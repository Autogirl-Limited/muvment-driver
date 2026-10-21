import { apiFetchClient, ApiRequestError } from "../api/client";
import { isAppKnownOffline } from "../utils/networkStatus";
import { storage } from "../utils/storage";

/**
 * Shares the driver's GPS with the passenger's live map while a trip is active.
 *
 * Fixes are buffered and uploaded in batches to POST /driver-app/trips/{id}/locations at the
 * cadence the server asks for. Offline, the newest 120 fixes are kept and flushed on reconnect.
 *
 * Web limitation: browsers only deliver geolocation while the tab is open and in the
 * foreground (there is no background location API for PWAs). The tracker therefore runs in
 * "foreground" mode only and tells the driver to keep the app open.
 */

const ACTIVE_TRIP_KEY = "tracking.activeTripId";
const MAX_BUFFERED_FIXES = 120;
const DEFAULT_UPLOAD_INTERVAL_MS = 5_000;
const MAX_BACKOFF_MS = 60_000;

export type TrackerMode = "foreground";

export type TrackerProblem = "permission" | "unsupported" | "offline" | "server" | null;

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
  data: {
    accepted: number;
    trackingActive: boolean;
    phase: string;
    nextUploadIntervalSeconds: number;
  };
};

type Sample = {
  latitude: number;
  longitude: number;
  heading: number | null;
  speed: number | null;
  accuracy: number | null;
  recordedAt: number;
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
let buffer: Sample[] = [];
let uploadIntervalMs = DEFAULT_UPLOAD_INTERVAL_MS;
let nextUploadAt = 0;
let consecutiveFailures = 0;
let inFlight: Promise<void> | null = null;
let watchId: number | null = null;
let flushTimer: ReturnType<typeof setInterval> | null = null;

const setState = (patch: Partial<TrackerState>) => {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
};

export const getTrackerState = () => state;

export const subscribeToTracker = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const toSample = (position: GeolocationPosition): Sample => {
  const { coords, timestamp } = position;
  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    heading: coords.heading != null && coords.heading >= 0 && Number.isFinite(coords.heading) ? coords.heading : null,
    speed: coords.speed != null && coords.speed >= 0 ? coords.speed : null,
    accuracy: coords.accuracy ?? null,
    recordedAt: Math.round(timestamp),
  };
};

const handlePosition = (position: GeolocationPosition) => {
  if (!state.tripId) {
    return;
  }
  const sample = toSample(position);
  buffer.push(sample);
  if (buffer.length > MAX_BUFFERED_FIXES) {
    buffer = buffer.slice(buffer.length - MAX_BUFFERED_FIXES);
  }
  setState({
    status: "sharing",
    pendingFixes: buffer.length,
    lastFix: {
      latitude: sample.latitude,
      longitude: sample.longitude,
      heading: sample.heading,
      speed: sample.speed,
      accuracy: sample.accuracy,
      timestamp: sample.recordedAt,
    },
  });
  void flushTripLocations();
};

const uploadPath = (tripId: string) => `/driver-app/trips/${encodeURIComponent(tripId)}/locations`;

export const flushTripLocations = async (force = false): Promise<void> => {
  if (inFlight) {
    return inFlight;
  }
  const tripId = state.tripId;
  if (!tripId || buffer.length === 0) {
    return;
  }
  if (!force && Date.now() < nextUploadAt) {
    return;
  }
  if (isAppKnownOffline()) {
    setState({ problem: "offline" });
    return;
  }

  const batch = buffer.slice(0, MAX_BUFFERED_FIXES);
  inFlight = (async () => {
    try {
      const response = await apiFetchClient.post<LocationIngestResponse, { samples: Sample[] }>(
        uploadPath(tripId),
        { samples: batch },
      );
      buffer = buffer.slice(batch.length);
      consecutiveFailures = 0;
      const result = response.data?.data;
      uploadIntervalMs = Math.max(1, result?.nextUploadIntervalSeconds ?? 5) * 1000;
      nextUploadAt = Date.now() + uploadIntervalMs;
      setState({
        lastUploadAt: Date.now(),
        pendingFixes: buffer.length,
        phase: result?.phase ?? state.phase,
        problem: null,
      });
      if (result && (!result.trackingActive || result.nextUploadIntervalSeconds === 0)) {
        await stopTripTracking();
      }
    } catch (error) {
      const status = error instanceof ApiRequestError ? error.status : undefined;
      if (status === 404 || status === 403) {
        await stopTripTracking();
        return;
      }
      if (status === 400) {
        buffer = buffer.slice(batch.length);
      }
      consecutiveFailures += 1;
      nextUploadAt =
        Date.now() + Math.min(MAX_BACKOFF_MS, DEFAULT_UPLOAD_INTERVAL_MS * 2 ** (consecutiveFailures - 1));
      setState({ problem: isAppKnownOffline() ? "offline" : "server", pendingFixes: buffer.length });
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
};

const ensureFlushTimer = () => {
  if (flushTimer) {
    return;
  }
  flushTimer = setInterval(() => void flushTripLocations(), 3_000);
};

const clearFlushTimer = () => {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
};

const stopWatch = () => {
  if (watchId !== null && typeof navigator !== "undefined") {
    navigator.geolocation.clearWatch(watchId);
  }
  watchId = null;
};

/**
 * Starts sharing for a trip. Idempotent: calling it again for the same trip does nothing;
 * calling it for another trip switches over. Never throws; problems surface in the state.
 */
export const startTripTracking = async (tripId: string): Promise<void> => {
  if (typeof navigator === "undefined") {
    return;
  }
  if (state.tripId === tripId && state.status !== "idle") {
    return;
  }
  const switchingTrip = state.tripId !== null && state.tripId !== tripId;
  if (switchingTrip) {
    await stopTripTracking();
  }
  if (switchingTrip || state.tripId === null) {
    buffer = [];
  }
  consecutiveFailures = 0;
  nextUploadAt = 0;
  setState({ tripId, status: "starting", problem: null, pendingFixes: buffer.length });
  storage.set(ACTIVE_TRIP_KEY, tripId);

  if (!("geolocation" in navigator)) {
    setState({ problem: "unsupported" });
    return;
  }

  ensureFlushTimer();
  stopWatch();
  watchId = navigator.geolocation.watchPosition(
    (position) => {
      if (state.problem === "permission") {
        setState({ problem: null });
      }
      handlePosition(position);
    },
    (error) => {
      if (error.code === error.PERMISSION_DENIED) {
        setState({ problem: "permission" });
      }
    },
    { enableHighAccuracy: true, maximumAge: 2_000, timeout: 20_000 },
  );
  setState({ mode: "foreground" });
};

/** Stops sharing, sends whatever is still queued, and forgets the trip. */
export const stopTripTracking = async (): Promise<void> => {
  const hadTrip = state.tripId;
  stopWatch();
  clearFlushTimer();
  if (hadTrip && buffer.length > 0 && !inFlight) {
    await apiFetchClient
      .post(uploadPath(hadTrip), { samples: buffer.slice(-MAX_BUFFERED_FIXES) })
      .catch(() => undefined);
  }
  buffer = [];
  storage.remove(ACTIVE_TRIP_KEY);
  setState({
    tripId: null,
    status: "idle",
    mode: null,
    problem: null,
    pendingFixes: 0,
    phase: null,
  });
};

/** On app start: continue sharing for a trip that was active when the tab was closed. */
export const resumeTripTrackingIfNeeded = async () => {
  const storedTripId = storage.get(ACTIVE_TRIP_KEY);
  if (storedTripId) {
    await startTripTracking(storedTripId);
  }
};

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && state.tripId) {
      void flushTripLocations(true);
    }
  });
  window.addEventListener("online", () => {
    if (state.tripId) {
      void flushTripLocations(true);
    }
  });
}
