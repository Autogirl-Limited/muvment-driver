/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import { Info, Sparkles } from "lucide-react";

import { AiFeedbackCard, toAiFeedbackTone } from "@/components/checklist/AiFeedbackCard";
import { insightTone } from "@/components/checklist/AiPhotoNotes";
import { useDashboardReading, usePhotoCheck, usePhotoInsight } from "@/lib/api/hooks/useChecklistAi";
import type { ChecklistType, PhotoInsightKind } from "@/lib/api/types";

export interface ReportPhoto {
  url: string;
  /** The photo's slot, e.g. FRONT, DASHBOARD, OIL_LEVEL. */
  slot: string;
  /** The report step it belongs to, e.g. EXTERIOR. */
  step: string;
  label: string;
}

const SIDES = new Set(["FRONT", "BACK", "LEFT_SIDE", "RIGHT_SIDE"]);

/** Which AI analysis a photo has, from its step and slot. */
export const insightKindFor = (photo: Pick<ReportPhoto, "step" | "slot">): PhotoInsightKind | undefined => {
  if (photo.step === "DRIVER_PHOTO") return "DRIVER_SELFIE";

  switch (photo.slot) {
    case "DAMAGE":
      return "DAMAGE";
    case "ACCESSORIES":
      return "ACCESSORY";
    case "OIL_LEVEL":
    case "COOLANT_LEVEL":
    case "SAFETY_EQUIPMENT":
      return photo.slot;
    default:
      return undefined;
  }
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const formatKm = (km?: number | null) => (km === null || km === undefined ? undefined : `${Math.round(km).toLocaleString("en-US")} km`);

const NoAnalysis = ({ text }: { text: string }) => (
  <p className="flex items-center gap-2 py-1 text-[14px] text-white/60">
    <Info size={15} />
    {text}
  </p>
);

/** A side of the car, compared with the same side in its previous report. */
const SideAnalysis = ({
  photo,
  comparing,
  onToggleCompare,
}: {
  photo: ReportPhoto;
  comparing: boolean;
  onToggleCompare: (previousUrl?: string) => void;
}) => {
  const { data: check } = usePhotoCheck(photo.url);

  if (!check) return <NoAnalysis text="No AI comparison for this photo." />;

  const tone =
    check.status !== "COMPLETED"
      ? toAiFeedbackTone(check.status, false)
      : check.outcome === "NEW_DAMAGE"
        ? "failed"
        : check.outcome === "UNUSABLE_PHOTO" || check.outcome === "WRONG_SIDE"
          ? "attention"
          : check.outcome === "NO_BASELINE"
            ? "neutral"
            : "good";

  return (
    <div>
      {/* No retake advice: the report was sent and is complete. */}
      <AiFeedbackCard tone={tone} headline={check.headline} feedback={check.feedback} />
      {check.newDamage.length > 0 && (
        <div className="mt-2.5">
          <p className="mb-1.5 text-[13px] font-semibold text-white/60">NEW DAMAGE</p>
          {check.newDamage.map((damage, index) => (
            <p key={index} className="mb-1.5 flex items-start gap-2 text-[14px] leading-5 text-white">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF453A]" />
              <span>
                {[damage.kind, damage.location].filter(Boolean).join(" · ") || "Damage"}
                {damage.severity ? ` (${String(damage.severity).toLowerCase()})` : ""}
                {damage.description ? ` — ${damage.description}` : ""}
              </span>
            </p>
          ))}
        </div>
      )}
      {check.previousImageUrl && (
        <button
          type="button"
          onClick={() => onToggleCompare(check.previousImageUrl ?? undefined)}
          className="pressable mt-3 flex w-full items-center gap-2.5 rounded-xl bg-white/10 p-2.5 text-left"
        >
          <img src={comparing ? photo.url : check.previousImageUrl} alt="" className="h-11 w-11 rounded-lg object-cover" />
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-white">{comparing ? "Show This Report" : "Compare with Last Report"}</span>
            <span className="block text-[12.5px] text-white/60">
              {comparing
                ? "Back to the photo you took"
                : `The same side${check.previousCapturedAt ? `, ${dateFormatter.format(new Date(check.previousCapturedAt))}` : ""}`}
            </span>
          </span>
        </button>
      )}
    </div>
  );
};

/** The dashboard: odometer and fuel as the AI read them. */
const DashboardAnalysis = ({ photo, trackerId, checklistType }: { photo: ReportPhoto; trackerId: string; checklistType: ChecklistType }) => {
  const { data: reading } = useDashboardReading(trackerId, checklistType, photo.url);

  if (!reading) return <NoAnalysis text="No AI reading for this photo." />;

  const facts = [
    formatKm(reading.odometerKm) ? `Odometer ${formatKm(reading.odometerKm)}` : undefined,
    reading.fuelPercent !== null && reading.fuelPercent !== undefined ? `Fuel ${Math.round(reading.fuelPercent)}%` : undefined,
    formatKm(reading.distanceSinceLastKm) ? `${formatKm(reading.distanceSinceLastKm)} since the last report` : undefined,
  ].filter(Boolean);

  return (
    <AiFeedbackCard
      tone={toAiFeedbackTone(reading.status, reading.needsReview)}
      headline={reading.headline}
      feedback={reading.feedback}
      footnote={facts.join(" · ") || undefined}
    />
  );
};

/** Oil, coolant, safety gear, accessories, damage close-ups and the selfie. */
const InsightAnalysis = ({ photo, kind }: { photo: ReportPhoto; kind: PhotoInsightKind }) => {
  const { data: insight } = usePhotoInsight(photo.url, kind);

  if (!insight) return <NoAnalysis text="No AI check for this photo." />;

  return (
    <AiFeedbackCard
      tone={insightTone(insight)}
      headline={insight.headline}
      feedback={insight.findings.join(" ") || undefined}
      // The report was sent and is complete: keep advice about the car, never "retake this photo".
      footnote={insight.verdict === "UNUSABLE" ? undefined : (insight.recommendation ?? undefined)}
    />
  );
};

/**
 * A sent report's photos, full screen like Photos: swipe between them, Done to
 * close, and under each one what the AI made of it.
 */
export const ReportPhotoViewer = ({
  photos,
  startIndex,
  visible,
  onClose,
  trackerId,
  checklistType,
}: {
  photos: ReportPhoto[];
  startIndex: number;
  visible: boolean;
  onClose: () => void;
  trackerId: string;
  checklistType: ChecklistType;
}) => {
  const [index, setIndex] = useState(startIndex);
  const [compareUrl, setCompareUrl] = useState<string>();
  const strip = useRef<HTMLDivElement>(null);

  // Open on the tapped photo.
  useEffect(() => {
    if (!visible) return;
    setIndex(startIndex);
    setCompareUrl(undefined);
    requestAnimationFrame(() => {
      const node = strip.current;
      if (node) node.scrollLeft = node.clientWidth * startIndex;
    });
  }, [startIndex, visible]);

  // Keep the page behind from scrolling while open, and close on Escape.
  useEffect(() => {
    if (!visible) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, visible]);

  if (!visible) return null;

  const photo = photos[index];
  const kind = photo ? insightKindFor(photo) : undefined;

  return (
    <div role="dialog" aria-modal="true" aria-label="Report photos" className="anim-fade-in fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between px-4" style={{ paddingTop: "calc(var(--safe-top) + 8px)", height: "calc(var(--safe-top) + 52px)" }}>
        <span className="text-[15px] font-semibold tabular-nums text-white/70">{photos.length > 1 ? `${index + 1} of ${photos.length}` : ""}</span>
        <button type="button" onClick={onClose} className="pressable-soft text-[17px] font-semibold text-white">
          Done
        </button>
      </div>

      <div
        ref={strip}
        onScroll={(event) => {
          const node = event.currentTarget;
          const next = Math.round(node.scrollLeft / node.clientWidth);
          if (next !== index && next >= 0 && next < photos.length) {
            setIndex(next);
            setCompareUrl(undefined);
          }
        }}
        className="flex h-[48dvh] shrink-0 snap-x snap-mandatory overflow-x-auto"
        style={{ scrollbarWidth: "none" }}
      >
        {photos.map((item, itemIndex) => (
          <div key={`${item.url}-${itemIndex}`} className="relative flex h-full w-full shrink-0 snap-center items-center justify-center">
            <img
              src={itemIndex === index && compareUrl ? compareUrl : item.url}
              alt={item.label}
              className="h-full w-full object-contain"
            />
            {itemIndex === index && compareUrl && (
              <span className="absolute top-2.5 rounded-xl bg-black/60 px-2.5 py-1 text-[12px] font-semibold text-white">LAST REPORT</span>
            )}
          </div>
        ))}
      </div>

      {photo && (
        <div key={photo.url} className="anim-fade-in scroll-y min-h-0 flex-1 px-5 pt-4" style={{ paddingBottom: "calc(var(--safe-bottom) + 24px)" }}>
          <h2 className="text-[22px] font-bold text-white">{photo.label}</h2>
          <p className="mb-3.5 mt-1 flex items-center gap-1.5 text-[13px] text-white/60">
            <Sparkles size={13} />
            AI Analysis
          </p>
          {SIDES.has(photo.slot) && photo.step === "EXTERIOR" ? (
            <SideAnalysis
              photo={photo}
              comparing={Boolean(compareUrl)}
              onToggleCompare={(previousUrl) => setCompareUrl((current) => (current ? undefined : previousUrl))}
            />
          ) : photo.slot === "DASHBOARD" ? (
            <DashboardAnalysis photo={photo} trackerId={trackerId} checklistType={checklistType} />
          ) : kind ? (
            <InsightAnalysis photo={photo} kind={kind} />
          ) : (
            <NoAnalysis text="The AI doesn't check this photo; it's kept for the record." />
          )}
        </div>
      )}
    </div>
  );
};
