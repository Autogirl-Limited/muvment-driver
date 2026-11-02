"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, CheckCircle2, Plus, SlidersHorizontal, X } from "lucide-react";

import { DashboardHeader } from "@/components/layout/DashboardHeader";
import {
  NoBankAccountBanner,
  PaymentRequestCard,
  PayoutRow,
  SummaryCard,
} from "@/components/payments/PaymentBits";
import { Button } from "@/components/ui/Button";
import { DatePickerSheet } from "@/components/ui/DatePickerSheet";
import { Sheet } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen } from "@/components/ui/Screen";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { CardSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { getApiErrorMessage } from "@/lib/api/errors";
import {
  openPayoutReceipt,
  useDriverPaymentSummary,
  useDriverPayouts,
  usePaymentRequests,
} from "@/lib/api/hooks/useDriverPayments";
import type { PaymentRequestType, PaymentStatus, VerificationStatus } from "@/lib/api/types";
import {
  formatNaira,
  PAYMENT_LABELS,
  PAYMENT_REQUEST_TYPES,
  PAYMENT_TYPE_LABELS,
  VERIFICATION_LABELS,
} from "@/lib/payments/labels";
import { formatApiDate } from "@/lib/utils/driverTrips";
import { formatLagosDate } from "@/lib/utils/lagosTime";
import { useToast } from "@/providers/ToastProvider";

type Segment = "requests" | "payouts";

const PAGE_STEP = 20;

const VERIFICATION_FILTERS: VerificationStatus[] = ["PENDING", "VERIFIED", "NEEDS_REVIEW", "REJECTED", "WITHDRAWN"];
const PAYMENT_FILTERS: PaymentStatus[] = [
  "NOT_DUE",
  "AWAITING_CUSTOMER_PAYMENT",
  "PENDING_PAYMENT",
  "PROCESSING",
  "PAID",
  "FAILED",
  "NOT_PAYABLE",
];

interface Filters {
  type?: PaymentRequestType;
  verificationStatus?: VerificationStatus;
  paymentStatus?: PaymentStatus;
  from?: string;
  to?: string;
}

const Chip = ({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={selected}
    className={`pressable h-9 rounded-full border px-3.5 text-[13px] font-medium ${
      selected ? "border-accent bg-accent-soft text-accent-text" : "border-border bg-surface text-text-2"
    }`}
  >
    {label}
  </button>
);

const FilterSheet = ({
  open,
  onClose,
  filters,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  filters: Filters;
  onApply: (filters: Filters) => void;
}) => {
  const [draft, setDraft] = useState<Filters>(filters);
  const [datePicker, setDatePicker] = useState<"from" | "to" | null>(null);
  const [lastOpen, setLastOpen] = useState(open);

  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) setDraft(filters);
  }

  const toggle = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setDraft((current) => ({ ...current, [key]: current[key] === value ? undefined : value }));

  return (
    <>
      <Sheet open={open && datePicker === null} onClose={onClose} title="Filter requests">
        <div className="max-h-[62dvh] overflow-y-auto pb-2">
          <p className="text-eyebrow mb-2 text-text-3">Type</p>
          <div className="mb-4 flex flex-wrap gap-2">
            {PAYMENT_REQUEST_TYPES.map((type) => (
              <Chip key={type} label={PAYMENT_TYPE_LABELS[type]} selected={draft.type === type} onClick={() => toggle("type", type)} />
            ))}
          </div>
          <p className="text-eyebrow mb-2 text-text-3">Verification</p>
          <div className="mb-4 flex flex-wrap gap-2">
            {VERIFICATION_FILTERS.map((status) => (
              <Chip
                key={status}
                label={VERIFICATION_LABELS[status]}
                selected={draft.verificationStatus === status}
                onClick={() => toggle("verificationStatus", status)}
              />
            ))}
          </div>
          <p className="text-eyebrow mb-2 text-text-3">Payment</p>
          <div className="mb-4 flex flex-wrap gap-2">
            {PAYMENT_FILTERS.map((status) => (
              <Chip
                key={status}
                label={PAYMENT_LABELS[status]}
                selected={draft.paymentStatus === status}
                onClick={() => toggle("paymentStatus", status)}
              />
            ))}
          </div>
          <p className="text-eyebrow mb-2 text-text-3">Submitted between</p>
          <div className="grid grid-cols-2 gap-3">
            {(["from", "to"] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setDatePicker(key)}
                className="pressable flex h-12 items-center gap-2 rounded-xl border border-border-strong bg-surface px-3 text-left text-[15px]"
              >
                <CalendarDays size={16} className="shrink-0 text-text-4" />
                <span className={draft[key] ? "text-text" : "text-text-4"}>
                  {draft[key] ? formatLagosDate(draft[key]) : key === "from" ? "From" : "To"}
                </span>
                {draft[key] && (
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={`Clear ${key} date`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setDraft((current) => ({ ...current, [key]: undefined }));
                    }}
                    className="ml-auto text-text-4"
                  >
                    <X size={16} />
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Button variant="outline" size="md" onClick={() => setDraft({})}>
            Clear all
          </Button>
          <Button size="md" onClick={() => onApply(draft)}>
            Show results
          </Button>
        </div>
      </Sheet>
      <DatePickerSheet
        open={datePicker !== null}
        onClose={() => setDatePicker(null)}
        onSelectDate={(date) => {
          const key = datePicker;
          if (key) setDraft((current) => ({ ...current, [key]: formatApiDate(date) }));
          setDatePicker(null);
        }}
      />
    </>
  );
};

export default function PaymentsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toast = useToast();
  const segment: Segment = searchParams.get("tab") === "payouts" ? "payouts" : "requests";
  const [filters, setFilters] = useState<Filters>({});
  const [requestsSize, setRequestsSize] = useState(PAGE_STEP);
  const [payoutsSize, setPayoutsSize] = useState(PAGE_STEP);
  const [isFilterOpen, setFilterOpen] = useState(false);
  const [receiptLoadingId, setReceiptLoadingId] = useState<string | null>(null);

  const summaryQuery = useDriverPaymentSummary();
  const requestsQuery = usePaymentRequests({ ...filters, page: 0, size: requestsSize });
  const payoutsQuery = useDriverPayouts({ page: 0, size: payoutsSize, enabled: segment === "payouts" });
  const summary = summaryQuery.data?.data;
  const requests = requestsQuery.data?.data.content ?? [];
  const requestsTotal = requestsQuery.data?.data.totalItems ?? 0;
  const payouts = payoutsQuery.data?.data.content ?? [];
  const payoutsTotal = payoutsQuery.data?.data.totalItems ?? 0;

  const activeFilterLabels = useMemo(
    () =>
      [
        filters.type && { key: "type" as const, label: PAYMENT_TYPE_LABELS[filters.type] },
        filters.verificationStatus && { key: "verificationStatus" as const, label: VERIFICATION_LABELS[filters.verificationStatus] },
        filters.paymentStatus && { key: "paymentStatus" as const, label: `Payment: ${PAYMENT_LABELS[filters.paymentStatus]}` },
        filters.from && { key: "from" as const, label: `From ${formatLagosDate(filters.from)}` },
        filters.to && { key: "to" as const, label: `To ${formatLagosDate(filters.to)}` },
      ].filter((item): item is { key: keyof Filters; label: string } => Boolean(item)),
    [filters],
  );

  const setSegment = (next: Segment) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "payouts") params.set("tab", "payouts");
    else params.delete("tab");
    router.replace(params.size ? `${pathname}?${params}` : pathname, { scroll: false });
  };

  const refresh = useCallback(async () => {
    await Promise.all([
      summaryQuery.refetch(),
      segment === "payouts" ? payoutsQuery.refetch() : requestsQuery.refetch(),
    ]);
  }, [payoutsQuery, requestsQuery, segment, summaryQuery]);
  const pull = usePullToRefresh(refresh);

  const showReceipt = async (payoutId: string) => {
    setReceiptLoadingId(payoutId);
    try {
      await openPayoutReceipt(payoutId);
    } catch (error) {
      toast.error("Couldn't open the receipt", getApiErrorMessage(error) ?? "Please try again.");
    } finally {
      setReceiptLoadingId(null);
    }
  };

  return (
    <Screen withTabBar {...pull.bind}>
      {pull.indicator}
      <DashboardHeader title="Payments" />

      <div className="px-5">
        {summary && !summary.hasBankAccount && <NoBankAccountBanner />}

        <div className="mb-4 grid grid-cols-3 gap-2.5">
          {summaryQuery.isLoading ? (
            <>
              <Skeleton className="h-[78px] rounded-[20px]" />
              <Skeleton className="h-[78px] rounded-[20px]" />
              <Skeleton className="h-[78px] rounded-[20px]" />
            </>
          ) : (
            <>
              <SummaryCard label="Pending verification" value={String(summary?.pendingVerificationCount ?? 0)} />
              <SummaryCard label="Awaiting payment" value={formatNaira(summary?.awaitingPaymentAmount ?? 0)} tone="accent" />
              <SummaryCard label="Paid this month" value={formatNaira(summary?.paidThisMonthAmount ?? 0)} tone="success" />
            </>
          )}
        </div>

        <Button icon={<Plus size={20} />} onClick={() => router.push("/payments/new")}>
          Add payment request
        </Button>

        <SegmentedControl
          className="mt-5"
          ariaLabel="Payments view"
          value={segment}
          onChange={setSegment}
          options={[
            { label: "Requests", value: "requests" },
            { label: "Payments received", value: "payouts" },
          ]}
        />
      </div>

      <div className="flex-1 px-5 pt-4">
        {segment === "requests" ? (
          <>
            <div className="scrollbar-none -mx-5 mb-3 flex items-center gap-2 overflow-x-auto px-5">
              <button
                type="button"
                onClick={() => setFilterOpen(true)}
                className={`pressable flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium ${
                  activeFilterLabels.length ? "border-accent bg-accent-soft text-accent-text" : "border-border bg-surface text-text-2"
                }`}
              >
                <SlidersHorizontal size={15} />
                Filters{activeFilterLabels.length ? ` (${activeFilterLabels.length})` : ""}
              </button>
              {activeFilterLabels.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilters((current) => ({ ...current, [key]: undefined }))}
                  className="pressable flex h-9 shrink-0 items-center gap-1 rounded-full bg-fill px-3 text-[13px] font-medium text-text-2"
                  aria-label={`Remove filter ${label}`}
                >
                  {label}
                  <X size={14} />
                </button>
              ))}
            </div>

            {requestsQuery.isLoading ? (
              <>
                <CardSkeleton />
                <CardSkeleton />
              </>
            ) : requestsQuery.isError ? (
              <EmptyState
                title="Unable to load requests"
                description={getApiErrorMessage(requestsQuery.error) ?? "Please check your connection and try again."}
              />
            ) : requests.length === 0 ? (
              <EmptyState
                title={activeFilterLabels.length ? "No matching requests" : "No payment requests yet"}
                description={
                  activeFilterLabels.length
                    ? "Try other filters."
                    : "Claim off-day and interstate allowances, extra hours and airport tickets here."
                }
              />
            ) : (
              <div className="anim-fade-in">
                {requests.map((request) => (
                  <PaymentRequestCard key={request.id} request={request} />
                ))}
                {requests.length < requestsTotal && (
                  <Button
                    variant="ghost"
                    size="md"
                    loading={requestsQuery.isFetching}
                    onClick={() => setRequestsSize((size) => size + PAGE_STEP)}
                  >
                    Show more
                  </Button>
                )}
              </div>
            )}
          </>
        ) : payoutsQuery.isLoading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : payoutsQuery.isError ? (
          <EmptyState
            title="Unable to load payments"
            description={getApiErrorMessage(payoutsQuery.error) ?? "Please check your connection and try again."}
          />
        ) : payouts.length === 0 ? (
          <EmptyState title="No payments yet" description="Money paid to your bank account will show here with its receipt." />
        ) : (
          <div className="anim-fade-in">
            {payouts.map((payout) => (
              <PayoutRow
                key={payout.id}
                payout={payout}
                receiptLoading={receiptLoadingId === payout.id}
                onReceipt={() => void showReceipt(payout.id)}
              />
            ))}
            {payouts.length < payoutsTotal && (
              <Button
                variant="ghost"
                size="md"
                loading={payoutsQuery.isFetching}
                onClick={() => setPayoutsSize((size) => size + PAGE_STEP)}
              >
                Show more
              </Button>
            )}
            <p className="text-footnote mt-2 mb-4 flex items-center justify-center gap-1.5 text-text-4">
              <CheckCircle2 size={14} /> Receipts are also emailed to you.
            </p>
          </div>
        )}
      </div>

      <FilterSheet
        open={isFilterOpen}
        onClose={() => setFilterOpen(false)}
        filters={filters}
        onApply={(next) => {
          setFilters(next);
          setRequestsSize(PAGE_STEP);
          setFilterOpen(false);
        }}
      />
    </Screen>
  );
}
