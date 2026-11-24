"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ListFilter, Search, X } from "lucide-react";

import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { TripCard } from "@/components/trips/TripCard";
import { TripStatusScroller, type StatusOption } from "@/components/trips/TripStatusScroller";
import { DatePickerSheet } from "@/components/ui/DatePickerSheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterMenu, type FilterMenuSection } from "@/components/ui/FilterMenu";
import { Screen } from "@/components/ui/Screen";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useDriverTrips } from "@/lib/api/hooks/useTrips";
import type { DriverTrip, DriverTripStatus } from "@/lib/api/types";
import {
  formatApiDate,
  getDriverTripTab,
  groupDriverTripsForCards,
  reconcileDriverTripStatistics,
  type DriverTripSortOrder,
} from "@/lib/utils/driverTrips";
import { toLagosDate } from "@/lib/utils/lagosTime";

const TRIPS_PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 350;

type TripFilter = "All" | "Upcoming" | "Ongoing" | "Completed" | "Cancelled";
type DateFilter = "Today" | "Yesterday" | "Last 7 days" | "This Month" | null;
type MenuValue =
  | { kind: "status"; value: TripFilter }
  | { kind: "date"; value: DateFilter }
  | { kind: "custom" };

const TRIP_FILTERS: TripFilter[] = ["All", "Upcoming", "Ongoing", "Completed", "Cancelled"];
const DATE_FILTERS: Exclude<DateFilter, null>[] = ["Today", "Yesterday", "Last 7 days", "This Month"];

// Relative ranges use the Lagos calendar day, the same clock the API uses.
const addDaysToApiDate = (apiDate: string, days: number) => {
  const [year, month, day] = apiDate.split("-").map(Number);

  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
};

const getDateRangeParams = (dateFilter: DateFilter, customDate: Date | null) => {
  if (customDate) {
    const selectedDate = formatApiDate(customDate);
    return { endDate: selectedDate, startDate: selectedDate };
  }
  if (!dateFilter) {
    return {};
  }

  const today = toLagosDate(new Date());

  if (dateFilter === "Today") {
    return { endDate: today, startDate: today };
  }
  if (dateFilter === "Yesterday") {
    const yesterday = addDaysToApiDate(today, -1);
    return { endDate: yesterday, startDate: yesterday };
  }
  if (dateFilter === "Last 7 days") {
    return { endDate: today, startDate: addDaysToApiDate(today, -6) };
  }

  const firstDayOfMonth = `${today.slice(0, 7)}-01`;
  const lastDayOfMonth = addDaysToApiDate(`${addDaysToApiDate(firstDayOfMonth, 31).slice(0, 7)}-01`, -1);

  return { endDate: lastDayOfMonth, startDate: firstDayOfMonth };
};

// Tabs follow the driver's own ride state (see getDriverTripTab): a ride that
// is still going sits in Ongoing, overtime included, whatever the clock says.
const matchesActiveTab = (trip: DriverTrip, activeTab: TripFilter, nowMs: number) =>
  activeTab === "All" || getDriverTripTab(trip, nowMs) === activeTab;

/** Re-renders once a minute while `active`, so overtime shows up on time. */
const useMinuteTick = (active: boolean) => {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    setNowMs(Date.now());
    const timer = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, [active]);

  return active ? nowMs : Date.now();
};

/** Debounced copy of a value, so typing doesn't fire a request per keystroke. */
const useDebouncedValue = <T,>(value: T, delay: number) => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [delay, value]);

  return debounced;
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

  const debouncedSearch = useDebouncedValue(searchQuery.trim(), SEARCH_DEBOUNCE_MS);
  const dateRangeParams = useMemo(() => getDateRangeParams(dateFilter, customDate), [customDate, dateFilter]);
  const driverTripsQuery = useDriverTrips({
    page: 0,
    search: debouncedSearch,
    size: TRIPS_PAGE_SIZE,
    ...dateRangeParams,
  });
  const driverTripsContent = driverTripsQuery.data?.data.content;
  const driverTrips = useMemo(() => driverTripsContent ?? [], [driverTripsContent]);
  // The newest trips, unfiltered: what the tab counts are reconciled against.
  const recentTripsQuery = useDriverTrips({ page: 0, size: 20 });
  const recentTrips = recentTripsQuery.data?.data.content;
  const hasLiveRide = [...driverTrips, ...(recentTrips ?? [])].some((trip) => getDriverTripTab(trip) === "Ongoing");
  // While a ride is live, check each minute so a trip slides into Overtime
  // (or back out, once an extension is paid) without a pull to refresh.
  const nowMs = useMinuteTick(hasLiveRide);
  const { refetch: refetchTrips } = driverTripsQuery;

  useEffect(() => {
    if (!hasLiveRide) return;
    const timer = setInterval(() => void refetchTrips(), 60_000);
    return () => clearInterval(timer);
  }, [hasLiveRide, refetchTrips]);

  const tripStatistics = useMemo(
    () => reconcileDriverTripStatistics(driverTripsQuery.data?.data.statistics, recentTrips ?? [], nowMs),
    [driverTripsQuery.data?.data.statistics, nowMs, recentTrips],
  );

  // Counts only appear once the first response is in.
  const statusCounts: Record<TripFilter, number | undefined> = {
    All: tripStatistics?.assignedTrips,
    Upcoming: tripStatistics?.upcomingTrips,
    Ongoing: tripStatistics?.onGoingTrips,
    Completed: tripStatistics?.completedTrips,
    Cancelled: tripStatistics?.cancelledTrips,
  };
  const statusOptions: StatusOption<TripFilter>[] = TRIP_FILTERS.map((value) => ({
    count: tripStatistics ? (statusCounts[value] ?? 0) : undefined,
    label: value,
    value,
  }));

  const activeDateLabel = customDate ? formatCustomDate(customDate) : dateFilter;
  const isDateFiltered = Boolean(activeDateLabel);

  const menuSections: FilterMenuSection<MenuValue>[] = [
    {
      title: "Status",
      items: TRIP_FILTERS.map((value) => ({
        label: value === "All" ? "All Trips" : value,
        selected: activeTab === value,
        value: { kind: "status", value } as MenuValue,
      })),
    },
    {
      title: "Date",
      items: [
        { label: "Any Date", selected: !isDateFiltered, value: { kind: "date", value: null } as MenuValue },
        ...DATE_FILTERS.map((value) => ({
          label: value,
          selected: !customDate && dateFilter === value,
          value: { kind: "date", value } as MenuValue,
        })),
        {
          detail: customDate ? formatCustomDate(customDate) : undefined,
          label: customDate ? "Specific Date" : "Choose a Date…",
          selected: Boolean(customDate),
          value: { kind: "custom" } as MenuValue,
        },
      ],
    },
  ];

  const hasSearchOrDate = debouncedSearch.length > 0 || isDateFiltered;
  const visibleTrips = useMemo(() => {
    const matching = driverTrips.filter((trip) => matchesActiveTab(trip, activeTab, nowMs));

    // A ride that is still going must show under Ongoing even when it falls
    // outside this page of results (started on an earlier day, or older than
    // the newest 50). Only without a search or date, which narrow on purpose.
    if (activeTab !== "Ongoing" || hasSearchOrDate) return matching;

    const known = new Set(matching.map((trip) => trip.id));
    const carried = (recentTrips ?? []).filter(
      (trip) => !known.has(trip.id) && matchesActiveTab(trip, "Ongoing", nowMs),
    );

    return carried.length > 0 ? [...carried, ...matching] : matching;
  }, [activeTab, driverTrips, hasSearchOrDate, nowMs, recentTrips]);
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
  // Upcoming and ongoing read as an itinerary (next trip first); everything
  // else shows the most recent trips first.
  const sortOrder: DriverTripSortOrder =
    activeTab === "Upcoming" || activeTab === "Ongoing" ? "soonest-first" : "latest-first";
  // nowMs: card labels (Overtime) are worked out from the clock.
  const visibleSections = useMemo(
    () => groupDriverTripsForCards(visibleTrips, fallbackStatus, sortOrder),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fallbackStatus, sortOrder, visibleTrips, nowMs],
  );

  const isSearching = searchQuery.trim().length > 0;
  // While a new filter or search loads, show placeholders (the counts stay put).
  const isSwitching = driverTripsQuery.isPlaceholderData || searchQuery.trim() !== debouncedSearch;
  const totalFound = visibleSections.reduce((acc, section) => acc + section.data.length, 0);
  const isLoadingTrips = driverTripsQuery.isLoading;
  const isTripsError = driverTripsQuery.isError && !driverTripsQuery.data;
  const tripsErrorMessage = getApiErrorMessage(driverTripsQuery.error);

  const refresh = useCallback(async () => {
    await driverTripsQuery.refetch();
  }, [driverTripsQuery]);
  const pull = usePullToRefresh(refresh);

  const handleMenuSelect = (item: MenuValue) => {
    setMenuVisible(false);

    if (item.kind === "custom") {
      // Let the menu finish closing before the calendar rises.
      setTimeout(() => setDatePickerVisible(true), 150);
      return;
    }
    if (item.kind === "status") {
      setActiveTab(item.value);
      return;
    }

    setDateFilter(item.value);
    setCustomDate(null);
  };

  const clearDate = () => {
    setDateFilter(null);
    setCustomDate(null);
  };

  return (
    <Screen withTabBar {...pull.bind}>
      {pull.indicator}
      <DashboardHeader title="Trips" />

      {/* Search + filter */}
      <div className="flex items-center gap-2 px-5 pb-3">
        <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl bg-fill px-3 focus-within:ring-2 focus-within:ring-accent/40">
          <Search size={16} className="shrink-0 text-text-4" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Trip ID or client name"
            enterKeyHint="search"
            className="h-full min-w-0 flex-1 bg-transparent text-[16px] text-text outline-none placeholder:text-text-4 [&::-webkit-search-cancel-button]:hidden"
          />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery("")} className="pressable-soft p-1 text-text-4" aria-label="Clear search">
              <X size={16} />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setMenuVisible(true)}
          className={`pressable flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
            isDateFiltered || activeTab !== "All" ? "bg-accent text-white" : "bg-fill text-accent"
          }`}
          aria-label="Filter trips"
          aria-haspopup="menu"
        >
          <ListFilter size={19} />
        </button>
      </div>

      {(isSearching || isDateFiltered) && !isLoadingTrips && !isTripsError && (
        <p className="text-footnote px-5 pb-2 font-semibold text-text">
          {totalFound} Trip{totalFound !== 1 ? "s" : ""} Found
        </p>
      )}

      <div className="glass sticky top-0 z-20 border-y border-separator pt-2.5">
        <TripStatusScroller options={statusOptions} value={activeTab} onChange={setActiveTab} />
        {activeDateLabel && (
          <div className="-mt-1 px-5 pb-2.5">
            <button
              type="button"
              onClick={clearDate}
              aria-label={`Date: ${activeDateLabel}. Clear date filter`}
              className="pressable inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-[12px] font-semibold text-accent-text"
            >
              {activeDateLabel}
              <X size={12} />
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 px-5 pt-4">
        {isLoadingTrips || isSwitching ? (
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
          <EmptyState
            title="No trips found"
            description={
              isDateFiltered
                ? "Nothing matches this status and date. Try another date."
                : "Try another status, or pull down to refresh."
            }
          />
        )}
      </div>

      <FilterMenu
        open={isMenuVisible}
        onClose={() => setMenuVisible(false)}
        sections={menuSections}
        onSelect={handleMenuSelect}
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
