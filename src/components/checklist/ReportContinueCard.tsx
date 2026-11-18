"use client";

import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { Skeleton } from "@/components/ui/Skeleton";
import { usePreRideChecklistSummary, useSubmittedChecklistPhotos } from "@/lib/api/hooks/usePreRideChecklist";
import { getNextPreRidePart, getPreRideResumeRoute } from "@/lib/utils/reportProgress";

/** A small ring that fills as parts of the report are done, with the count inside. */
export const ProgressRing = ({ done, total, size = 52 }: { done: number; total: number; size?: number }) => {
  const stroke = 4.5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = total > 0 ? done / total : 0;

  return (
    <div className="relative flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute -rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="var(--fill-strong)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--accent)"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference * progress} ${circumference}`}
          style={{ transition: "stroke-dasharray 0.4s ease" }}
        />
      </svg>
      <span className="text-[13px] font-semibold tabular-nums text-text">
        {done}/{total}
      </span>
    </div>
  );
};

/**
 * A pre-ride report that was started but never sent: how far along it is,
 * what's next, and one button that goes straight to where the driver stopped.
 */
export const ReportContinueCard = ({ trackerId }: { trackerId: string }) => {
  const router = useRouter();
  const summaryQuery = usePreRideChecklistSummary(trackerId);
  const submittedQuery = useSubmittedChecklistPhotos(trackerId);
  const summary = summaryQuery.data?.data;
  const submitted = submittedQuery.data;
  const next = getNextPreRidePart(summary, submitted);
  const vehicle = summary?.vehicleInfo;
  const ready = !summaryQuery.isLoading && !submittedQuery.isLoading;

  return (
    <button
      type="button"
      disabled={!ready}
      aria-label={`Pre-ride report not sent yet. ${next.done} of ${next.total} parts done. Next: ${next.title}.`}
      onClick={() => router.push(getPreRideResumeRoute(trackerId, summary, submitted))}
      className="card pressable w-full p-4 text-left disabled:cursor-wait"
    >
      <span className="flex items-center">
        {ready ? <ProgressRing done={next.done} total={next.total} /> : <Skeleton className="h-[52px] w-[52px] rounded-full" />}
        <span className="ml-3.5 min-w-0 flex-1">
          <span className="block text-[13px] font-semibold text-accent-text">PRE-RIDE REPORT · NOT SENT YET</span>
          <span className="mt-0.5 block truncate text-[17px] font-semibold text-text">Next: {next.title}</span>
          <span className="mt-0.5 block truncate text-[13.5px] text-text-3">
            {vehicle?.vehicleName
              ? `${vehicle.vehicleName}${vehicle.vehicleIdentifier ? ` · ${vehicle.vehicleIdentifier}` : ""}`
              : "Your report is saved as you go"}
          </span>
        </span>
      </span>
      <span className="mt-3.5 flex h-11 items-center justify-center gap-1.5 rounded-full bg-accent text-[16px] font-semibold text-white">
        Continue
        <ChevronRight size={14} strokeWidth={3} />
      </span>
    </button>
  );
};
