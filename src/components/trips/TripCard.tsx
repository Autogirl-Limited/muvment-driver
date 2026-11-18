"use client";

import { useRef, useState } from "react";
import { Car, Clock, MapPin } from "lucide-react";

import { TripBadge } from "@/components/ui/Badge";
import { TripPeek } from "@/components/trips/TripPeek";
import { TripTimeNotes } from "@/components/trips/TripTimeNotes";
import type { DriverTripBadge, DriverTripExtension } from "@/lib/utils/driverTrips";

interface TripCardProps {
  badges: DriverTripBadge[];
  clientName: string;
  location: string;
  vehicle: string;
  timeRange: string;
  tripId: string;
  /** Paid time the client added to the booking. */
  extension?: DriverTripExtension;
  /** Shown while the ride runs past its booked end. */
  overtimeNote?: string;
  onClick?: () => void;
}

export const TripCard = ({
  badges,
  clientName,
  location,
  vehicle,
  timeRange,
  tripId,
  extension,
  overtimeNote,
  onClick,
}: TripCardProps) => {
  const [peeking, setPeeking] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const longPressed = useRef(false);

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = undefined;
  };

  return (
    <>
  <button
    type="button"
    onClick={() => {
      // A long press opened the preview; its release isn't also a tap.
      if (longPressed.current) {
        longPressed.current = false;
        return;
      }
      onClick?.();
    }}
    onPointerDown={() => {
      longPressed.current = false;
      cancel();
      timer.current = setTimeout(() => {
        longPressed.current = true;
        if ("vibrate" in navigator) navigator.vibrate?.(10);
        setPeeking(true);
      }, 500);
    }}
    onPointerUp={cancel}
    onPointerLeave={cancel}
    onPointerCancel={cancel}
    onContextMenu={(event) => {
      event.preventDefault();
      cancel();
      longPressed.current = true;
      setPeeking(true);
    }}
    className="card pressable mb-3 w-full select-none p-4 text-left"
    style={{ WebkitTouchCallout: "none" }}
  >
    <div className="mb-3 flex flex-wrap gap-1.5">
      {badges.map((badge, index) => (
        <TripBadge key={`${badge.label}-${index}`} label={badge.label} type={badge.type} />
      ))}
    </div>

    <p className="text-headline mb-3 text-[17px] text-text">{clientName}</p>

    <div className="space-y-2">
      <p className="text-callout flex items-start gap-2 text-text-2">
        <MapPin size={16} className="mt-0.5 shrink-0 text-text-4" />
        <span className="min-w-0 flex-1">{location}</span>
      </p>
      <p className="text-callout flex items-start gap-2 text-text-2">
        <Car size={16} className="mt-0.5 shrink-0 text-text-4" />
        <span className="min-w-0 flex-1">{vehicle}</span>
      </p>
      <p className="text-callout flex items-start gap-2 text-text-2">
        <Clock size={16} className="mt-0.5 shrink-0 text-text-4" />
        <span className="min-w-0 flex-1">{timeRange}</span>
      </p>
    </div>

    <TripTimeNotes extension={extension} overtimeNote={overtimeNote} className="mt-3" />

    <div className="mt-4 border-t border-separator pt-3">
      <p className="text-eyebrow text-right tracking-[0.14em] text-text-4">{tripId}</p>
    </div>
  </button>
    <TripPeek
      open={peeking}
      onClose={() => setPeeking(false)}
      onOpenTrip={() => onClick?.()}
      badges={badges}
      clientName={clientName}
      location={location}
      vehicle={vehicle}
      timeRange={timeRange}
      tripId={tripId}
    />
    </>
  );
};
