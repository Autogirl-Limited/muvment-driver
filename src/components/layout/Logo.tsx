"use client";

import Image from "next/image";

import { useTheme } from "@/providers/ThemeProvider";

/** Wordmark that swaps between the black and white variants with the theme. */
export const Wordmark = ({ className = "" }: { className?: string }) => {
  const { isDark } = useTheme();

  return (
    <Image
      src={isDark ? "/brand/package.png" : "/brand/Logo-Black.png"}
      alt="Muvment"
      width={192}
      height={26}
      priority
      className={`h-7 w-auto ${className}`}
    />
  );
};
