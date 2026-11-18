"use client";

import Link from "next/link";

import { MUVMENT_BLUE, MuvmentGlyph } from "./MuvmentLogo";

const RING = 2.5;
const GAP = 2;

/**
 * The account button at the top right of the main screens: the Muvment logo in
 * brand blue, ringed in a rainbow. Opens the profile.
 * `gapColor` is the thin ring between the rainbow and the logo: the colour
 * behind the header, so the rainbow looks like it floats.
 */
export const BrandAvatar = ({
  href = "/profile",
  size = 40,
  gapColor = "var(--bg)",
}: {
  href?: string;
  size?: number;
  gapColor?: string;
}) => {
  const inner = size - (RING + GAP) * 2;

  return (
    <Link href={href} aria-label="Profile" className="pressable inline-flex" title="Opens your profile">
      <span
        className="flex items-center justify-center rounded-full"
        style={{
          width: size,
          height: size,
          // A true angular rainbow, starting a little before the top like the mobile app.
          background: "conic-gradient(from 330deg, hsl(330 92% 56%), hsl(30 92% 56%), hsl(90 92% 56%), hsl(150 92% 56%), hsl(210 92% 56%), hsl(270 92% 56%), hsl(330 92% 56%))",
        }}
      >
        <span className="flex items-center justify-center rounded-full" style={{ width: size - RING * 2, height: size - RING * 2, backgroundColor: gapColor }}>
          <span className="flex items-center justify-center rounded-full" style={{ width: inner, height: inner, backgroundColor: MUVMENT_BLUE }}>
            <MuvmentGlyph size={inner * 0.66} />
          </span>
        </span>
      </span>
    </Link>
  );
};
