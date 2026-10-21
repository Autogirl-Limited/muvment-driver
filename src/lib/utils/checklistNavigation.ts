import type {
  PostRideChecklistAggregate,
  PreRideChecklistSummary,
} from "../api/types";

export type ChecklistFlow = "postRide" | "preRide";

const PRE_RIDE_STEP_COUNT = 4;
const POST_RIDE_STEP_COUNT = 4;

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
  options?: { tripId?: string },
) => {
  const trimmedTrackerId = checklistTrackerId.trim();
  const maxStep =
    flow === "preRide" ? PRE_RIDE_STEP_COUNT : POST_RIDE_STEP_COUNT;
  const safeStep = clampStep(step, maxStep);
  const basePath =
    flow === "preRide" ? "/checklist" : "/post-ride-checklist";
  const params = new URLSearchParams();

  params.set("trackerId", trimmedTrackerId);
  const tripId = options?.tripId?.trim();

  if (tripId) {
    params.set("tripId", tripId);
  }

  return `${basePath}/step${safeStep}?${params.toString()}`;
};

export const getPreRideStarterStepRoute = (
  tripId: string,
  step: number,
) => {
  const trimmedTripId = tripId.trim();
  const safeStep = clampStep(step, PRE_RIDE_STEP_COUNT);
  const params = new URLSearchParams();

  params.set("tripId", trimmedTripId);

  return `/checklist/step${safeStep}?${params.toString()}`;
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
) => Math.min(
  clampStep(requestedStep, PRE_RIDE_STEP_COUNT),
  getPreRideUnlockedStep(summary),
);

export const getPostRideGuardedStep = (
  requestedStep: number,
  aggregate?: PostRideChecklistAggregate,
) => Math.min(
  clampStep(requestedStep, POST_RIDE_STEP_COUNT),
  getPostRideUnlockedStep(aggregate),
);

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
