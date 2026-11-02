"use client";

import Link from "next/link";
import { CalendarCheck, ChevronRight, Clock, Landmark, Map as MapIcon, Plane, Receipt } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Pill } from "@/components/ui/Badge";
import type {
  DriverPaymentRequest,
  DriverPayout,
  DriverPayoutStatus,
  PaymentRequestType,
  PaymentStatus,
  VerificationStatus,
} from "@/lib/api/types";
import {
  formatNaira,
  PAYMENT_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_TONES,
  PAYMENT_TYPE_LABELS,
  PAYOUT_STATUS_LABELS,
  PAYOUT_STATUS_TONES,
  VERIFICATION_LABELS,
  VERIFICATION_TONES,
} from "@/lib/payments/labels";
import { formatLagosDate, formatLagosShortDate } from "@/lib/utils/lagosTime";

export const PAYMENT_TYPE_ICONS: Record<PaymentRequestType, LucideIcon> = {
  OFF_DAY: CalendarCheck,
  INTERSTATE: MapIcon,
  EXTRA_HOURS: Clock,
  AIRPORT_TICKET: Plane,
};

export const PaymentTypeIcon = ({ type, size = 18 }: { type: PaymentRequestType; size?: number }) => {
  const Icon = PAYMENT_TYPE_ICONS[type];
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-accent-soft text-accent">
      <Icon size={size} />
    </span>
  );
};

export const VerificationPill = ({ status }: { status: VerificationStatus }) => (
  <Pill tone={VERIFICATION_TONES[status]}>{VERIFICATION_LABELS[status]}</Pill>
);

export const PaymentPill = ({ status }: { status: PaymentStatus }) => (
  <Pill tone={PAYMENT_TONES[status]}>{PAYMENT_LABELS[status]}</Pill>
);

export const PayoutStatusPill = ({ status }: { status: DriverPayoutStatus }) => (
  <Pill tone={PAYOUT_STATUS_TONES[status]}>{PAYOUT_STATUS_LABELS[status]}</Pill>
);

/** What the request is for, in one line: "Sun, 25 Oct", "2 hrs on INVOT0042", "MMIA ticket". */
export const getRequestSubject = (request: DriverPaymentRequest) => {
  switch (request.type) {
    case "OFF_DAY":
    case "INTERSTATE":
      return formatLagosShortDate(request.workDate) ?? "Date not set";
    case "EXTRA_HOURS":
      return `${request.hoursClaimed ?? 0} hr${request.hoursClaimed === 1 ? "" : "s"}${
        request.overtimeInvoiceNumber ? ` · ${request.overtimeInvoiceNumber}` : ""
      }`;
    case "AIRPORT_TICKET":
      return request.airport?.airportName ? `${request.airport.airportName} ticket` : "Airport ticket";
  }
};

export const PaymentRequestCard = ({ request }: { request: DriverPaymentRequest }) => (
  <Link
    href={`/payments/requests/${encodeURIComponent(request.id)}`}
    className="card pressable mb-3 block w-full p-4 text-left"
  >
    <div className="flex items-start gap-3">
      <PaymentTypeIcon type={request.type} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="text-body truncate font-semibold text-text">{PAYMENT_TYPE_LABELS[request.type]}</p>
          <p className="text-body shrink-0 font-semibold tabular-nums text-text">
            {formatNaira(request.approvedAmount ?? request.amount)}
          </p>
        </div>
        <p className="text-footnote mt-0.5 truncate text-text-3">
          {[request.bookingInvoiceNumber, request.customerName].filter(Boolean).join(" · ") || "Booking"}
        </p>
        <p className="text-footnote truncate text-text-3">{getRequestSubject(request)}</p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <VerificationPill status={request.verificationStatus} />
          <PaymentPill status={request.paymentStatus} />
        </div>
      </div>
    </div>
  </Link>
);

export const PayoutRow = ({
  payout,
  onReceipt,
  receiptLoading,
}: {
  payout: DriverPayout;
  onReceipt: () => void;
  receiptLoading?: boolean;
}) => (
  <div className="card mb-3 flex items-center gap-3 p-4">
    <Link href={`/payments/payouts/${encodeURIComponent(payout.id)}`} className="pressable-soft flex min-w-0 flex-1 items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-success-soft text-success">
        <Landmark size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-body block font-semibold tabular-nums text-text">{formatNaira(payout.amount)}</span>
        <span className="text-footnote block truncate text-text-3">
          {formatLagosDate(payout.paidAt) ?? "Not paid yet"} · {PAYMENT_METHOD_LABELS[payout.method]}
        </span>
        <span className="text-footnote block truncate text-text-4">
          {[payout.bankName, payout.accountNumberMasked].filter(Boolean).join(" ") || "Bank not shown"}
        </span>
      </span>
      {payout.status !== "PAID" && <PayoutStatusPill status={payout.status} />}
    </Link>
    {payout.status === "PAID" && payout.receiptNumber ? (
      <button
        type="button"
        onClick={onReceipt}
        disabled={receiptLoading}
        className="pressable flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] bg-accent-soft px-3 text-[13px] font-semibold text-accent-text disabled:opacity-50"
      >
        <Receipt size={15} />
        Receipt
      </button>
    ) : (
      <ChevronRight size={18} className="shrink-0 text-text-4" />
    )}
  </div>
);

export const SummaryCard = ({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "accent" | "success" }) => (
  <div className="card min-w-0 px-3 py-3">
    <p className="text-caption line-clamp-2 min-h-[32px] text-text-3">{label}</p>
    <p
      className={`mt-1 truncate text-[17px] leading-6 font-bold tabular-nums ${
        tone === "success" ? "text-success-text" : tone === "accent" ? "text-accent-text" : "text-text"
      }`}
    >
      {value}
    </p>
  </div>
);

export const NoBankAccountBanner = () => (
  <Link
    href="/payment-account"
    className="pressable mb-4 flex items-center gap-3 rounded-2xl border border-warning/30 bg-warning-soft px-4 py-3"
  >
    <Landmark size={20} className="shrink-0 text-warning-text" />
    <span className="min-w-0 flex-1">
      <span className="text-callout block font-semibold text-warning-text">Add your payment account</span>
      <span className="text-footnote block text-warning-text">We can&apos;t pay you until you add a bank account.</span>
    </span>
    <ChevronRight size={18} className="shrink-0 text-warning-text" />
  </Link>
);
