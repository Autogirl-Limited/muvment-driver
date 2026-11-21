import type {
  PostRideChecklistAggregate,
  PreRideChecklistSummary,
} from "../api/types";

export type ChecklistFlow = "postRide" | "preRide";

const PRE_RIDE_STEP_COUNT = 4;
const POST_RIDE_STEP_COUNT = 4;

/**
 * Same switches as the mobile app. When true, a step is locked behind the
 * earlier ones: the stepper only goes back, and a step whose earlier part is not
 * saved yet shows a notice (see useStepGate) with a way to finish that part or
 * check again, instead of throwing the driver backwards. When false, any step
 * can be opened and the server and the review screens catch what is missing.
 */
export const PRE_RIDE_STEP_LOCK_ENABLED = true;
export const POST_RIDE_STEP_LOCK_ENABLED = true;

const clampStep = (step: number, maxStep: number) =>
  Math.min(Math.max(Math.trunc(step), 1), maxStep);

export const getTripDetailRoute = (tripId?: string) => {
  const trimmedTripId = tripId?.trim();

  return trimmedTripId
    ? `/trip/${encodeURIComponent(trimmedTripId)}`
    : "/trips";
};

export const getChecklistStepRoute = (
  flow: ChecklistFlow,
  checklistTrackerId: string,
  step: number,
) => {
  const trimmedTrackerId = checklistTrackerId.trim();
  const maxStep =
    flow === "preRide" ? PRE_RIDE_STEP_COUNT : POST_RIDE_STEP_COUNT;
  const safeStep = clampStep(step, maxStep);
  const basePath =
    flow === "preRide" ? "/checklist" : "/post-ride-checklist";
  const params = new URLSearchParams();

  params.set("trackerId", trimmedTrackerId);

  return `${basePath}/step${safeStep}?${params.toString()}`;
};

export const getPreRideStarterStepRoute = (
  step: number,
) => {
  const safeStep = clampStep(step, PRE_RIDE_STEP_COUNT);

  return `/checklist/step${safeStep}`;
};

export const getPreRideUnlockedStep = (
  summary?: PreRideChecklistSummary,
) => {
  if (!summary?.exteriorPhotos?.valid) {
    return 2;
  }

  if (!summary.interiorPhotos?.valid) {
    return 3;
  }

  if (
    !summary.vehicleHealthCheckPhotos?.valid ||
    !summary.driverPhoto?.valid
  ) {
    return 4;
  }

  return 4;
};

export const getPostRideUnlockedStep = (
  aggregate?: PostRideChecklistAggregate,
) => {
  const postTripSummary = aggregate?.postTripSummary;

  if (!postTripSummary?.exteriorPhotos.valid) {
    return 2;
  }

  if (!postTripSummary.interiorPhotos.valid) {
    return 3;
  }

  return 4;
};

export const getPreRideGuardedStep = (
  requestedStep: number,
  summary?: PreRideChecklistSummary,
) => PRE_RIDE_STEP_LOCK_ENABLED
  ? Math.min(
      clampStep(requestedStep, PRE_RIDE_STEP_COUNT),
      getPreRideUnlockedStep(summary),
    )
  : clampStep(requestedStep, PRE_RIDE_STEP_COUNT);

export const getPostRideGuardedStep = (
  requestedStep: number,
  aggregate?: PostRideChecklistAggregate,
) => POST_RIDE_STEP_LOCK_ENABLED
  ? Math.min(
      clampStep(requestedStep, POST_RIDE_STEP_COUNT),
      getPostRideUnlockedStep(aggregate),
    )
  : clampStep(requestedStep, POST_RIDE_STEP_COUNT);

export const getGuardedChecklistStepRoute = ({
  aggregate,
  flow,
  requestedStep,
  summary,
  trackerId,
}: {
  aggregate?: PostRideChecklistAggregate;
  flow: ChecklistFlow;
  requestedStep: number;
  summary?: PreRideChecklistSummary;
  trackerId: string;
}) => getChecklistStepRoute(
  flow,
  trackerId,
  flow === "preRide"
    ? getPreRideGuardedStep(requestedStep, summary)
    : getPostRideGuardedStep(requestedStep, aggregate),
);
