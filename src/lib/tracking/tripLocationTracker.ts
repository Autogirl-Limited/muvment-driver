import { apiFetchClient, ApiRequestError } from "../api/client";
import type { DriverTripDetailsResponse } from "../api/types";
import { getResolvedDriverTripDetailsStatus } from "../utils/driverTrips";
import { isAppKnownOffline } from "../utils/networkStatus";
import { storage } from "../utils/storage";

/** Shares the driver's foreground GPS with the passenger while a trip is active. */
const ACTIVE_TRIP_KEY = "tracking.activeTripId";
const MAX_BUFFERED_FIXES = 120;
const DEFAULT_UPLOAD_INTERVAL_MS = 5_000;
const MAX_BACKOFF_MS = 60_000;
const SHARING_STATUSES = ["CHECKED_IN", "AWAITING_PICKUP", "RUNNING_LATE", "ONGOING", "EXTRA_TIME"] as const;

export type TrackerMode = "foreground";
export type TrackerProblem = "permission" | "unavailable" | "unsupported" | "offline" | "server" | null;
export type DriverFix = {
  latitude: number;
  longitude: number;
  heading: number | null;
  speed: number | null;
  accuracy: number | null;
  timestamp: number;
};
export type TrackerState = {
  tripId: string | null;
  status: "idle" | "starting" | "sharing";
  mode: TrackerMode | null;
  problem: TrackerProblem;
  lastFix: DriverFix | null;
  lastUploadAt: number | null;
  pendingFixes: number;
  phase: string | null;
};
type LocationIngestResponse = {
  data: { accepted: number; trackingActive: boolean; phase: string; nextUploadIntervalSeconds: number };
};
type Sample = Omit<DriverFix, "timestamp"> & { recordedAt: number };
type TrackingSession = {
  id: number;
  tripId: string;
  buffer: Sample[];
  nextUploadAt: number;
  consecutiveFailures: number;
  inFlight: Promise<void> | null;
};

let state: TrackerState = {
  tripId: null,
  status: "idle",
  mode: null,
  problem: null,
  lastFix: null,
  lastUploadAt: null,
  pendingFixes: 0,
  phase: null,
};
const listeners = new Set<() => void>();
let activeSession: TrackingSession | null = null;
let nextSessionId = 1;
let watchId: number | null = null;
let flushTimer: ReturnType<typeof setInterval> | null = null;

const setState = (patch: Partial<TrackerState>) => {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
};
const isActiveSession = (session: TrackingSession) => activeSession?.id === session.id;
export const getTrackerState = () => state;
export const subscribeToTracker = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const finiteOrNull = (value: number | null, minimum = Number.NEGATIVE_INFINITY) =>
  value !== null && Number.isFinite(value) && value >= minimum ? value : null;

const toSample = ({ coords, timestamp }: GeolocationPosition): Sample | null => {
  if (
    !Number.isFinite(coords.latitude) || coords.latitude < -90 || coords.latitude > 90 ||
    !Number.isFinite(coords.longitude) || coords.longitude < -180 || coords.longitude > 180 ||
    !Number.isFinite(timestamp) || timestamp <= 0
  ) return null;
  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    heading: finiteOrNull(coords.heading, 0),
    speed: finiteOrNull(coords.speed, 0),
    accuracy: finiteOrNull(coords.accuracy, 0),
    recordedAt: Math.round(timestamp),
  };
};
const uploadPath = (tripId: string) => `/driver-app/trips/${encodeURIComponent(tripId)}/locations`;
const tripPath = (tripId: string) => `/driver-app/trips/${encodeURIComponent(tripId)}`;

const stopWatch = () => {
  if (watchId !== null && typeof navigator !== "undefined" && "geolocation" in navigator) {
    navigator.geolocation.clearWatch(watchId);
  }
  watchId = null;
};
const clearFlushTimer = () => {
  if (flushTimer) clearInterval(flushTimer);
  flushTimer = null;
};
const resetState = () => {
  storage.remove(ACTIVE_TRIP_KEY);
  setState({ tripId: null, status: "idle", mode: null, problem: null, lastFix: null, pendingFixes: 0, phase: null });
};

const deactivateSession = (session: TrackingSession) => {
  if (!isActiveSession(session)) return;
  activeSession = null;
  stopWatch();
  clearFlushTimer();
  resetState();
};

const stopSession = async (session: TrackingSession, drain: boolean) => {
  deactivateSession(session);
  await session.inFlight?.catch(() => undefined);
  if (drain && session.buffer.length > 0 && !isAppKnownOffline()) {
    await apiFetchClient.post(uploadPath(session.tripId), { samples: session.buffer.slice(-MAX_BUFFERED_FIXES) }).catch(() => undefined);
  }
  session.buffer = [];
};

const flushSession = async (session: TrackingSession, force = false): Promise<void> => {
  if (session.inFlight) return session.inFlight;
  if (!isActiveSession(session) || session.buffer.length === 0) return;
  if (!force && Date.now() < session.nextUploadAt) return;
  if (isAppKnownOffline()) {
    setState({ problem: "offline" });
    return;
  }
  const batch = session.buffer.slice(0, MAX_BUFFERED_FIXES);
  session.inFlight = (async () => {
    try {
      const response = await apiFetchClient.post<LocationIngestResponse, { samples: Sample[] }>(
        uploadPath(session.tripId), { samples: batch },
      );
      if (!isActiveSession(session)) return;
      session.buffer.splice(0, batch.length);
      session.consecutiveFailures = 0;
      const result = response.data?.data;
      session.nextUploadAt = Date.now() + Math.max(1, result?.nextUploadIntervalSeconds ?? 5) * 1000;
      setState({ lastUploadAt: Date.now(), pendingFixes: session.buffer.length, phase: result?.phase ?? state.phase, problem: null });
      if (result && (!result.trackingActive || result.nextUploadIntervalSeconds === 0)) {
        deactivateSession(session);
        session.buffer = [];
      }
    } catch (error) {
      if (!isActiveSession(session)) return;
      const status = error instanceof ApiRequestError ? error.status : undefined;
      if (status === 403 || status === 404) {
        deactivateSession(session);
        session.buffer = [];
        return;
      }
      if (status === 400) session.buffer.splice(0, batch.length);
      session.consecutiveFailures += 1;
      session.nextUploadAt = Date.now() + Math.min(MAX_BACKOFF_MS, DEFAULT_UPLOAD_INTERVAL_MS * 2 ** (session.consecutiveFailures - 1));
      setState({ problem: isAppKnownOffline() ? "offline" : "server", pendingFixes: session.buffer.length });
    } finally {
      session.inFlight = null;
    }
  })();
  return session.inFlight;
};

export const flushTripLocations = async (force = false) => {
  if (activeSession) await flushSession(activeSession, force);
};
const handlePosition = (session: TrackingSession, position: GeolocationPosition) => {
  if (!isActiveSession(session)) return;
  const sample = toSample(position);
  if (!sample) {
    setState({ problem: "unavailable" });
    return;
  }
  session.buffer.push(sample);
  if (session.buffer.length > MAX_BUFFERED_FIXES) session.buffer.splice(0, session.buffer.length - MAX_BUFFERED_FIXES);
  setState({
    status: "sharing", problem: null, pendingFixes: session.buffer.length,
    lastFix: { latitude: sample.latitude, longitude: sample.longitude, heading: sample.heading, speed: sample.speed, accuracy: sample.accuracy, timestamp: sample.recordedAt },
  });
  void flushSession(session);
};
const ensureFlushTimer = () => {
  if (!flushTimer) flushTimer = setInterval(() => void flushTripLocations(), 3_000);
};

export const startTripTracking = async (tripId: string): Promise<void> => {
  const normalizedTripId = tripId.trim();
  if (typeof navigator === "undefined" || !normalizedTripId) return;
  if (activeSession?.tripId === normalizedTripId) return;
  if (activeSession) await stopSession(activeSession, true);
  const session: TrackingSession = { id: nextSessionId++, tripId: normalizedTripId, buffer: [], nextUploadAt: 0, consecutiveFailures: 0, inFlight: null };
  activeSession = session;
  setState({ tripId: normalizedTripId, status: "starting", mode: null, problem: null, lastFix: null, pendingFixes: 0, phase: null });
  if (!("geolocation" in navigator)) {
    activeSession = null;
    setState({ tripId: null, status: "idle", problem: "unsupported" });
    storage.remove(ACTIVE_TRIP_KEY);
    return;
  }
  storage.set(ACTIVE_TRIP_KEY, normalizedTripId);
  ensureFlushTimer();
  stopWatch();
  watchId = navigator.geolocation.watchPosition(
    (position) => handlePosition(session, position),
    (error) => {
      if (!isActiveSession(session)) return;
      if (error.code === error.PERMISSION_DENIED) storage.remove(ACTIVE_TRIP_KEY);
      setState({ problem: error.code === error.PERMISSION_DENIED ? "permission" : "unavailable" });
    },
    { enableHighAccuracy: true, maximumAge: 2_000, timeout: 20_000 },
  );
  setState({ mode: "foreground" });
};

export const stopTripTracking = async (): Promise<void> => {
  if (activeSession) await stopSession(activeSession, true);
  else {
    stopWatch();
    clearFlushTimer();
    resetState();
  }
};

/** Revalidates the persisted trip before requesting high-accuracy location. */
export const resumeTripTrackingIfNeeded = async () => {
  const storedTripId = storage.get(ACTIVE_TRIP_KEY)?.trim();
  if (!storedTripId) return;
  try {
    const response = await apiFetchClient.get<DriverTripDetailsResponse>(tripPath(storedTripId));
    const status = getResolvedDriverTripDetailsStatus(response.data.data);
    if (SHARING_STATUSES.some((candidate) => candidate === status)) await startTripTracking(storedTripId);
    else storage.remove(ACTIVE_TRIP_KEY);
  } catch (error) {
    if (error instanceof ApiRequestError && (error.status === 403 || error.status === 404)) storage.remove(ACTIVE_TRIP_KEY);
  }
};

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void flushTripLocations(true);
  });
  window.addEventListener("online", () => void flushTripLocations(true));
}
