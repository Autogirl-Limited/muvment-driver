"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Search, X } from "lucide-react";

import { BookingPicker } from "@/components/payments/BookingPicker";
import { NoBankAccountBanner, PaymentTypeIcon, VerificationPill } from "@/components/payments/PaymentBits";
import { PaymentRequestForm, type PaymentRequestFormValue } from "@/components/payments/PaymentRequestForm";
import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import { NavBar, Screen } from "@/components/ui/Screen";
import { getApiErrorMessage } from "@/lib/api/errors";
import {
  useDriverPaymentRates,
  useDriverPaymentSummary,
  useEligibleTrips,
  useSubmitPaymentRequest,
} from "@/lib/api/hooks/useDriverPayments";
import type { DriverPaymentRequest, EligibleTrip, PaymentRequestType } from "@/lib/api/types";
import {
  formatNaira,
  PAYMENT_REQUEST_TYPES,
  PAYMENT_TYPE_DESCRIPTIONS,
  PAYMENT_TYPE_LABELS,
} from "@/lib/payments/labels";
import { useToast } from "@/providers/ToastProvider";

type Step = "type" | "booking" | "form" | "success";

const STEP_TITLES: Record<Step, string> = {
  type: "New payment request",
  booking: "Choose booking",
  form: "Request details",
  success: "Submitted",
};

const SUCCESS_REDIRECT_MS = 2500;

const newIdempotencyKey = () =>
  `payreq-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;

const isPaymentType = (value: string | null): value is PaymentRequestType =>
  !!value && (PAYMENT_REQUEST_TYPES as string[]).includes(value);

export default function NewPaymentRequestPage() {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const preselectedTripId = searchParams.get("tripId") ?? undefined;
  const typeParam = searchParams.get("type");
  const [type, setType] = useState<PaymentRequestType | null>(isPaymentType(typeParam) ? typeParam : null);
  const [step, setStep] = useState<Step>(isPaymentType(typeParam) ? "booking" : "type");
  const [typeSearch, setTypeSearch] = useState("");
  const [selectedTrips, setSelectedTrips] = useState<EligibleTrip[]>([]);
  const [created, setCreated] = useState<DriverPaymentRequest[]>([]);
  const ratesQuery = useDriverPaymentRates();
  const summaryQuery = useDriverPaymentSummary();
  const submit = useSubmitPaymentRequest();
  const rates = ratesQuery.data?.data;
  // One key per distinct submission: a double tap or a retry of the same
  // body reuses it, so the server creates the requests only once.
  const idempotencyRef = useRef<{ body: string; key: string } | null>(null);
  const submittingRef = useRef(false);

  // "Request payment" on a trip: once the type is chosen, jump straight to the
  // form when that trip can be claimed.
  const preselectQuery = useEligibleTrips({
    type: type ?? undefined,
    enabled: Boolean(preselectedTripId && type && step === "booking"),
  });
  const preselectHandledRef = useRef<string | null>(null);

  useEffect(() => {
    if (!preselectedTripId || !type || step !== "booking" || type === "EXTRA_HOURS") return;
    if (preselectHandledRef.current === type || !preselectQuery.data) return;
    preselectHandledRef.current = type;
    const match = preselectQuery.data.data.find((trip) => trip.tripId === preselectedTripId);
    if (match?.eligible) {
      setSelectedTrips([match]);
      setStep("form");
    } else if (match?.reason) {
      toast.info("This trip can't be claimed", match.reason);
    }
  }, [preselectQuery.data, preselectedTripId, step, toast, type]);

  useEffect(() => {
    if (step !== "success" || created.length === 0) return;
    const timeout = window.setTimeout(() => {
      router.replace(created.length === 1 ? `/payments/requests/${encodeURIComponent(created[0].id)}` : "/payments");
    }, SUCCESS_REDIRECT_MS);
    return () => window.clearTimeout(timeout);
  }, [created, router, step]);

  const visibleTypes = useMemo(() => {
    const query = typeSearch.trim().toLowerCase();
    return PAYMENT_REQUEST_TYPES.filter(
      (item) =>
        !query ||
        PAYMENT_TYPE_LABELS[item].toLowerCase().includes(query) ||
        PAYMENT_TYPE_DESCRIPTIONS[item].toLowerCase().includes(query),
    );
  }, [typeSearch]);

  const rateLabel = (item: PaymentRequestType) => {
    const rate = rates?.[item];
    if (item === "AIRPORT_TICKET") return "Amount on the ticket";
    if (!rate?.amount) return undefined;
    return `${formatNaira(rate.amount)} ${rate.unit === "PER_HOUR" ? "per hour" : "per day"}`;
  };

  const goBack = () => {
    if (step === "form") {
      setStep("booking");
      return;
    }
    if (step === "booking") {
      setStep("type");
      setSelectedTrips([]);
      return;
    }
    router.back();
  };

  const handleSubmit = async (value: PaymentRequestFormValue) => {
    // A ref, not submit.isPending: two taps in the same frame both see isPending=false.
    if (!type || submittingRef.current) return;
    submittingRef.current = true;
    const payload = { type, comment: value.comment, items: value.items };
    const body = JSON.stringify(payload);
    if (idempotencyRef.current?.body !== body) {
      idempotencyRef.current = { body, key: newIdempotencyKey() };
    }

    try {
      const response = await submit.mutateAsync({ payload, idempotencyKey: idempotencyRef.current.key });
      setCreated(response.data.requests ?? []);
      setStep("success");
    } catch (error) {
      toast.error("Couldn't submit the request", getApiErrorMessage(error) ?? "Please try again.");
    } finally {
      submittingRef.current = false;
    }
  };

  if (step === "success") {
    return (
      <Screen>
        <NavBar left={<BackButton href="/payments" label="Payments" />} />
        <div className="flex flex-1 flex-col items-center justify-center px-6 pb-16 text-center">
          <div className="anim-scale-in mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-success-soft text-success">
            <Check size={30} strokeWidth={3} />
          </div>
          <h1 className="text-title-1 mb-2 text-text">
            {created.length > 1 ? `${created.length} requests submitted` : "Request submitted"}
          </h1>
          <p className="text-body mb-6 text-text-2">We&apos;re checking it now. You&apos;ll get a notification when it&apos;s verified.</p>
          <div className="inset-group mb-8 w-full text-left [&>*+*]:border-t [&>*+*]:border-separator">
            {created.map((request) => (
              <div key={request.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0">
                  <span className="text-body block font-semibold text-text">{request.requestNumber}</span>
                  <span className="text-footnote block text-text-3">{formatNaira(request.amount)}</span>
                </span>
                <VerificationPill status={request.verificationStatus} />
              </div>
            ))}
          </div>
          <Button
            onClick={() =>
              router.replace(created.length === 1 ? `/payments/requests/${encodeURIComponent(created[0].id)}` : "/payments")
            }
          >
            {created.length === 1 ? "View request" : "View requests"}
          </Button>
        </div>
      </Screen>
    );
  }

  return (
    <Screen>
      <NavBar left={<BackButton onClick={goBack} />} title={STEP_TITLES[step]} />

      <div className="flex flex-1 flex-col px-5 pt-2">
        {summaryQuery.data && !summaryQuery.data.data.hasBankAccount && <NoBankAccountBanner />}

        {step === "type" && (
          <div className="anim-fade-in">
            <div className="mb-4 flex h-12 items-center gap-2 rounded-2xl border border-border bg-surface px-3 shadow-card focus-within:border-accent">
              <Search size={18} className="shrink-0 text-text-4" />
              <input
                type="search"
                value={typeSearch}
                onChange={(event) => setTypeSearch(event.target.value)}
                placeholder="What are you claiming for?"
                className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-text outline-none placeholder:text-text-4"
              />
              {typeSearch && (
                <button type="button" onClick={() => setTypeSearch("")} className="pressable-soft p-1 text-text-4" aria-label="Clear search">
                  <X size={18} />
                </button>
              )}
            </div>
            <div className="inset-group [&>*+*]:border-t [&>*+*]:border-separator">
              {visibleTypes.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setType(item);
                    setSelectedTrips([]);
                    setStep("booking");
                  }}
                  className="pressable-row flex w-full items-center gap-3 px-4 py-3.5 text-left"
                >
                  <PaymentTypeIcon type={item} />
                  <span className="min-w-0 flex-1">
                    <span className="text-body block font-semibold text-text">{PAYMENT_TYPE_LABELS[item]}</span>
                    <span className="text-footnote block text-text-3">{PAYMENT_TYPE_DESCRIPTIONS[item]}</span>
                    {rateLabel(item) && <span className="text-footnote block font-medium text-accent-text">{rateLabel(item)}</span>}
                  </span>
                </button>
              ))}
              {visibleTypes.length === 0 && <p className="text-callout px-4 py-4 text-text-3">No request type matches.</p>}
            </div>
            {rates?.claimWindowDays && (
              <p className="text-footnote mt-3 ml-1 text-text-4">Claims must be made within {rates.claimWindowDays} days of the trip.</p>
            )}
          </div>
        )}

        {step === "booking" && type && (
          <BookingPicker
            key={type}
            type={type}
            multiple={type === "EXTRA_HOURS"}
            initialSelectedIds={preselectedTripId ? [preselectedTripId] : []}
            onContinue={(trips) => {
              setSelectedTrips(trips);
              setStep("form");
            }}
          />
        )}

        {step === "form" && type && selectedTrips.length > 0 && (
          <div className="anim-fade-in">
            <PaymentRequestForm
              key={`${type}-${selectedTrips.map((trip) => trip.tripId).join(",")}`}
              type={type}
              trips={selectedTrips}
              rates={rates}
              mode="create"
              submitting={submit.isPending}
              onSubmit={(value) => void handleSubmit(value)}
              onChangeBooking={() => setStep("booking")}
            />
          </div>
        )}
      </div>
    </Screen>
  );
}
