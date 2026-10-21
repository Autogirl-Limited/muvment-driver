"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

import { Spinner } from "./Spinner";

type ButtonVariant = "primary" | "secondary" | "outline" | "danger" | "ghost" | "navy";
type ButtonSize = "lg" | "md" | "sm";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white shadow-[0_6px_16px_-6px_rgba(6,115,255,0.55)]",
  navy: "bg-navy text-white",
  secondary: "bg-accent-soft text-accent-text",
  outline: "bg-surface text-text border border-border-strong",
  danger: "bg-danger text-white",
  ghost: "bg-transparent text-accent",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  lg: "h-[52px] px-6 rounded-[14px] text-[16px] font-semibold",
  md: "h-11 px-5 rounded-xl text-[15px] font-semibold",
  sm: "h-9 px-4 rounded-[10px] text-[14px] font-medium",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "lg",
      loading = false,
      fullWidth = true,
      icon,
      className = "",
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        type="button"
        disabled={isDisabled}
        aria-busy={loading || undefined}
        className={`pressable inline-flex items-center justify-center gap-2 tracking-[-0.01em] ${
          fullWidth ? "w-full" : ""
        } ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${
          isDisabled ? "opacity-45 shadow-none" : ""
        } ${className}`}
        {...props}
      >
        {loading ? <Spinner size={18} className="text-current" /> : icon}
        <span>{children}</span>
      </button>
    );
  },
);

Button.displayName = "Button";
