"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import type { MapCoordinate } from "../utils/geo";
import { getTrackerState } from "../tracking/tripLocationTracker";
import {
  describeRideLocation,
  fixFromPosition,
  getLatestRideFix,
  getLocationPermission,
  noteLocationDenied,
  noteRideFix,
  subscribeToRideFix,
  watchLocationPermission,
  type RideLocationStatus,
} from "./rideGps";

const subscribeVersion = (listener: () => void) => subscribeToRideFix(listener);
const getSnapshot = () => `${getLatestRideFix()?.timestamp ?? 0}|${getLocationPermission()}`;
const getServerSnapshot = () => "0|unknown";

/**
 * The driver's location against a ride target (pickup for Start, drop-off for
 * End), kept warm while `active` so the tap itself never waits for GPS.
 *
 * It only watches the GPS by itself once location is already allowed: the
 * browser's permission prompt should come from a tap on "Allow location", not
 * appear out of nowhere when a screen opens.
 */
export const useRideLocation = (target: MapCoordinate | null | undefined, active: boolean) => {
  useSyncExternalStore(subscribeVersion, getSnapshot, getServerSnapshot);
  const permission = useSyncExternalStore(subscribeVersion, getLocationPermission, () => "unknown" as const);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [asked, setAsked] = useState(false);
  // The GPS answered but had no position (indoors, timeout).
  const [gpsUnavailable, setGpsUnavailable] = useState(false);

  useEffect(() => {
    watchLocationPermission();
  }, []);

  // Re-evaluate freshness even when no new fix arrives.
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 5_000);
    return () => window.clearInterval(id);
  }, [active]);

  const canWatch = active && (permission === "granted" || asked);
  useEffect(() => {
    if (!canWatch || typeof navigator === "undefined" || !("geolocation" in navigator)) return;
    // Live trip sharing already streams fixes into the store for its trip.
    if (getTrackerState().status === "sharing") return;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        noteRideFix(fixFromPosition(position));
        setGpsUnavailable(false);
        setNowMs(Date.now());
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) noteLocationDenied();
        else setGpsUnavailable(true);
        setNowMs(Date.now());
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [canWatch]);

  const status: RideLocationStatus = describeRideLocation(target, nowMs, gpsUnavailable);
  const needsPrompt = !asked && (permission === "prompt" || permission === "unknown") && status.kind === "locating";
  const requestPermission = useCallback(() => setAsked(true), []);

  return { status, needsPrompt, requestPermission };
};
