"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Circle, Info, Search, X } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useEligibleTrips } from "@/lib/api/hooks/useDriverPayments";
import type { EligibleTrip, PaymentRequestType } from "@/lib/api/types";
import { formatHours } from "@/lib/payments/labels";
import { formatLagosShortDate, formatLagosTime } from "@/lib/utils/lagosTime";

export const formatTripRange = (trip: Pick<EligibleTrip, "startAt" | "endAt">) => {
  const start = formatLagosShortDate(trip.startAt);
  const end = formatLagosShortDate(trip.endAt);

  if (!start) return "Dates unavailable";
  if (!end || end === start) {
    const startTime = formatLagosTime(trip.startAt);
    const endTime = formatLagosTime(trip.endAt);
    return startTime && endTime ? `${start}, ${startTime} – ${endTime}` : start;
  }

  return `${start} – ${end}`;
};

const useDebounced = (value: string, delayMs = 300) => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timeout);
  }, [delayMs, value]);

  return debounced;
};

export const BookingCardBody = ({ trip, type }: { trip: EligibleTrip; type: PaymentRequestType }) => {
  const unclaimedOvertimes = (trip.overtimes ?? []).filter((overtime) => !overtime.claimed);

  return (
    <span className="min-w-0 flex-1">
      <span className="text-body block truncate font-semibold text-text">{trip.invoiceNumber ?? trip.tripId}</span>
      <span className="text-footnote block truncate text-text-2">
        {[trip.customerName, trip.bookingTypeName].filter(Boolean).join(" · ") || "Booking"}
      </span>
      <span className="text-footnote block truncate text-text-3">{formatTripRange(trip)}</span>
      {type === "EXTRA_HOURS" && trip.eligible && unclaimedOvertimes.length > 0 && (
        <span className="text-footnote block truncate text-text-3">
          {formatHours(unclaimedOvertimes.reduce((sum, overtime) => sum + overtime.hours, 0))} billed
        </span>
      )}
      {!trip.eligible && trip.reason && (
        <span className="text-footnote mt-1 flex items-start gap-1 text-warning-text">
          <Info size={14} className="mt-[2px] shrink-0" />
          <span>{trip.reason}</span>
        </span>
      )}
    </span>
  );
};

interface BookingPickerProps {
  type: PaymentRequestType;
  multiple: boolean;
  initialSelectedIds?: string[];
  onContinue: (trips: EligibleTrip[]) => void;
}

/**
 * Searches the driver's trips for this request type. Ineligible trips are
 * listed but disabled, with the reason from the server.
 */
export const BookingPicker = ({ type, multiple, initialSelectedIds = [], onContinue }: BookingPickerProps) => {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search);
  const [selected, setSelected] = useState<Map<string, EligibleTrip>>(() => new Map());
  const tripsQuery = useEligibleTrips({ type, search: debouncedSearch });
  const trips = useMemo(() => tripsQuery.data?.data ?? [], [tripsQuery.data]);
  const sortedTrips = useMemo(
    () => [...trips].sort((a, b) => Number(b.eligible) - Number(a.eligible)),
    [trips],
  );

  // Keep a preselected trip (from "Request payment" on a trip) ticked.
  useEffect(() => {
    if (!multiple || initialSelectedIds.length === 0) return;
    setSelected((current) => {
      if (current.size > 0) return current;
      const next = new Map(current);
      trips.filter((trip) => trip.eligible && initialSelectedIds.includes(trip.tripId)).forEach((trip) => next.set(trip.tripId, trip));
      return next.size === current.size ? current : next;
    });
  }, [initialSelectedIds, multiple, trips]);

  const toggle = (trip: EligibleTrip) => {
    if (!multiple) {
      onContinue([trip]);
      return;
    }

    setSelected((current) => {
      const next = new Map(current);
      if (next.has(trip.tripId)) next.delete(trip.tripId);
      else next.set(trip.tripId, trip);
      return next;
    });
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-3 flex h-12 items-center gap-2 rounded-2xl border border-border bg-surface px-3 shadow-card focus-within:border-accent">
        <Search size={18} className="shrink-0 text-text-4" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Client name, trip ID or invoice number"
          enterKeyHint="search"
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-text outline-none placeholder:text-text-4"
        />
        {search && (
          <button type="button" onClick={() => setSearch("")} className="pressable-soft p-1 text-text-4" aria-label="Clear search">
            <X size={18} />
          </button>
        )}
      </div>

      {tripsQuery.isLoading ? (
        <>
          <CardSkeleton />
          <CardSkeleton />
        </>
      ) : tripsQuery.isError ? (
        <EmptyState
          title="Unable to load your trips"
          description={getApiErrorMessage(tripsQuery.error) ?? "Please check your connection and try again."}
        />
      ) : sortedTrips.length === 0 ? (
        <EmptyState
          image={search ? "search" : "empty"}
          title={search ? "No matching trips" : "No trips to claim for"}
          description={
            search ? "Check the client name, trip ID or invoice number." : "Finished trips from the last 30 days show here."
          }
        />
      ) : (
        <ul className={`anim-fade-in ${multiple ? "pb-24" : "pb-6"}`}>
          {sortedTrips.map((trip) => {
            const isSelected = selected.has(trip.tripId);
            const isPreselected = !multiple && initialSelectedIds.includes(trip.tripId);

            return (
              <li key={trip.tripId}>
                <button
                  type="button"
                  disabled={!trip.eligible}
                  onClick={() => toggle(trip)}
                  aria-pressed={multiple ? isSelected : undefined}
                  className={`card pressable mb-3 flex w-full items-start gap-3 p-4 text-left disabled:opacity-60 ${
                    isSelected || isPreselected ? "border-accent" : ""
                  }`}
                >
                  <BookingCardBody trip={trip} type={type} />
                  {multiple && trip.eligible && (
                    <span className="mt-0.5 shrink-0">
                      {isSelected ? <CheckCircle2 size={22} className="text-accent" /> : <Circle size={22} className="text-border-strong" />}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {multiple && (
        <div
          className="glass fixed inset-x-0 bottom-0 z-30 mx-auto max-w-lg border-t px-5 pt-3"
          style={{ paddingBottom: "calc(var(--safe-bottom) + 12px)" }}
        >
          <Button disabled={selected.size === 0} onClick={() => onContinue([...selected.values()])}>
            {selected.size === 0 ? "Choose bookings" : `Continue with ${selected.size} booking${selected.size === 1 ? "" : "s"}`}
          </Button>
        </div>
      )}
    </div>
  );
};
