"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

/** Shown instead of sending the driver back: what is not saved yet and how to carry on. */
export const StepLockedNotice = ({
  onGo,
  onRecheck,
  stepName,
}: {
  onGo: () => void;
  onRecheck: () => void;
  stepName: string;
}) => {
  const actionClass =
    "pressable inline-flex min-h-11 items-center gap-2 rounded-xl border border-border-strong bg-surface px-4 text-[14px] font-semibold text-text";

  return (
    <div role="alert" className="anim-rise-in mb-5 rounded-2xl border border-warning/40 bg-warning-soft p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning-text" />
        <div>
          <p className="text-callout font-semibold text-warning-text">{stepName} isn&apos;t saved yet</p>
          <p className="text-footnote mt-1 text-text-2">
            Finish that part first. Photos you already took are kept on this phone, so you only need to send them again.
            If you&apos;ve already done it, check again.
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={onGo} className={actionClass}>
          Go to {stepName}
        </button>
        <button type="button" onClick={onRecheck} className={actionClass}>
          <RefreshCw size={16} />
          Check again
        </button>
      </div>
    </div>
  );
};
