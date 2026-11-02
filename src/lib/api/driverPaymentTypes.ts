/**
 * Types for the "Driver Payment Requests" feature: ride timer, schedule, push
 * devices, bank account, payment requests and payouts. Shapes follow
 * muvment-backend-mono/docs/driver-payment-requests-api.md.
 *
 * Ride times are Africa/Lagos wall-clock date-times without an offset
 * (e.g. "2026-11-02T15:00:00"); see lib/utils/lagosTime.ts.
 */
import type { ApiResponse, PaginatedApiResponseData } from "./types";

/* ------------------------------------------------------------------ ride timer */
export type RideStartMethod = "DRIVER" | "AUTO";
export type RideEndMethod = "DRIVER" | "SUPPORT";
export type RideCloseoutStatus = "OPEN" | "CLOSED";

export type RidePauseReason =
  | "CUSTOMER_NOT_READY"
  | "WAITING_AT_AIRPORT"
  | "TRAFFIC_OR_ROADBLOCK"
  | "VEHICLE_ISSUE"
  | "CUSTOMER_STOP"
  | "OTHER";

export interface RidePause {
  id: string;
  pausedAt: string;
  resumedAt?: string | null;
  reason: RidePauseReason;
  note?: string | null;
}

export interface RideTimer {
  bookedStartAt?: string | null;
  bookedEndAt?: string | null;
  originalEndAt?: string | null;
  actualStartAt?: string | null;
  startMethod?: RideStartMethod | null;
  actualEndAt?: string | null;
  endMethod?: RideEndMethod | null;
  paused: boolean;
  currentPause?: RidePause | null;
  pauses?: RidePause[] | null;
  extraTimeMinutes?: number | null;
  inExtraTime?: boolean | null;
  closeoutStatus?: RideCloseoutStatus | null;
  serverNow?: string | null;
}

export type RideTimerResponse = ApiResponse<RideTimer>;

export type RideAction = "start" | "pause" | "resume" | "end";

export interface RideActionPayload {
  reportedAt?: string;
  reason?: RidePauseReason;
  note?: string;
}

/* ------------------------------------------------------------------ schedule */
export type DriverShift = "DAY" | "NIGHT" | "ALL_DAY" | "NONE";

export interface DriverScheduleDay {
  date: string;
  weekday: string;
  shift: DriverShift | null;
  off: boolean;
}

export interface DriverScheduleWeek {
  weekStartDate: string;
  scheduled?: boolean;
  days: DriverScheduleDay[];
}

export type DriverScheduleResponse = ApiResponse<DriverScheduleWeek[]>;

/* ------------------------------------------------------------------ push devices */
export interface PushConfig {
  publicKey: string;
  enabled: boolean;
}

export type PushConfigResponse = ApiResponse<PushConfig>;

export interface RegisterPushTokenPayload {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  platform: "WEB";
  appVersion?: string;
  userAgent?: string;
}

/* ------------------------------------------------------------------ bank account */
export interface Bank {
  name: string;
  code: string;
}

export type BanksResponse = ApiResponse<Bank[]>;

export interface DriverBankAccount {
  bankCode: string;
  bankName: string;
  accountNumberMasked: string;
  accountName: string;
  verified: boolean;
  updatedAt?: string | null;
  source?: string | null;
  status?: string | null;
  replacedAt?: string | null;
}

export interface DriverBankAccountOverview {
  current: DriverBankAccount | null;
  history: DriverBankAccount[];
  driverName: { firstName: string; lastName: string };
}

export type DriverBankAccountOverviewResponse = ApiResponse<DriverBankAccountOverview>;

export interface ResolveBankAccountResult {
  accountName: string;
  matches: boolean;
  message?: string | null;
}

export type ResolveBankAccountResponse = ApiResponse<ResolveBankAccountResult>;

export type OtpChannel = "EMAIL" | "PHONE";

export interface RequestBankOtpResult {
  channel: OtpChannel;
  destinationMasked: string;
}

export type RequestBankOtpResponse = ApiResponse<RequestBankOtpResult>;

export interface SaveBankAccountPayload {
  bankCode: string;
  bankName: string;
  accountNumber: string;
  otp: string;
}

export type SaveBankAccountResponse = ApiResponse<DriverBankAccount>;

/* ------------------------------------------------------------------ payment requests */
export type PaymentRequestType = "OFF_DAY" | "INTERSTATE" | "EXTRA_HOURS" | "AIRPORT_TICKET";

export type VerificationStatus = "PENDING" | "VERIFIED" | "NEEDS_REVIEW" | "REJECTED" | "WITHDRAWN";

export type PaymentStatus =
  | "NOT_DUE"
  | "AWAITING_CUSTOMER_PAYMENT"
  | "PENDING_PAYMENT"
  | "NOT_PAYABLE"
  | "PROCESSING"
  | "PAID"
  | "FAILED";

export type PaymentMethod = "AUTOMATED" | "MANUAL";

export interface AirportTicketOcr {
  airportName?: string | null;
  entryAt?: string | null;
  exitAt?: string | null;
  ticketNumber?: string | null;
  amount?: number | null;
  readable: boolean;
  notes?: string | null;
}

export interface PaymentRequestAirport {
  airportName?: string | null;
  entryAt?: string | null;
  exitAt?: string | null;
  ticketNumber?: string | null;
  amount?: number | null;
  ocr?: AirportTicketOcr | null;
  changedFields?: string[] | null;
}

export interface PaymentRequestAttachment {
  id: string;
  url: string;
  contentType?: string | null;
}

export type PaymentCheckResult = "PASS" | "FAIL" | "INFO";

export interface PaymentRequestCheck {
  code: string;
  label: string;
  result: PaymentCheckResult;
  message?: string | null;
}

export interface PaymentRequestEvent {
  id: string;
  action: string;
  fromVerification?: VerificationStatus | null;
  toVerification?: VerificationStatus | null;
  fromPayment?: PaymentStatus | null;
  toPayment?: PaymentStatus | null;
  actor?: string | null;
  note?: string | null;
  createdAt: string;
}

export interface DriverPaymentRequest {
  id: string;
  requestNumber: string;
  type: PaymentRequestType;
  bookingId?: string | null;
  tripId?: string | null;
  bookingInvoiceNumber?: string | null;
  customerName?: string | null;
  tripStartAt?: string | null;
  tripEndAt?: string | null;
  bookingTypeName?: string | null;
  workDate?: string | null;
  overtimeId?: string | null;
  overtimeInvoiceNumber?: string | null;
  overtimePaymentStatus?: string | null;
  hoursClaimed?: number | null;
  hoursApproved?: number | null;
  airport?: PaymentRequestAirport | null;
  attachments?: PaymentRequestAttachment[] | null;
  unitRate?: number | null;
  amount?: number | null;
  approvedAmount?: number | null;
  comment?: string | null;
  verificationStatus: VerificationStatus;
  verificationMethod?: "SYSTEM" | "MANUAL" | null;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  rejectionReason?: string | null;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod | null;
  payoutId?: string | null;
  payoutReference?: string | null;
  paidAt?: string | null;
  flagged?: boolean | null;
  checks?: PaymentRequestCheck[] | null;
  lateAccepted?: boolean | null;
  canEdit?: boolean | null;
  canWithdraw?: boolean | null;
  submittedAt?: string | null;
  events?: PaymentRequestEvent[] | null;
}

export type DriverPaymentRequestResponse = ApiResponse<DriverPaymentRequest>;
export type DriverPaymentRequestsPageResponse = ApiResponse<PaginatedApiResponseData<DriverPaymentRequest>>;

export interface DriverPaymentSummary {
  pendingVerificationCount: number;
  awaitingPaymentAmount: number;
  paidThisMonthAmount: number;
  hasBankAccount: boolean;
}

export type DriverPaymentSummaryResponse = ApiResponse<DriverPaymentSummary>;

export interface DriverPaymentRate {
  amount: number | null;
  unit: string;
}

export interface DriverPaymentRates {
  OFF_DAY?: DriverPaymentRate;
  INTERSTATE?: DriverPaymentRate;
  EXTRA_HOURS?: DriverPaymentRate;
  AIRPORT_TICKET?: DriverPaymentRate;
  claimWindowDays?: number;
}

export type DriverPaymentRatesResponse = ApiResponse<DriverPaymentRates>;

export interface EligibleTripDate {
  date: string;
  weekday: string;
  claimed: boolean;
  offDay?: boolean | null;
}

export interface EligibleTripOvertime {
  overtimeId: string;
  invoiceNumber: string;
  hours: number;
  paymentStatus: string;
  claimed: boolean;
}

export interface EligibleTrip {
  tripId: string;
  bookingId?: string | null;
  invoiceNumber?: string | null;
  customerName?: string | null;
  bookingTypeName?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  eligible: boolean;
  reason?: string | null;
  dates?: EligibleTripDate[] | null;
  overtimes?: EligibleTripOvertime[] | null;
}

export type EligibleTripsResponse = ApiResponse<EligibleTrip[]>;

export type AirportTicketOcrResponse = ApiResponse<AirportTicketOcr>;

export interface PaymentRequestItemPayload {
  tripId: string;
  workDate?: string;
  overtimeId?: string;
  hoursClaimed?: number;
  airportName?: string;
  entryAt?: string;
  exitAt?: string;
  ticketNumber?: string;
  amount?: number;
  attachmentUrls?: string[];
  ocr?: AirportTicketOcr | null;
}

export interface SubmitPaymentRequestPayload {
  type: PaymentRequestType;
  comment?: string;
  items: PaymentRequestItemPayload[];
}

export type UpdatePaymentRequestPayload = Partial<PaymentRequestItemPayload> & {
  comment?: string;
};

export type SubmitPaymentRequestResponse = ApiResponse<{ requests: DriverPaymentRequest[] }>;

export type DriverPayoutStatus = "PROCESSING" | "PAID" | "FAILED" | "VOIDED";

export interface DriverPayout {
  id: string;
  reference: string;
  method: PaymentMethod;
  amount: number;
  paidAt?: string | null;
  status: DriverPayoutStatus;
  bankName?: string | null;
  accountNumberMasked?: string | null;
  manualReference?: string | null;
  receiptNumber?: string | null;
  requestCount?: number | null;
}

export interface DriverPayoutRequestSummary {
  id: string;
  requestNumber: string;
  type: PaymentRequestType;
  bookingInvoiceNumber?: string | null;
  workDate?: string | null;
  hoursApproved?: number | null;
  amount: number;
}

export interface DriverPayoutDetail extends DriverPayout {
  requests?: DriverPayoutRequestSummary[] | null;
  accountName?: string | null;
  failureReason?: string | null;
  createdAt?: string | null;
}

export type DriverPayoutsPageResponse = ApiResponse<PaginatedApiResponseData<DriverPayout>>;
export type DriverPayoutDetailResponse = ApiResponse<DriverPayoutDetail>;

export interface DriverPaymentRequestFilters {
  type?: PaymentRequestType;
  verificationStatus?: VerificationStatus;
  paymentStatus?: PaymentStatus;
  from?: string;
  to?: string;
  page?: number;
  size?: number;
}
