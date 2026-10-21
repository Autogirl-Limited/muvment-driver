"use client";

import { Check } from "lucide-react";

interface StepIndicatorProps {
  currentStep: number;
  totalSteps?: number;
  onStepPress?: (step: number) => void;
}

export const StepIndicator = ({ currentStep, totalSteps = 4, onStepPress }: StepIndicatorProps) => {
  const steps = Array.from({ length: totalSteps }, (_, index) => index + 1);

  return (
    <div className="my-5 flex items-center">
      {steps.map((step, index) => {
        const isDone = step < currentStep;
        const isActive = step === currentStep;
        const isSelectable = Boolean(onStepPress) && step <= currentStep;

        return (
          <div key={step} className="flex flex-1 items-center last:flex-none">
            <button
              type="button"
              disabled={!isSelectable}
              onClick={() => onStepPress?.(step)}
              aria-current={isActive ? "step" : undefined}
              aria-label={`Step ${step}`}
              className={`pressable flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold transition-colors ${
                isDone
                  ? "bg-accent text-white"
                  : isActive
                    ? "bg-accent text-white shadow-[0_0_0_4px_rgba(6,115,255,0.18)]"
                    : "bg-surface-alt text-text-4"
              }`}
            >
              {isDone ? <Check size={18} strokeWidth={3} /> : step}
            </button>
            {index < steps.length - 1 && (
              <div className="mx-2 h-0.5 flex-1 overflow-hidden rounded-full bg-surface-alt">
                <div
                  className="h-full bg-accent"
                  style={{
                    width: isDone ? "100%" : "0%",
                    transition: "width var(--dur-slow) var(--ease-spring)",
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
