"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Car, ChevronRight, ClipboardList, Flag, RefreshCw } from "lucide-react";

import { Avatar } from "@/components/layout/Avatar";
import { NotificationBellButton } from "@/components/notifications/NotificationBellButton";
import { StatCard } from "@/components/trips/StatCard";
import { TripCard } from "@/components/trips/TripCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen } from "@/components/ui/Screen";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useTodayChecklist } from "@/lib/api/hooks/usePreRideChecklist";
import { useDriverTripStatistics, useDriverTrips } from "@/lib/api/hooks/useTrips";
import { useCurrentUser } from "@/lib/api/hooks/useUsers";
import { getPreRideStarterStepRoute } from "@/lib/utils/checklistNavigation";
import { toDriverTripCardModel } from "@/lib/utils/driverTrips";
import { getUserDisplayName, getUserInitials } from "@/lib/utils/userProfile";
import { useScreenThemeColor } from "@/providers/ThemeProvider";
import { useToast } from "@/providers/ToastProvider";

/** Top of the header gradient, so the status bar blends into it. */
const HOME_HEADER_TOP_COLOR = "#516C9F";

export default function HomePage() {
  const router = useRouter();
  const toast = useToast();
  const [isOpeningPilotReport, setIsOpeningPilotReport] = useState(false);
  useScreenThemeColor(HOME_HEADER_TOP_COLOR);
  const currentUserQuery = useCurrentUser();
  const driverTripStatisticsQuery = useDriverTripStatistics();
  const driverTripsQuery = useDriverTrips({ page: 0, size: 20 });
  const todayChecklistQuery = useTodayChecklist();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";
  const currentDate = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());

  const driverTrips = driverTripsQuery.data?.data.content ?? [];
  const todayChecklist = todayChecklistQuery.data?.data;
  const todayChecklistState = todayChecklist?.state ?? todayChecklist?.status;
  const todayChecklistTrackerId = todayChecklist?.checklistTrackerId?.trim();
  const shouldShowPreRidePilotReport =
    todayChecklistState === "NOT_STARTED" || todayChecklistState === "PRE_TRIP_IN_PROGRESS";
  const shouldShowPostRidePilotReport =
    todayChecklistState === "PRE_TRIP_COMPLETED" || todayChecklistState === "POST_TRIP_IN_PROGRESS";
  const recentTrips = driverTrips.slice(0, 3).map((trip) => toDriverTripCardModel(trip));
  const tripStatistics = driverTripStatisticsQuery.data?.data;
  const tripsErrorMessage = getApiErrorMessage(driverTripsQuery.error);
  const currentUser = currentUserQuery.data?.data;
  const driverName = currentUserQuery.isLoading ? "Loading..." : getUserDisplayName(currentUser);
  const driverInitials = getUserInitials(currentUser);

  const getStatisticValue = (value?: number) => {
    if (driverTripStatisticsQuery.isLoading) return "...";
    if (driverTripStatisticsQuery.isError) return "--";

    return String(value ?? 0);
  };

  const refresh = useCallback(async () => {
    await Promise.all([
      driverTripsQuery.refetch(),
      todayChecklistQuery.refetch(),
      driverTripStatisticsQuery.refetch(),
    ]);
  }, [driverTripStatisticsQuery, driverTripsQuery, todayChecklistQuery]);
  const pull = usePullToRefresh(refresh);

  const handleMissingTracker = async () => {
    const refreshed = await todayChecklistQuery.refetch();
    const trackerId = refreshed.data?.data.checklistTrackerId?.trim();

    if (trackerId) {
      return trackerId;
    }

    toast.error("Pilot Report unavailable", "We could not find today's report yet. Please refresh and try again.");
    return undefined;
  };

  const openPreRideReport = async () => {
    if (isOpeningPilotReport) return;

    setIsOpeningPilotReport(true);

    try {
      if (todayChecklistTrackerId) {
        router.push(`/checklist/step1?trackerId=${encodeURIComponent(todayChecklistTrackerId)}`);
        return;
      }

      if (todayChecklistState !== "NOT_STARTED") {
        const trackerId = await handleMissingTracker();
        if (trackerId) {
          router.push(`/checklist/step1?trackerId=${encodeURIComponent(trackerId)}`);
        }
        return;
      }

      router.push(getPreRideStarterStepRoute(1));
    } finally {
      setIsOpeningPilotReport(false);
    }
  };

  const openPostRideReport = async () => {
    if (isOpeningPilotReport) return;

    setIsOpeningPilotReport(true);

    try {
      const trackerId = todayChecklistTrackerId ?? await handleMissingTracker();

      if (trackerId) {
        router.push(`/post-ride-checklist/step1?trackerId=${encodeURIComponent(trackerId)}`);
      }
    } finally {
      setIsOpeningPilotReport(false);
    }
  };

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
            <Avatar initials={driverInitials} href="/profile" inverse />
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

      {todayChecklistQuery.isError && (
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

      {(shouldShowPreRidePilotReport || shouldShowPostRidePilotReport) && (
        <div className="mb-5 space-y-3 px-5">
          {shouldShowPreRidePilotReport && (
            <button
              type="button"
              onClick={() => void openPreRideReport()}
              disabled={isOpeningPilotReport}
              className="card pressable flex w-full items-center gap-3 p-4 text-left disabled:cursor-wait disabled:opacity-70"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-soft text-[#3538CD] dark:text-accent">
                <ClipboardList size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-body block font-semibold text-text">Pre Ride Pilot Report</span>
                <span className="text-footnote block text-text-3">
                  {isOpeningPilotReport
                    ? "Preparing your report..."
                    : "Complete this before your first ride today."}
                </span>
              </span>
              <ChevronRight size={20} className="text-text-4" />
            </button>
          )}

          {shouldShowPostRidePilotReport && (
            <button
              type="button"
              onClick={() => void openPostRideReport()}
              disabled={isOpeningPilotReport}
              className="pressable flex w-full items-center gap-3 rounded-[20px] bg-navy p-4 text-left shadow-card disabled:cursor-wait disabled:opacity-70"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white">
                <Flag size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-body block font-semibold text-white">Done for the day?</span>
                <span className="text-footnote block text-white/70">Submit your Post Ride Pilot Report.</span>
              </span>
              <ChevronRight size={20} className="text-white" />
            </button>
          )}
        </div>
      )}

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
        ) : recentTrips.length > 0 ? (
          <>
            <p className="text-eyebrow mb-3 text-text-3">Recent trips</p>
            {recentTrips.map((trip) => (
              <TripCard key={trip.id} {...trip} onClick={() => router.push(`/trip/${encodeURIComponent(trip.id)}`)} />
            ))}
          </>
        ) : (
          <EmptyState
            title="No trips scheduled"
            description="You don't have any upcoming trips. New assignments will appear here once assigned."
          />
        )}
      </div>
    </Screen>
  );
}
