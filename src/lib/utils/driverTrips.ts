import type { RideTimer } from "../api/driverPaymentTypes";
import { getEffectiveBookedEndMs } from "../rideTimer/ridePauses";
import type {
  DriverTrip,
  DriverTripDetails,
  DriverTripStatistics,
  DriverTripStatus,
  StandardTripStatus,
} from "../api/types";
import { formatLagosTime, formatMinutes, LAGOS_TIME_ZONE, parseLagos, parseLagosMs } from "./lagosTime";

export type DriverTripBadgeType = "booking" | "owner" | "status";

export interface DriverTripBadge {
  label: string;
  type?: DriverTripBadgeType;
}

export interface DriverTripBadgeStyle {
  bg: string;
  text: string;
}

export interface DriverTripExtension {
  /** Paid time added on top of the original booking, in minutes. */
  minutes: number;
  /** "+2h", "+1h 30m" */
  addedLabel: string;
  /** The booking's original end, e.g. "3:00 PM". */
  originalEndLabel?: string;
  /** Where the ride now runs to, e.g. "5:00 PM". */
  extendedEndLabel?: string;
}

export interface DriverTripCardModel {
  /** Paid time the client added to the booking. */
  extension?: DriverTripExtension;
  /** Shown while the ride runs past its booked end. */
  overtimeNote?: string;
  badges: DriverTripBadge[];
  clientName: string;
  id: string;
  location: string;
  timeRange: string;
  tripId: string;
  vehicle: string;
}

export interface DriverTripSection {
  data: DriverTripCardModel[];
  title: string;
}

export type DriverTripBookingTimerType = "airport" | "standard" | "full-day";

export const ACTIVE_DRIVER_TRIP_STATUSES: DriverTripStatus[] = [
  "NOT_STARTED",
  "CHECKED_IN",
  "AWAITING_PICKUP",
  "RUNNING_LATE",
  "ONGOING",
  "EXTRA_TIME",
];

const STATUS_LABELS: Record<DriverTripStatus, string> = {
  AWAITING_PICKUP: "AWAITING PICKUP",
  CANCELLED: "CANCELLED",
  CHECKED_IN: "CHECKED IN",
  COMPLETE: "COMPLETE",
  EXTRA_TIME: "OVERTIME",
  NOT_STARTED: "NOT STARTED",
  ONGOING: "ONGOING",
  RUNNING_LATE: "RUNNING LATE",
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  weekday: "long",
  timeZone: LAGOS_TIME_ZONE,
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: LAGOS_TIME_ZONE,
});

const compact = (value?: string | null) => value?.trim() || undefined;

// API times are Lagos wall-clock times, whatever the phone's time zone.
const parseDate = (value?: string | null) => parseLagos(value);

const getDurationLabel = (duration?: number | null) => {
  if (duration === undefined || duration === null) {
    return undefined;
  }

  return `${duration} hr${duration === 1 ? "" : "s"}`;
};

const getFallbackValue = (value: string | undefined, fallback: string) =>
  value && value.length > 0 ? value : fallback;

const normalizeBookingText = (value?: string | null) =>
  compact(value)?.toLowerCase().replace(/[_-]+/g, " ");

const normalizeBadgeText = (value?: string | null) =>
  compact(value)?.toUpperCase().replace(/[_-]+/g, " ");

const getBookingDurationHours = (value?: string | null) => {
  const normalizedValue = normalizeBookingText(value);

  if (!normalizedValue) {
    return undefined;
  }

  const hourMatch =
    normalizedValue.match(/^(\d+(?:\.\d+)?)$/) ??
    normalizedValue.match(/\b(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/);

  if (!hourMatch?.[1]) {
    return undefined;
  }

  const hours = Number(hourMatch[1]);

  return Number.isFinite(hours) && hours > 0 ? hours : undefined;
};

const formatBookingDurationBadgeLabel = (hours: number) => {
  const formattedHours = Number.isInteger(hours)
    ? String(hours)
    : String(hours).replace(/\.?0+$/, "");

  return `${formattedHours} HOUR${hours === 1 ? "" : "S"}`;
};

export const isUnaccommodatedHourBookingLabel = (value?: string | null) => {
  const hours = getBookingDurationHours(value);

  return (
    hours !== undefined &&
    hours !== 12 &&
    hours !== 24
  );
};

const COMPANY_BADGE_STYLE = { bg: "bg-[#2D3192]", text: "text-white" };
const HOST_BADGE_STYLE = { bg: "bg-[#ECFDF3]", text: "text-[#027A48]" };
const UNACCOMMODATED_TIME_BADGE_STYLE = {
  bg: "bg-[#FEF3C7]",
  text: "text-[#92400E]",
};

export const getDriverTripBadgeStyle = (
  label: string,
  type?: DriverTripBadgeType,
): DriverTripBadgeStyle => {
  const normalizedLabel = normalizeBadgeText(label);

  if (type === "booking" && normalizedLabel) {
    switch (normalizedLabel) {
      case "AIRPORT":
        return { bg: "bg-[#CFFAFE]", text: "text-[#0891B2]" };
      case "STANDARD":
        return { bg: "bg-[#E0EAFF]", text: "text-[#3538CD]" };
      case "FULL DAY RENTAL":
        return { bg: "bg-[#F4EBFF]", text: "text-[#6941C6]" };
      default:
        return UNACCOMMODATED_TIME_BADGE_STYLE;
    }
  }

  if (type === "owner" && normalizedLabel) {
    if (
      normalizedLabel === "COMPANY" ||
      normalizedLabel.includes("AUTOGIRL")
    ) {
      return COMPANY_BADGE_STYLE;
    }

    if (normalizedLabel === "CUSTOMER") {
      return { bg: "bg-[#101928]", text: "text-[#F5A623]" };
    }

    return HOST_BADGE_STYLE;
  }

  if (isUnaccommodatedHourBookingLabel(label)) {
    return UNACCOMMODATED_TIME_BADGE_STYLE;
  }

  switch (normalizedLabel) {
    case "ONGOING":
      return { bg: "bg-[#12B76A]", text: "text-white" };
    case "FULL DAY RENTAL":
      return { bg: "bg-[#F4EBFF]", text: "text-[#6941C6]" };
    case "CUSTOMER":
      return { bg: "bg-[#101928]", text: "text-[#F5A623]" };
    case "NOT STARTED":
      return { bg: "bg-[#F79009]", text: "text-white" };
    case "CHECKED IN":
      return { bg: "bg-[#12B76A]", text: "text-white" };
    case "STANDARD":
      return { bg: "bg-[#E0EAFF]", text: "text-[#3538CD]" };
    case "MAINTENANCE":
      return { bg: "bg-[#E4E7EC]", text: "text-[#475367]" };
    case "AWAITING PICKUP":
      return { bg: "bg-[#F97316]", text: "text-white" };
    case "RUNNING LATE":
      return { bg: "bg-[#D92D20]", text: "text-white" };
    case "COMPANY":
    case "AUTOGIRL":
      return COMPANY_BADGE_STYLE;
    case "HOST":
      return HOST_BADGE_STYLE;
    case "COMPLETE":
      return { bg: "bg-[#667185]", text: "text-white" };
    case "AIRPORT":
      return { bg: "bg-[#CFFAFE]", text: "text-[#0891B2]" };
    case "CANCELLED":
      return { bg: "bg-[#D92D20]", text: "text-white" };
    default:
      return { bg: "bg-[#F2F4F7]", text: "text-[#475367]" };
  }
};

export const getDriverTripBookingTimerType = (
  value?: string | null,
): DriverTripBookingTimerType => {
  const normalizedValue = normalizeBookingText(value) ?? "";

  if (normalizedValue.includes("airport")) {
    return "airport";
  }

  if (
    normalizedValue.includes("standard") ||
    normalizedValue.includes("12")
  ) {
    return "standard";
  }

  return "full-day";
};

export const getDriverTripBookingBadgeLabel = (value?: string | null) => {
  const normalizedValue = normalizeBookingText(value);

  if (!normalizedValue) {
    return undefined;
  }

  if (normalizedValue.includes("airport")) {
    return "AIRPORT";
  }

  if (
    normalizedValue.includes("standard") ||
    normalizedValue.includes("12")
  ) {
    return "STANDARD";
  }

  if (
    normalizedValue.includes("full day") ||
    normalizedValue.includes("24")
  ) {
    return "FULL DAY RENTAL";
  }

  const durationHours = getBookingDurationHours(normalizedValue);

  if (durationHours !== undefined) {
    return formatBookingDurationBadgeLabel(durationHours);
  }

  return compact(value);
};

export const formatApiDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

export const getDriverTripStatus = (trip: DriverTrip) =>
  trip.driverTripStatus ?? trip.tripStatus ?? trip.status ?? undefined;

export const getDriverTripStandardStatus = (trip: DriverTrip) =>
  trip.standardTripStatus ?? undefined;

export const getTerminalDriverTripStatusFromStandardStatus = (
  standardStatus?: StandardTripStatus | null,
): DriverTripStatus | undefined => {
  if (standardStatus === "COMPLETED") {
    return "COMPLETE";
  }

  if (standardStatus === "CANCELLED") {
    return "CANCELLED";
  }

  return undefined;
};

/* ------------------------------------------------------------- live ride state
 *
 * The backend's `standardTripStatus` is worked out from the clock alone: once
 * the original end time passes it says COMPLETED, even while the driver is
 * still driving the client. A ride is only over when the driver (or support)
 * ends it, so the driver's own ride state wins over that clock guess:
 *
 * - started and not ended, before the booked end  -> ONGOING
 * - started and not ended, past the booked end    -> EXTRA_TIME ("Overtime")
 * - ended (actualEndAt set)                       -> COMPLETE
 *
 * The booked end includes extensions the client has paid for
 * (`rideTimer.bookedEndAt`), so a paid extension turns Overtime back into
 * Ongoing as soon as it lands, even before the server's next sweep.
 */

const RIDING: readonly DriverTripStatus[] = ["ONGOING", "EXTRA_TIME"];
const PRE_RIDE: readonly DriverTripStatus[] = [
  "NOT_STARTED",
  "CHECKED_IN",
  "AWAITING_PICKUP",
  "RUNNING_LATE",
];

/** Where the ride is meant to end: the original end plus paid extensions. */
export const getBookedEndMs = (
  rideTimer?: RideTimer | null,
  endDateTime?: string | null,
  nowMs = Date.now(),
) =>
  getEffectiveBookedEndMs(rideTimer, parseLagosMs(rideTimer?.bookedEndAt), nowMs) ??
  parseLagosMs(endDateTime);

const resolveLiveRideStatus = (
  status: DriverTripStatus | undefined,
  rideTimer: RideTimer | null | undefined,
  endDateTime: string | null | undefined,
  nowMs: number,
): DriverTripStatus | undefined => {
  if (status === "CANCELLED") {
    return undefined;
  }

  if (rideTimer?.actualEndAt) {
    return "COMPLETE";
  }

  const rideStarted =
    (status !== undefined && RIDING.includes(status)) ||
    (Boolean(rideTimer?.actualStartAt) && status !== "COMPLETE");

  if (!rideStarted) {
    return undefined;
  }

  const bookedEndMs = getBookedEndMs(rideTimer, endDateTime, nowMs);

  if (bookedEndMs === undefined) {
    return status === "EXTRA_TIME" ? "EXTRA_TIME" : "ONGOING";
  }

  return nowMs > bookedEndMs ? "EXTRA_TIME" : "ONGOING";
};

export const getResolvedDriverTripStatus = (
  trip: DriverTrip,
  nowMs = Date.now(),
): DriverTripStatus | undefined => {
  const driverStatus = getDriverTripStatus(trip);

  if (trip.standardTripStatus === "CANCELLED" || driverStatus === "CANCELLED") {
    return "CANCELLED";
  }

  return (
    resolveLiveRideStatus(driverStatus, trip.rideTimer, trip.endDateTime, nowMs) ??
    getTerminalDriverTripStatusFromStandardStatus(trip.standardTripStatus) ??
    driverStatus
  );
};

export const getResolvedDriverTripDetailsStatus = (
  tripDetails?: DriverTripDetails,
  nowMs = Date.now(),
): DriverTripStatus | undefined => {
  if (!tripDetails) {
    return undefined;
  }

  const driverStatus = tripDetails.driverTripStatus ?? undefined;

  if (tripDetails.standardTripStatus === "CANCELLED" || driverStatus === "CANCELLED") {
    return "CANCELLED";
  }

  return (
    resolveLiveRideStatus(driverStatus, tripDetails.rideTimer, tripDetails.endDateTime, nowMs) ??
    getTerminalDriverTripStatusFromStandardStatus(tripDetails.standardTripStatus) ??
    driverStatus
  );
};

/** The ride is still running past its booked end (paid extensions included). */
export const isDriverTripInOvertime = (trip: DriverTrip, nowMs = Date.now()) =>
  getResolvedDriverTripStatus(trip, nowMs) === "EXTRA_TIME";

export const getDriverTripStatusLabel = (status: DriverTripStatus) =>
  STATUS_LABELS[status];

const getDriverTripCardStatusLabel = (
  trip: DriverTrip,
  fallbackStatus?: DriverTripStatus,
) => {
  const driverStatus = getResolvedDriverTripStatus(trip) ?? fallbackStatus;

  return driverStatus ? getDriverTripStatusLabel(driverStatus) : undefined;
};

export type DriverTripTab = "Upcoming" | "Ongoing" | "Completed" | "Cancelled";

/**
 * Which Trips tab a trip belongs in. A ride that is still going belongs in
 * Ongoing, overtime included, whatever the clock says.
 */
export const getDriverTripTab = (
  trip: DriverTrip,
  nowMs = Date.now(),
): DriverTripTab | undefined => {
  const status = getResolvedDriverTripStatus(trip, nowMs);

  if (status === "CANCELLED") return "Cancelled";
  if (status === "COMPLETE") return "Completed";
  if (status && RIDING.includes(status)) return "Ongoing";

  const startMs = parseLagosMs(trip.startDateTime);
  const endMs = getBookedEndMs(trip.rideTimer, trip.endDateTime, nowMs);

  if (!status || PRE_RIDE.includes(status)) {
    // Never started and its time is over: Completed.
    if (endMs !== undefined && endMs < nowMs) return "Completed";
    // Only a trip nobody has acted on yet is still upcoming; a checked-in
    // or waiting trip is already under way.
    if ((!status || status === "NOT_STARTED") && startMs !== undefined && startMs > nowMs) {
      return "Upcoming";
    }
    return "Ongoing";
  }

  return undefined;
};

export const isDriverTripUpcoming = (trip: DriverTrip) =>
  getDriverTripTab(trip) === "Upcoming";

export const isDriverTripActive = (trip: DriverTrip) =>
  getDriverTripTab(trip) === "Ongoing";

/* ------------------------------------------------------------- paid extensions */

/**
 * Time the client has paid to extend the booking. The backend adds paid
 * extensions to `rideTimer.bookedEndAt` and keeps the booking's own end in
 * `originalEndAt` (or `endDateTime` on older responses). Unpaid extension
 * invoices never move `bookedEndAt`, so anything found here is paid.
 */
export const getDriverTripExtension = (
  rideTimer?: RideTimer | null,
  endDateTime?: string | null,
): DriverTripExtension | undefined => {
  const originalEnd = rideTimer?.originalEndAt ?? endDateTime;
  const originalMs = parseLagosMs(originalEnd);
  const bookedMs = parseLagosMs(rideTimer?.bookedEndAt);

  if (originalMs === undefined || bookedMs === undefined || bookedMs <= originalMs) {
    return undefined;
  }

  const minutes = Math.round((bookedMs - originalMs) / 60_000);

  if (minutes <= 0) {
    return undefined;
  }

  return {
    addedLabel: `+${formatMinutes(minutes)}`,
    extendedEndLabel: formatLagosTime(rideTimer?.bookedEndAt),
    minutes,
    originalEndLabel: formatLagosTime(originalEnd),
  };
};

/* ------------------------------------------------------------- tab counts */

/** The tab the backend's clock-based statistics count a trip under. */
const getBackendCountedTab = (trip: DriverTrip, nowMs: number): DriverTripTab | undefined => {
  // The backend sends more standard statuses than the app's type lists.
  switch (trip.standardTripStatus as string | null | undefined) {
    case "CANCELLED":
      return "Cancelled";
    case "COMPLETED":
      return "Completed";
    case "IN_PROGRESS":
    case "COMING_TO_AN_END":
      return "Ongoing";
    case "UPCOMING": {
      const startMs = parseLagosMs(trip.startDateTime);
      return startMs !== undefined && startMs > nowMs ? "Upcoming" : undefined;
    }
    default:
      return undefined;
  }
};

const STATISTIC_KEY: Record<DriverTripTab, keyof DriverTripStatistics> = {
  Upcoming: "upcomingTrips",
  Ongoing: "onGoingTrips",
  Completed: "completedTrips",
  Cancelled: "cancelledTrips",
};

/**
 * The backend counts trips by the clock alone, so a ride in overtime is
 * counted as Completed and one ended early as Ongoing. Using the most recent
 * trips (where those cases live), move each trip the backend counted under a
 * different tab to the tab the list actually shows it in.
 */
export const reconcileDriverTripStatistics = (
  statistics: DriverTripStatistics | undefined,
  recentTrips: DriverTrip[],
  nowMs = Date.now(),
): DriverTripStatistics | undefined => {
  if (!statistics) {
    return statistics;
  }

  const next = { ...statistics };
  const seen = new Set<string>();

  recentTrips.forEach((trip) => {
    if (seen.has(trip.id)) return;
    seen.add(trip.id);

    const counted = getBackendCountedTab(trip, nowMs);
    const shown = getDriverTripTab(trip, nowMs);

    if (!counted || !shown || counted === shown) return;

    const from = STATISTIC_KEY[counted];
    const to = STATISTIC_KEY[shown];

    if (next[from] > 0) {
      next[from] -= 1;
      next[to] += 1;
    }
  });

  return next;
};

export const getDriverTripSectionTitle = (trip: DriverTrip) => {
  const startDate = parseDate(trip.startDateTime);

  if (!startDate) {
    return "Other Trips";
  }

  return dateFormatter.format(startDate);
};

const getSortableTripDuration = (duration?: number | null) =>
  duration !== undefined &&
  duration !== null &&
  Number.isFinite(duration) &&
  duration >= 0
    ? duration
    : Number.POSITIVE_INFINITY;

/**
 * Orders assignments as a driver itinerary: chronologically first, then by
 * shortest assignment when start times match. The id keeps the result stable
 * when both scheduling values are equal.
 */
export const compareDriverTripsBySchedule = (
  firstTrip: DriverTrip,
  secondTrip: DriverTrip,
) => {
  const firstStartTime = parseDate(firstTrip.startDateTime)?.getTime();
  const secondStartTime = parseDate(secondTrip.startDateTime)?.getTime();

  if (firstStartTime !== undefined && secondStartTime !== undefined) {
    const startTimeDifference = firstStartTime - secondStartTime;

    if (startTimeDifference !== 0) {
      return startTimeDifference;
    }
  } else if (firstStartTime !== undefined) {
    return -1;
  } else if (secondStartTime !== undefined) {
    return 1;
  }

  const durationDifference =
    getSortableTripDuration(firstTrip.tripDuration) -
    getSortableTripDuration(secondTrip.tripDuration);

  if (Number.isFinite(durationDifference) && durationDifference !== 0) {
    return durationDifference;
  }

  return firstTrip.id.localeCompare(secondTrip.id);
};

export const toDriverTripCardModel = (
  trip: DriverTrip,
  fallbackStatus?: DriverTripStatus,
): DriverTripCardModel => {
  const statusLabel = getDriverTripCardStatusLabel(trip, fallbackStatus);
  const bookingTypeName = getDriverTripBookingBadgeLabel(trip.bookingTypeName);
  const driverOwnerType = compact(trip.driverOwnerType);
  const vehicleName = compact(trip.vehicleName);
  const vehicleIdentifier = compact(trip.vehicleIdentifier);
  const startDate = parseDate(trip.startDateTime);
  const endDate = parseDate(trip.endDateTime);
  const durationLabel = getDurationLabel(trip.tripDuration);
  const timeRange = [
    startDate && endDate
      ? `${timeFormatter.format(startDate)} - ${timeFormatter.format(endDate)}`
      : undefined,
    durationLabel ? `(${durationLabel})` : undefined,
  ].filter(Boolean).join(" ");
  const badges: DriverTripBadge[] = [];

  if (statusLabel) {
    badges.push({
      label: statusLabel,
      type: "status",
    });
  }

  if (bookingTypeName) {
    badges.push({
      label: bookingTypeName,
      type: "booking",
    });
  }

  if (driverOwnerType) {
    badges.push({
      label: driverOwnerType,
      type: "owner",
    });
  }

  const extension = getDriverTripExtension(trip.rideTimer, trip.endDateTime);
  const bookedEndLabel = formatLagosTime(trip.rideTimer?.bookedEndAt ?? trip.endDateTime);
  const overtimeNote =
    getResolvedDriverTripStatus(trip) === "EXTRA_TIME"
      ? `Past the booked end${bookedEndLabel ? ` (${bookedEndLabel})` : ""} · ride still on`
      : undefined;

  return {
    badges,
    extension,
    overtimeNote,
    clientName: getFallbackValue(compact(trip.customerName), "Customer"),
    id: trip.id,
    location: getFallbackValue(
      compact(trip.pickupLocation) ?? compact(trip.city),
      "Pickup location unavailable",
    ),
    timeRange: getFallbackValue(timeRange, "Schedule unavailable"),
    tripId: getFallbackValue(compact(trip.tripCustomId), trip.id),
    vehicle: getFallbackValue(
      [vehicleName, vehicleIdentifier].filter(Boolean).join(" • "),
      "Vehicle unavailable",
    ),
  };
};

export type DriverTripSortOrder = "soonest-first" | "latest-first";

export const groupDriverTripsForCards = (
  trips: DriverTrip[],
  fallbackStatus?: DriverTripStatus,
  order: DriverTripSortOrder = "soonest-first",
): DriverTripSection[] => {
  const groupedTrips = new Map<string, DriverTripCardModel[]>();
  const compare =
    order === "latest-first"
      ? (first: DriverTrip, second: DriverTrip) =>
          compareDriverTripsBySchedule(second, first)
      : compareDriverTripsBySchedule;

  [...trips].sort(compare).forEach((trip) => {
    const sectionTitle = getDriverTripSectionTitle(trip);
    const sectionTrips = groupedTrips.get(sectionTitle) ?? [];

    sectionTrips.push(toDriverTripCardModel(trip, fallbackStatus));
    groupedTrips.set(sectionTitle, sectionTrips);
  });

  return Array.from(groupedTrips.entries()).map(([title, data]) => ({
    data,
    title,
  }));
};
