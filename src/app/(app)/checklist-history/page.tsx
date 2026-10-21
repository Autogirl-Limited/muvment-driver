"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronRight, Circle } from "lucide-react";

import { BackButton } from "@/components/ui/BackButton";
import { Pill } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { NavBar, Screen } from "@/components/ui/Screen";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useChecklistTrackers, usePreRideChecklistSummary } from "@/lib/api/hooks/usePreRideChecklist";
import type { ChecklistTracker, PreRideChecklistSummary } from "@/lib/api/types";
import { getChecklistStepRoute, getPreRideUnlockedStep } from "@/lib/utils/checklistNavigation";

const HISTORY_WINDOW_DAYS = 3;

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

const TrackerHistoryCard = ({ tracker }: { tracker: ChecklistTracker }) => {
  const router = useRouter();
  const summaryQuery = usePreRideChecklistSummary(tracker.id);
  const summary = summaryQuery.data?.data;
  const isComplete =
    tracker.status === "PRE_RIDE_CLOSED" || (summary ? STEP_LABELS.every(({ key }) => summary[key]?.valid) : false);
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
  const range = useMemo(() => {
    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - HISTORY_WINDOW_DAYS);
    // The backend binds from/to to a LocalDateTime and rejects a trailing "Z".
    return { from: from.toISOString().replace("Z", ""), to: to.toISOString().replace("Z", "") };
  }, []);

  const trackersQuery = useChecklistTrackers({ from: range.from, size: 20, to: range.to });
  const trackers = trackersQuery.data?.data.content ?? [];
  const errorMessage = getApiErrorMessage(trackersQuery.error);

  return (
    <Screen>
      <NavBar
        left={<BackButton />}
        largeTitle="Checklist History"
        subtitle={`Resume an incomplete pre-ride checklist from the last ${HISTORY_WINDOW_DAYS} days, or review one you already submitted.`}
      />

      <div className="px-5 pb-10">
        {trackersQuery.isLoading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : trackersQuery.isError ? (
          <EmptyState title="Unable to load checklists" description={errorMessage ?? "Please check your connection and try again."} />
        ) : trackers.length === 0 ? (
          <EmptyState title="No recent checklists" description="Checklists you start will appear here so you can resume them." />
        ) : (
          trackers.map((tracker) => <TrackerHistoryCard key={tracker.id} tracker={tracker} />)
        )}
      </div>
    </Screen>
  );
}
