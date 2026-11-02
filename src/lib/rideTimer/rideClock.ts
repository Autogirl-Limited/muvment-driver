"use client";

import { useEffect, useMemo, useState } from "react";

import type { DriverTripStatus, RideTimer } from "../api/types";
import { parseLagosMs } from "../utils/lagosTime";

/** Statuses from which the driver can start the ride (or the server auto-starts it). */
export const PRE_RIDE_STATUSES: readonly DriverTripStatus[] = [
  "NOT_STARTED",
  "CHECKED_IN",
  "AWAITING_PICKUP",
  "RUNNING_LATE",
];

export const RIDING_STATUSES: readonly DriverTripStatus[] = ["ONGOING", "EXTRA_TIME"];

export const isPreRideStatus = (status?: DriverTripStatus | null) => !!status && PRE_RIDE_STATUSES.includes(status);
export const isRidingStatus = (status?: DriverTripStatus | null) => !!status && RIDING_STATUSES.includes(status);

/** Seconds of the "Ride starting in 3, 2, 1" countdown before an auto-start. */
export const AUTO_START_COUNTDOWN_SECONDS = 3;

export type RideClockPhase = "NOT_STARTED" | "RUNNING" | "EXTRA_TIME" | "PAUSED" | "ENDED";

export interface RideClock {
  phase: RideClockPhase;
  /** Seconds until the booked end (RUNNING/PAUSED). */
  secondsLeft: number;
  /** Seconds past the booked end (EXTRA_TIME, or PAUSED after the end). */
  extraSeconds: number;
  /** Seconds until the booked start; negative once it has passed. */
  secondsToStart?: number;
  pastBookedEnd: boolean;
}

export const computeRideClock = (timer: RideTimer | null | undefined, nowMs: number): RideClock => {
  const bookedStartMs = parseLagosMs(timer?.bookedStartAt);
  const bookedEndMs = parseLagosMs(timer?.bookedEndAt);
  const secondsToStart = bookedStartMs !== undefined ? Math.ceil((bookedStartMs - nowMs) / 1000) : undefined;

  if (!timer?.actualStartAt) {
    return { phase: "NOT_STARTED", secondsLeft: 0, extraSeconds: 0, secondsToStart, pastBookedEnd: false };
  }

  if (timer.actualEndAt) {
    const endMs = parseLagosMs(timer.actualEndAt) ?? nowMs;
    const extraSeconds =
      timer.extraTimeMinutes !== null && timer.extraTimeMinutes !== undefined
        ? timer.extraTimeMinutes * 60
        : bookedEndMs !== undefined
          ? Math.max(0, Math.floor((endMs - bookedEndMs) / 1000))
          : 0;

    return { phase: "ENDED", secondsLeft: 0, extraSeconds, secondsToStart, pastBookedEnd: extraSeconds > 0 };
  }

  const diffSeconds = bookedEndMs !== undefined ? Math.floor((bookedEndMs - nowMs) / 1000) : 0;
  const pastBookedEnd = bookedEndMs !== undefined && diffSeconds < 0;
  const secondsLeft = Math.max(0, diffSeconds);
  const extraSeconds = pastBookedEnd ? -diffSeconds : 0;

  if (timer.paused) {
    return { phase: "PAUSED", secondsLeft, extraSeconds, secondsToStart, pastBookedEnd };
  }

  return {
    phase: pastBookedEnd ? "EXTRA_TIME" : "RUNNING",
    secondsLeft,
    extraSeconds,
    secondsToStart,
    pastBookedEnd,
  };
};

/**
 * Ticks once a second while `active`, returning "now" corrected by the
 * server's clock: `serverNow` is the Lagos wall clock when the response was
 * built, `receivedAt` is the device time the response arrived
 * (TanStack's dataUpdatedAt).
 */
export const useServerNow = ({
  active,
  receivedAt,
  serverNow,
}: {
  active: boolean;
  receivedAt?: number;
  serverNow?: string | null;
}) => {
  const skewMs = useMemo(() => {
    const serverMs = parseLagosMs(serverNow);

    if (serverMs === undefined || !receivedAt) {
      return 0;
    }

    return serverMs - receivedAt;
  }, [receivedAt, serverNow]);
  const [deviceNow, setDeviceNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) {
      return;
    }

    setDeviceNow(Date.now());
    const interval = window.setInterval(() => setDeviceNow(Date.now()), 1000);

    return () => window.clearInterval(interval);
  }, [active]);

  return deviceNow + skewMs;
};
