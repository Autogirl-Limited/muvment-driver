import type {
  ChecklistTracker,
  DriverTrip,
  PostRideChecklistAggregate,
  PreRideChecklistSummary,
} from "../api/types";
import {
  ACTIVE_DRIVER_TRIP_STATUSES,
  getDriverTripStandardStatus,
  getResolvedDriverTripStatus,
} from "./driverTrips";

const parseDate = (value?: string | null) => {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? undefined : date;
};

const isSameLocalDay = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

const getTripDate = (trip: DriverTrip) =>
  parseDate(trip.startDateTime) ??
  parseDate(trip.endDateTime) ??
  parseDate(trip.createdAt);

const getTripTime = (trip: DriverTrip) => getTripDate(trip)?.getTime() ?? 0;

const padDatePart = (value: number) => String(value).padStart(2, "0");

const formatLocalDateTime = (date: Date) =>
  `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(
    date.getDate(),
  )}T${padDatePart(date.getHours())}:${padDatePart(
    date.getMinutes(),
  )}:${padDatePart(date.getSeconds())}`;

export const getLocalDayDateTimeRange = (date = new Date()) => {
  const from = new Date(date);
  from.setHours(0, 0, 0, 0);

  const to = new Date(date);
  to.setHours(23, 59, 59, 999);

  return {
    from: formatLocalDateTime(from),
    to: formatLocalDateTime(to),
  };
};

export const getTodayDriverTrips = (
  trips: DriverTrip[],
  today = new Date(),
) =>
  trips.filter((trip) => {
    const tripDate = getTripDate(trip);

    return tripDate ? isSameLocalDay(tripDate, today) : false;
  });

export const getPreRidePilotReportTrip = (
  trips: DriverTrip[],
  today = new Date(),
) =>
  getTodayDriverTrips(trips, today)
    .filter((trip) => {
      const status = getResolvedDriverTripStatus(trip);
      const standardStatus = getDriverTripStandardStatus(trip);

      if (standardStatus === "COMPLETED" || standardStatus === "CANCELLED") {
        return false;
      }

      return !status || ACTIVE_DRIVER_TRIP_STATUSES.includes(status);
    })
    .sort((left, right) => getTripTime(left) - getTripTime(right))[0];

export const getAvailablePreRidePilotReportTrip = (
  trips: DriverTrip[],
  today = new Date(),
) =>
  getPreRidePilotReportTrip(trips, today) ??
  trips
    .filter((trip) => {
      const status = getResolvedDriverTripStatus(trip);
      const standardStatus = getDriverTripStandardStatus(trip);

      if (standardStatus === "COMPLETED" || standardStatus === "CANCELLED") {
        return false;
      }

      return !status || ACTIVE_DRIVER_TRIP_STATUSES.includes(status);
    })
    .sort((left, right) => getTripTime(left) - getTripTime(right))[0];

export const getPostRidePilotReportTrip = (
  trips: DriverTrip[],
  today = new Date(),
) =>
  getTodayDriverTrips(trips, today)
    .filter((trip) => {
      const status = getResolvedDriverTripStatus(trip);
      const standardStatus = getDriverTripStandardStatus(trip);

      return status === "COMPLETE" || standardStatus === "COMPLETED";
    })
    .sort((left, right) => getTripTime(right) - getTripTime(left))[0];

export const hasCompletedTripToday = (
  trips: DriverTrip[],
  today = new Date(),
) => Boolean(getPostRidePilotReportTrip(trips, today));

export const shouldShowPreRidePilotReportAction = (
  tracker?: ChecklistTracker,
) => (tracker?.status ?? tracker?.checklistStatus) === "PRE_RIDE_OPEN";

export const shouldShowPostRidePilotReportAction = ({
  tracker,
}: {
  tracker?: ChecklistTracker;
}) => (tracker?.status ?? tracker?.checklistStatus) === "POST_RIDE_OPEN";

export const isPreRidePilotReportSubmitted = (
  trip?: DriverTrip,
  summary?: PreRideChecklistSummary,
) => {
  const status =
    summary?.driverTripStatus ??
    (trip ? getResolvedDriverTripStatus(trip) : undefined);

  return Boolean(status && status !== "NOT_STARTED" && status !== "CANCELLED");
};

export const isPostRidePilotReportSubmitted = (
  aggregate?: PostRideChecklistAggregate,
) =>
  Boolean(
    aggregate?.postTripSummary.exteriorPhotos.valid &&
      aggregate.postTripSummary.interiorPhotos.valid,
  );
