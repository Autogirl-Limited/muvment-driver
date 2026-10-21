"use client";

import Link from "next/link";

interface AvatarProps {
  initials: string;
  size?: number;
  href?: string;
  inverse?: boolean;
}

export const Avatar = ({ initials, size = 40, href, inverse = false }: AvatarProps) => {
  const content = (
    <span
      className={`flex items-center justify-center rounded-full bg-surface-soft font-bold text-navy-mid dark:text-text ${
        inverse ? "border-2 border-white" : "border border-border"
      }`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }}
    >
      {initials}
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="pressable inline-flex" aria-label="Open profile">
        {content}
      </Link>
    );
  }

  return content;
};
