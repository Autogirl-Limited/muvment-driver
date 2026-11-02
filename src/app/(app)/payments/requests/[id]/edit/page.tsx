"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";

import { PaymentRequestForm, type PaymentRequestFormValue } from "@/components/payments/PaymentRequestForm";
import { BackButton } from "@/components/ui/BackButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { NavBar, Screen } from "@/components/ui/Screen";
import { getApiErrorMessage } from "@/lib/api/errors";
import {
  useDriverPaymentRates,
  useEligibleTrips,
  usePaymentRequest,
  useUpdatePaymentRequest,
} from "@/lib/api/hooks/useDriverPayments";
import type { EligibleTrip } from "@/lib/api/types";
import { useToast } from "@/providers/ToastProvider";

/** A booking to edit against when the eligible-trips list doesn't include it any more. */
const tripFromRequest = (request: NonNullable<ReturnType<typeof usePaymentRequest>["data"]>["data"]): EligibleTrip => ({
  tripId: request.tripId ?? "",
  bookingId: request.bookingId,
  invoiceNumber: request.bookingInvoiceNumber,
  customerName: request.customerName,
  bookingTypeName: request.bookingTypeName,
  startAt: request.tripStartAt,
  endAt: request.tripEndAt,
  eligible: true,
  dates: request.workDate ? [{ date: request.workDate, weekday: "", claimed: false }] : [],
  overtimes: request.overtimeId
    ? [
        {
          overtimeId: request.overtimeId,
          invoiceNumber: request.overtimeInvoiceNumber ?? "Overtime",
          hours: request.hoursClaimed ?? 0,
          paymentStatus: request.overtimePaymentStatus ?? "",
          claimed: false,
        },
      ]
    : [],
});

export default function EditPaymentRequestPage() {
  const router = useRouter();
  const toast = useToast();
  const params = useParams<{ id: string }>();
  const requestId = decodeURIComponent(params.id ?? "");
  const requestQuery = usePaymentRequest(requestId || undefined);
  const request = requestQuery.data?.data;
  const ratesQuery = useDriverPaymentRates();
  const update = useUpdatePaymentRequest();
  const tripsQuery = useEligibleTrips({
    type: request?.type,
    search: request?.bookingInvoiceNumber ?? undefined,
    enabled: Boolean(request),
  });

  const trip = useMemo(() => {
    if (!request) return undefined;
    const match = tripsQuery.data?.data.find((item) => item.tripId === request.tripId);
    return match ?? (tripsQuery.isFetched || tripsQuery.isError ? tripFromRequest(request) : undefined);
  }, [request, tripsQuery.data, tripsQuery.isError, tripsQuery.isFetched]);

  const back = <BackButton href={`/payments/requests/${encodeURIComponent(requestId)}`} />;

  if (requestQuery.isLoading || (request && !trip)) {
    return (
      <Screen>
        <NavBar left={back} title="Edit request" />
        <EmptyState loading title="Loading request" description="Fetching your payment request." />
      </Screen>
    );
  }

  if (!request || !trip) {
    return (
      <Screen>
        <NavBar left={back} title="Edit request" />
        <EmptyState
          title="Unable to load request"
          description={getApiErrorMessage(requestQuery.error) ?? "Please check your connection and try again."}
        />
      </Screen>
    );
  }

  if (!request.canEdit) {
    return (
      <Screen>
        <NavBar left={back} title="Edit request" />
        <EmptyState title="Can't edit this request" description="Requests can only be changed while pending or under review." />
      </Screen>
    );
  }

  const handleSubmit = async ({ comment, items }: PaymentRequestFormValue) => {
    const item = items[0];
    if (!item) return;

    try {
      await update.mutateAsync({ id: request.id, payload: { ...item, comment: comment ?? "" } });
      toast.success("Request updated", "The checks will run again.");
      router.replace(`/payments/requests/${encodeURIComponent(request.id)}`);
    } catch (error) {
      toast.error("Couldn't save changes", getApiErrorMessage(error) ?? "Please try again.");
    }
  };

  return (
    <Screen>
      <NavBar left={back} title={request.requestNumber} />
      <div className="anim-fade-in px-5 pt-2">
        <PaymentRequestForm
          type={request.type}
          trips={[trip]}
          rates={ratesQuery.data?.data}
          mode="edit"
          initial={request}
          submitting={update.isPending}
          onSubmit={(value) => void handleSubmit(value)}
        />
      </div>
    </Screen>
  );
}
