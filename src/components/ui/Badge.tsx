import { getDriverTripBadgeStyle, type DriverTripBadgeType } from "@/lib/utils/driverTrips";

interface BadgeProps {
  label: string;
  type?: DriverTripBadgeType;
  size?: "sm" | "md";
}

/** Status / booking / owner pill. Colors come from the shared trip badge map. */
export const TripBadge = ({ label, type, size = "sm" }: BadgeProps) => {
  const style = getDriverTripBadgeStyle(label, type);

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold uppercase tracking-[0.06em] ${style.bg} ${style.text} ${
        size === "sm" ? "px-2.5 py-1 text-[10px]" : "px-3 py-1.5 text-[11px]"
      }`}
    >
      {label}
    </span>
  );
};

export const Pill = ({
  children,
  tone = "neutral",
  className = "",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "accent";
  className?: string;
}) => {
  const tones = {
    neutral: "bg-surface-alt text-text-2",
    success: "bg-success-soft text-success-text",
    warning: "bg-warning-soft text-warning-text",
    danger: "bg-danger-soft text-danger-text",
    accent: "bg-accent-soft text-accent-text",
  } as const;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
};
