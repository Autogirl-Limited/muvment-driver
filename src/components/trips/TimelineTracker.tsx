import { CheckCircle2 } from "lucide-react";

import type { TimelineStep } from "@/lib/data/tripTimeline";

export const TimelineTracker = ({ steps }: { steps: TimelineStep[] }) => (
  <ol className="ml-1">
    {steps.map((step, index) => {
      const isLast = index === steps.length - 1;

      return (
        <li key={step.id} className="relative flex">
          {!isLast && <span className="absolute top-6 bottom-0 left-[8px] w-px bg-separator" />}
          <span className="z-10 flex w-10 items-start pt-1">
            {step.state === "completed" ? (
              <CheckCircle2 size={18} className="text-success" />
            ) : step.state === "current" ? (
              <span className="ml-px h-4 w-4 rounded-full border-2 border-text-3" />
            ) : (
              <span className="ml-px h-4 w-4 rounded-full border border-border-strong" />
            )}
          </span>
          <span className="flex flex-1 items-center justify-between pb-4">
            <span
              className={`text-body ${
                step.state === "completed"
                  ? "text-success"
                  : step.state === "current"
                    ? "font-medium text-text"
                    : "text-text-3"
              }`}
            >
              {step.title}
            </span>
            {step.state === "current" && (
              <span className="rounded-full bg-text-4 px-2.5 py-1 text-[11px] font-medium text-white">Current</span>
            )}
          </span>
        </li>
      );
    })}
  </ol>
);
