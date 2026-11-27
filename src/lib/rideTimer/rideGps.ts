/**
 * GPS evidence for Start ride and End ride.
 *
 * The backend compares the fix sent with an action against the booked pickup
 * (start) or drop-off (end) and stores the result for admins reconciling trip
 * times. The driver must never be slowed down by it, so:
 *
 *  - every fix the app already gets (live trip sharing, the navigation map,
 *    the readiness check on the trip screen) is remembered here, which makes a
 *    fresh fix available the instant the driver taps;
 *  - only when nothing fresh and accurate is at hand do we ask the GPS, for a
 *    few seconds at most, and then go ahead with or without a fix;
 *  - a missing or denied location never blocks the action.
 */
import type { RideGps } from "../api/types";
import { toLagosLocalIso } from "../utils/lagosTime";
import { getDistanceMeters, isValidCoordinate, type MapCoordinate } from "../utils/geo";
import { getTrackerState, notifyLocationAvailable, subscribeToTracker } from "../tracking/tripLocationTracker";

/** Backend defaults (`tracking.arrival-radius-meters`, `tracking.max-accuracy-meters`). */
export const RIDE_GPS_RADIUS_METERS = 150;
export const RIDE_GPS_MAX_ACCURACY_METERS = 100;
/** A fix older than this at the tap is not used as the action's location. */
const FRESH_FIX_MS = 20_000;
/** Good enough to send at once without asking the GPS again. */
const GOOD_ACCURACY_METERS = 50;
/** Longest the driver waits for a fix after tapping. */
export const RIDE_GPS_WAIT_MS = 5_000;

export type RideFix = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
};

export type LocationPermission = "granted" | "prompt" | "denied" | "unsupported" | "unknown";

/* ------------------------------------------------------------------ shared store */
let lastFix: RideFix | null = null;
let permission: LocationPermission = "unknown";
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export const subscribeToRideFix = (listener: () => void) => {
  listeners.add(listener);
  const stopTracker = subscribeToTracker(listener);
  return () => {
    listeners.delete(listener);
    stopTracker();
  };
};

const isBetter = (next: RideFix, current: RideFix | null) => {
  if (!current) return true;
  // A newer fix wins unless it's much worse than one taken moments before.
  if (next.timestamp - current.timestamp > 5_000) return true;
  return (next.accuracy ?? Infinity) <= (current.accuracy ?? Infinity);
};

/** Remembers a fix from any GPS stream in the app. */
export const noteRideFix = (fix: RideFix) => {
  if (!isValidCoordinate(fix) || !Number.isFinite(fix.timestamp)) return;
  if (isBetter(fix, lastFix)) lastFix = fix;
  if (permission !== "granted") permission = "granted";
  // Proof location works again: live sharing can restart if it had been refused.
  notifyLocationAvailable();
  emit();
};

export const fixFromPosition = (position: GeolocationPosition): RideFix => ({
  latitude: position.coords.latitude,
  longitude: position.coords.longitude,
  accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
  timestamp: position.timestamp,
});

const setPermission = (next: LocationPermission) => {
  if (permission === next) return;
  permission = next;
  emit();
};

/** A GPS read was refused by the browser. */
export const noteLocationDenied = () => setPermission("denied");

/** Freshest known fix, from this store or the live trip tracker. */
export const getLatestRideFix = (): RideFix | null => {
  const tracked = getTrackerState().lastFix;
  const fromTracker: RideFix | null = tracked
    ? { latitude: tracked.latitude, longitude: tracked.longitude, accuracy: tracked.accuracy, timestamp: tracked.timestamp }
    : null;
  if (fromTracker && isBetter(fromTracker, lastFix)) return fromTracker;
  return lastFix ?? fromTracker;
};

export const getLocationPermission = (): LocationPermission => {
  if (typeof navigator === "undefined") return "unknown";
  if (!("geolocation" in navigator)) return "unsupported";
  // The browser's current answer (or a fix just received) beats the tracker's
  // memory of an earlier refusal: the driver may have turned location back on.
  if (permission === "granted" || permission === "denied") return permission;
  if (getTrackerState().problem === "permission") return "denied";
  return permission;
};

let permissionWatchStarted = false;
/** Follows the browser's permission state where the Permissions API exists. */
export const watchLocationPermission = () => {
  if (permissionWatchStarted || typeof navigator === "undefined" || !navigator.permissions?.query) return;
  permissionWatchStarted = true;
  navigator.permissions
    .query({ name: "geolocation" as PermissionName })
    .then((status) => {
      setPermission(status.state as LocationPermission);
      status.addEventListener("change", () => setPermission(status.state as LocationPermission));
    })
    .catch(() => undefined);
};

/* ------------------------------------------------------------------ one-off fix */
const requestFix = (timeoutMs: number) =>
  new Promise<RideFix | "denied" | null>((resolve) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      resolve(null);
      return;
    }
    let done = false;
    const finish = (value: RideFix | "denied" | null) => {
      if (done) return;
      done = true;
      resolve(value);
    };
    // The browser's own timeout doesn't cover the permission prompt; this does.
    const timer = setTimeout(() => finish(null), timeoutMs);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timer);
        const fix = fixFromPosition(position);
        noteRideFix(fix);
        finish(fix);
      },
      (error) => {
        clearTimeout(timer);
        if (error.code === error.PERMISSION_DENIED) {
          setPermission("denied");
          finish("denied");
        } else {
          finish(null);
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: timeoutMs },
    );
  });

const freshAt = (fix: RideFix | null, atMs: number) =>
  fix && Math.abs(atMs - fix.timestamp) <= FRESH_FIX_MS ? fix : null;

export type RideGpsCapture = { gps: RideGps | null; denied: boolean };

const toRideGps = (fix: RideFix): RideGps => ({
  latitude: fix.latitude,
  longitude: fix.longitude,
  // The backend treats a missing accuracy as ACCURACY_UNKNOWN.
  ...(fix.accuracy !== null ? { accuracyMeters: Math.round(fix.accuracy * 10) / 10 } : {}),
  capturedTime: toLagosLocalIso(new Date(fix.timestamp)),
});

/**
 * The best fix for an action tapped at `tapAtMs`: an already fresh, accurate
 * one straight away; otherwise a new reading within `waitMs`.
 */
export const captureRideGps = async (tapAtMs: number, waitMs = RIDE_GPS_WAIT_MS): Promise<RideGpsCapture> => {
  if (getLocationPermission() === "unsupported") return { gps: null, denied: false };

  const known = freshAt(getLatestRideFix(), tapAtMs);
  if (known && known.accuracy !== null && known.accuracy <= GOOD_ACCURACY_METERS) {
    return { gps: toRideGps(known), denied: false };
  }

  const fresh = await requestFix(waitMs);
  if (fresh === "denied") {
    return { gps: known ? toRideGps(known) : null, denied: !known };
  }

  const candidates = [known, fresh].filter((fix): fix is RideFix => fix !== null);
  if (candidates.length === 0) return { gps: null, denied: false };
  const best = candidates.reduce((a, b) => ((b.accuracy ?? Infinity) < (a.accuracy ?? Infinity) ? b : a));
  return { gps: toRideGps(best), denied: false };
};

/* ------------------------------------------------------------------ readiness */
export type RideLocationStatus =
  | { kind: "unsupported" }
  | { kind: "denied" }
  | { kind: "locating" }
  | { kind: "unavailable" }
  | { kind: "weak"; accuracy: number | null; distanceMeters: number | null }
  | { kind: "ready"; accuracy: number | null; distanceMeters: number | null };

/** What the driver's location says about one target (pickup or drop-off). */
export const describeRideLocation = (
  target: MapCoordinate | null | undefined,
  nowMs = Date.now(),
  gpsUnavailable = false,
): RideLocationStatus => {
  const allowed = getLocationPermission();
  if (allowed === "unsupported") return { kind: "unsupported" };
  const fix = freshAt(getLatestRideFix(), nowMs);
  if (!fix) {
    if (allowed === "denied") return { kind: "denied" };
    return gpsUnavailable ? { kind: "unavailable" } : { kind: "locating" };
  }
  const distanceMeters = isValidCoordinate(target) ? getDistanceMeters(fix, target) : null;
  const weak = fix.accuracy === null || fix.accuracy > RIDE_GPS_MAX_ACCURACY_METERS;
  return { kind: weak ? "weak" : "ready", accuracy: fix.accuracy, distanceMeters };
};
