"use client";

import { AiFeedbackCard, toAiFeedbackTone } from "@/components/checklist/AiFeedbackCard";
import { insightTone } from "@/components/checklist/AiPhotoNotes";
import { useConditionReport, useDashboardReading, useReportInsights } from "@/lib/api/hooks/useChecklistAi";
import type { ChecklistType } from "@/lib/api/types";

const KIND_LABEL: Record<string, string> = {
  DAMAGE: "Damage",
  ACCESSORY: "Accessory",
  OIL_LEVEL: "Oil",
  COOLANT_LEVEL: "Coolant",
  SAFETY_EQUIPMENT: "Safety",
  DRIVER_SELFIE: "Selfie",
};

/** Most recommendations shown; the rest are in the report for the fleet manager. */
const MAX_RECOMMENDATIONS = 4;

/**
 * The server's checks for this report, next to the car's previous report:
 * whether there is new damage, and how the odometer and fuel compare. Each
 * line updates while the server is still working.
 */
export const ChecklistAiSummary = ({
  trackerId,
  checklistType,
  onOpenExterior,
  onOpenReadings,
  readOnly = false,
}: {
  trackerId?: string;
  checklistType: ChecklistType;
  /** A sent (completed) report: leave out "photo unusable, retake it" items. */
  readOnly?: boolean;
  onOpenExterior?: () => void;
  onOpenReadings?: () => void;
}) => {
  const { data: report } = useConditionReport(trackerId || undefined, checklistType);
  const { data: reading } = useDashboardReading(trackerId || undefined, checklistType);
  const { data: insights } = useReportInsights(trackerId || undefined, checklistType);
  // Only what the driver should act on, worst first (the server sorts them).
  const recommendations = (insights ?? [])
    .filter((insight) => insight.status === "COMPLETED" && insight.verdict && insight.verdict !== "OK")
    .filter((insight) => !(readOnly && insight.verdict === "UNUSABLE"))
    .slice(0, MAX_RECOMMENDATIONS);

  if (!report && !reading && recommendations.length === 0) return null;

  return (
    <section className="anim-fade-in mb-5">
      <p className="text-eyebrow ml-1 text-text-3">AI Check</p>
      {report && (
        <AiFeedbackCard
          tone={
            report.status === "COMPLETED" && report.newDamageFound !== true && !report.needsReview && !report.previousCapturedAt
              ? "neutral"
              : toAiFeedbackTone(report.status, report.needsReview)
          }
          headline={report.headline}
          feedback={report.feedback}
          onClick={report.needsReview ? onOpenExterior : undefined}
        />
      )}
      {reading && (
        <AiFeedbackCard
          tone={toAiFeedbackTone(reading.status, reading.needsReview)}
          headline={reading.headline}
          feedback={reading.feedback}
          onClick={reading.needsReview ? onOpenReadings : undefined}
        />
      )}
      {recommendations.map((insight) => (
        <AiFeedbackCard
          key={insight.id}
          compact
          tone={insightTone(insight)}
          headline={`${insight.label?.trim() || KIND_LABEL[insight.kind] || "Photo"}: ${insight.headline ?? ""}`}
          feedback={insight.recommendation}
        />
      ))}
    </section>
  );
};
