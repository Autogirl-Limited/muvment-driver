import type {
  DriverPayoutStatus,
  PaymentMethod,
  PaymentRequestType,
  PaymentStatus,
  RidePauseReason,
  VerificationStatus,
} from "../api/types";

export type PillTone = "neutral" | "success" | "warning" | "danger" | "accent";

export const PAYMENT_REQUEST_TYPES: PaymentRequestType[] = ["OFF_DAY", "INTERSTATE", "EXTRA_HOURS", "AIRPORT_TICKET"];

export const PAYMENT_TYPE_LABELS: Record<PaymentRequestType, string> = {
  OFF_DAY: "Off-day allowance",
  INTERSTATE: "Interstate allowance",
  EXTRA_HOURS: "Extra hours",
  AIRPORT_TICKET: "Airport ticket",
};

export const PAYMENT_TYPE_DESCRIPTIONS: Record<PaymentRequestType, string> = {
  OFF_DAY: "You worked a trip on a day your schedule marks off",
  INTERSTATE: "You drove an interstate trip (one claim per day)",
  EXTRA_HOURS: "Extra hours customer support billed to the client",
  AIRPORT_TICKET: "Airport parking or entry ticket you paid",
};

export const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  PENDING: "Pending",
  VERIFIED: "Verified",
  NEEDS_REVIEW: "Needs review",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

export const VERIFICATION_TONES: Record<VerificationStatus, PillTone> = {
  PENDING: "neutral",
  VERIFIED: "success",
  NEEDS_REVIEW: "warning",
  REJECTED: "danger",
  WITHDRAWN: "neutral",
};

/** What the driver sees. NOT_DUE reads "Pending" (spec section 7). */
export const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  NOT_DUE: "Pending",
  AWAITING_CUSTOMER_PAYMENT: "Awaiting customer payment",
  PENDING_PAYMENT: "Pending payment",
  NOT_PAYABLE: "Not payable",
  PROCESSING: "Processing",
  PAID: "Paid",
  FAILED: "Failed",
};

export const PAYMENT_TONES: Record<PaymentStatus, PillTone> = {
  NOT_DUE: "neutral",
  AWAITING_CUSTOMER_PAYMENT: "warning",
  PENDING_PAYMENT: "accent",
  NOT_PAYABLE: "danger",
  PROCESSING: "accent",
  PAID: "success",
  FAILED: "danger",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  AUTOMATED: "Bank transfer",
  MANUAL: "Paid by hand",
};

export const PAYOUT_STATUS_LABELS: Record<DriverPayoutStatus, string> = {
  PROCESSING: "Processing",
  PAID: "Paid",
  FAILED: "Failed",
  VOIDED: "Voided",
};

export const PAYOUT_STATUS_TONES: Record<DriverPayoutStatus, PillTone> = {
  PROCESSING: "accent",
  PAID: "success",
  FAILED: "danger",
  VOIDED: "neutral",
};

export const PAUSE_REASONS: RidePauseReason[] = [
  "CUSTOMER_NOT_READY",
  "WAITING_AT_AIRPORT",
  "TRAFFIC_OR_ROADBLOCK",
  "VEHICLE_ISSUE",
  "CUSTOMER_STOP",
  "OTHER",
];

export const PAUSE_REASON_LABELS: Record<RidePauseReason, string> = {
  CUSTOMER_NOT_READY: "Customer not ready",
  WAITING_AT_AIRPORT: "Waiting at the airport",
  TRAFFIC_OR_ROADBLOCK: "Traffic or roadblock",
  VEHICLE_ISSUE: "Vehicle issue",
  CUSTOMER_STOP: "Customer stop",
  OTHER: "Other",
};

/** Plain words for request timeline actions; unknown actions are humanised. */
const EVENT_ACTION_LABELS: Record<string, string> = {
  SUBMITTED: "Submitted",
  EDITED: "Edited",
  UPDATED: "Edited",
  WITHDRAWN: "Withdrawn",
  CHECKS_RUN: "Checks ran",
  CHECKS_RERUN: "Checks ran again",
  RECHECKED: "Checks ran again",
  VERIFIED: "Verified",
  AUTO_VERIFIED: "Verified by System",
  UNVERIFIED: "Sent back for review",
  REJECTED: "Rejected",
  AUTO_REJECTED: "Rejected automatically",
  ADJUSTED: "Amount adjusted",
  LATE_ACCEPTED: "Late claim accepted",
  CUSTOMER_PAID: "Customer paid",
  PAYOUT_STARTED: "Payment started",
  PAYMENT_STARTED: "Payment started",
  PAID: "Paid",
  PAYMENT_FAILED: "Payment failed",
  PAYOUT_FAILED: "Payment failed",
  PAYMENT_RETRIED: "Payment retried",
  MARKED_NOT_PAYABLE: "Marked not payable",
  PAYOUT_VOIDED: "Payment voided",
};

export const getEventActionLabel = (action: string) => {
  const known = EVENT_ACTION_LABELS[action];

  if (known) {
    return known;
  }

  const words = action.replace(/_/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const nairaFormatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

export const formatNaira = (amount?: number | null) =>
  amount === null || amount === undefined || !Number.isFinite(amount) ? "—" : nairaFormatter.format(amount);

export const formatHours = (hours?: number | null) =>
  hours === null || hours === undefined ? "—" : `${hours} hr${hours === 1 ? "" : "s"}`;
