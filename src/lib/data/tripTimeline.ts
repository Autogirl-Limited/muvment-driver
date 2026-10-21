import type { DriverTripStatus } from "../api/types";

export type TimelineState = "completed" | "current" | "upcoming";

export type TimelineStep = {
  id: string;
  title: string;
  state: TimelineState;
};

const STEP_TITLES = [
  "Trip Assigned",
  "Driver Check-In",
  "Client Pickup",
  "Ongoing Ride",
  "Trip Complete",
];

const buildTimeline = (currentIndex: number, allDone = false): TimelineStep[] =>
  STEP_TITLES.map((title, index) => ({
    id: String(index + 1),
    title,
    state: allDone || index < currentIndex ? "completed" : index === currentIndex ? "current" : "upcoming",
  }));

export const getTripTimeline = (status?: DriverTripStatus | null): TimelineStep[] => {
  switch (status) {
    case "CHECKED_IN":
    case "AWAITING_PICKUP":
    case "RUNNING_LATE":
      return buildTimeline(2);
    case "ONGOING":
    case "EXTRA_TIME":
      return buildTimeline(3);
    case "COMPLETE":
      return buildTimeline(5, true);
    case "NOT_STARTED":
    case "CANCELLED":
    default:
      return buildTimeline(1);
  }
};

export const getTripBannerMessage = (status?: DriverTripStatus | null) => {
  switch (status) {
    case "CHECKED_IN":
      return "Checked in. Proceed to pickup location.";
    case "AWAITING_PICKUP":
      return "Waiting for client. Tap 'Start Ride' when ready.";
    case "RUNNING_LATE":
      return "Pickup overdue. Contact operations.";
    case "ONGOING":
    case "EXTRA_TIME":
      return "Trip Ongoing - Complete Ride Safely";
    case "COMPLETE":
      return "Trip Complete";
    case "CANCELLED":
      return "Trip Cancelled";
    default:
      return "Trip Not Started - Check in to begin";
  }
};

export const POST_RIDE_EXTERIOR_PHOTOS = [
  { id: "rightSide", title: "Right Side", subtitle: "Right Side: Full side including wheels" },
  { id: "leftSide", title: "Left Side", subtitle: "Left Side: Full side including wheels" },
  { id: "front", title: "Front", subtitle: "Front: Including headlights, bumper, plate" },
  { id: "back", title: "Back", subtitle: "Back: Including taillights, bumper, plate" },
] as const;

export const POST_RIDE_DAMAGE_CONFIG = {
  title: "Additional (Optional)",
  subtitle: "Up to 3 damage close-ups",
  maxPhotos: 3,
} as const;
