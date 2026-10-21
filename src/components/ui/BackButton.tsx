"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";

interface BackButtonProps {
  label?: string;
  href?: string;
  onClick?: () => void;
  tone?: "default" | "inverse";
  className?: string;
}

export const BackButton = ({ label = "Back", href, onClick, tone = "default", className = "" }: BackButtonProps) => {
  const router = useRouter();

  const handleClick = () => {
    if (onClick) {
      onClick();
      return;
    }

    if (href) {
      router.replace(href);
      return;
    }

    if (window.history.length > 1) {
      router.back();
    } else {
      router.replace("/home");
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`pressable-soft -ml-2 inline-flex h-10 items-center pr-3 pl-1 text-[16px] ${
        tone === "inverse" ? "text-white" : "text-accent"
      } ${className}`}
      aria-label={label}
    >
      <ChevronLeft size={26} strokeWidth={2.2} className="-mr-0.5" />
      <span>{label}</span>
    </button>
  );
};
