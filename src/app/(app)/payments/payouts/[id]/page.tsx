"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronRight, Receipt } from "lucide-react";

import { PaymentTypeIcon, PayoutStatusPill } from "@/components/payments/PaymentBits";
import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { NavBar, Screen, SectionHeader } from "@/components/ui/Screen";
import { getApiErrorMessage } from "@/lib/api/errors";
import { openPayoutReceipt, useDriverPayout } from "@/lib/api/hooks/useDriverPayments";
import { formatHours, formatNaira, PAYMENT_METHOD_LABELS, PAYMENT_TYPE_LABELS } from "@/lib/payments/labels";
import { formatLagosDateTime, formatLagosShortDate } from "@/lib/utils/lagosTime";
import { useToast } from "@/providers/ToastProvider";

const Row = ({ label, value }: { label: string; value?: string | null }) => (
  <div className="flex items-start justify-between gap-4 px-4 py-3">
    <span className="text-callout shrink-0 text-text-3">{label}</span>
    <span className="text-callout min-w-0 text-right font-medium break-words text-text">{value || "—"}</span>
  </div>
);

export default function PayoutDetailPage() {
  const toast = useToast();
  const params = useParams<{ id: string }>();
  const payoutId = decodeURIComponent(params.id ?? "");
  const payoutQuery = useDriverPayout(payoutId || undefined);
  const payout = payoutQuery.data?.data;
  const [isReceiptLoading, setReceiptLoading] = useState(false);
  const back = <BackButton href="/payments?tab=payouts" />;

  if (payoutQuery.isLoading) {
    return (
      <Screen>
        <NavBar left={back} />
        <EmptyState loading title="Loading payment" description="Fetching payment details." />
      </Screen>
    );
  }

  if (payoutQuery.isError || !payout) {
    return (
      <Screen>
        <NavBar left={back} />
        <EmptyState
          title="Unable to load payment"
          description={getApiErrorMessage(payoutQuery.error) ?? "Please check your connection and try again."}
        />
      </Screen>
    );
  }

  const showReceipt = async () => {
    setReceiptLoading(true);
    try {
      await openPayoutReceipt(payout.id);
    } catch (error) {
      toast.error("Couldn't open the receipt", getApiErrorMessage(error) ?? "Please try again.");
    } finally {
      setReceiptLoading(false);
    }
  };

  return (
    <Screen>
      <NavBar left={back} title={payout.reference} />
      <div className="anim-rise-in space-y-6 px-5 pt-3 pb-10">
        <div className="card p-5">
          <p className="text-footnote text-text-3">Amount</p>
          <p className="mt-1 text-[34px] leading-10 font-bold tracking-[-0.02em] tabular-nums text-text">{formatNaira(payout.amount)}</p>
          <div className="mt-3">
            <PayoutStatusPill status={payout.status} />
          </div>
          {payout.status === "FAILED" && payout.failureReason && (
            <p className="text-footnote mt-2 text-danger-text">{payout.failureReason}. Finance will retry or pay you by hand.</p>
          )}
          {payout.status === "PROCESSING" && (
            <p className="text-footnote mt-2 text-text-3">The transfer has been sent and is waiting for the bank.</p>
          )}
        </div>

        <div className="inset-group [&>*+*]:border-t [&>*+*]:border-separator">
          <Row label="Paid" value={formatLagosDateTime(payout.paidAt)} />
          <Row label="Method" value={PAYMENT_METHOD_LABELS[payout.method]} />
          <Row label="Bank" value={[payout.bankName, payout.accountNumberMasked].filter(Boolean).join(" ")} />
          {payout.accountName && <Row label="Account name" value={payout.accountName} />}
          <Row label="Reference" value={payout.manualReference || payout.reference} />
          <Row label="Receipt" value={payout.receiptNumber} />
        </div>

        {(payout.requests?.length ?? 0) > 0 && (
          <section>
            <SectionHeader>Requests paid ({payout.requests?.length})</SectionHeader>
            <div className="inset-group [&>*+*]:border-t [&>*+*]:border-separator">
              {payout.requests?.map((request) => (
                <Link
                  key={request.id}
                  href={`/payments/requests/${encodeURIComponent(request.id)}`}
                  className="pressable-row flex items-center gap-3 px-4 py-3"
                >
                  <PaymentTypeIcon type={request.type} />
                  <span className="min-w-0 flex-1">
                    <span className="text-body block font-medium text-text">{PAYMENT_TYPE_LABELS[request.type]}</span>
                    <span className="text-footnote block truncate text-text-3">
                      {[
                        request.requestNumber,
                        request.bookingInvoiceNumber,
                        request.workDate ? formatLagosShortDate(request.workDate) : undefined,
                        request.hoursApproved ? formatHours(request.hoursApproved) : undefined,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span className="text-callout shrink-0 font-semibold tabular-nums text-text">{formatNaira(request.amount)}</span>
                  <ChevronRight size={16} className="shrink-0 text-text-4" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {payout.status === "PAID" && payout.receiptNumber && (
          <Button icon={<Receipt size={18} />} loading={isReceiptLoading} onClick={() => void showReceipt()}>
            View receipt
          </Button>
        )}
      </div>
    </Screen>
  );
}
