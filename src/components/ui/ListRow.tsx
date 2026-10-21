"use client";

import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

interface ListRowProps {
  icon?: ReactNode;
  iconTone?: "neutral" | "accent" | "danger" | "success" | "warning";
  title: string;
  description?: string;
  trailing?: ReactNode;
  chevron?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  inset?: boolean;
  titleTone?: "default" | "danger";
}

const ICON_TONES = {
  neutral: "bg-surface-alt text-text-2",
  accent: "bg-accent-soft text-accent",
  danger: "bg-danger-soft text-danger",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
} as const;

/** iOS inset-grouped list row: icon tile, title/subtitle, trailing control. */
export const ListRow = ({
  icon,
  iconTone = "neutral",
  title,
  description,
  trailing,
  chevron = true,
  onClick,
  disabled = false,
  inset = false,
  titleTone = "default",
}: ListRowProps) => {
  const content = (
    <>
      {icon && (
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${ICON_TONES[iconTone]}`}>
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className={`text-body block font-medium ${titleTone === "danger" ? "text-danger" : "text-text"}`}>
          {title}
        </span>
        {description && <span className="text-footnote mt-0.5 block text-text-3">{description}</span>}
      </span>
      {trailing}
      {chevron && onClick && <ChevronRight size={18} className="shrink-0 text-text-4" />}
    </>
  );

  const className = `flex w-full items-center gap-3 py-3 pr-4 text-left ${inset ? "pl-14" : "pl-4"} ${
    disabled ? "opacity-50" : ""
  }`;

  if (onClick) {
    return (
      <button type="button" disabled={disabled} onClick={onClick} className={`pressable-row ${className}`}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
};

export const ListGroup = ({
  children,
  className = "",
  header,
  footer,
}: {
  children: ReactNode;
  className?: string;
  header?: string;
  footer?: string;
}) => (
  <section className={className}>
    {header && <p className="text-eyebrow mb-2 ml-4 text-text-3">{header}</p>}
    <div className="inset-group [&>*+*]:border-t [&>*+*]:border-separator">{children}</div>
    {footer && <p className="text-footnote mt-2 ml-4 text-text-4">{footer}</p>}
  </section>
);
