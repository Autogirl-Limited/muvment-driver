/**
 * Pilot reports the driver still owes (GET /driver-app/checklists/outstanding).
 *
 * Pre-Ride is due only on a day with a trip; a Post-Ride is due for every day
 * whose Pre-Ride was sent. A `blocking` report stops check-in, heading to
 * pickup and starting a ride until it is sent (the server refuses those with
 * PILOT_REPORTS_REQUIRED). Ending, pausing or resuming a ride is never blocked.
 */
import { ApiRequestError } from "../api/client";
import type { OutstandingPilotReport } from "../api/types";
import { formatLagosShortDate } from "../utils/lagosTime";

export const PILOT_REPORTS_REQUIRED = "PILOT_REPORTS_REQUIRED";

/** The server refused to start work because pilot reports are owed. */
export const isPilotReportsRequiredError = (error: unknown) =>
  error instanceof ApiRequestError &&
  (error.data?.errorCode === PILOT_REPORTS_REQUIRED || error.code === PILOT_REPORTS_REQUIRED);

const addDays = (isoDate: string, days: number) => {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

/** "Today", "Yesterday" or "Wed, 26 Nov". */
export const pilotReportDayLabel = (date: string, today: string) =>
  date === today ? "Today" : date === addDays(today, -1) ? "Yesterday" : (formatLagosShortDate(date) ?? date);

export const pilotReportTitle = (report: OutstandingPilotReport) => {
  const base = report.kind === "PRE_RIDE" ? "Pre-Ride Pilot Report" : "Post-Ride Pilot Report";
  return report.reportType === "INVOICE" && report.invoiceNumber ? `${base} · ${report.invoiceNumber}` : base;
};

/** What the driver needs to know about when it's due. */
export const pilotReportDetail = (report: OutstandingPilotReport, today: string) => {
  const day = pilotReportDayLabel(report.date, today);
  const started = report.state === "IN_PROGRESS";

  switch (report.dueReason) {
    case "TRIP_TODAY":
      return started ? `${day} · Pick up where you left off` : `${day} · Do this before your first trip`;
    case "PAST_DAY":
      return `${day} · Missed. ${started ? "Finish" : "Do"} it now to start work`;
    case "DAY_FINISHED":
      return `${day} · Your trips are done. Wrap up your day`;
    case "AFTER_LAST_TRIP":
      return `${day} · Due after your last trip`;
    case "AFTER_BOOKING":
      return `${day} · Due when this booking ends`;
  }
};

/** Where to open the report: the intro of the right flow, with its tracker. */
export const pilotReportRoute = (report: OutstandingPilotReport) => {
  const trackerId = report.checklistTrackerId?.trim();

  if (report.kind === "POST_RIDE") {
    return `/checklist/intro?flow=postRide&trackerId=${encodeURIComponent(trackerId ?? "")}`;
  }

  return trackerId ? `/checklist/intro?trackerId=${encodeURIComponent(trackerId)}` : "/checklist/intro";
};
