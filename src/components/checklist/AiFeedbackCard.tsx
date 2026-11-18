"use client";

import { AlertTriangle, CheckCircle2, ChevronRight, Sparkles, XCircle } from "lucide-react";

import { Spinner } from "@/components/ui/Spinner";
import type { ChecklistAiStatus } from "@/lib/api/types";

/** The tone for a server result; anything needing review reads as attention. */
export const toAiFeedbackTone = (status: ChecklistAiStatus | undefined, needsAttention: boolean): AiFeedbackTone =>
  status === "PROCESSING" ? "processing" : status === "FAILED" ? "failed" : needsAttention ? "attention" : "good";

/** How an AI result should read: working, all good, worth a look, or not read. */
export type AiFeedbackTone = "processing" | "good" | "attention" | "failed" | "neutral";

const LOOK = {
  processing: { box: "bg-fill text-text-2", Icon: Sparkles },
  good: { box: "bg-success-soft text-success-text", Icon: CheckCircle2 },
  attention: { box: "bg-warning-soft text-warning-text", Icon: AlertTriangle },
  failed: { box: "bg-danger-soft text-danger-text", Icon: XCircle },
  neutral: { box: "bg-accent-soft text-accent-text", Icon: Sparkles },
} as const;

interface AiFeedbackCardProps {
  tone: AiFeedbackTone;
  headline?: string | null;
  feedback?: string | null;
  footnote?: string | null;
  compact?: boolean;
  onClick?: () => void;
}

/**
 * The AI's verdict on a photo, written for the driver: one headline and one
 * or two plain sentences, tinted by how much it matters. While it's still
 * working it shows a quiet spinner so the driver can keep going.
 */
export const AiFeedbackCard = ({ tone, headline, feedback, footnote, compact = false, onClick }: AiFeedbackCardProps) => {
  if (!headline && !feedback) return null;

  const { box, Icon } = LOOK[tone];
  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      key={`${tone}:${headline ?? ""}`}
      {...(onClick ? { type: "button" as const, onClick } : {})}
      aria-live="polite"
      className={`anim-fade-in flex w-full items-start rounded-[14px] text-left ${compact ? "mt-2.5 p-2.5" : "mt-3.5 p-3"} ${box}`}
    >
      <span className="flex w-[18px] justify-center pt-px">
        {tone === "processing" ? <Spinner size={14} /> : <Icon size={15} strokeWidth={2.25} />}
      </span>
      <span className="ml-2 min-w-0 flex-1">
        {headline && <span className={`block font-semibold leading-5 ${compact ? "text-[14px]" : "text-[15px]"}`}>{headline}</span>}
        {feedback && (
          <span className={`block opacity-90 ${compact ? "text-[13px] leading-[18px]" : "text-[14px] leading-[19px]"} ${headline ? "mt-0.5" : ""}`}>
            {feedback}
          </span>
        )}
        {footnote && <span className="mt-1 block text-[12px] leading-4 opacity-70">{footnote}</span>}
      </span>
      {onClick && <ChevronRight size={12} strokeWidth={2.5} className="ml-1.5 mt-[3px] shrink-0" />}
    </Tag>
  );
};
