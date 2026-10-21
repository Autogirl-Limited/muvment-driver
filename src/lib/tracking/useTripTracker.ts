import { useEffect, useSyncExternalStore } from "react";

import type { DriverTripStatus } from "../api/types";
import {
  getTrackerState,
  startTripTracking,
  stopTripTracking,
  subscribeToTracker,
  type TrackerState,
} from "./tripLocationTracker";

/** Driver statuses during which the passenger can follow the car. */
export const SHARING_STATUSES: readonly DriverTripStatus[] = [
  "CHECKED_IN",
  "AWAITING_PICKUP",
  "RUNNING_LATE",
  "ONGOING",
  "EXTRA_TIME",
];

const FINISHED_STATUSES: readonly DriverTripStatus[] = ["COMPLETE", "CANCELLED"];

export const isSharingStatus = (status?: DriverTripStatus | null) =>
  !!status && SHARING_STATUSES.includes(status);

export const useTripTracker = (): TrackerState =>
  useSyncExternalStore(subscribeToTracker, getTrackerState, getTrackerState);

/** Keeps location sharing in step with a trip's status. */
export const useEnsureTripTracking = (tripId?: string, status?: DriverTripStatus | null) => {
  useEffect(() => {
    if (!tripId || !status) {
      return;
    }
    if (isSharingStatus(status)) {
      void startTripTracking(tripId);
    } else if (FINISHED_STATUSES.includes(status) && getTrackerState().tripId === tripId) {
      void stopTripTracking();
    }
  }, [tripId, status]);
};

/** Called after the driver changes a trip's status. */
export const syncTrackingWithStatus = (tripId: string, status: DriverTripStatus) => {
  if (isSharingStatus(status)) {
    void startTripTracking(tripId);
  } else if (FINISHED_STATUSES.includes(status) && getTrackerState().tripId === tripId) {
    void stopTripTracking();
  }
};
