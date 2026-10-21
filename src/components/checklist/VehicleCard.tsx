interface VehicleCardProps {
  model: string;
  plate: string;
  imageUri?: string;
  statusText?: string;
}

const DEFAULT_VEHICLE_IMAGE =
  "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&q=80&w=800";

export const VehicleCard = ({
  model,
  plate,
  imageUri = DEFAULT_VEHICLE_IMAGE,
  statusText = "Selected for this ride",
}: VehicleCardProps) => (
  <div className="card overflow-hidden">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={imageUri} alt={model} className="h-40 w-full object-cover" loading="lazy" />
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
