"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Car, ChevronRight, ReceiptText, RefreshCw } from "lucide-react";

import { BrandAvatar } from "@/components/brand/BrandAvatar";
import { NotificationBellButton } from "@/components/notifications/NotificationBellButton";
import { StatCard } from "@/components/trips/StatCard";
import { TripCard } from "@/components/trips/TripCard";
import { AlertDialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen } from "@/components/ui/Screen";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useOutstandingPilotReports, useTodayChecklist } from "@/lib/api/hooks/usePreRideChecklist";
import { PilotReportBlockedBanner, PilotReportList } from "@/components/checklist/PilotReportList";
import { usePilotReportGate } from "@/providers/PilotReportGateProvider";
import { useDriverTripStatistics, useDriverTrips } from "@/lib/api/hooks/useTrips";
import { useCurrentUser } from "@/lib/api/hooks/useUsers";
import { InvoiceContinueCard } from "@/components/checklist/InvoiceContinueCard";
import { ReportContinueCard } from "@/components/checklist/ReportContinueCard";
import { readChecklistVehicleSelection, type ChecklistVehicleSelection } from "@/lib/utils/checklistVehicleSelection";
import { getDriverTripTab, toDriverTripCardModel } from "@/lib/utils/driverTrips";
import { parseLagosMs, toLagosDate } from "@/lib/utils/lagosTime";
import { discardInvoiceSelection, PENDING_INVOICE_RESUME_ROUTE } from "@/lib/utils/pendingInvoiceReport";
import { getUserDisplayName } from "@/lib/utils/userProfile";
import { useScreenThemeColor } from "@/providers/ThemeProvider";

/** Top of the header gradient, so the status bar blends into it. */
const HOME_HEADER_TOP_COLOR = "#516C9F";

export default function HomePage() {
  const router = useRouter();
  const pilotReports = usePilotReportGate();
  useScreenThemeColor(HOME_HEADER_TOP_COLOR);
  const currentUserQuery = useCurrentUser();
  const driverTripStatisticsQuery = useDriverTripStatistics();
  // Today's trips only, by the Lagos calendar day the API uses. The key
  // changes at midnight, so the list rolls over on the next render.
  const today = toLagosDate(new Date());
  const driverTripsQuery = useDriverTrips({ endDate: today, page: 0, size: 50, startDate: today });
  // A ride that started on an earlier day but is still going (overnight, or in
  // overtime past midnight) stays on Home until the driver ends it.
  const recentTripsQuery = useDriverTrips({ page: 0, size: 20 });
  const todayChecklistQuery = useTodayChecklist();
  // Its own observer, so arriving on Home refetches a stale list (a trip ended elsewhere, midnight).
  const outstandingQuery = useOutstandingPilotReports();

  // An invoice report begun on this phone. Read after mount: it lives in localStorage.
  const userId = currentUserQuery.data?.data.userId;
  const [savedInvoice, setSavedInvoice] = useState<ChecklistVehicleSelection>();
  const [confirmRemoveInvoice, setConfirmRemoveInvoice] = useState(false);
  useEffect(() => {
    setSavedInvoice(readChecklistVehicleSelection(userId));
  }, [today, userId]);

  const removeInvoice = () => {
    if (userId) discardInvoiceSelection(userId);
    setSavedInvoice(undefined);
    setConfirmRemoveInvoice(false);
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";
  const currentDate = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());

  const driverTripsContent = driverTripsQuery.data?.data.content;
  const recentTripsContent = recentTripsQuery.data?.data.content;
  const homeTrips = useMemo(() => {
    const todayTrips = driverTripsContent ?? [];
    const carriedOver = (recentTripsContent ?? []).filter(
      (trip) =>
        !todayTrips.some((todayTrip) => todayTrip.id === trip.id) &&
        getDriverTripTab(trip) === "Ongoing" &&
        (trip.startDateTime ?? "").slice(0, 10) < today,
    );

    return [...carriedOver, ...todayTrips].sort(
      (a, b) => (parseLagosMs(a.startDateTime) ?? 0) - (parseLagosMs(b.startDateTime) ?? 0),
    );
  }, [driverTripsContent, recentTripsContent, today]);
  const hasLiveRide = homeTrips.some((trip) => getDriverTripTab(trip) === "Ongoing");
  const [, setMinuteTick] = useState(0);
  const { refetch: refetchTodayTrips } = driverTripsQuery;

  // While a ride is live, re-check each minute so it turns to Overtime on time
  // and picks up a paid extension even if a notification was missed.
  useEffect(() => {
    if (!hasLiveRide) return;
    const timer = setInterval(() => {
      setMinuteTick((tick) => tick + 1);
      void refetchTodayTrips();
    }, 60_000);

    return () => clearInterval(timer);
  }, [hasLiveRide, refetchTodayTrips]);

  const todayChecklist = todayChecklistQuery.data?.data;
  const todayChecklistState = todayChecklist?.state ?? todayChecklist?.status;
  const todayChecklistTrackerId = todayChecklist?.checklistTrackerId?.trim();
  const outstanding = pilotReports.outstanding;
  const owedReports = outstanding?.reports ?? [];
  // An open Pre-Ride report shows its progress ring instead of a plain row.
  const preRideInProgress = owedReports.find(
    (report) => report.kind === "PRE_RIDE" && report.state === "IN_PROGRESS" && report.checklistTrackerId,
  );
  // Until its first part is sent, an invoice report exists only on this phone.
  const pendingInvoice =
    todayChecklistState === "NOT_STARTED" && !todayChecklistTrackerId ? savedInvoice : undefined;
  // The server may not list a started report (say, an invoice one on a day with
  // no trip): keep a way back into it.
  const unlistedTrackerId =
    todayChecklistState === "PRE_TRIP_IN_PROGRESS" &&
    !pilotReports.isLoading &&
    !owedReports.some((report) => report.kind === "PRE_RIDE")
      ? todayChecklistTrackerId
      : undefined;
  const listedReports = owedReports.filter(
    (report) =>
      report !== preRideInProgress &&
      // The invoice card stands in for today's unstarted Pre-Ride: one way to continue.
      !(pendingInvoice && report.kind === "PRE_RIDE" && !report.checklistTrackerId),
  );
  const continueTrackerId = preRideInProgress?.checklistTrackerId ?? unlistedTrackerId;
  // Emergency / newly assigned bookings can still be reported against their invoice.
  const showInvoiceReport =
    (todayChecklistState === "NOT_STARTED" && !todayChecklistTrackerId) ||
    todayChecklistState === "PRE_TRIP_COMPLETED" ||
    todayChecklistState === "POST_TRIP_IN_PROGRESS";
  const todayTrips = homeTrips.map((trip) => toDriverTripCardModel(trip));
  const tripStatistics = driverTripStatisticsQuery.data?.data;
  const tripsErrorMessage = getApiErrorMessage(driverTripsQuery.error);
  const currentUser = currentUserQuery.data?.data;
  const driverName = currentUserQuery.isLoading ? "Loading..." : getUserDisplayName(currentUser);

  const getStatisticValue = (value?: number) => {
    if (driverTripStatisticsQuery.isLoading) return "...";
    if (driverTripStatisticsQuery.isError) return "--";

    return String(value ?? 0);
  };

  const refresh = useCallback(async () => {
    await Promise.all([
      driverTripsQuery.refetch(),
      recentTripsQuery.refetch(),
      todayChecklistQuery.refetch(),
      outstandingQuery.refetch(),
      driverTripStatisticsQuery.refetch(),
    ]);
  }, [driverTripStatisticsQuery, driverTripsQuery, outstandingQuery, recentTripsQuery, todayChecklistQuery]);
  const pull = usePullToRefresh(refresh);

  return (
    <Screen withTabBar {...pull.bind}>
      {pull.indicator}
      {/* Curved gradient header */}
      <header
        className="safe-top rounded-b-[40px] bg-gradient-to-b from-[#516C9F] to-[#1D2739] px-6 pb-16"
        style={{ paddingTop: "calc(var(--safe-top) + 24px)" }}
      >
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1 pr-4">
            <p className="text-body text-white/85">{greeting},</p>
            <h1 className="text-title-1 mt-0.5 text-white">{driverName}</h1>
            <p className="text-callout mt-1.5 text-white/75">{currentDate}</p>
          </div>
          <div className="mt-1 flex items-center gap-3">
            <NotificationBellButton inverse />
            <BrandAvatar gapColor="#516C9F" />
          </div>
        </div>
      </header>

      {/* Stats overlap the header */}
      <div className="-mt-10 mb-6 flex gap-3 px-5">
        <StatCard
          title="Assigned Trips"
          value={getStatisticValue(tripStatistics?.assignedTrips)}
          icon={<Car size={20} />}
        />
        <StatCard
          title="Upcoming Trips"
          value={getStatisticValue(tripStatistics?.upcomingTrips)}
          icon={<CalendarDays size={20} />}
          tone="warm"
        />
      </div>

      {!outstanding && pilotReports.isLoading === false && todayChecklistQuery.isError && (
        <div className="mb-5 px-5">
          <button
            type="button"
            onClick={() => void todayChecklistQuery.refetch()}
            className="card pressable flex w-full items-center gap-3 border-danger/40 p-4 text-left"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger-soft text-danger">
              <RefreshCw size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-body block font-semibold text-text">Pilot Report unavailable</span>
              <span className="text-footnote block text-text-3">Tap to reload today&apos;s checklist status.</span>
            </span>
            <RefreshCw size={18} className="text-text-4" />
          </button>
        </div>
      )}

      {(owedReports.length > 0 || showInvoiceReport || unlistedTrackerId) && (
        <section className="mb-5 space-y-3 px-5" aria-label="Pilot reports">
          {owedReports.length > 0 && <p className="text-eyebrow text-text-3">Pilot reports</p>}
          {outstanding?.blocking && <PilotReportBlockedBanner message={outstanding.message} />}

          {continueTrackerId && <ReportContinueCard trackerId={continueTrackerId} />}

          {pendingInvoice && (
            <InvoiceContinueCard
              selection={pendingInvoice}
              onContinue={() => router.push(PENDING_INVOICE_RESUME_ROUTE)}
              onChange={() => router.push("/checklist/invoice")}
              onRemove={() => setConfirmRemoveInvoice(true)}
            />
          )}

          {outstanding && listedReports.length > 0 && (
            <PilotReportList
              reports={listedReports}
              today={outstanding.today}
              onOpen={pilotReports.openReport}
              opening={pilotReports.opening}
            />
          )}

          {showInvoiceReport && !pendingInvoice && (
            <button
              type="button"
              onClick={() => router.push("/checklist/invoice")}
              className="card pressable flex w-full items-center gap-3 border border-border p-4 text-left"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-fill text-text-2">
                <ReceiptText size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-body block font-semibold text-text">Start trip with invoice</span>
                <span className="text-footnote block text-text-3">For emergency or newly assigned bookings.</span>
              </span>
              <ChevronRight size={20} className="text-text-4" />
            </button>
          )}
        </section>
      )}

      <AlertDialog
        open={confirmRemoveInvoice}
        onClose={() => setConfirmRemoveInvoice(false)}
        onConfirm={removeInvoice}
        title="Remove this invoice report?"
        message="The invoice number, vehicle and any photos you haven't sent will be cleared from this report."
        cancelText="Keep it"
        confirmText="Remove"
        confirmVariant="danger"
      />

      <div className="px-5">
        {driverTripsQuery.isLoading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : driverTripsQuery.isError ? (
          <EmptyState
            title="Unable to load trips"
            description={tripsErrorMessage ?? "Please check your connection and try again."}
          />
        ) : todayTrips.length > 0 ? (
          <>
            <p className="text-eyebrow mb-3 text-text-3">Today&apos;s trips</p>
            {todayTrips.map((trip) => (
              <TripCard key={trip.id} {...trip} onClick={() => router.push(`/trip/${encodeURIComponent(trip.id)}`)} />
            ))}
          </>
        ) : (
          <EmptyState
            title="No trips today"
            description="You have no trips scheduled for today. New assignments for today will appear here."
          />
        )}
      </div>
    </Screen>
  );
}
