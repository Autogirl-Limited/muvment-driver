/* eslint-disable @next/next/no-img-element */
"use client";

import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { CheckCircle2, Clock, Camera, Car } from "lucide-react";

import type { AiFeedbackTone } from "@/components/checklist/AiFeedbackCard";
import { insightTone } from "@/components/checklist/AiPhotoNotes";
import { ChecklistAiSummary } from "@/components/checklist/ChecklistAiSummary";
import { ReportContinueCard } from "@/components/checklist/ReportContinueCard";
import { ReportPhotoViewer, type ReportPhoto } from "@/components/checklist/ReportPhotoViewer";
import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { NavBar, Screen } from "@/components/ui/Screen";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useConditionReport, useDashboardReading, useReportInsights } from "@/lib/api/hooks/useChecklistAi";
import { usePreRideChecklistSummary, useSubmittedChecklistPhotos } from "@/lib/api/hooks/usePreRideChecklist";
import type { ChecklistTracker, ChecklistType } from "@/lib/api/types";
import { parseLagosMs } from "@/lib/utils/lagosTime";
import { REPORT_SECTIONS, getReportPhase, slotLabel, type ReportPhase } from "@/lib/utils/reportProgress";

const dayFormatter = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "short" });
const timeFormatter = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

const PHASE_BADGE: Record<ReportPhase, { label: string; good: boolean }> = {
  inProgress: { label: "Not Sent Yet", good: false },
  completed: { label: "Completed", good: true },
};

const TONE_DOT: Partial<Record<AiFeedbackTone, string>> = {
  good: "#34C759",
  attention: "#FF9500",
  failed: "#FF3B30",
  processing: "#8E8E93",
};

const toDate = (value?: string | null) => {
  const ms = value ? parseLagosMs(value) : undefined;
  return ms ? new Date(ms) : undefined;
};

/** A photo thumbnail with its name under it and a dot for the AI's verdict. */
const PhotoTile = ({ photo, tone, onClick }: { photo: ReportPhoto; tone?: AiFeedbackTone; onClick: () => void }) => {
  const dot = tone ? TONE_DOT[tone] : undefined;
  const verdict =
    tone === "good" ? "looks good" : tone === "attention" ? "worth a look" : tone === "failed" ? "problem found" : tone === "processing" ? "being checked" : undefined;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${photo.label}${verdict ? `, ${verdict}` : ""}. Opens the photo and its AI analysis`}
      className="pressable-soft text-left"
    >
      <span className="relative block aspect-square overflow-hidden rounded-xl bg-fill">
        <img src={photo.url} alt="" loading="lazy" className="h-full w-full object-cover" />
        {dot && <span className="absolute right-1.5 top-1.5 h-3 w-3 rounded-full border-2 border-white" style={{ backgroundColor: dot }} />}
      </span>
      <span className="mt-1 block truncate text-[12.5px] text-text-2">{photo.label}</span>
    </button>
  );
};

/** One reading as a big number, with a fuel gauge under the fuel level. */
const ReadingTile = ({ label, value, unit, fuel }: { label: string; value: string; unit?: string; fuel?: number }) => {
  const level = fuel !== undefined ? Math.max(0, Math.min(100, fuel)) : undefined;

  return (
    <div className="card flex-1 p-3.5">
      <p className="text-[13px] text-text-3">{label}</p>
      <p className="mt-1 text-[24px] font-bold tabular-nums tracking-tight text-text">
        {value}
        {unit && <span className="text-[15px] font-semibold text-text-3">{unit === "%" ? "%" : ` ${unit}`}</span>}
      </p>
      {level !== undefined && (
        <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-fill-strong">
          <span
            className="block h-full rounded-full"
            style={{ width: `${level}%`, backgroundColor: level < 20 ? "#FF3B30" : level < 40 ? "#FF9500" : "#34C759" }}
          />
        </span>
      )}
    </div>
  );
};

/**
 * A pilot report as it was sent, read-only: the car, each half's photos and
 * readings, and what the AI made of them. An unfinished report leads straight
 * back to where the driver stopped.
 */
export default function ChecklistReportPage() {
  const params = useParams<{ trackerId: string }>();
  const trackerId = decodeURIComponent(params.trackerId ?? "");
  const status = useSearchParams().get("status") as ChecklistTracker["status"] | null;
  const submittedQuery = useSubmittedChecklistPhotos(trackerId);
  const summaryQuery = usePreRideChecklistSummary(trackerId);
  const submitted = submittedQuery.data;
  const vehicle = summaryQuery.data?.data.vehicleInfo;
  const [viewer, setViewer] = useState<{ photos: ReportPhoto[]; index: number } | null>(null);
  const [half, setHalf] = useState<ChecklistType>("PRE_TRIP");

  const hasPostRide = Boolean(
    submitted?.postRideCompletedAt || submitted?.steps.some((step) => step.type === "POST_TRIP" && step.images.length > 0),
  );
  const phase = getReportPhase({
    status: status ?? undefined,
    preRideCompletedAt: submitted?.preRideCompletedAt,
    postRideCompletedAt: submitted?.postRideCompletedAt,
  });
  const checklistType: ChecklistType = hasPostRide ? half : "PRE_TRIP";

  // The AI's verdict per photo, for the coloured dots on the thumbnails.
  const { data: insights } = useReportInsights(trackerId, checklistType);
  const { data: condition } = useConditionReport(trackerId, checklistType);
  const { data: reading } = useDashboardReading(trackerId, checklistType);
  const toneByUrl = useMemo(() => {
    const map = new Map<string, AiFeedbackTone>();

    insights?.forEach((insight) => map.set(insight.imageUrl, insightTone(insight)));
    condition?.sides.forEach((side) => {
      if (side.status !== "COMPLETED") {
        map.set(side.imageUrl, "processing");
        return;
      }
      map.set(
        side.imageUrl,
        side.outcome === "NEW_DAMAGE" ? "failed" : side.outcome === "UNUSABLE_PHOTO" || side.outcome === "WRONG_SIDE" ? "attention" : "good",
      );
    });
    if (reading?.imageUrl) {
      map.set(reading.imageUrl, reading.status === "COMPLETED" ? (reading.needsReview ? "attention" : "good") : "processing");
    }

    return map;
  }, [condition, insights, reading]);

  const sections = useMemo(
    () =>
      REPORT_SECTIONS.map((section) => {
        const step = submitted?.steps.find((s) => s.step === section.step && s.type === checklistType);
        const photos: ReportPhoto[] = (step?.images ?? []).map((image) => ({
          url: image.url,
          slot: image.type,
          step: section.step,
          label:
            image.type === "ACCESSORIES"
              ? (insights?.find((insight) => insight.imageUrl === image.url)?.label ?? "Accessory")
              : slotLabel(image.type),
        }));

        return { ...section, photos };
      }).filter((section) => section.photos.length > 0),
    [checklistType, insights, submitted],
  );

  const readings = checklistType === "PRE_TRIP" ? submitted?.preTripReadings : submitted?.postTripReadings;
  const sentAt = toDate(checklistType === "PRE_TRIP" ? submitted?.preRideCompletedAt : submitted?.postRideCompletedAt);
  const firstStepAt = toDate(submitted?.preRideCompletedAt ?? submitted?.steps[0]?.submittedAt);
  const title = firstStepAt ? dayFormatter.format(firstStepAt) : "Pilot Report";
  const badge = PHASE_BADGE[phase];
  const half_ = checklistType === "PRE_TRIP" ? "Pre-ride" : "Post-ride";

  const pull = usePullToRefresh(async () => {
    await Promise.all([submittedQuery.refetch(), summaryQuery.refetch()]);
  });

  const nav = <NavBar left={<BackButton href="/checklist-history" label="History" />} largeTitle={title} subtitle="Pilot Report" />;

  if (submittedQuery.isLoading) {
    return (
      <Screen>
        {nav}
        <div className="px-5" aria-label="Loading the report">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="mt-5 h-9 w-full rounded-xl" />
          <Skeleton className="mt-5 h-32 w-full rounded-2xl" />
        </div>
      </Screen>
    );
  }

  if (submittedQuery.isError) {
    return (
      <Screen>
        {nav}
        <EmptyState
          title="Couldn't load this report"
          description={getApiErrorMessage(submittedQuery.error) ?? "Check your connection and try again."}
        />
        <div className="px-5">
          <Button variant="outline" onClick={() => void submittedQuery.refetch()}>
            Try Again
          </Button>
        </div>
      </Screen>
    );
  }

  return (
    <Screen {...pull.bind}>
      {pull.indicator}
      {nav}

      <div className="px-5 pb-12">
        {/* The car */}
        <div className="card anim-fade-in flex items-center gap-3.5 p-3.5">
          {vehicle?.vehicleImageUrl ? (
            <img src={vehicle.vehicleImageUrl} alt="" className="h-16 w-[84px] rounded-xl bg-fill object-cover" />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-[14px] bg-fill text-text-3">
              <Car size={28} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[18px] font-semibold text-text">{vehicle?.vehicleName || "Vehicle"}</p>
            {vehicle?.vehicleIdentifier && (
              <span className="mt-1 inline-block rounded-md border border-border bg-fill px-2 py-[3px] text-[12.5px] font-semibold tracking-[0.08em] text-text">
                {vehicle.vehicleIdentifier.toUpperCase()}
              </span>
            )}
            <p className="mt-1.5 flex items-center gap-1.5 text-[13px] font-medium text-text-3">
              <span className={`h-2 w-2 rounded-full ${badge.good ? "bg-success" : "bg-warning"}`} />
              {badge.label}
            </p>
          </div>
        </div>

        {/* Only a report that was never sent leads back to where the driver stopped. */}
        {phase === "inProgress" && (
          <div className="mt-3.5">
            <ReportContinueCard trackerId={trackerId} />
          </div>
        )}

        {hasPostRide && (
          <div className="mt-5">
            <SegmentedControl
              ariaLabel="Which half of the report"
              options={[
                { label: "Pre-Ride", value: "PRE_TRIP" as ChecklistType },
                { label: "Post-Ride", value: "POST_TRIP" as ChecklistType },
              ]}
              value={half}
              onChange={setHalf}
            />
          </div>
        )}

        <p className="mx-2 mt-3 flex items-center gap-1.5 text-[13px] text-text-3">
          {sentAt ? <CheckCircle2 size={14} className="text-success" /> : <Clock size={14} />}
          {sentAt ? `${half_} report sent at ${timeFormatter.format(sentAt)}` : `${half_} report not sent`}
        </p>

        {/* What the AI made of it */}
        <div className="mt-5">
          <ChecklistAiSummary trackerId={trackerId} checklistType={checklistType} readOnly={phase === "completed"} />
        </div>

        {/* Readings */}
        {readings && (readings.odometerKM != null || readings.fuelLevelInPercentage != null) && (
          <section className="anim-rise-in">
            <p className="text-eyebrow mb-2 ml-3 text-text-3">Readings</p>
            <div className="flex gap-2.5">
              <ReadingTile
                label="Odometer"
                value={readings.odometerKM != null ? Math.round(readings.odometerKM).toLocaleString("en-US") : "—"}
                unit={readings.odometerKM != null ? "km" : undefined}
              />
              <ReadingTile
                label="Fuel"
                value={readings.fuelLevelInPercentage != null ? String(Math.round(readings.fuelLevelInPercentage)) : "—"}
                unit={readings.fuelLevelInPercentage != null ? "%" : undefined}
                fuel={readings.fuelLevelInPercentage ?? undefined}
              />
            </div>
          </section>
        )}

        {/* Photos, by section */}
        {sections.length === 0 ? (
          <div className="flex flex-col items-center px-8 pt-8 text-center text-text-3">
            <Camera size={28} />
            <p className="mt-2 text-[15px]">No photos were sent in this half of the report.</p>
          </div>
        ) : (
          sections.map((section) => (
            <section key={`${checklistType}-${section.step}`} className="anim-rise-in mt-6">
              <div className="mx-3 mb-2 flex items-baseline justify-between">
                <p className="text-eyebrow text-text-3">{section.title}</p>
                <p className="text-[12px] text-text-4">
                  {section.photos.length} {section.photos.length === 1 ? "photo" : "photos"}
                </p>
              </div>
              <div className="card grid grid-cols-3 gap-2 p-3.5">
                {section.photos.map((photo, photoIndex) => (
                  <PhotoTile
                    key={`${photo.url}-${photoIndex}`}
                    photo={photo}
                    tone={toneByUrl.get(photo.url)}
                    onClick={() => setViewer({ photos: section.photos, index: photoIndex })}
                  />
                ))}
              </div>
            </section>
          ))
        )}

        <p className="mx-3 mt-5 text-[13px] leading-[18px] text-text-3">
          {phase === "inProgress"
            ? "This report hasn't been sent yet. Continue it above to send it."
            : "This report is completed and read-only. If something in it is wrong, tell your Driver Manager."}
        </p>
      </div>

      <ReportPhotoViewer
        visible={viewer !== null}
        photos={viewer?.photos ?? []}
        startIndex={viewer?.index ?? 0}
        onClose={() => setViewer(null)}
        trackerId={trackerId}
        checklistType={checklistType}
      />
    </Screen>
  );
}
