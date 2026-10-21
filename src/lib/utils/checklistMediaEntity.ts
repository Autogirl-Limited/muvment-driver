import { useEffect, useState } from "react";

import type { DriverTrip } from "../api/types";
import { getAvailablePreRidePilotReportTrip } from "./pilotReports";
import { storage } from "./storage";

const CHECKLIST_MEDIA_ENTITY_KEY_PREFIX = "checklist-media-entity-";

const getMediaEntityStorageKey = (trackerId: string) =>
  `${CHECKLIST_MEDIA_ENTITY_KEY_PREFIX}${trackerId}`;

/**
 * Pre-ride checklist photos must presign against the driver trip id so
 * /checklists/exterior can resolve uploaded media. Do not use checklistTrackerId here.
 */
export const resolvePreRideChecklistMediaEntityId = ({
  tripId,
  trips,
}: {
  tripId?: string | null;
  trips: DriverTrip[];
}) => {
  const routeTripId = tripId?.trim();

  if (routeTripId) {
    return routeTripId;
  }

  return getAvailablePreRidePilotReportTrip(trips)?.id?.trim() ?? "";
};

/**
 * Keeps the resolved trip id stable per tracker: whenever a tripId route param
 * is known it is cached against the tracker id; on resume (no tripId param)
 * the cached id is used instead of re-running the "earliest active trip" heuristic,
 * which could pick a different trip later in the day.
 */
export const useChecklistMediaEntityId = ({
  trackerId,
  tripId,
  trips,
}: {
  trackerId?: string | null;
  tripId?: string | null;
  trips: DriverTrip[];
}) => {
  const routeTripId = tripId?.trim();
  const trimmedTrackerId = trackerId?.trim();
  const [cachedTripId, setCachedTripId] = useState<string | null>(null);

  useEffect(() => {
    if (!trimmedTrackerId) {
      return;
    }

    if (routeTripId) {
      storage.set(getMediaEntityStorageKey(trimmedTrackerId), routeTripId);
      return;
    }

    const storedTripId = storage.get(getMediaEntityStorageKey(trimmedTrackerId));

    if (storedTripId) {
      setCachedTripId(storedTripId);
    }
  }, [trimmedTrackerId, routeTripId]);

  if (routeTripId) {
    return routeTripId;
  }

  if (trimmedTrackerId && cachedTripId) {
    return cachedTripId;
  }

  return resolvePreRideChecklistMediaEntityId({ tripId: routeTripId, trips });
};
