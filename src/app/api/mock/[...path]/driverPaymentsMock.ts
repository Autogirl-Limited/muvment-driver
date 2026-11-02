import { NextResponse, type NextRequest } from "next/server";

/**
 * Dev mock for the Driver Payment Requests contract
 * (muvment-backend-mono/docs/driver-payment-requests-api.md): ride timer,
 * schedule, push devices, bank account and payment requests. State lives in
 * memory and resets when the dev server reloads this module.
 */

const ok = <T>(data: T, message = "Request successful") =>
  NextResponse.json({ status: "SUCCESSFUL", message, data, timestamp: new Date().toISOString() });

const fail = (status: number, message: string) =>
  NextResponse.json({ status: "FAILED", message, timestamp: new Date().toISOString() }, { status });

const page = <T>(items: T[], request: NextRequest) => {
  const pageNumber = Number(request.nextUrl.searchParams.get("page") ?? 0);
  const size = Number(request.nextUrl.searchParams.get("size") ?? 20);
  return {
    content: items.slice(pageNumber * size, pageNumber * size + size),
    currentPage: pageNumber,
    pageSize: size,
    totalItems: items.length,
    totalPages: Math.max(1, Math.ceil(items.length / size)),
  };
};

/* ------------------------------------------------------------------ Lagos time */
const LAGOS_OFFSET_MS = 3_600_000;
const lagos = (ms: number) => new Date(ms + LAGOS_OFFSET_MS).toISOString().slice(0, 19);
const lagosDate = (ms: number) => lagos(ms).slice(0, 10);
/** Record timestamps (event createdAt, bank account updatedAt/replacedAt) are UTC without an offset. */
const utc = (ms: number) => new Date(ms).toISOString().slice(0, 19);
/** Request, payout and bank account objects leave out null fields (@JsonInclude NON_NULL). */
const withoutNulls = <T extends Record<string, unknown>>(value: T) =>
  Object.fromEntries(Object.entries(value).filter(([, field]) => field !== null && field !== undefined)) as T;
const reportedOrNow = (body: { reportedAt?: string }) => {
  const parsed = body.reportedAt ? Date.parse(body.reportedAt) : NaN;
  return Number.isNaN(parsed) ? Date.now() : parsed;
};
const WEEKDAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const weekdayOf = (date: string) => WEEKDAYS[new Date(`${date}T12:00:00+01:00`).getUTCDay()];
const HOUR = 3_600_000;
const BOOT = Date.now();

/* ------------------------------------------------------------------ ride timer */
type Pause = { id: string; pausedAt: string; resumedAt: string | null; reason: string; note: string | null };
type RideState = {
  status: string;
  bookedStartMs: number;
  bookedEndMs: number;
  actualStartMs: number | null;
  startMethod: "DRIVER" | "AUTO" | null;
  actualEndMs: number | null;
  endMethod: "DRIVER" | "SUPPORT" | null;
  pauses: Pause[];
  closeoutStatus: "OPEN" | "CLOSED";
};

const PRE_RIDE = ["NOT_STARTED", "CHECKED_IN", "AWAITING_PICKUP", "RUNNING_LATE"];

/**
 * In-memory state, kept on globalThis so it survives `next dev` recompiling
 * this route (each recompile would otherwise start from scratch).
 */
type MockStore = {
  rides: Map<string, RideState>;
  bank: { current: Record<string, unknown> | null; history: Record<string, unknown>[] };
  requests: MockRequest[];
  submitted: Map<string, MockRequest[]>;
  seq: { request: number };
};
const globalStore = globalThis as typeof globalThis & { __driverPaymentsMock?: MockStore };
const store: MockStore = (globalStore.__driverPaymentsMock ??= {
  rides: new Map(),
  bank: { current: null, history: [] },
  requests: [],
  submitted: new Map(),
  seq: { request: 410 },
});
const rides = store.rides;

export const registerMockRide = (tripId: string, init: Partial<RideState> & { status: string; bookedStartMs: number; bookedEndMs: number }) => {
  if (!rides.has(tripId)) {
    rides.set(tripId, {
      actualStartMs: null,
      startMethod: null,
      actualEndMs: null,
      endMethod: null,
      pauses: [],
      closeoutStatus: "OPEN",
      ...init,
    });
  }
};

/** Server sweep: auto-start at booked start, extra time after booked end. */
const sweep = (state: RideState) => {
  const now = Date.now();
  if (PRE_RIDE.includes(state.status) && now >= state.bookedStartMs && !state.actualStartMs) {
    state.status = "ONGOING";
    state.actualStartMs = state.bookedStartMs;
    state.startMethod = "AUTO";
  }
  if (state.status === "ONGOING" && !state.actualEndMs && now >= state.bookedEndMs) {
    state.status = "EXTRA_TIME";
  }
};

const timerOf = (state: RideState) => {
  const now = Date.now();
  const open = state.pauses.find((pause) => !pause.resumedAt) ?? null;
  const endMs = state.actualEndMs ?? now;
  return {
    bookedStartAt: lagos(state.bookedStartMs),
    bookedEndAt: lagos(state.bookedEndMs),
    originalEndAt: lagos(state.bookedEndMs),
    actualStartAt: state.actualStartMs ? lagos(state.actualStartMs) : null,
    startMethod: state.startMethod,
    actualEndAt: state.actualEndMs ? lagos(state.actualEndMs) : null,
    endMethod: state.endMethod,
    paused: Boolean(open),
    currentPause: open,
    pauses: state.pauses,
    extraTimeMinutes: state.actualStartMs ? Math.max(0, Math.floor((endMs - state.bookedEndMs) / 60_000)) : 0,
    inExtraTime: !state.actualEndMs && Boolean(state.actualStartMs) && now >= state.bookedEndMs,
    closeoutStatus: state.closeoutStatus,
    serverNow: lagos(now),
  };
};

/** Merges the mock ride state into a trip object (list item or details). */
export const withRide = <T extends { id: string }>(trip: T) => {
  const state = rides.get(trip.id);
  if (!state) return trip;
  sweep(state);
  return {
    ...trip,
    startDateTime: lagos(state.bookedStartMs),
    endDateTime: lagos(state.bookedEndMs),
    driverTripStatus: state.status,
    standardTripStatus:
      state.status === "COMPLETE" ? "COMPLETED" : state.status === "CANCELLED" ? "CANCELLED" : PRE_RIDE.includes(state.status) ? "UPCOMING" : "ONGOING",
    rideTimer: timerOf(state),
  };
};

export const setMockRideStatus = (tripId: string, status: string) => {
  const state = rides.get(tripId);
  if (!state) return;
  if (status === "ONGOING" && !state.actualStartMs) {
    state.actualStartMs = Date.now();
    state.startMethod = "DRIVER";
  }
  if (status === "COMPLETE" && !state.actualEndMs) {
    state.actualEndMs = Date.now();
    state.endMethod = "DRIVER";
  }
  state.status = status;
};

const rideAction = async (request: NextRequest, tripId: string, action: string) => {
  const state = rides.get(tripId);
  if (!state) return fail(404, "Trip not found");
  sweep(state);
  const body = (await request.json().catch(() => ({}))) as { reportedAt?: string; reason?: string; note?: string };
  const at = reportedOrNow(body);

  switch (action) {
    case "start":
      if (state.actualStartMs) return ok(timerOf(state));
      if (state.status === "CANCELLED") return fail(400, "This trip was cancelled.");
      state.actualStartMs = at;
      state.startMethod = "DRIVER";
      // The sweep moves it to EXTRA_TIME once the booked end passes.
      state.status = "ONGOING";
      return ok(timerOf(state));
    case "pause":
      if (!["ONGOING", "EXTRA_TIME"].includes(state.status) || state.actualEndMs) {
        return fail(400, "You can only pause a ride that is in progress.");
      }
      // Already paused (or a replay): the timer unchanged, like the backend.
      if (state.pauses.some((pause) => !pause.resumedAt)) return ok(timerOf(state));
      state.pauses.push({ id: `pause-${state.pauses.length + 1}`, pausedAt: lagos(at), resumedAt: null, reason: body.reason ?? "OTHER", note: body.note ?? null });
      return ok(timerOf(state));
    case "resume": {
      const open = state.pauses.find((pause) => !pause.resumedAt);
      if (!open) return ok(timerOf(state));
      open.resumedAt = lagos(at);
      return ok(timerOf(state));
    }
    case "end":
      if (state.actualEndMs) return ok(timerOf(state));
      if (!state.actualStartMs) return fail(400, "Start the ride before ending it.");
      state.pauses.forEach((pause) => {
        if (!pause.resumedAt) pause.resumedAt = lagos(at);
      });
      state.actualEndMs = at;
      state.endMethod = "DRIVER";
      state.status = "COMPLETE";
      return ok(timerOf(state));
  }

  return fail(404, "Unknown ride action");
};

/* ------------------------------------------------------------------ schedule */
const schedule = (weeks: number) => {
  const now = Date.now();
  const todayLagos = new Date(`${lagosDate(now)}T12:00:00+01:00`);
  const mondayOffset = (todayLagos.getUTCDay() + 6) % 7;
  const mondayMs = todayLagos.getTime() - mondayOffset * 24 * HOUR;

  return Array.from({ length: weeks }, (_, weekIndex) => {
    const weekStartMs = mondayMs + weekIndex * 7 * 24 * HOUR;
    const scheduled = weekIndex === 0;
    return {
      weekStartDate: lagosDate(weekStartMs),
      scheduled,
      days: Array.from({ length: 7 }, (_, dayIndex) => {
        const date = lagosDate(weekStartMs + dayIndex * 24 * HOUR);
        const off = scheduled && (dayIndex === 2 || dayIndex === 6);
        return {
          date,
          weekday: weekdayOf(date),
          shift: scheduled ? (off ? "NONE" : dayIndex === 4 ? "NIGHT" : "DAY") : null,
          off,
        };
      }),
    };
  });
};

/* ------------------------------------------------------------------ bank account */
const DRIVER_NAME = { firstName: "Adaeze", lastName: "Okafor" };
const BANKS = [
  { name: "Access Bank", code: "044" },
  { name: "Guaranty Trust Bank", code: "058" },
  { name: "First Bank of Nigeria", code: "011" },
  { name: "Kuda Microfinance Bank", code: "50211" },
  { name: "Moniepoint MFB", code: "50515" },
  { name: "Opay", code: "999992" },
  { name: "United Bank For Africa", code: "033" },
  { name: "Zenith Bank", code: "057" },
];
const bankHistory = store.bank.history;

/* ------------------------------------------------------------------ payment requests */
type MockRequest = Record<string, unknown> & {
  id: string;
  type: string;
  verificationStatus: string;
  paymentStatus: string;
  tripId: string;
  submittedAt: string;
  events: Record<string, unknown>[];
};

const requests = store.requests;
const submitted = store.submitted;
const RATES = {
  OFF_DAY: { amount: 9000, unit: "PER_DAY" },
  INTERSTATE: { amount: 7000, unit: "PER_DAY" },
  EXTRA_HOURS: { amount: 2000, unit: "PER_HOUR" },
  AIRPORT_TICKET: { unit: "ACTUAL" },
  claimWindowDays: 30,
};

/** Finished trips the driver can claim for (relative to when the server started). */
const CLAIM_TRIPS = [
  {
    tripId: "trip-3",
    bookingId: "bk-1093",
    invoiceNumber: "INVAG-1093",
    customerName: "Mr Clark Hakeam",
    bookingTypeName: "Airport Pickup",
    startMs: BOOT - 30 * HOUR,
    endMs: BOOT - 26 * HOUR,
    closed: true,
    interstate: false,
    overtimes: [] as { overtimeId: string; invoiceNumber: string; hours: number; paymentStatus: string }[],
  },
  {
    tripId: "trip-6",
    bookingId: "bk-1071",
    invoiceNumber: "INVAG-1071",
    customerName: "Ada Obi",
    bookingTypeName: "24 Hours",
    startMs: BOOT - 4 * 24 * HOUR,
    endMs: BOOT - 2 * 24 * HOUR,
    closed: true,
    interstate: true,
    overtimes: [{ overtimeId: "ot-42", invoiceNumber: "INVOT0042", hours: 2, paymentStatus: "PAID" }],
  },
  {
    tripId: "trip-7",
    bookingId: "bk-1102",
    invoiceNumber: "INVAG-1102",
    customerName: "Tunde Bakare",
    bookingTypeName: "12 Hours",
    startMs: BOOT - 20 * HOUR,
    endMs: BOOT - 8 * HOUR,
    closed: false,
    interstate: false,
    overtimes: [{ overtimeId: "ot-51", invoiceNumber: "INVOT0051", hours: 1, paymentStatus: "PENDING" }],
  },
];

const tripDates = (startMs: number, endMs: number) => {
  const dates: string[] = [];
  for (let ms = startMs; lagosDate(ms) <= lagosDate(endMs); ms += 24 * HOUR) {
    const date = lagosDate(ms);
    if (!dates.includes(date)) dates.push(date);
  }
  return dates;
};

const isLive = (request: MockRequest) => !["REJECTED", "WITHDRAWN"].includes(request.verificationStatus);

const eligibleTrips = (type: string, search: string) => {
  const offDays = new Set(schedule(2).flatMap((week) => week.days.filter((day) => day.off).map((day) => day.date)));
  return CLAIM_TRIPS.filter((trip) =>
    !search || `${trip.invoiceNumber} ${trip.customerName} ${trip.tripId}`.toLowerCase().includes(search.toLowerCase()),
  ).map((trip) => {
    let reason: string | null = null;
    if (type === "INTERSTATE" && !trip.interstate) reason = "Booking is not interstate";
    if (type === "EXTRA_HOURS" && !trip.closed) reason = "Waiting for customer support to close this trip";
    if (type === "EXTRA_HOURS" && trip.closed && trip.overtimes.length === 0) reason = "No extra hours were billed for this trip";
    return {
      tripId: trip.tripId,
      bookingId: trip.bookingId,
      invoiceNumber: trip.invoiceNumber,
      customerName: trip.customerName,
      bookingTypeName: trip.bookingTypeName,
      startAt: lagos(trip.startMs),
      endAt: lagos(trip.endMs),
      eligible: reason === null,
      ...(reason ? { reason } : {}),
      dates:
        type === "OFF_DAY" || type === "INTERSTATE"
          ? tripDates(trip.startMs, trip.endMs).map((date) => ({
              date,
              weekday: weekdayOf(date),
              claimed: requests.some((item) => isLive(item) && item.type === type && item.workDate === date),
              ...(type === "OFF_DAY" ? { offDay: offDays.has(date) } : {}),
            }))
          : [],
      overtimes:
        type === "EXTRA_HOURS"
          ? trip.overtimes.map((overtime) => ({
              ...overtime,
              claimed: requests.some((item) => isLive(item) && item.overtimeId === overtime.overtimeId),
            }))
          : [],
    };
  });
};

const checksFor = (request: MockRequest) => {
  const base = [
    { code: "DRIVER_ON_TRIP", label: "Driver did this trip", result: "PASS", message: null },
    { code: "TRIP_FINISHED", label: "Trip finished", result: "PASS", message: null },
    { code: "CLAIM_WINDOW", label: "Inside claim window", result: "PASS", message: null },
  ];
  switch (request.type) {
    case "OFF_DAY":
      return [
        ...base,
        { code: "WORKED_ON_DATE", label: "Worked on that date", result: "PASS", message: null },
        request.offDay
          ? { code: "OFF_DAY_SCHEDULED", label: "Off day in schedule", result: "PASS", message: null }
          : { code: "OFF_DAY_SCHEDULED", label: "Off day in schedule", result: "FAIL", message: "Schedule shows a working day" },
      ];
    case "INTERSTATE":
      return [...base, { code: "INTERSTATE", label: "Interstate booking", result: "PASS", message: null }];
    case "EXTRA_HOURS":
      return [
        ...base,
        { code: "BILLED_HOURS", label: "Billed hours", result: "PASS", message: null },
        { code: "MEASURED_EXTRA_TIME", label: "Measured extra time agrees", result: "INFO", message: "Ride timer measured 1h 40m" },
        { code: "CUSTOMER_PAID", label: "Customer paid", result: "PASS", message: null },
      ];
    default:
      return [
        ...base,
        { code: "AIRPORT_BOOKING", label: "Airport booking and ticket count", result: "PASS", message: null },
        { code: "TICKET_TIMES", label: "Ticket times inside trip", result: "PASS", message: null },
        { code: "MANUAL_REVIEW", label: "Person must check", result: "FAIL", message: "Ticket needs checking" },
      ];
  }
};

const event = (action: string, extra: Record<string, unknown> = {}) => ({
  id: `ev-${Math.random().toString(36).slice(2, 9)}`,
  action,
  fromVerification: null,
  toVerification: null,
  fromPayment: null,
  toPayment: null,
  actor: "You",
  note: null,
  createdAt: utc(Date.now()),
  ...extra,
});

const evaluate = (request: MockRequest) => {
  const checks = checksFor(request);
  request.checks = checks;
  const failed = checks.some((check) => check.result === "FAIL");
  const before = request.verificationStatus;
  request.verificationStatus = failed ? "NEEDS_REVIEW" : "VERIFIED";
  request.verificationMethod = failed ? null : "SYSTEM";
  request.verifiedBy = failed ? null : "System";
  request.paymentStatus = failed ? "NOT_DUE" : "PENDING_PAYMENT";
  request.canEdit = failed;
  request.canWithdraw = failed;
  request.events.push(
    event(failed ? "CHECKS_RUN" : "AUTO_VERIFIED", {
      actor: "System",
      fromVerification: before,
      toVerification: request.verificationStatus,
      toPayment: request.paymentStatus,
      note: failed ? checks.filter((check) => check.result === "FAIL").map((check) => check.message).join("; ") : null,
    }),
  );
};

const createRequest = (type: string, comment: string | undefined, item: Record<string, unknown>): MockRequest => {
  const trip = CLAIM_TRIPS.find((candidate) => candidate.tripId === item.tripId) ?? CLAIM_TRIPS[0];
  store.seq.request += 1;
  const requestSeq = store.seq.request;
  const overtime = trip.overtimes.find((candidate) => candidate.overtimeId === item.overtimeId);
  const unitRate = type === "AIRPORT_TICKET" ? null : RATES[type as "OFF_DAY"].amount;
  const amount =
    type === "AIRPORT_TICKET"
      ? Number(item.amount ?? 0)
      : type === "EXTRA_HOURS"
        ? Number(item.hoursClaimed ?? 0) * (unitRate ?? 0)
        : unitRate ?? 0;
  const offDays = new Set(schedule(2).flatMap((week) => week.days.filter((day) => day.off).map((day) => day.date)));
  const ocr = item.ocr as Record<string, unknown> | null | undefined;
  const changedFields = ocr
    ? ["airportName", "entryAt", "exitAt", "ticketNumber", "amount"].filter(
        (field) => ocr[field] !== null && ocr[field] !== undefined && String(ocr[field]) !== String(item[field] ?? ""),
      )
    : [];

  const request: MockRequest = {
    id: `req-${requestSeq}`,
    requestNumber: `DPR-2026-000${requestSeq}`,
    type,
    bookingId: trip.bookingId,
    tripId: trip.tripId,
    bookingInvoiceNumber: trip.invoiceNumber,
    customerName: trip.customerName,
    tripStartAt: lagos(trip.startMs),
    tripEndAt: lagos(trip.endMs),
    bookingTypeName: trip.bookingTypeName,
    workDate: (item.workDate as string) ?? null,
    offDay: item.workDate ? offDays.has(item.workDate as string) : false,
    overtimeId: overtime?.overtimeId ?? null,
    overtimeInvoiceNumber: overtime?.invoiceNumber ?? null,
    overtimePaymentStatus: overtime?.paymentStatus ?? null,
    hoursClaimed: (item.hoursClaimed as number) ?? null,
    hoursApproved: (item.hoursClaimed as number) ?? null,
    airport:
      type === "AIRPORT_TICKET"
        ? {
            airportName: item.airportName,
            entryAt: item.entryAt,
            exitAt: item.exitAt,
            ticketNumber: item.ticketNumber,
            amount: item.amount,
            ocr: ocr ?? null,
            changedFields,
          }
        : null,
    attachments: ((item.attachmentUrls as string[]) ?? []).map((url, index) => ({ id: `att-${index}`, url, contentType: "image/jpeg" })),
    unitRate,
    amount,
    approvedAmount: amount,
    comment: comment ?? null,
    verificationStatus: "PENDING",
    paymentStatus: "NOT_DUE",
    flagged: false,
    lateAccepted: false,
    submittedAt: lagos(Date.now()),
    events: [event("SUBMITTED", { toVerification: "PENDING", toPayment: "NOT_DUE", note: comment ?? null })],
  };
  evaluate(request);
  return request;
};

/* ------------------------------------------------------------------ payouts */
const payouts = [
  {
    id: "payout-1",
    reference: "DRVPAY-2026-000123",
    method: "AUTOMATED",
    amount: 23000,
    paidAt: lagos(BOOT - 6 * 24 * HOUR),
    status: "PAID",
    bankName: "Guaranty Trust Bank",
    accountNumberMasked: "******4821",
    accountName: "OKAFOR ADAEZE",
    manualReference: null,
    receiptNumber: "DRVR-2026-000123",
    requestCount: 2,
    requests: [
      { id: "req-401", requestNumber: "DPR-2026-000401", type: "OFF_DAY", bookingInvoiceNumber: "INVAG-1001", workDate: lagosDate(BOOT - 9 * 24 * HOUR), hoursApproved: null, amount: 9000 },
      { id: "req-402", requestNumber: "DPR-2026-000402", type: "INTERSTATE", bookingInvoiceNumber: "INVAG-1003", workDate: lagosDate(BOOT - 8 * 24 * HOUR), hoursApproved: null, amount: 14000 },
    ],
  },
  {
    id: "payout-2",
    reference: "DRVPAY-2026-000131",
    method: "MANUAL",
    amount: 5000,
    paidAt: lagos(BOOT - 2 * 24 * HOUR),
    status: "PAID",
    bankName: "Guaranty Trust Bank",
    accountNumberMasked: "******4821",
    accountName: "OKAFOR ADAEZE",
    manualReference: "TRF/88213",
    receiptNumber: "DRVR-2026-000131",
    requestCount: 1,
    requests: [{ id: "req-405", requestNumber: "DPR-2026-000405", type: "AIRPORT_TICKET", bookingInvoiceNumber: "INVAG-1040", workDate: null, hoursApproved: null, amount: 5000 }],
  },
];

const RECEIPT_PDF = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length 60>>stream
BT /F1 16 Tf 40 120 Td (Mock driver payout receipt) Tj ET
endstream endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
trailer<</Root 1 0 R>>
%%EOF`;

/* ------------------------------------------------------------------ router */
export const handleDriverPaymentsMock = async (request: NextRequest, path: string): Promise<NextResponse | Response | null> => {
  const method = request.method;
  const params = request.nextUrl.searchParams;

  const ride = path.match(/^driver-app\/trips\/([^/]+)\/(start|pause|resume|end)$/);
  if (ride && method === "POST") return rideAction(request, decodeURIComponent(ride[1]), ride[2]);

  if (path === "driver-app/schedule") return ok(schedule(Number(params.get("weeks") ?? 2)));

  if (path === "driver-app/devices/push-config") {
    return ok({ publicKey: "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U", enabled: true });
  }
  if (path === "driver-app/devices/push-token") {
    return method === "DELETE" ? ok(null, "Push subscription removed.") : ok({ id: "push-1" }, "Push subscription saved.");
  }

  if (path === "banks") {
    const query = params.get("searchQuery")?.toLowerCase();
    return ok(query ? BANKS.filter((bank) => bank.name.toLowerCase().includes(query)) : BANKS);
  }
  if (path === "driver-app/payments/bank-account" && method === "GET") {
    return ok({ current: store.bank.current, history: bankHistory, driverName: DRIVER_NAME });
  }
  if (path === "driver-app/payments/bank-account/resolve") {
    const accountNumber = params.get("accountNumber") ?? "";
    // Numbers ending in 0 resolve to someone else, to show the mismatch message.
    const accountName = accountNumber.endsWith("0") ? "JOHN ADEBAYO" : "OKAFOR ADAEZE CHIOMA";
    const matches = !accountNumber.endsWith("0");
    return ok({
      accountName,
      matches,
      message: matches ? null : `The account name ${accountName} does not match the driver's name: missing last name "Okafor"`,
    });
  }
  if (path === "driver-app/payments/bank-account/request-otp") {
    const body = (await request.json().catch(() => ({}))) as { channel?: string };
    return ok({ channel: body.channel ?? "PHONE", destinationMasked: body.channel === "EMAIL" ? "d****r@example.com" : "+234 801 *** 5678" });
  }
  if (path === "driver-app/payments/bank-account" && method === "PUT") {
    const body = (await request.json()) as { bankCode: string; bankName: string; accountNumber: string; otp: string };
    if (body.otp !== "123456") return fail(400, "The code is wrong or has expired. (Mock: use 123456)");
    if (store.bank.current) bankHistory.unshift({ ...store.bank.current, status: "REPLACED", replacedAt: utc(Date.now()) });
    store.bank.current = {
      bankCode: body.bankCode,
      bankName: body.bankName,
      accountNumberMasked: `******${body.accountNumber.slice(-4)}`,
      accountName: "OKAFOR ADAEZE CHIOMA",
      verified: true,
      updatedAt: utc(Date.now()),
      source: "DRIVER_APP",
      status: "ACTIVE",
    };
    return ok(store.bank.current, "Bank account saved");
  }

  if (path === "driver-app/payments/summary") {
    const live = requests.filter(isLive);
    return ok({
      pendingVerificationCount: live.filter((item) => ["PENDING", "NEEDS_REVIEW"].includes(item.verificationStatus)).length,
      awaitingPaymentAmount: live
        .filter((item) => ["PENDING_PAYMENT", "AWAITING_CUSTOMER_PAYMENT", "PROCESSING"].includes(item.paymentStatus))
        .reduce((sum, item) => sum + Number(item.amount ?? 0), 0),
      paidThisMonthAmount: 28000,
      hasBankAccount: Boolean(store.bank.current),
    });
  }
  if (path === "driver-app/payments/rates") return ok(RATES);
  if (path === "driver-app/payments/eligible-trips") {
    return ok(eligibleTrips(params.get("type") ?? "OFF_DAY", params.get("search") ?? ""));
  }
  if (path === "driver-app/payments/ocr/airport-ticket") {
    const trip = CLAIM_TRIPS[0];
    // Exit time and ticket number "unreadable", to show the highlight.
    return ok({
      airportName: "MMIA Lagos",
      entryAt: lagos(trip.startMs + HOUR / 4),
      exitAt: null,
      ticketNumber: null,
      amount: 5000,
      readable: true,
      notes: "Exit time and ticket number were unclear",
    });
  }
  if (path === "driver-app/payments/requests" && method === "POST") {
    // Same Idempotency-Key, same answer: a double tap creates the requests once.
    const idempotencyKey = request.headers.get("Idempotency-Key");
    const replay = idempotencyKey ? submitted.get(idempotencyKey) : undefined;
    if (replay) return ok({ requests: replay.map(withoutNulls) }, "Payment request submitted.");
    const body = (await request.json()) as { type: string; comment?: string; items: Record<string, unknown>[] };
    for (const item of body.items) {
      if (body.type === "OFF_DAY" && requests.some((existing) => isLive(existing) && existing.type === "OFF_DAY" && existing.workDate === item.workDate)) {
        return fail(409, `Off-day allowance for ${item.workDate} already claimed`);
      }
      if (body.type === "AIRPORT_TICKET" && requests.some((existing) => isLive(existing) && (existing.airport as { ticketNumber?: string } | null)?.ticketNumber === item.ticketNumber)) {
        return fail(409, "This ticket has already been claimed");
      }
    }
    const created = body.items.map((item) => createRequest(body.type, body.comment, item));
    requests.unshift(...created);
    if (idempotencyKey) submitted.set(idempotencyKey, created);
    return ok({ requests: created.map(withoutNulls) }, "Payment request submitted.");
  }
  if (path === "driver-app/payments/requests" && method === "GET") {
    const type = params.get("type");
    const verification = params.get("verificationStatus");
    const payment = params.get("paymentStatus");
    const from = params.get("from");
    const to = params.get("to");
    const filtered = requests.filter(
      (item) =>
        (!type || item.type === type) &&
        (!verification || item.verificationStatus === verification) &&
        (!payment || item.paymentStatus === payment) &&
        (!from || item.submittedAt.slice(0, 10) >= from) &&
        (!to || item.submittedAt.slice(0, 10) <= to),
    );
    return ok(page(filtered.map((item) => withoutNulls({ ...item, events: undefined })), request));
  }
  const requestMatch = path.match(/^driver-app\/payments\/requests\/([^/]+)(\/withdraw)?$/);
  if (requestMatch) {
    const found = requests.find((item) => item.id === decodeURIComponent(requestMatch[1]));
    if (!found) return fail(404, "Request not found");
    if (requestMatch[2] && method === "POST") {
      if (!found.canWithdraw) return fail(409, "This request can't be withdrawn any more");
      found.events.push(event("WITHDRAWN", { fromVerification: found.verificationStatus, toVerification: "WITHDRAWN" }));
      found.events[found.events.length - 1].toPayment = "NOT_DUE";
      Object.assign(found, { verificationStatus: "WITHDRAWN", paymentStatus: "NOT_DUE", canEdit: false, canWithdraw: false });
      return ok(withoutNulls(found), "Request withdrawn");
    }
    if (method === "PATCH") {
      if (!found.canEdit) return fail(409, "This request can't be edited any more");
      const body = (await request.json()) as Record<string, unknown>;
      const updated = createRequest(found.type, (body.comment as string) || undefined, { ...body, tripId: found.tripId });
      Object.assign(found, { ...updated, id: found.id, requestNumber: found.requestNumber, events: [...found.events, event("EDITED"), ...updated.events.slice(1)] });
      return ok(withoutNulls(found), "Request updated");
    }
    return ok(withoutNulls(found));
  }
  if (path === "driver-app/payments/payouts") {
    return ok(page(payouts.map((payout) => withoutNulls({ ...payout, requests: undefined })), request));
  }
  const payoutMatch = path.match(/^driver-app\/payments\/payouts\/([^/]+)(\/receipt)?$/);
  if (payoutMatch) {
    const payout = payouts.find((item) => item.id === decodeURIComponent(payoutMatch[1]));
    if (!payout) return fail(404, "Payout not found");
    if (payoutMatch[2]) {
      return new Response(RECEIPT_PDF, {
        headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${payout.receiptNumber}.pdf"` },
      });
    }
    return ok(withoutNulls(payout));
  }

  if (path === "upload-sink") return new Response(null, { status: 200 });

  return null;
};

