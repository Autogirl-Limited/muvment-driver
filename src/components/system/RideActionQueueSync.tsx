"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
  applySentRideAction,
  invalidateAfterRideOutcomes,
  RIDE_ACTION_ERROR_TITLES,
} from "@/lib/api/hooks/useRideTimer";
import { flushRideActions, getQueuedRideActions } from "@/lib/rideTimer/rideActionQueue";
import { useNetworkStatus } from "@/providers/NetworkStatusProvider";
import { useToast } from "@/providers/ToastProvider";

const RETRY_INTERVAL_MS = 30_000;

/**
 * Sends ride actions saved while offline: on app start, when the phone comes
 * back online, when the app returns to the foreground, and every 30 s while
 * something is still waiting.
 */
export const RideActionQueueSync = () => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { isOnline } = useNetworkStatus();

  useEffect(() => {
    if (!isOnline) {
      return;
    }

    const flush = async () => {
      if (getQueuedRideActions().length === 0) {
        return;
      }

      const outcomes = await flushRideActions((item, timer) => applySentRideAction(queryClient, item, timer));
      invalidateAfterRideOutcomes(queryClient, outcomes);

      // Only mention actions that actually waited (not one a screen just sent).
      const sentCount = outcomes.filter(
        (outcome) => outcome.type === "sent" && Date.now() - Date.parse(outcome.item.createdAt) > 10_000,
      ).length;

      if (sentCount > 0) {
        toast.success("Ride updates sent", "Times saved while offline have been sent.");
      }

      outcomes.forEach((outcome) => {
        if (outcome.type === "rejected") {
          toast.error(RIDE_ACTION_ERROR_TITLES[outcome.item.action], outcome.message);
        }
      });
    };

    void flush();

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void flush();
      }
    };
    const interval = window.setInterval(() => void flush(), RETRY_INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [isOnline, queryClient, toast]);

  return null;
};
