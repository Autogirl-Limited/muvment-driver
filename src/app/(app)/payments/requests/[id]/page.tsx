"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, ChevronRight, Info, Pencil, Receipt, Undo2, XCircle } from "lucide-react";

import { PaymentPill, PaymentTypeIcon, VerificationPill } from "@/components/payments/PaymentBits";
import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import { AlertDialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { NavBar, Screen, SectionHeader } from "@/components/ui/Screen";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { getApiErrorMessage } from "@/lib/api/errors";
import { openPayoutReceipt, usePaymentRequest, useWithdrawPaymentRequest } from "@/lib/api/hooks/useDriverPayments";
import type { DriverPaymentRequest, PaymentRequestCheck } from "@/lib/api/types";
import {
  formatHours,
  formatNaira,
  getEventActionLabel,
  PAYMENT_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_TYPE_LABELS,
  VERIFICATION_LABELS,
} from "@/lib/payments/labels";
import { formatLagosDate, formatLagosDateTime, formatLagosShortDate, formatUtcDateTime } from "@/lib/utils/lagosTime";
import { useToast } from "@/providers/ToastProvider";

const Row = ({ label, value, note }: { label: string; value?: ReactNode; note?: ReactNode }) => (
  <div className="px-4 py-3">
    <div className="flex items-start justify-between gap-4">
      <span className="text-callout shrink-0 text-text-3">{label}</span>
      <span className="text-callout min-w-0 text-right font-medium break-words text-text">{value ?? "—"}</span>
    </div>
    {note && <div className="text-footnote mt-1 text-right text-text-3">{note}</div>}
  </div>
);

const CHECK_ICONS = {
  PASS: { icon: CheckCircle2, className: "text-success" },
  FAIL: { icon: AlertTriangle, className: "text-warning" },
  INFO: { icon: Info, className: "text-accent" },
} as const;

const CheckRow = ({ check }: { check: PaymentRequestCheck }) => {
  const { icon: Icon, className } = CHECK_ICONS[check.result] ?? CHECK_ICONS.INFO;
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <Icon size={18} className={`mt-[2px] shrink-0 ${className}`} />
      <div className="min-w-0 flex-1">
        <p className="text-callout font-medium text-text">{check.label}</p>
        {check.message && <p className="text-footnote mt-0.5 text-text-3">{check.message}</p>}
      </div>
    </div>
  );
};

const AIRPORT_FIELD_LABELS: Record<string, string> = {
  airportName: "Airport",
  entryAt: "Time in",
  exitAt: "Time out",
  ticketNumber: "Ticket number",
  amount: "Amount",
};

const SubmittedDetails = ({ request }: { request: DriverPaymentRequest }) => {
  const airport = request.airport;
  const changed = new Set(airport?.changedFields ?? []);
  /** When the driver changed a value read from the ticket, show what the ticket said. */
  const ticketSays = (
    field: "airportName" | "entryAt" | "exitAt" | "ticketNumber" | "amount",
    format: (value: string | number) => string | undefined = (value) => String(value),
  ) => {
    const ocrValue = airport?.ocr?.[field];
    if (!changed.has(field) || ocrValue === null || ocrValue === undefined) return undefined;
    return `Ticket says ${format(ocrValue) ?? String(ocrValue)}`;
  };

  return (
    <div className="inset-group [&>*+*]:border-t [&>*+*]:border-separator">
      {(request.type === "OFF_DAY" || request.type === "INTERSTATE") && (
        <Row label="Date worked" value={formatLagosShortDate(request.workDate)} />
      )}
      {request.type === "EXTRA_HOURS" && (
        <>
          <Row label="Overtime invoice" value={request.overtimeInvoiceNumber} />
          <Row label="Hours claimed" value={formatHours(request.hoursClaimed)} />
          {request.hoursApproved !== null &&
            request.hoursApproved !== undefined &&
            request.hoursApproved !== request.hoursClaimed && <Row label="Hours approved" value={formatHours(request.hoursApproved)} />}
          <Row
            label="Customer payment"
            value={request.overtimePaymentStatus === "PAID" ? "Paid" : request.overtimePaymentStatus ? "Not paid yet" : undefined}
          />
        </>
      )}
      {request.type === "AIRPORT_TICKET" && airport && (
        <>
          <Row label={AIRPORT_FIELD_LABELS.airportName} value={airport.airportName} note={ticketSays("airportName")} />
          <Row
            label={AIRPORT_FIELD_LABELS.entryAt}
            value={formatLagosDateTime(airport.entryAt)}
            note={ticketSays("entryAt", (value) => formatLagosDateTime(String(value)))}
          />
          <Row
            label={AIRPORT_FIELD_LABELS.exitAt}
            value={formatLagosDateTime(airport.exitAt)}
            note={ticketSays("exitAt", (value) => formatLagosDateTime(String(value)))}
          />
          <Row label={AIRPORT_FIELD_LABELS.ticketNumber} value={airport.ticketNumber} note={ticketSays("ticketNumber")} />
          <Row
            label={AIRPORT_FIELD_LABELS.amount}
            value={formatNaira(airport.amount)}
            note={ticketSays("amount", (value) => formatNaira(Number(value)))}
          />
        </>
      )}
      <Row label="Rate" value={request.unitRate ? formatNaira(request.unitRate) : request.type === "AIRPORT_TICKET" ? "Ticket amount" : undefined} />
      {request.comment && <Row label="Your comment" value={request.comment} />}
      {(request.attachments?.length ?? 0) > 0 && (
        <div className="scrollbar-none flex gap-3 overflow-x-auto px-4 py-3">
          {request.attachments?.map((attachment) => (
            <a
              key={attachment.id}
              href={attachment.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block h-28 w-24 shrink-0 overflow-hidden rounded-xl border border-border bg-surface-alt"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- R2 attachment */}
              <img src={attachment.url} alt="Ticket photo" className="h-full w-full object-cover" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
};

export default function PaymentRequestDetailPage() {
  const router = useRouter();
  const toast = useToast();
  const params = useParams<{ id: string }>();
  const requestId = decodeURIComponent(params.id ?? "");
  const requestQuery = usePaymentRequest(requestId || undefined);
  const withdraw = useWithdrawPaymentRequest();
  const [isWithdrawOpen, setWithdrawOpen] = useState(false);
  const [isReceiptLoading, setReceiptLoading] = useState(false);
  const request = requestQuery.data?.data;
  const pull = usePullToRefresh(async () => {
    await requestQuery.refetch();
  });

  const back = <BackButton href="/payments" />;

  if (requestQuery.isLoading) {
    return (
      <Screen>
        <NavBar left={back} />
        <EmptyState loading title="Loading request" description="Fetching your payment request." />
      </Screen>
    );
  }

  if (requestQuery.isError || !request) {
    return (
      <Screen>
        <NavBar left={back} />
        <EmptyState
          title="Unable to load request"
          description={getApiErrorMessage(requestQuery.error) ?? "Please check your connection and try again."}
        />
      </Screen>
    );
  }

  const events = [...(request.events ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const amount = request.approvedAmount ?? request.amount;

  const showReceipt = async () => {
    if (!request.payoutId) return;
    setReceiptLoading(true);
    try {
      await openPayoutReceipt(request.payoutId);
    } catch (error) {
      toast.error("Couldn't open the receipt", getApiErrorMessage(error) ?? "Please try again.");
    } finally {
      setReceiptLoading(false);
    }
  };

  const confirmWithdraw = async () => {
    try {
      await withdraw.mutateAsync(request.id);
      setWithdrawOpen(false);
      toast.success("Request withdrawn");
    } catch (error) {
      setWithdrawOpen(false);
      toast.error("Couldn't withdraw", getApiErrorMessage(error) ?? "Please try again.");
    }
  };

  return (
    <Screen {...pull.bind}>
      {pull.indicator}
      <NavBar left={back} title={request.requestNumber} />

      <div className="anim-rise-in space-y-6 px-5 pt-3 pb-10">
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <PaymentTypeIcon type={request.type} />
            <div className="min-w-0 flex-1">
              <p className="text-headline text-text">{PAYMENT_TYPE_LABELS[request.type]}</p>
              <p className="text-footnote text-text-3">{request.requestNumber}</p>
            </div>
          </div>
          <p className="mt-4 text-[34px] leading-10 font-bold tracking-[-0.02em] tabular-nums text-text">{formatNaira(amount)}</p>
          {request.approvedAmount !== null &&
            request.approvedAmount !== undefined &&
            request.amount !== null &&
            request.amount !== undefined &&
            request.approvedAmount !== request.amount && (
              <p className="text-footnote text-text-3">You claimed {formatNaira(request.amount)}</p>
            )}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <p className="text-caption mb-1 text-text-3">Verification</p>
              <VerificationPill status={request.verificationStatus} />
            </div>
            <div>
              <p className="text-caption mb-1 text-text-3">Payment</p>
              <PaymentPill status={request.paymentStatus} />
            </div>
          </div>
          <p className="text-footnote mt-3 text-text-3">
            Submitted {formatLagosDateTime(request.submittedAt) ?? "—"}
            {request.verificationStatus === "VERIFIED" && request.verifiedBy ? ` · Verified by ${request.verifiedBy}` : ""}
          </p>
          {request.paymentStatus === "PAID" && (
            <p className="text-footnote mt-1 text-success-text">
              Paid {formatLagosDate(request.paidAt) ?? ""}
              {request.paymentMethod ? ` · ${PAYMENT_METHOD_LABELS[request.paymentMethod]}` : ""}
            </p>
          )}
          {request.paymentStatus === "AWAITING_CUSTOMER_PAYMENT" && (
            <p className="text-footnote mt-1 text-warning-text">You&apos;ll be paid once the customer pays the overtime invoice.</p>
          )}
        </div>

        {request.verificationStatus === "REJECTED" && (
          <div className="flex items-start gap-3 rounded-2xl bg-danger-soft px-4 py-3">
            <XCircle size={18} className="mt-[2px] shrink-0 text-danger" />
            <div>
              <p className="text-callout font-semibold text-danger-text">Rejected</p>
              <p className="text-footnote text-danger-text">{request.rejectionReason ?? "No reason given."}</p>
            </div>
          </div>
        )}

        <section>
          <SectionHeader>Booking</SectionHeader>
          {request.tripId ? (
            <Link href={`/trip/${encodeURIComponent(request.tripId)}`} className="card pressable flex items-center gap-3 p-4">
              <span className="min-w-0 flex-1">
                <span className="text-body block font-semibold text-text">{request.bookingInvoiceNumber ?? "Booking"}</span>
                <span className="text-footnote block text-text-2">
                  {[request.customerName, request.bookingTypeName].filter(Boolean).join(" · ")}
                </span>
                <span className="text-footnote block text-text-3">
                  {[formatLagosShortDate(request.tripStartAt), formatLagosShortDate(request.tripEndAt)]
                    .filter((value, index, list) => value && list.indexOf(value) === index)
                    .join(" – ")}
                </span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-text-4" />
            </Link>
          ) : (
            <p className="text-callout text-text-3">{request.bookingInvoiceNumber ?? "Booking unavailable"}</p>
          )}
        </section>

        <section>
          <SectionHeader>What you submitted</SectionHeader>
          <SubmittedDetails request={request} />
        </section>

        {(request.checks?.length ?? 0) > 0 && (
          <section>
            <SectionHeader>Checks</SectionHeader>
            <div className="inset-group [&>*+*]:border-t [&>*+*]:border-separator">
              {request.checks?.map((check) => <CheckRow key={check.code} check={check} />)}
            </div>
          </section>
        )}

        {events.length > 0 && (
          <section>
            <SectionHeader>Timeline</SectionHeader>
            <ol className="relative ml-2 border-l border-separator pl-5">
              {events.map((event) => (
                <li key={event.id} className="relative pb-4 last:pb-0">
                  <span className="absolute top-1.5 -left-[25px] h-2.5 w-2.5 rounded-full border-2 border-bg bg-accent" />
                  <p className="text-callout font-medium text-text">{getEventActionLabel(event.action)}</p>
                  <p className="text-footnote text-text-3">
                    {[formatUtcDateTime(event.createdAt), event.actor].filter(Boolean).join(" · ")}
                  </p>
                  {(event.toVerification || event.toPayment) && (
                    <p className="text-footnote text-text-3">
                      {[
                        event.toVerification && VERIFICATION_LABELS[event.toVerification],
                        event.toPayment && `Payment: ${PAYMENT_LABELS[event.toPayment]}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                  {event.note && <p className="text-footnote mt-1 rounded-lg bg-fill px-2.5 py-1.5 text-text-2">{event.note}</p>}
                </li>
              ))}
            </ol>
          </section>
        )}

        <div className="space-y-3">
          {request.paymentStatus === "PAID" && request.payoutId && (
            <Button icon={<Receipt size={18} />} loading={isReceiptLoading} onClick={() => void showReceipt()}>
              View receipt
            </Button>
          )}
          {request.payoutId && (
            <Button variant="outline" onClick={() => router.push(`/payments/payouts/${encodeURIComponent(request.payoutId ?? "")}`)}>
              View payment
            </Button>
          )}
          {request.canEdit && (
            <Button
              variant="secondary"
              icon={<Pencil size={17} />}
              onClick={() => router.push(`/payments/requests/${encodeURIComponent(request.id)}/edit`)}
            >
              Edit request
            </Button>
          )}
          {request.canWithdraw && (
            <Button variant="ghost" icon={<Undo2 size={17} />} className="text-danger" onClick={() => setWithdrawOpen(true)}>
              Withdraw request
            </Button>
          )}
        </div>
      </div>

      <AlertDialog
        open={isWithdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        onConfirm={() => void confirmWithdraw()}
        title="Withdraw this request?"
        message="It won't be checked or paid. You can make a new request later if you're still inside the claim window."
        confirmText="Withdraw"
        confirmVariant="danger"
        confirmLoading={withdraw.isPending}
      />
    </Screen>
  );
}
