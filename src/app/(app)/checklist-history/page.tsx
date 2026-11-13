"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronRight, Circle } from "lucide-react";

import { BackButton } from "@/components/ui/BackButton";
import { Pill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { NavBar, Screen } from "@/components/ui/Screen";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useInfiniteChecklistTrackers, usePreRideChecklistSummary } from "@/lib/api/hooks/usePreRideChecklist";
import type { ChecklistTracker, PreRideChecklistSummary } from "@/lib/api/types";
import { getChecklistStepRoute, getPreRideUnlockedStep } from "@/lib/utils/checklistNavigation";
import { getLagosLocalDateTimeRange } from "@/lib/utils/lagosTime";

const HISTORY_RANGE_OPTIONS = [
  { label: "7 days", value: "7" },
  { label: "30 days", value: "30" },
  { label: "90 days", value: "90" },
  { label: "All time", value: "730" },
] as const;

type HistoryRange = (typeof HISTORY_RANGE_OPTIONS)[number]["value"];
type HistoryStatus = "all" | "complete" | "in-progress";

const HISTORY_STATUS_OPTIONS: Array<{ label: string; value: HistoryStatus }> = [
  { label: "All", value: "all" },
  { label: "In progress", value: "in-progress" },
  { label: "Complete", value: "complete" },
];

const STEP_LABELS: Array<{
  key: keyof Pick<PreRideChecklistSummary, "exteriorPhotos" | "interiorPhotos" | "vehicleHealthCheckPhotos" | "driverPhoto">;
  label: string;
}> = [
  { key: "exteriorPhotos", label: "Exterior" },
  { key: "interiorPhotos", label: "Interior" },
  { key: "vehicleHealthCheckPhotos", label: "Vehicle Health" },
  { key: "driverPhoto", label: "Driver Photo" },
];

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

const formatTrackerDate = (value?: string | null) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : dateTimeFormatter.format(date);
};

const isTrackerComplete = (tracker: ChecklistTracker) => {
  const status = tracker.status ?? tracker.checklistStatus;

  return Boolean(
    tracker.preRideCompletedAt ||
      status === "PRE_RIDE_CLOSED" ||
      status === "POST_RIDE_OPEN" ||
      status === "POST_RIDE_CLOSED",
  );
};

const TrackerHistoryCard = ({ tracker }: { tracker: ChecklistTracker }) => {
  const router = useRouter();
  const summaryQuery = usePreRideChecklistSummary(tracker.id);
  const summary = summaryQuery.data?.data;
  const isComplete = isTrackerComplete(tracker) || (summary ? STEP_LABELS.every(({ key }) => summary[key]?.valid) : false);
  const unlockedStep = getPreRideUnlockedStep(summary);
  const vehicleName = summary?.vehicleInfo?.vehicleName?.trim();
  const vehiclePlate = summary?.vehicleInfo?.vehicleIdentifier?.trim();
  const dateLabel = formatTrackerDate(tracker.preRideCompletedAt);

  return (
    <button
      type="button"
      onClick={() => router.push(getChecklistStepRoute("preRide", tracker.id, isComplete ? 4 : unlockedStep))}
      className="card pressable mb-3 w-full p-4 text-left"
    >
      <div className="mb-3 flex items-center justify-between">
        <Pill tone={isComplete ? "success" : "warning"}>{isComplete ? "Complete" : "In progress"}</Pill>
        <span className="flex items-center gap-2">
          {dateLabel && <span className="text-caption text-text-4">{dateLabel}</span>}
          <ChevronRight size={18} className="text-text-4" />
        </span>
      </div>

      {summaryQuery.isLoading ? (
        <p className="text-footnote text-text-3">Loading details...</p>
      ) : summaryQuery.isError ? (
        <p className="text-footnote text-danger">{getApiErrorMessage(summaryQuery.error) ?? "Unable to load this checklist."}</p>
      ) : (
        <>
          <p className="text-body font-semibold text-text">{vehicleName || "Vehicle unavailable"}</p>
          {vehiclePlate && <p className="text-caption mt-0.5 mb-3 text-text-3">{vehiclePlate}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {STEP_LABELS.map(({ key, label }) => {
              const valid = summary?.[key]?.valid === true;

              return (
                <span
                  key={key}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] ${
                    valid ? "border-success/30 bg-success-soft text-success-text" : "border-border bg-surface-alt text-text-3"
                  }`}
                >
                  {valid ? <CheckCircle2 size={12} className="text-success" /> : <Circle size={12} className="text-text-4" />}
                  {label}
                </span>
              );
            })}
          </div>
        </>
      )}
    </button>
  );
};

export default function ChecklistHistoryPage() {
  const [historyRange, setHistoryRange] = useState<HistoryRange>("730");
  const [historyStatus, setHistoryStatus] = useState<HistoryStatus>("all");
  const range = useMemo(() => getLagosLocalDateTimeRange(Number(historyRange)), [historyRange]);
  const trackersQuery = useInfiniteChecklistTrackers({ from: range.from, size: 50, to: range.to });
  const trackers = useMemo(
    () => trackersQuery.data?.pages.flatMap((page) => page.data.content) ?? [],
    [trackersQuery.data],
  );
  const filteredTrackers = useMemo(
    () => trackers.filter((tracker) => {
      if (historyStatus === "all") return true;
      return isTrackerComplete(tracker) === (historyStatus === "complete");
    }),
    [historyStatus, trackers],
  );
  const totalItems = trackersQuery.data?.pages[0]?.data.totalItems ?? 0;
  const errorMessage = getApiErrorMessage(trackersQuery.error);

  return (
    <Screen>
      <NavBar
        left={<BackButton />}
        largeTitle="Checklist History"
        subtitle="Resume an incomplete pre-ride checklist or review one you already submitted."
      />

      <div className="px-5 pb-10">
        <div className="mb-5 space-y-3">
          <SegmentedControl
            ariaLabel="Checklist history date range"
            options={[...HISTORY_RANGE_OPTIONS]}
            value={historyRange}
            onChange={setHistoryRange}
          />
          <SegmentedControl
            ariaLabel="Checklist completion status"
            options={HISTORY_STATUS_OPTIONS}
            value={historyStatus}
            onChange={setHistoryStatus}
          />
        </div>

        {trackersQuery.isLoading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : trackersQuery.isError ? (
          <EmptyState title="Unable to load checklists" description={errorMessage ?? "Please check your connection and try again."} />
        ) : trackers.length === 0 ? (
          <EmptyState title="No checklists found" description="Checklists you start in this date range will appear here." />
        ) : filteredTrackers.length === 0 ? (
          <EmptyState title="No matching checklists" description="Try another status or date range." />
        ) : (
          <>
            <p className="text-caption mb-3 text-text-4">
              Loaded {trackers.length} of {totalItems}
            </p>
            {filteredTrackers.map((tracker) => <TrackerHistoryCard key={tracker.id} tracker={tracker} />)}
          </>
        )}
        {!trackersQuery.isLoading && !trackersQuery.isError && trackersQuery.hasNextPage && (
          <Button
            variant="outline"
            loading={trackersQuery.isFetchingNextPage}
            onClick={() => void trackersQuery.fetchNextPage()}
            className="mt-2"
          >
            Load more checklists
          </Button>
        )}
      </div>
    </Screen>
  );
}
