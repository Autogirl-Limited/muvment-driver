import { MapPin } from "lucide-react";

import { SectionHeader } from "@/components/ui/Screen";

interface LocationItemProps {
  title: string;
  address: string;
  mapsUrl?: string | null;
}

export const LocationItem = ({ title, address, mapsUrl }: LocationItemProps) => (
  <div>
    <SectionHeader>{title}</SectionHeader>
    <div className="flex items-start gap-3">
      <MapPin size={18} className="mt-0.5 shrink-0 text-text-4" />
      <p className="text-body flex-1 text-text">{address}</p>
    </div>
    {mapsUrl && (
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-footnote pressable-soft ml-[30px] mt-2 inline-block font-medium text-accent"
      >
        Open in Maps
      </a>
    )}
  </div>
);
