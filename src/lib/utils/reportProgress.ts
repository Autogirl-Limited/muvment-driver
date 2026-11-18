import type { ChecklistTracker, PreRideChecklistSummary, SubmittedChecklistPhotos } from "@/lib/api/types";

import { getChecklistStepRoute } from "./checklistNavigation";

export interface ReportPart {
  /** The step screen that holds this part. */
  step: number;
  title: string;
  /** Server step names that must all be in for the part to count as done. */
  serverSteps: string[];
  done: boolean;
}

const PRE_RIDE_PARTS = [
  { step: 2, title: "Exterior Photos", serverSteps: ["EXTERIOR"] },
  { step: 3, title: "Interior & Readings", serverSteps: ["INTERIOR"] },
  { step: 4, title: "Health & Selfie", serverSteps: ["VEHICLE_HEALTH_CHECK", "DRIVER_PHOTO"] },
] as const;

const FINAL_STEP = 4;

const sentSteps = (submitted: SubmittedChecklistPhotos | null | undefined) =>
  new Set(
    (submitted?.steps ?? [])
      .filter((step) => step.type === "PRE_TRIP" && step.images.length > 0)
      .map((step) => step.step),
  );

/**
 * Parts of the pre-ride report, each marked done from what the server holds:
 * its list of submitted photos when it can say, else the report summary.
 */
export const getPreRideParts = (
  summary?: PreRideChecklistSummary | null,
  submitted?: SubmittedChecklistPhotos | null,
): ReportPart[] => {
  const sent = sentSteps(submitted);

  return PRE_RIDE_PARTS.map((part) => {
    let done = part.serverSteps.every((step) => sent.has(step));

    // No photo list from the server (older server, or not loaded yet): fall back to the summary.
    if (!submitted && summary) {
      done =
        part.step === 2
          ? Boolean(summary.exteriorPhotos?.valid)
          : part.step === 3
            ? Boolean(summary.interiorPhotos?.valid)
            : Boolean(summary.vehicleHealthCheckPhotos?.valid && summary.driverPhoto?.valid);
    }

    return { ...part, serverSteps: [...part.serverSteps], done };
  });
};

/** The next part still to do, or the final "send" step when every part is in. */
export const getNextPreRidePart = (
  summary?: PreRideChecklistSummary | null,
  submitted?: SubmittedChecklistPhotos | null,
) => {
  const parts = getPreRideParts(summary, submitted);
  const next = parts.find((part) => !part.done);
  const done = parts.filter((part) => part.done).length;

  return next
    ? { step: next.step, title: next.title, done, total: parts.length }
    : { step: FINAL_STEP, title: "Send Your Report", done, total: parts.length };
};

export const getPreRideResumeRoute = (
  trackerId: string,
  summary?: PreRideChecklistSummary | null,
  submitted?: SubmittedChecklistPhotos | null,
) => getChecklistStepRoute("preRide", trackerId, getNextPreRidePart(summary, submitted).step);

/**
 * Where a pilot report stands. Once the driver has submitted a report (either
 * half) it is COMPLETED, whatever it holds: it is never "continued" or topped
 * up. Only a report that was never submitted is in progress.
 */
export type ReportPhase = "inProgress" | "completed";

const SUBMITTED_STATUSES = new Set(["PRE_RIDE_CLOSED", "POST_RIDE_OPEN", "POST_RIDE_CLOSED"]);

type TrackerFacts = Partial<Pick<ChecklistTracker, "status" | "checklistStatus" | "preRideCompletedAt" | "postRideCompletedAt">>;

export const isReportSubmitted = (tracker: TrackerFacts) =>
  Boolean(tracker.preRideCompletedAt || tracker.postRideCompletedAt) ||
  SUBMITTED_STATUSES.has(tracker.status ?? tracker.checklistStatus ?? "");

export const getReportPhase = (tracker: TrackerFacts): ReportPhase => (isReportSubmitted(tracker) ? "completed" : "inProgress");

/** The read-only report, with its status so the page knows which half is open. */
export const reportDetailRoute = (tracker: Pick<ChecklistTracker, "id" | "status" | "checklistStatus">) => {
  const status = tracker.status ?? tracker.checklistStatus;

  return `/checklist-report/${encodeURIComponent(tracker.id)}${status ? `?status=${status}` : ""}`;
};

const SLOT_LABELS: Record<string, string> = {
  FRONT: "Front",
  BACK: "Back",
  LEFT_SIDE: "Left Side",
  RIGHT_SIDE: "Right Side",
  DAMAGE: "Damage",
  DASHBOARD: "Dashboard",
  DRIVER_SIDE: "Driver Side",
  PASSENGER: "Passenger Side",
  REAR_SEATS: "Rear Seats",
  BOOT: "Boot",
  ACCESSORIES: "Accessory",
  OIL_LEVEL: "Oil Level",
  COOLANT_LEVEL: "Coolant Level",
  SAFETY_EQUIPMENT: "Safety Equipment",
  DRIVER_PHOTO: "Selfie",
  SELFIE: "Selfie",
};

export const slotLabel = (slot: string) =>
  SLOT_LABELS[slot] ??
  slot
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

/** The report sections, in the order the driver took them. */
export const REPORT_SECTIONS: { step: string; title: string }[] = [
  { step: "EXTERIOR", title: "Exterior" },
  { step: "INTERIOR", title: "Interior" },
  { step: "VEHICLE_HEALTH_CHECK", title: "Vehicle Health" },
  { step: "DRIVER_PHOTO", title: "Driver Photo" },
];
