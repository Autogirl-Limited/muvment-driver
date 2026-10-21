"use client";

import { Fuel, Gauge } from "lucide-react";

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
