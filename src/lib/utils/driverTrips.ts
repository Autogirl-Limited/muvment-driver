import type {
  DriverTrip,
  DriverTripDetails,
  DriverTripStatus,
  StandardTripStatus,
} from "../api/types";

export type DriverTripBadgeType = "booking" | "owner" | "status";

export interface DriverTripBadge {
  label: string;
  type?: DriverTripBadgeType;
}

export interface DriverTripBadgeStyle {
  bg: string;
  text: string;
}

export interface DriverTripCardModel {
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
  EXTRA_TIME: "EXTRA TIME",
  NOT_STARTED: "NOT STARTED",
  ONGOING: "ONGOING",
  RUNNING_LATE: "RUNNING LATE",
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  weekday: "long",
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

const compact = (value?: string | null) => value?.trim() || undefined;

const parseDate = (value?: string | null) => {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? undefined : date;
};

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

export const getResolvedDriverTripStatus = (trip: DriverTrip) =>
  getTerminalDriverTripStatusFromStandardStatus(trip.standardTripStatus) ??
  getDriverTripStatus(trip);

export const getResolvedDriverTripDetailsStatus = (
  tripDetails?: DriverTripDetails,
) =>
  tripDetails
    ? getTerminalDriverTripStatusFromStandardStatus(
        tripDetails.standardTripStatus,
      ) ?? tripDetails.driverTripStatus ?? undefined
    : undefined;

export const getDriverTripStatusLabel = (status: DriverTripStatus) =>
  STATUS_LABELS[status];

const getDriverTripCardStatusLabel = (
  trip: DriverTrip,
  fallbackStatus?: DriverTripStatus,
) => {
  const driverStatus = getResolvedDriverTripStatus(trip) ?? fallbackStatus;

  return driverStatus ? getDriverTripStatusLabel(driverStatus) : undefined;
};

export const isDriverTripUpcoming = (trip: DriverTrip) => {
  const status = getResolvedDriverTripStatus(trip);
  const startDate = parseDate(trip.startDateTime);

  if (!startDate || startDate.getTime() <= Date.now()) {
    return false;
  }

  return !status || status === "NOT_STARTED";
};

export const isDriverTripActive = (trip: DriverTrip) => {
  const status = getResolvedDriverTripStatus(trip);

  if (isDriverTripUpcoming(trip)) {
    return false;
  }

  return !status || ACTIVE_DRIVER_TRIP_STATUSES.includes(status);
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

  return {
    badges,
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

export const groupDriverTripsForCards = (
  trips: DriverTrip[],
  fallbackStatus?: DriverTripStatus,
): DriverTripSection[] => {
  const groupedTrips = new Map<string, DriverTripCardModel[]>();

  [...trips].sort(compareDriverTripsBySchedule).forEach((trip) => {
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
