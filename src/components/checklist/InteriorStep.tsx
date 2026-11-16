"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Fuel, Gauge, PencilLine, RotateCcw } from "lucide-react";

import { Spinner } from "@/components/ui/Spinner";
import type { VehicleMetadata } from "@/lib/api/types";

export const parseNumericInput = (value: string) => {
  const normalizedValue = value.replace(/[,%\s]/g, "");

  if (!normalizedValue) {
    return undefined;
  }

  const parsedValue = Number(normalizedValue);

  return Number.isFinite(parsedValue) ? parsedValue : undefined;
};

/** Keeps only digits and the first decimal point while the driver types. */
export const sanitizeNumericInput = (value: string) => {
  const digitsAndDot = value.replace(/[^0-9.]/g, "");
  const firstDotIndex = digitsAndDot.indexOf(".");

  if (firstDotIndex === -1) {
    return digitsAndDot;
  }

  return digitsAndDot.slice(0, firstDotIndex + 1) + digitsAndDot.slice(firstDotIndex + 1).replace(/\./g, "");
};

export const getInteriorAnalysisMetadata = (data?: { metadata?: VehicleMetadata; vehicleMetadata?: VehicleMetadata }) =>
  data?.vehicleMetadata ?? data?.metadata;

export const isMetadataValid = (odometerKM?: number, fuelLevelInPercentage?: number) =>
  odometerKM !== undefined &&
  odometerKM >= 0 &&
  fuelLevelInPercentage !== undefined &&
  fuelLevelInPercentage >= 0 &&
  fuelLevelInPercentage <= 100;

const formatMetadataValue = (value?: number) => (value === undefined ? "Unavailable" : String(value));

interface ReadingsFieldsProps {
  odometer: string;
  fuelLevel: string;
  onOdometerChange: (value: string) => void;
  onFuelLevelChange: (value: string) => void;
}

export const ReadingsFields = ({ odometer, fuelLevel, onOdometerChange, onFuelLevelChange }: ReadingsFieldsProps) => (
  <div className="mb-6 grid grid-cols-2 gap-3">
    <label className="block">
      <span className="text-footnote mb-2 flex items-center gap-1.5 font-medium text-text">
        <Gauge size={14} />
        Odometer (km)
      </span>
      <input
        value={odometer}
        onChange={(event) => onOdometerChange(sanitizeNumericInput(event.target.value))}
        placeholder="0"
        inputMode="decimal"
        className="hide-number-spin h-12 w-full rounded-xl border border-border-strong bg-surface px-4 text-[16px] text-text outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(6,115,255,0.15)]"
      />
    </label>
    <label className="block">
      <span className="text-footnote mb-2 flex items-center gap-1.5 font-medium text-text">
        <Fuel size={14} />
        Fuel Level (%)
      </span>
      <input
        value={fuelLevel}
        onChange={(event) => onFuelLevelChange(sanitizeNumericInput(event.target.value))}
        placeholder="0%"
        inputMode="decimal"
        className="hide-number-spin h-12 w-full rounded-xl border border-border-strong bg-surface px-4 text-[16px] text-text outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(6,115,255,0.15)]"
      />
    </label>
  </div>
);

export const AnalysisReviewCard = ({ metadata, children }: { metadata: VehicleMetadata; children?: React.ReactNode }) => (
  <div className="anim-rise-in mb-6 rounded-2xl border border-accent/30 bg-accent-soft p-4">
    <p className="text-headline mb-1 text-text">Dashboard Analysis</p>
    <p className="text-footnote mb-4 text-text-2">
      Confirm the dashboard reading below. If the detected values are wrong, edit the odometer or fuel level before
      continuing.
    </p>
    <div className="mb-4 grid grid-cols-2 gap-3">
      <div>
        <p className="text-caption text-text-3">Detected odometer</p>
        <p className="text-body font-semibold text-text">{formatMetadataValue(metadata.odometerKM)}</p>
      </div>
      <div>
        <p className="text-caption text-text-3">Detected fuel</p>
        <p className="text-body font-semibold text-text">{formatMetadataValue(metadata.fuelLevelInPercentage)}%</p>
      </div>
    </div>
    {children}
  </div>
);

export const FeatureChips = ({
  features,
  selectedIds,
  onToggle,
  loading,
}: {
  features: { id: string; name: string }[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  loading?: boolean;
}) => {
  if (loading) {
    return <p className="text-footnote mb-4 text-text-3">Loading vehicle features...</p>;
  }

  if (features.length === 0) {
    return null;
  }

  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {features.map((feature) => {
        const isSelected = selectedIds.includes(feature.id);

        return (
          <button
            key={feature.id}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onToggle(feature.id)}
            className={`pressable rounded-full border px-3.5 py-2 text-[13px] font-medium transition-colors ${
              isSelected ? "border-accent bg-accent-soft text-accent-text" : "border-border bg-surface text-text"
            }`}
          >
            {feature.name}
          </button>
        );
      })}
    </div>
  );
};

/* ------------------------------------------------------------------ dashboard analysis status */
/** After this long the driver is offered manual entry while the AI is still working. */
export const ANALYSIS_SLOW_AFTER_MS = 20_000;

/**
 * Tracks the AI dashboard analysis from the driver's point of view: working,
 * slow (past ANALYSIS_SLOW_AFTER_MS), failed, or replaced by manual entry.
 */
export const useDashboardAnalysisStatus = (analyzing: boolean) => {
  const [slow, setSlow] = useState(false);
  const [failed, setFailed] = useState(false);
  const [manual, setManual] = useState(false);
  const manualRef = useRef(false);

  useEffect(() => {
    if (!analyzing || manual) {
      setSlow(false);
      return;
    }
    const timer = window.setTimeout(() => setSlow(true), ANALYSIS_SLOW_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [analyzing, manual]);

  const markFailed = useCallback(() => setFailed(true), []);
  const clearFailed = useCallback(() => setFailed(false), []);
  const enterManually = useCallback(() => {
    manualRef.current = true;
    setManual(true);
    setFailed(false);
    setSlow(false);
  }, []);

  return { clearFailed, enterManually, failed, manual, manualRef, markFailed, slow };
};

export const DashboardAnalysisNotice = ({
  analyzing,
  failed,
  manual,
  onManual,
  onRetry,
  slow,
}: {
  analyzing: boolean;
  failed: boolean;
  manual: boolean;
  onManual: () => void;
  onRetry: () => void;
  slow: boolean;
}) => {
  const actionClass =
    "pressable inline-flex min-h-11 items-center gap-2 rounded-xl border border-border-strong bg-surface px-4 text-[14px] font-semibold text-text";

  if (manual) {
    return (
      <div role="status" className="anim-rise-in mb-6 flex gap-3 rounded-2xl border border-border bg-surface p-4">
        <PencilLine size={18} className="mt-0.5 shrink-0 text-text-2" />
        <div>
          <p className="text-callout font-semibold text-text">Enter your readings</p>
          <p className="text-footnote mt-1 text-text-2">
            Type the odometer and fuel level exactly as the dashboard shows them, then continue.
          </p>
        </div>
      </div>
    );
  }

  if (analyzing) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`anim-rise-in mb-6 rounded-2xl border p-4 ${slow ? "border-warning/40 bg-warning-soft" : "border-accent/30 bg-accent-soft"}`}
      >
        <div className="flex items-start gap-3">
          {slow ? (
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning-text" />
          ) : (
            <Spinner size={18} className="mt-0.5 shrink-0 text-accent" />
          )}
          <div>
            <p className={`text-callout font-semibold ${slow ? "text-warning-text" : "text-text"}`}>
              {slow ? "This is taking longer than usual" : "Analyzing your dashboard photo"}
            </p>
            <p className="text-footnote mt-1 text-text-2">
              {slow
                ? "You can keep waiting, or enter the odometer and fuel level yourself."
                : "We are reading the odometer and fuel level. This usually takes a few seconds."}
            </p>
          </div>
        </div>
        {slow && (
          <button type="button" onClick={onManual} className={`${actionClass} mt-3`}>
            <PencilLine size={16} />
            Enter manually
          </button>
        )}
      </div>
    );
  }

  if (failed) {
    return (
      <div role="alert" className="anim-rise-in mb-6 rounded-2xl border border-danger/30 bg-danger-soft p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-danger" />
          <div>
            <p className="text-callout font-semibold text-text">We couldn&apos;t read your dashboard</p>
            <p className="text-footnote mt-1 text-text-2">
              Try again, or enter the odometer and fuel level yourself.
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={onRetry} className={actionClass}>
            <RotateCcw size={16} />
            Try again
          </button>
          <button type="button" onClick={onManual} className={actionClass}>
            <PencilLine size={16} />
            Enter manually
          </button>
        </div>
      </div>
    );
  }

  return null;
};
