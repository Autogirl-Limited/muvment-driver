"use client";

import { CheckCircle2, LocateFixed, MapPin, MapPinOff, SignalLow } from "lucide-react";

import { Spinner } from "@/components/ui/Spinner";
import { RIDE_GPS_RADIUS_METERS } from "@/lib/rideTimer/rideGps";
import { useRideLocation } from "@/lib/rideTimer/useRideLocation";
import type { MapCoordinate } from "@/lib/utils/geo";

const formatDistance = (meters: number) =>
  meters < 1000 ? `${Math.max(10, Math.round(meters / 10) * 10)} m` : `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)} km`;

const TONES = {
  good: "bg-success-soft text-success-text",
  neutral: "bg-surface-alt text-text-2",
  warn: "bg-warning-soft text-warning-text",
} as const;

/**
 * One line telling the driver what their location will say about this
 * action, before they tap: "At the pickup", "1.2 km from the drop-off",
 * "Location is off". It informs, never blocks: rides start early, end
 * somewhere else, and the time is saved either way.
 */
export const RideLocationNote = ({
  target,
  place,
  active = true,
  className = "",
}: {
  target: MapCoordinate | null | undefined;
  /** "pickup" or "drop-off" */
  place: string;
  active?: boolean;
  className?: string;
}) => {
  const { status, needsPrompt, requestPermission } = useRideLocation(target, active);

  if (status.kind === "unsupported") return null;

  const view = (() => {
    if (needsPrompt) {
      return {
        tone: "neutral" as const,
        icon: <LocateFixed size={16} />,
        text: `Allow location so the ${place} can be confirmed with your time.`,
        action: { label: "Allow", onClick: requestPermission },
      };
    }
    switch (status.kind) {
      case "denied":
        return {
          tone: "warn" as const,
          icon: <MapPinOff size={16} />,
          text: `Location is off. Your time is still saved, but the ${place} can't be confirmed. Turn location on in your browser settings.`,
        };
      case "locating":
        return { tone: "neutral" as const, icon: <Spinner size={14} />, text: "Finding your location…" };
      case "unavailable":
        return {
          tone: "warn" as const,
          icon: <SignalLow size={16} />,
          text: `No GPS signal right now. Your time is still saved; the ${place} may not be confirmed.`,
        };
      case "weak":
        return {
          tone: "warn" as const,
          icon: <SignalLow size={16} />,
          text: `Weak GPS${status.accuracy ? ` (±${Math.round(status.accuracy)} m)` : ""}. Step into the open if you can.`,
        };
      case "ready": {
        const accuracy = status.accuracy ? ` · GPS ±${Math.round(status.accuracy)} m` : "";
        if (status.distanceMeters === null) {
          return { tone: "good" as const, icon: <CheckCircle2 size={16} />, text: `Location ready${accuracy}` };
        }
        if (status.distanceMeters <= RIDE_GPS_RADIUS_METERS) {
          return { tone: "good" as const, icon: <CheckCircle2 size={16} />, text: `You're at the ${place}${accuracy}` };
        }
        return {
          tone: "neutral" as const,
          icon: <MapPin size={16} />,
          text: `You're ${formatDistance(status.distanceMeters)} from the ${place}. Your location is saved with the time.`,
        };
      }
    }
  })();

  return (
    <div
      className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left ${TONES[view.tone]} ${className}`}
      role="status"
      aria-live="polite"
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">{view.icon}</span>
      <p className="text-footnote min-w-0 flex-1">{view.text}</p>
      {"action" in view && view.action && (
        <button
          type="button"
          onClick={view.action.onClick}
          className="pressable shrink-0 rounded-lg bg-accent px-3 py-1.5 text-[13px] font-semibold text-white"
        >
          {view.action.label}
        </button>
      )}
    </div>
  );
};
