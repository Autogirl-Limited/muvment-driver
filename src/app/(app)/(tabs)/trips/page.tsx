"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical, Search, X } from "lucide-react";

import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { TripCard } from "@/components/trips/TripCard";
import { DatePickerSheet } from "@/components/ui/DatePickerSheet";
import { PopoverMenu } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen } from "@/components/ui/Screen";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useDriverTrips } from "@/lib/api/hooks/useTrips";
import type { DriverTrip, DriverTripStatus, StandardTripStatus } from "@/lib/api/types";
import {
  formatApiDate,
  getDriverTripStandardStatus,
  getResolvedDriverTripStatus,
  groupDriverTripsForCards,
  isDriverTripActive,
  isDriverTripUpcoming,
} from "@/lib/utils/driverTrips";

const TRIPS_PAGE_SIZE = 50;

type TripFilter = "All" | "Upcoming" | "Ongoing" | "Completed" | "Cancelled";
type DateFilter = "Today" | "Yesterday" | "Last 7 days" | "This Month" | null;

const TRIP_FILTERS: TripFilter[] = ["All", "Upcoming", "Ongoing", "Completed", "Cancelled"];
const DATE_FILTERS = ["Today", "Yesterday", "Last 7 days", "This Month", "Custom Date"];

const STANDARD_TRIP_STATUS_BY_TAB: Partial<Record<TripFilter, StandardTripStatus>> = {
  Cancelled: "CANCELLED",
  Completed: "COMPLETED",
  Ongoing: "ONGOING",
  Upcoming: "UPCOMING",
};

const addDays = (date: Date, days: number) => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
};

const getDateRangeParams = (dateFilter: DateFilter, customDate: Date | null) => {
  if (customDate) {
    const selectedDate = formatApiDate(customDate);
    return { endDate: selectedDate, startDate: selectedDate };
  }
  if (!dateFilter) {
    return {};
  }

  const today = new Date();

  if (dateFilter === "Today") {
    const selectedDate = formatApiDate(today);
    return { endDate: selectedDate, startDate: selectedDate };
  }
  if (dateFilter === "Yesterday") {
    const selectedDate = formatApiDate(addDays(today, -1));
    return { endDate: selectedDate, startDate: selectedDate };
  }
  if (dateFilter === "Last 7 days") {
    return { endDate: formatApiDate(today), startDate: formatApiDate(addDays(today, -6)) };
  }

  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  return { endDate: formatApiDate(lastDayOfMonth), startDate: formatApiDate(firstDayOfMonth) };
};

const matchesActiveTab = (trip: DriverTrip, activeTab: TripFilter) => {
  const standardTripStatus = getDriverTripStandardStatus(trip);
  const tripStatus = getResolvedDriverTripStatus(trip);

  if (activeTab === "All") {
    return true;
  }

  const expectedStandardStatus = STANDARD_TRIP_STATUS_BY_TAB[activeTab];

  if (standardTripStatus && expectedStandardStatus) {
    return standardTripStatus === expectedStandardStatus;
  }
  if (activeTab === "Upcoming") {
    return isDriverTripUpcoming(trip);
  }
  if (activeTab === "Ongoing") {
    return isDriverTripActive(trip);
  }

  const expectedStatus = activeTab === "Completed" ? "COMPLETE" : activeTab === "Cancelled" ? "CANCELLED" : undefined;

  return !tripStatus || tripStatus === expectedStatus;
};

const formatCustomDate = (date: Date) =>
  new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric" }).format(date);

export default function TripsPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TripFilter>("All");
  const [dateFilter, setDateFilter] = useState<DateFilter>(null);
  const [customDate, setCustomDate] = useState<Date | null>(null);
  const [isMenuVisible, setMenuVisible] = useState(false);
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);

  const dateRangeParams = useMemo(() => getDateRangeParams(dateFilter, customDate), [customDate, dateFilter]);
  const driverTripsQuery = useDriverTrips({
    page: 0,
    search: searchQuery,
    size: TRIPS_PAGE_SIZE,
    tripStatus: STANDARD_TRIP_STATUS_BY_TAB[activeTab],
    ...dateRangeParams,
  });
  const driverTripsContent = driverTripsQuery.data?.data.content;
  const driverTrips = useMemo(() => driverTripsContent ?? [], [driverTripsContent]);
  const tripStatistics = driverTripsQuery.data?.data.statistics;

  const counts: Record<TripFilter, number | undefined> = {
    All: tripStatistics?.assignedTrips,
    Upcoming: tripStatistics?.upcomingTrips,
    Ongoing: tripStatistics?.onGoingTrips,
    Completed: tripStatistics?.completedTrips,
    Cancelled: tripStatistics?.cancelledTrips,
  };

  const visibleTrips = useMemo(
    () => driverTrips.filter((trip) => matchesActiveTab(trip, activeTab)),
    [activeTab, driverTrips],
  );
  const fallbackStatus: DriverTripStatus | undefined =
    activeTab === "Upcoming"
      ? "NOT_STARTED"
      : activeTab === "Ongoing"
        ? "ONGOING"
        : activeTab === "Completed"
          ? "COMPLETE"
          : activeTab === "Cancelled"
            ? "CANCELLED"
            : undefined;
  const visibleSections = useMemo(
    () => groupDriverTripsForCards(visibleTrips, fallbackStatus),
    [fallbackStatus, visibleTrips],
  );

  const isSearching = searchQuery.trim().length > 0;
  const totalFound = visibleSections.reduce((acc, section) => acc + section.data.length, 0);
  const isLoadingTrips = driverTripsQuery.isLoading;
  const isTripsError = driverTripsQuery.isError;
  const tripsErrorMessage = getApiErrorMessage(driverTripsQuery.error);
  const activeDateLabel = customDate ? formatCustomDate(customDate) : dateFilter;

  const refresh = useCallback(async () => {
    await driverTripsQuery.refetch();
  }, [driverTripsQuery]);
  const pull = usePullToRefresh(refresh);

  const handleDropdownSelect = (option: string) => {
    setMenuVisible(false);

    if (option === "Custom Date") {
      setTimeout(() => setDatePickerVisible(true), 150);
      return;
    }
    if (TRIP_FILTERS.includes(option as TripFilter)) {
      setActiveTab(option as TripFilter);
      setDateFilter(null);
      setCustomDate(null);
      return;
    }

    setDateFilter(option as DateFilter);
    setCustomDate(null);
  };

  return (
    <Screen withTabBar {...pull.bind}>
      {pull.indicator}
      <DashboardHeader title="Trips" />

      {/* Search */}
      <div className="px-5 pb-3">
        <div className="flex h-12 items-center gap-2 rounded-2xl border border-border bg-surface px-3 shadow-card focus-within:border-accent">
          <Search size={18} className="shrink-0 text-text-4" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by trip ID or Client Name"
            enterKeyHint="search"
            className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-text outline-none placeholder:text-text-4"
          />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery("")} className="pressable-soft p-1 text-text-4" aria-label="Clear search">
              <X size={16} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setMenuVisible(true)}
            className="pressable flex h-9 w-9 items-center justify-center rounded-xl border border-border text-text-3"
            aria-label="Filters"
          >
            <MoreVertical size={18} />
          </button>
        </div>
      </div>

      {isSearching && !isLoadingTrips && !isTripsError && (
        <p className="text-footnote px-5 pb-2 font-semibold text-text">
          {totalFound} Trip{totalFound !== 1 ? "s" : ""} Found
        </p>
      )}

      {/* Segmented filter chips */}
      <div className="glass sticky top-0 z-20 border-y border-separator py-2.5">
        <div className="scrollbar-none flex gap-2 overflow-x-auto px-5">
          {TRIP_FILTERS.map((tab) => {
            const isActive = activeTab === tab;
            const count = counts[tab];
            const label = isLoadingTrips && count === undefined ? tab : `${tab} (${count ?? 0})`;

            return (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setActiveTab(tab);
                  setDateFilter(null);
                  setCustomDate(null);
                }}
                className={`pressable shrink-0 rounded-full px-4 py-1.5 text-[14px] font-medium transition-colors ${
                  isActive ? "bg-navy-mid text-white dark:bg-accent" : "bg-fill text-text-2"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        {activeDateLabel && (
          <div className="mt-2 px-5">
            <button
              type="button"
              onClick={() => {
                setDateFilter(null);
                setCustomDate(null);
              }}
              className="pressable inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-[12px] font-semibold text-accent-text"
            >
              {activeDateLabel}
              <X size={12} />
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 px-5 pt-4">
        {isLoadingTrips ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : isTripsError ? (
          <EmptyState
            title="Unable to load trips"
            description={tripsErrorMessage ?? "Please check your connection and try again."}
          />
        ) : visibleSections.length > 0 ? (
          visibleSections.map((section) => (
            <section key={section.title} className="anim-fade-in mb-2">
              <p className="text-callout mb-3 text-text-3">{section.title}</p>
              {section.data.map((trip) => (
                <TripCard key={trip.id} {...trip} onClick={() => router.push(`/trip/${encodeURIComponent(trip.id)}`)} />
              ))}
            </section>
          ))
        ) : isSearching ? (
          <EmptyState
            image="search"
            title="No results"
            description={`No trips match "${searchQuery}". Check the trip ID or client name and try again.`}
          />
        ) : (
          <EmptyState title="No trips found" description="Try another status, date, or search term." />
        )}
      </div>

      <PopoverMenu
        open={isMenuVisible}
        onClose={() => setMenuVisible(false)}
        options={[...TRIP_FILTERS, ...DATE_FILTERS]}
        separatorBefore={["Today"]}
        onSelect={handleDropdownSelect}
      />

      <DatePickerSheet
        open={isDatePickerVisible}
        onClose={() => setDatePickerVisible(false)}
        onSelectDate={(date) => {
          setCustomDate(date);
          setDateFilter(null);
          setDatePickerVisible(false);
        }}
      />
    </Screen>
  );
}
