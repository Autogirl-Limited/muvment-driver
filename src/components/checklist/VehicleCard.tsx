import { Car } from "lucide-react";

interface VehicleCardProps {
  model: string;
  plate: string;
  imageUri?: string;
  statusText?: string;
}

export const VehicleCard = ({
  model,
  plate,
  imageUri,
  statusText = "Selected for this ride",
}: VehicleCardProps) => (
  <div className="card overflow-hidden">
    {imageUri ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={imageUri} alt={model} className="h-40 w-full object-cover" loading="lazy" />
    ) : (
      <div className="flex h-40 w-full items-center justify-center bg-surface-soft text-text-4" aria-hidden>
        <Car size={40} />
      </div>
    )}
    <div className="p-4">
      <p className="text-headline text-text">{model}</p>
      <p className="text-callout mt-0.5 text-text-3">{plate}</p>
      <p className="text-footnote mt-4 flex items-center gap-2 text-text-2">
        <span className="h-1.5 w-1.5 rounded-full bg-success" />
        {statusText}
      </p>
    </div>
  </div>
);
