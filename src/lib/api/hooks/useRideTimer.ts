"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { useToast } from "@/providers/ToastProvider";

import { apiFetchClient } from "../client";
import type {
  DriverScheduleResponse,
  DriverTripDetails,
  DriverTripDetailsResponse,
  DriverTripStatus,
  RideAction,
  RidePauseReason,
  RideTimer,
} from "../types";
import { syncTrackingWithStatus } from "../../tracking/useTripTracker";
import { isPreRideStatus } from "../../rideTimer/rideClock";
import {
  enqueueRideAction,
  flushRideActions,
  getQueuedRideActions,
  subscribeToRideActionQueue,
  type QueuedRideAction,
  type RideActionOutcome,
} from "../../rideTimer/rideActionQueue";
import { parseLagosMs, toLagosLocalIso } from "../../utils/lagosTime";
import { isAppKnownOffline } from "../../utils/networkStatus";

export const DRIVER_SCHEDULE_PATH = "/driver-app/schedule";
export const DRIVER_SCHEDULE_QUERY_KEY = ["driver-schedule"] as const;

const EMPTY_TIMER: RideTimer = { paused: false };

const reportedAtLagos = (item: QueuedRideAction) =>
  toLagosLocalIso(new Date(item.body.reportedAt ?? item.createdAt));

/**
 * The server's `pauses` lists every pause, the open one included (it is also
 * `currentPause`). Closes the open pause in that list, adding it if missing.
 */
const closeOpenPause = (base: RideTimer, at: string) => {
  const open = base.currentPause;
  const pauses = base.pauses ?? [];
  if (!open) return pauses;
  const closed = { ...open, resumedAt: at };
  return pauses.some((pause) => pause.id === open.id)
    ? pauses.map((pause) => (pause.id === open.id ? closed : pause))
    : [...pauses, closed];
};

/** The timer as it will be once the server has applied `item`. */
export const applyRideActionToTimer = (timer: RideTimer | null | undefined, item: QueuedRideAction): RideTimer => {
  const base = timer ?? EMPTY_TIMER;
  const at = reportedAtLagos(item);

  switch (item.action) {
    case "start":
      return base.actualStartAt ? base : { ...base, actualStartAt: at, startMethod: "DRIVER", paused: false };
    case "pause":
      if (base.paused || base.actualEndAt) return base;
      {
        const currentPause = {
          id: item.id,
          pausedAt: at,
          resumedAt: null,
          reason: item.body.reason ?? "OTHER",
          note: item.body.note ?? null,
        };
        return { ...base, paused: true, currentPause, pauses: [...(base.pauses ?? []), currentPause] };
      }
    case "resume":
      if (!base.paused) return base;
      return {
        ...base,
        paused: false,
        currentPause: null,
        pauses: closeOpenPause(base, at),
      };
    case "end": {
      if (base.actualEndAt) return base;
      const bookedEndMs = parseLagosMs(base.bookedEndAt);
      const endMs = parseLagosMs(at) ?? Date.now();
      return {
        ...base,
        actualStartAt: base.actualStartAt ?? at,
        actualEndAt: at,
        endMethod: "DRIVER",
        paused: false,
        currentPause: null,
        pauses: closeOpenPause(base, at),
        extraTimeMinutes: bookedEndMs !== undefined ? Math.max(0, Math.floor((endMs - bookedEndMs) / 60000)) : 0,
        inExtraTime: false,
      };
    }
  }
};

const statusAfterAction = (current: DriverTripStatus | null | undefined, action: RideAction): DriverTripStatus | undefined => {
  if (action === "start" && (isPreRideStatus(current) || !current)) return "ONGOING";
  if (action === "end") return "COMPLETE";
  return current ?? undefined;
};

const applyRideActionToDetails = (details: DriverTripDetails, item: QueuedRideAction): DriverTripDetails => {
  const nextStatus = statusAfterAction(details.driverTripStatus, item.action);

  return {
    ...details,
    rideTimer: applyRideActionToTimer(details.rideTimer, item),
    driverTripStatus: nextStatus ?? details.driverTripStatus,
    standardTripStatus: item.action === "end" ? "COMPLETED" : details.standardTripStatus,
  };
};

const useQueuedRideActions = () =>
  useSyncExternalStore(subscribeToRideActionQueue, getQueuedRideActions, () => EMPTY_QUEUE);
const EMPTY_QUEUE: QueuedRideAction[] = [];

/**
 * Trip details with any not-yet-sent ride actions applied on top, so the
 * timer and status reflect what the driver did even while offline.
 */
export const useTripWithQueuedRideActions = (tripId: string, details?: DriverTripDetails) => {
  const queue = useQueuedRideActions();

  return useMemo(() => {
    const pending = queue.filter((item) => item.tripId === tripId);
    return {
      details: details ? pending.reduce(applyRideActionToDetails, details) : undefined,
      pendingCount: pending.length,
    };
  }, [details, queue, tripId]);
};

/** Writes the server's timer (and the matching status) into the cached trip. */
export const applySentRideAction = (queryClient: QueryClient, item: QueuedRideAction, timer: RideTimer) => {
  queryClient.setQueryData<DriverTripDetailsResponse>(["driver-trip", item.tripId], (current) => {
    if (!current?.data) return current;
    const nextStatus = statusAfterAction(current.data.driverTripStatus, item.action);
    return {
      ...current,
      data: {
        ...current.data,
        rideTimer: timer,
        driverTripStatus: nextStatus ?? current.data.driverTripStatus,
        standardTripStatus: item.action === "end" ? "COMPLETED" : current.data.standardTripStatus,
      },
    };
  });
};

export const invalidateAfterRideOutcomes = (queryClient: QueryClient, outcomes: RideActionOutcome[]) => {
  const tripIds = new Set(outcomes.map((outcome) => outcome.item.tripId));

  tripIds.forEach((tripId) => {
    void queryClient.invalidateQueries({ queryKey: ["driver-trip", tripId] });
  });

  if (tripIds.size > 0) {
    void queryClient.invalidateQueries({ queryKey: ["driver-trips"] });
    void queryClient.invalidateQueries({ queryKey: ["driver-trip-statistics"] });
    void queryClient.invalidateQueries({ queryKey: ["driver-payments"] });
  }
};

export const RIDE_ACTION_ERROR_TITLES: Record<RideAction, string> = {
  start: "Couldn't start the ride",
  pause: "Couldn't pause the ride",
  resume: "Couldn't resume the ride",
  end: "Couldn't end the ride",
};

const OFFLINE_SAVED_MESSAGE = "Saved on this phone with the time you tapped. It will be sent when you're back online.";

/**
 * Start / pause / resume / end for one trip. Each action goes through the
 * persistent queue, so it survives going offline or closing the app.
 */
export const useRideActions = (tripId: string) => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [pendingAction, setPendingAction] = useState<RideAction | null>(null);

  const run = useCallback(
    async (action: RideAction, body: { reason?: RidePauseReason; note?: string } = {}) => {
      if (!tripId) return { ok: false as const };

      const item = enqueueRideAction(tripId, action, body);

      // Location sharing follows the ride, even before the server confirms.
      if (action === "start") syncTrackingWithStatus(tripId, "ONGOING");
      if (action === "end") syncTrackingWithStatus(tripId, "COMPLETE");

      if (isAppKnownOffline()) {
        toast.info("Saved offline", OFFLINE_SAVED_MESSAGE);
        return { ok: true as const, queued: true };
      }

      setPendingAction(action);

      try {
        const outcomes = await flushRideActions((sent, timer) => applySentRideAction(queryClient, sent, timer));
        invalidateAfterRideOutcomes(queryClient, outcomes);
        outcomes
          .filter((outcome) => outcome.type === "rejected" && outcome.item.id !== item.id)
          .forEach((outcome) => {
            if (outcome.type === "rejected") toast.error(RIDE_ACTION_ERROR_TITLES[outcome.item.action], outcome.message);
          });

        const mine = outcomes.find((outcome) => outcome.item.id === item.id);

        if (!mine) {
          toast.info("Saved offline", OFFLINE_SAVED_MESSAGE);
          return { ok: true as const, queued: true };
        }

        if (mine.type === "rejected") {
          toast.error(RIDE_ACTION_ERROR_TITLES[action], mine.message);
          return { ok: false as const };
        }

        return { ok: true as const, queued: false, timer: mine.timer };
      } finally {
        setPendingAction(null);
      }
    },
    [queryClient, toast, tripId],
  );

  return { run, pendingAction };
};

/* ------------------------------------------------------------------ schedule */
export const useDriverSchedule = (weeks = 2) =>
  useQuery<DriverScheduleResponse, Error>({
    queryKey: [...DRIVER_SCHEDULE_QUERY_KEY, weeks],
    queryFn: async () => {
      const response = await apiFetchClient.get<DriverScheduleResponse>(`${DRIVER_SCHEDULE_PATH}?weeks=${weeks}`);
      return response.data;
    },
    staleTime: 5 * 60_000,
  });
