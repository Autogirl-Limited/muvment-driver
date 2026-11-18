"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronRight, Circle } from "lucide-react";

import { BackButton } from "@/components/ui/BackButton";
import { ReportContinueCard } from "@/components/checklist/ReportContinueCard";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { NavBar, Screen, SectionHeader } from "@/components/ui/Screen";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useInfiniteChecklistTrackers, usePreRideChecklistSummary } from "@/lib/api/hooks/usePreRideChecklist";
import type { ChecklistTracker, PreRideChecklistSummary } from "@/lib/api/types";
import { getChecklistStepRoute, getPreRideUnlockedStep } from "@/lib/utils/checklistNavigation";
import { reportDetailRoute } from "@/lib/utils/reportProgress";
import { getLagosLocalDateTimeRange } from "@/lib/utils/lagosTime";

const HISTORY_RANGE_OPTIONS = [
  { label: "7 days", value: "7" },
  { label: "30 days", value: "30" },
  { label: "90 days", value: "90" },
  { label: "All time", value: "730" },
] as const;

type HistoryRange = (typeof HISTORY_RANGE_OPTIONS)[number]["value"];

const STEP_LABELS: Array<{
  key: keyof Pick<PreRideChecklistSummary, "exteriorPhotos" | "interiorPhotos" | "vehicleHealthCheckPhotos" | "driverPhoto">;
  label: string;
}> = [
  { key: "exteriorPhotos", label: "Exterior" },
  { key: "interiorPhotos", label: "Interior" },
  { key: "vehicleHealthCheckPhotos", label: "Vehicle Health" },
  { key: "driverPhoto", label: "Driver Photo" },
];

const isTrackerComplete = (tracker: ChecklistTracker) => {
  const status = tracker.status ?? tracker.checklistStatus;

  return Boolean(
    tracker.preRideCompletedAt ||
      status === "PRE_RIDE_CLOSED" ||
      status === "POST_RIDE_OPEN" ||
      status === "POST_RIDE_CLOSED",
  );
};

const monthFormatter = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });
const dayFormatter = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });
const timeFormatter = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

/** The day a report is filed under: when its pre-ride (or post-ride) was sent. */
const trackerDate = (tracker: ChecklistTracker) => {
  const value = tracker.preRideCompletedAt ?? tracker.postRideCompletedAt;
  const date = value ? new Date(value) : undefined;
  return date && !Number.isNaN(date.getTime()) ? date : undefined;
};

const TrackerRow = ({ tracker, last }: { tracker: ChecklistTracker; last: boolean }) => {
  const router = useRouter();
  const summaryQuery = usePreRideChecklistSummary(tracker.id);
  const summary = summaryQuery.data?.data;
  const isComplete = isTrackerComplete(tracker) || (summary ? STEP_LABELS.every(({ key }) => summary[key]?.valid) : false);
  const date = trackerDate(tracker);
  const doneCount = STEP_LABELS.filter(({ key }) => summary?.[key]?.valid === true).length;

  return (
    <button
      type="button"
      onClick={() => router.push(isComplete ? reportDetailRoute(tracker) : getChecklistStepRoute("preRide", tracker.id, getPreRideUnlockedStep(summary)))}
      className="pressable flex w-full items-center gap-3 pl-4 text-left"
    >
      {summary?.vehicleInfo?.vehicleImageUrl?.trim() ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={summary.vehicleInfo.vehicleImageUrl} alt="" className="h-11 w-11 shrink-0 rounded-xl bg-fill object-cover" />
      ) : (
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
            isComplete ? "bg-success-soft text-success-text" : "bg-warning-soft text-warning-text"
          }`}
        >
          {isComplete ? <CheckCircle2 size={20} /> : <Circle size={20} />}
        </span>
      )}
      <span className={`flex min-h-[68px] min-w-0 flex-1 items-center gap-2 py-3 pr-4 ${last ? "" : "border-b border-border"}`}>
        <span className="min-w-0 flex-1">
          <span className="text-body block truncate font-semibold text-text">
            {summaryQuery.isLoading ? "Loading…" : summary?.vehicleInfo?.vehicleName?.trim() || "Pilot report"}
          </span>
          <span className="text-footnote block truncate text-text-3">
            {date ? `${dayFormatter.format(date)} · ${timeFormatter.format(date)}` : "Not sent yet"}
            {summary?.vehicleInfo?.vehicleIdentifier ? ` · ${summary.vehicleInfo.vehicleIdentifier}` : ""}
          </span>
        </span>
        {!isComplete && (
          <span className="text-caption shrink-0 tabular-nums text-text-3">
            {doneCount}/{STEP_LABELS.length}
          </span>
        )}
        <ChevronRight size={18} className="shrink-0 text-text-4" />
      </span>
    </button>
  );
};

export default function ChecklistHistoryPage() {
  const [historyRange, setHistoryRange] = useState<HistoryRange>("730");
  const range = useMemo(() => getLagosLocalDateTimeRange(Number(historyRange)), [historyRange]);
  const trackersQuery = useInfiniteChecklistTrackers({ from: range.from, size: 50, to: range.to });
  const trackers = useMemo(
    () => trackersQuery.data?.pages.flatMap((page) => page.data.content) ?? [],
    [trackersQuery.data],
  );
  const { openReports, months } = useMemo(() => {
    const open: ChecklistTracker[] = [];
    const byMonth = new Map<string, { title: string; trackers: ChecklistTracker[] }>();

    trackers.forEach((tracker) => {
      if (!isTrackerComplete(tracker)) {
        open.push(tracker);
        return;
      }
      const date = trackerDate(tracker);
      const key = date ? `${date.getFullYear()}-${String(date.getMonth()).padStart(2, "0")}` : "unknown";
      if (!byMonth.has(key)) byMonth.set(key, { title: date ? monthFormatter.format(date) : "Earlier", trackers: [] });
      byMonth.get(key)!.trackers.push(tracker);
    });

    const grouped = [...byMonth.entries()]
      .sort(([left], [right]) => (left < right ? 1 : -1))
      .map(([, value]) => ({
        ...value,
        trackers: value.trackers.sort((a, b) => (trackerDate(b)?.getTime() ?? 0) - (trackerDate(a)?.getTime() ?? 0)),
      }));

    return { months: grouped, openReports: open };
  }, [trackers]);
  const errorMessage = getApiErrorMessage(trackersQuery.error);

  return (
    <Screen>
      <NavBar
        left={<BackButton />}
        largeTitle="Checklist History"
        subtitle="Your pre-ride pilot reports. Pick up one you haven't sent, or look back at the rest."
      />

      <div className="px-5 pb-10">
        <div className="mb-5">
          <SegmentedControl
            ariaLabel="Checklist history date range"
            options={[...HISTORY_RANGE_OPTIONS]}
            value={historyRange}
            onChange={setHistoryRange}
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
        ) : (
          <>
            {openReports.length > 0 && (
              <>
                <SectionHeader>Not Sent Yet</SectionHeader>
                <div className="mb-6 space-y-3">
                  {openReports.map((tracker) => (
                    <ReportContinueCard key={tracker.id} trackerId={tracker.id} />
                  ))}
                </div>
              </>
            )}
            {months.map((month) => (
              <section key={month.title} className="mb-6">
                <SectionHeader>{month.title}</SectionHeader>
                <div className="card overflow-hidden p-0">
                  {month.trackers.map((tracker, index) => (
                    <TrackerRow key={tracker.id} tracker={tracker} last={index === month.trackers.length - 1} />
                  ))}
                </div>
              </section>
            ))}
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
