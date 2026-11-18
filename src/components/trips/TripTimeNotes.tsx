import { CheckCircle2, Hourglass } from "lucide-react";

import type { DriverTripExtension } from "@/lib/utils/driverTrips";

/**
 * The two notes that sit under a trip's times:
 * - Overtime (amber): the ride is still going past its booked end.
 * - Paid extension (green): the client paid for more time, with the new end.
 * Each is one tinted row with a symbol, so it reads at a glance in a list.
 */
export const TripTimeNotes = ({
  extension,
  overtimeNote,
  className = "",
}: {
  extension?: DriverTripExtension;
  overtimeNote?: string;
  className?: string;
}) => {
  if (!extension && !overtimeNote) return null;

  return (
    <div className={`space-y-1.5 ${className}`}>
      {overtimeNote ? (
        <p
          className="flex items-center gap-2 rounded-[10px] bg-warning-soft px-2.5 py-1.5 text-[13px] font-medium text-warning-text"
          aria-label={`Overtime. ${overtimeNote}`}
        >
          <Hourglass size={14} className="shrink-0" />
          <span className="min-w-0 flex-1">{overtimeNote}</span>
        </p>
      ) : null}
      {extension ? (
        <p
          className="flex items-center gap-2 rounded-[10px] bg-success-soft px-2.5 py-1.5 text-[13px] text-success-text"
          aria-label={`Extension paid by the client: ${extension.addedLabel.replace("+", "")} added${
            extension.extendedEndLabel ? `, the ride now ends at ${extension.extendedEndLabel}` : ""
          }.`}
        >
          <CheckCircle2 size={14} className="shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="font-semibold">{extension.addedLabel} extension · Paid</span>
            {extension.extendedEndLabel ? ` · now ends ${extension.extendedEndLabel}` : ""}
          </span>
        </p>
      ) : null}
    </div>
  );
};
