"use client";

import { Check } from "lucide-react";

interface StepIndicatorProps {
  currentStep: number;
  totalSteps?: number;
  onStepPress?: (step: number) => void;
  /** Short names shown under each circle (index 0 is step 1). */
  labels?: string[];
}

/**
 * Numbered circles joined by a line, with the name under each. Green tick =
 * done, blue = the one you're on. Tap a done step to go back to it.
 */
export const StepIndicator = ({ currentStep, totalSteps = 4, onStepPress, labels }: StepIndicatorProps) => {
  const steps = Array.from({ length: totalSteps }, (_, index) => index + 1);

  return (
    <div className="my-4 flex" role="list">
      {steps.map((step, index) => {
        const isDone = step < currentStep;
        const isActive = step === currentStep;
        const isSelectable = Boolean(onStepPress) && step <= currentStep;

        return (
          <button
            key={step}
            type="button"
            role="listitem"
            disabled={!isSelectable}
            onClick={() => !isActive && onStepPress?.(step)}
            aria-current={isActive ? "step" : undefined}
            aria-label={`Step ${step}${labels?.[index] ? `, ${labels[index]}` : ""}${isDone ? ", done" : ""}`}
            className="relative flex flex-1 flex-col items-center disabled:cursor-default"
          >
            {index > 0 && (
              <span className={`absolute left-0 right-1/2 top-[13px] h-0.5 ${isDone || isActive ? "bg-success" : "bg-fill-strong"}`} />
            )}
            {index < steps.length - 1 && (
              <span className={`absolute left-1/2 right-0 top-[13px] h-0.5 ${isDone ? "bg-success" : "bg-fill-strong"}`} />
            )}
            <span
              className={`relative flex h-7 w-7 items-center justify-center rounded-full border-2 text-[13px] font-semibold tabular-nums transition-colors ${
                isDone
                  ? "border-success bg-success text-white"
                  : isActive
                    ? "border-accent bg-accent text-white shadow-[0_0_0_4px_rgba(6,115,255,0.18)]"
                    : "border-border-strong bg-surface text-text-4"
              }`}
            >
              {isDone ? <Check size={13} strokeWidth={3.5} /> : step}
            </span>
            {labels?.[index] && (
              <span className={`mt-1.5 max-w-full truncate px-0.5 text-[12px] ${isActive ? "font-bold text-text" : "font-medium text-text-3"}`}>
                {labels[index]}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
