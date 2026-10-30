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
    } else if (getTrackerState().tripId === tripId) {
      void stopTripTracking();
    }
  }, [tripId, status]);
};

/** Called after the driver changes a trip's status. */
export const syncTrackingWithStatus = (tripId: string, status: DriverTripStatus) => {
  if (isSharingStatus(status)) {
    void startTripTracking(tripId);
  } else if (getTrackerState().tripId === tripId) {
    void stopTripTracking();
  }
};
