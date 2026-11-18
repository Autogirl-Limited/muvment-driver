"use client";

import { useEffect, useRef } from "react";

import { AiFeedbackCard, type AiFeedbackTone } from "@/components/checklist/AiFeedbackCard";
import {
  useDashboardReading,
  usePhotoCheck,
  usePhotoInsight,
  useStartPhotoCheck,
  useStartPhotoInsight,
} from "@/lib/api/hooks/useChecklistAi";
import type { ChecklistType, ExteriorSide, PhotoInsight, PhotoInsightKind } from "@/lib/api/types";

/** How a finished analysis should read. */
export const insightTone = (insight: PhotoInsight): AiFeedbackTone => {
  if (insight.status === "PROCESSING") return "processing";
  if (insight.status === "FAILED") return "failed";

  switch (insight.verdict) {
    case "PROBLEM":
      return "failed";
    case "ATTENTION":
    case "UNUSABLE":
      return "attention";
    default:
      return "good";
  }
};

const VERDICT_TONE: Record<string, AiFeedbackTone> = {
  OK: "good",
  ATTENTION: "attention",
  PROBLEM: "attention",
  UNUSABLE: "attention",
};

/** The AI's verdict on one exterior side, compared with the last report. Starts once per uploaded photo. */
export const SidePhotoCheck = ({
  imageUrl,
  side,
  checklistType,
  trackerId,
  vehicleId,
}: {
  imageUrl?: string;
  side: ExteriorSide;
  checklistType: ChecklistType;
  trackerId?: string;
  vehicleId?: string;
}) => {
  const started = useRef(new Set<string>());
  const start = useStartPhotoCheck();
  const check = usePhotoCheck(imageUrl);
  const { mutate } = start;

  useEffect(() => {
    if (!imageUrl || started.current.has(imageUrl)) return;
    started.current.add(imageUrl);
    mutate({ checklistType, side, imageUrl, checklistTrackerId: trackerId, vehicleId });
  }, [checklistType, imageUrl, mutate, side, trackerId, vehicleId]);

  const result = check.data;
  if (!imageUrl || !result) return null;

  const needsAttention =
    result.outcome === "NEW_DAMAGE" || result.outcome === "UNUSABLE_PHOTO" || result.outcome === "WRONG_SIDE";
  const tone: AiFeedbackTone =
    result.status === "PROCESSING" ? "processing" : result.status === "FAILED" ? "failed" : needsAttention ? "attention" : "good";

  return (
    <AiFeedbackCard
      tone={tone}
      compact
      headline={result.status === "PROCESSING" ? "Checking this photo…" : result.headline}
      feedback={result.status === "PROCESSING" ? undefined : result.feedback}
      footnote={needsAttention ? result.retakeAdvice : undefined}
    />
  );
};

/** The AI's read of one health photo, accessory, damage close-up or selfie. */
export const PhotoInsightNote = ({
  imageUrl,
  kind,
  label,
  checklistType,
  trackerId,
}: {
  imageUrl?: string;
  kind: PhotoInsightKind;
  label?: string;
  checklistType: ChecklistType;
  trackerId?: string;
}) => {
  const started = useRef(new Set<string>());
  const start = useStartPhotoInsight();
  const insight = usePhotoInsight(imageUrl, kind);
  const { mutate } = start;

  useEffect(() => {
    if (!imageUrl || started.current.has(imageUrl)) return;
    started.current.add(imageUrl);
    mutate({ checklistType, checklistTrackerId: trackerId, imageUrl, kind, label });
  }, [checklistType, imageUrl, kind, label, mutate, trackerId]);

  const result = insight.data;
  if (!imageUrl || !result) return null;

  const tone: AiFeedbackTone =
    result.status === "PROCESSING" ? "processing" : result.status === "FAILED" ? "failed" : VERDICT_TONE[result.verdict ?? "OK"] ?? "good";
  const needsRetake = result.verdict === "UNUSABLE" || result.identityMatch === "NO_MATCH" || result.identityMatch === "NO_FACE";

  return (
    <AiFeedbackCard
      tone={tone}
      compact
      headline={result.status === "PROCESSING" ? "Checking this photo…" : result.headline}
      feedback={result.status === "PROCESSING" ? undefined : (result.recommendation ?? result.findings[0])}
      footnote={needsRetake ? result.retakeAdvice : undefined}
    />
  );
};

/** The AI's read of the dashboard photo: odometer and fuel checked against the car's last reading. */
export const DashboardReadingNote = ({
  trackerId,
  checklistType,
}: {
  trackerId?: string;
  checklistType: ChecklistType;
}) => {
  const reading = useDashboardReading(trackerId, checklistType).data;

  if (!reading) return null;

  const tone: AiFeedbackTone =
    reading.status === "PROCESSING" ? "processing" : reading.status === "FAILED" ? "failed" : reading.needsReview ? "attention" : "good";

  return (
    <AiFeedbackCard
      tone={tone}
      headline={reading.status === "PROCESSING" ? "Reading your dashboard…" : reading.headline}
      feedback={reading.status === "PROCESSING" ? undefined : reading.feedback}
    />
  );
};
