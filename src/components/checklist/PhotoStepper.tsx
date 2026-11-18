"use client";

import { Check } from "lucide-react";

import { Spinner } from "@/components/ui/Spinner";

export type ShotTileState = "empty" | "saved" | "uploading" | "uploaded" | "failed";

export interface PhotoStep {
  key: string;
  label: string;
  state: ShotTileState;
  optional?: boolean;
}

const isDone = (state: ShotTileState) => state === "uploaded" || state === "saved";

/**
 * A plain stepper for the exterior photos: numbered circles joined by a line,
 * with the name under each. Green tick = done, blue = the one you're on,
 * red ! = upload failed. Tap any step to go to it.
 */
export const PhotoStepper = ({
  steps,
  current,
  onSelect,
}: {
  steps: PhotoStep[];
  current: number;
  onSelect: (index: number) => void;
}) => (
  <div className="flex" role="list">
    {steps.map((step, index) => {
      const isCurrent = index === current;
      const done = isDone(step.state);
      const failed = step.state === "failed";
      const uploading = step.state === "uploading";
      const status = failed ? "upload failed" : uploading ? "uploading" : done ? "done" : step.optional ? "optional" : "not done";
      const circle = failed
        ? "border-danger bg-danger text-white"
        : done
          ? "border-success bg-success text-white"
          : isCurrent
            ? "border-accent bg-accent text-white"
            : `bg-surface text-text-4 ${step.optional ? "border-dashed border-border-strong" : "border-border-strong"}`;

      return (
        <button
          key={step.key}
          type="button"
          role="listitem"
          aria-current={isCurrent ? "step" : undefined}
          aria-label={`Step ${index + 1}, ${step.label}, ${status}`}
          onClick={() => !isCurrent && onSelect(index)}
          className="relative flex flex-1 flex-col items-center"
        >
          {index > 0 && (
            <span className={`absolute left-0 right-1/2 top-[13px] h-0.5 ${isDone(steps[index - 1].state) ? "bg-success" : "bg-fill-strong"}`} />
          )}
          {index < steps.length - 1 && (
            <span className={`absolute left-1/2 right-0 top-[13px] h-0.5 ${done ? "bg-success" : "bg-fill-strong"}`} />
          )}
          <span className={`relative flex h-7 w-7 items-center justify-center rounded-full border-2 text-[13px] font-semibold tabular-nums transition-colors ${circle}`}>
            {uploading ? <Spinner size={14} className="text-current" /> : failed ? "!" : done ? <Check size={13} strokeWidth={3.5} /> : index + 1}
          </span>
          <span className={`mt-1.5 max-w-full truncate px-0.5 text-[13px] ${isCurrent ? "font-bold text-text" : "font-medium text-text-3"}`}>
            {step.label}
          </span>
          {step.optional && <span className="text-[11px] text-text-4">Optional</span>}
        </button>
      );
    })}
  </div>
);

/** The state of a photo slot, for the stepper. */
export const toShotTileState = (status: "empty" | "failed" | "uploaded" | "uploading", savedEarlier: boolean): ShotTileState =>
  status === "empty" ? (savedEarlier ? "saved" : "empty") : status;
