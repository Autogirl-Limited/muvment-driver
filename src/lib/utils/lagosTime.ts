/**
 * Ride and payment times from the backend are Africa/Lagos wall-clock
 * date-times without an offset ("2026-11-02T15:00:00"). Lagos is UTC+1 all
 * year (no daylight saving), so they are parsed with a fixed +01:00 offset
 * and always formatted in the Lagos time zone, whatever the phone's zone.
 */
export const LAGOS_TIME_ZONE = "Africa/Lagos";
const LAGOS_OFFSET_MS = 60 * 60 * 1000;

const HAS_OFFSET = /(Z|[+-]\d{2}:?\d{2})$/i;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Parses a Lagos local date-time (or an ISO instant with an offset). */
export const parseLagos = (value?: string | null): Date | undefined => {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  const iso = DATE_ONLY.test(trimmed)
    ? `${trimmed}T00:00:00+01:00`
    : HAS_OFFSET.test(trimmed)
      ? trimmed
      : `${trimmed}+01:00`;
  const date = new Date(iso);

  return Number.isNaN(date.getTime()) ? undefined : date;
};

export const parseLagosMs = (value?: string | null) => parseLagos(value)?.getTime();

/** An instant as a Lagos local date-time string, e.g. "2026-11-02T15:00:00". */
export const toLagosLocalIso = (date: Date) =>
  new Date(date.getTime() + LAGOS_OFFSET_MS).toISOString().slice(0, 19);

/** Lagos calendar date (YYYY-MM-DD) of an instant. */
export const toLagosDate = (date: Date) => toLagosLocalIso(date).slice(0, 10);

/** Inclusive Lagos calendar-day range for APIs that bind timezone-free LocalDateTime values. */
export const getLagosLocalDateTimeRange = (days: number, now = new Date()) => {
  const safeDays = Math.max(1, Math.trunc(days));
  const toDate = toLagosDate(now);
  const fromInstant = new Date(`${toDate}T12:00:00+01:00`);

  fromInstant.setUTCDate(fromInstant.getUTCDate() - (safeDays - 1));

  return {
    from: `${toLagosDate(fromInstant)}T00:00:00`,
    to: `${toDate}T23:59:59`,
  };
};

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: LAGOS_TIME_ZONE,
});
const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: LAGOS_TIME_ZONE,
});
const shortDateFormatter = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: LAGOS_TIME_ZONE,
});
const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: LAGOS_TIME_ZONE,
});

export const formatLagosTime = (value?: string | null) => {
  const date = parseLagos(value);
  return date ? timeFormatter.format(date) : undefined;
};

export const formatLagosDate = (value?: string | null) => {
  const date = parseLagos(value);
  return date ? dateFormatter.format(date) : undefined;
};

/** "Mon, 2 Nov" */
export const formatLagosShortDate = (value?: string | null) => {
  const date = parseLagos(value);
  return date ? shortDateFormatter.format(date) : undefined;
};

const dayMonthFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: LAGOS_TIME_ZONE,
});

/** "2 Nov" */
export const formatLagosDayMonth = (value?: string | null) => {
  const date = parseLagos(value);
  return date ? dayMonthFormatter.format(date) : undefined;
};

/** "2 Nov, 3:00 pm" */
export const formatLagosDateTime = (value?: string | null) => {
  const date = parseLagos(value);
  return date ? dateTimeFormatter.format(date) : undefined;
};

/**
 * Record timestamps (request event `createdAt`, bank account `updatedAt` /
 * `replacedAt`, payout `createdAt`) are UTC date-times without an offset.
 * Parse them as UTC; they are still shown in Lagos time.
 */
export const parseUtc = (value?: string | null): Date | undefined => {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  const date = new Date(HAS_OFFSET.test(trimmed) ? trimmed : DATE_ONLY.test(trimmed) ? `${trimmed}T00:00:00Z` : `${trimmed}Z`);

  return Number.isNaN(date.getTime()) ? undefined : date;
};

/** A UTC record timestamp as "2 Nov, 3:00 pm" in Lagos time. */
export const formatUtcDateTime = (value?: string | null) => {
  const date = parseUtc(value);
  return date ? dateTimeFormatter.format(date) : undefined;
};

/** A UTC record timestamp as "2 Nov 2026" in Lagos time. */
export const formatUtcDate = (value?: string | null) => {
  const date = parseUtc(value);
  return date ? dateFormatter.format(date) : undefined;
};

/** "1h 40m", "25m", "0m" */
export const formatMinutes = (minutes?: number | null) => {
  const safe = Math.max(0, Math.round(minutes ?? 0));
  const hours = Math.floor(safe / 60);
  const rest = safe % 60;

  if (hours === 0) {
    return `${rest}m`;
  }

  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
};

/** "2:14:05" */
export const formatClock = (totalSeconds: number) => {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const capitalise = (value: string) => value.charAt(0) + value.slice(1).toLowerCase();

/** "MONDAY" → "Monday" */
export const formatWeekday = (weekday?: string | null) => (weekday ? capitalise(weekday) : "");
