"use client";

import { Car, Clock, MapPin } from "lucide-react";

import { TripBadge } from "@/components/ui/Badge";
import type { DriverTripBadge } from "@/lib/utils/driverTrips";

interface TripCardProps {
  badges: DriverTripBadge[];
  clientName: string;
  location: string;
  vehicle: string;
  timeRange: string;
  tripId: string;
  onClick?: () => void;
}

export const TripCard = ({ badges, clientName, location, vehicle, timeRange, tripId, onClick }: TripCardProps) => (
  <button
    type="button"
    onClick={onClick}
    className="card pressable mb-3 w-full p-4 text-left"
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

    <div className="mt-4 border-t border-separator pt-3">
      <p className="text-eyebrow text-right tracking-[0.14em] text-text-4">{tripId}</p>
    </div>
  </button>
);
