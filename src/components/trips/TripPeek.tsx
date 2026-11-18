"use client";

import { Car, Clock, Info, MapPin, Navigation, Share2, User } from "lucide-react";

import { TripBadge } from "@/components/ui/Badge";
import { Sheet } from "@/components/ui/Dialog";
import { getMapsSearchUrl } from "@/lib/utils/deviceActions";
import type { DriverTripBadge } from "@/lib/utils/driverTrips";

interface TripPeekProps {
  open: boolean;
  onClose: () => void;
  onOpenTrip: () => void;
  badges: DriverTripBadge[];
  clientName: string;
  location: string;
  vehicle: string;
  timeRange: string;
  tripId: string;
}

const DetailRow = ({ icon: Icon, tint, label, value }: { icon: typeof User; tint: string; label: string; value: string }) => (
  <div className="flex items-start gap-3 px-4 py-3" aria-label={`${label}: ${value || "Not set"}`}>
    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] text-white" style={{ backgroundColor: tint }}>
      <Icon size={16} />
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-[12px] font-medium uppercase tracking-wide text-text-3">{label}</span>
      <span className="block text-[16px] text-text">{value || "Not set"}</span>
    </span>
  </div>
);

const ActionRow = ({ icon: Icon, label, onClick }: { icon: typeof User; label: string; onClick: () => void }) => (
  <button type="button" onClick={onClick} className="pressable flex w-full items-center gap-3 px-4 py-3.5 text-left">
    <Icon size={18} className="text-accent-text" />
    <span className="text-[16px] font-medium text-text">{label}</span>
  </button>
);

/**
 * A quick look at a trip without opening it, from a long press on its card:
 * the client, when, pickup and vehicle in labelled rows, plus the actions
 * drivers reach for most.
 */
export const TripPeek = ({ open, onClose, onOpenTrip, badges, clientName, location, vehicle, timeRange, tripId }: TripPeekProps) => {
  const share = async () => {
    onClose();
    const text = `Trip ${tripId}`;

    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(tripId);
      }
    } catch {
      // The driver closed the share sheet.
    }
  };
  const directionsUrl = getMapsSearchUrl({ address: location });

  return (
    <Sheet open={open} onClose={onClose} title={clientName}>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {badges.map((badge, index) => (
          <TripBadge key={`${badge.label}-${index}`} label={badge.label} type={badge.type} />
        ))}
      </div>

      <div className="card divide-y divide-separator p-0">
        <DetailRow icon={User} tint="#007AFF" label="Client" value={clientName} />
        <DetailRow icon={Clock} tint="#FF9500" label="When" value={timeRange} />
        <DetailRow icon={MapPin} tint="#34C759" label="Pickup" value={location} />
        <DetailRow icon={Car} tint="#5856D6" label="Vehicle" value={vehicle} />
      </div>

      <div className="card mt-3 divide-y divide-separator p-0">
        <ActionRow
          icon={Info}
          label="View Trip Details"
          onClick={() => {
            onClose();
            onOpenTrip();
          }}
        />
        {directionsUrl && (
          <ActionRow
            icon={Navigation}
            label="Get Directions"
            onClick={() => {
              onClose();
              window.open(directionsUrl, "_blank", "noopener,noreferrer");
            }}
          />
        )}
        <ActionRow icon={Share2} label="Share Trip ID" onClick={() => void share()} />
      </div>
    </Sheet>
  );
};
