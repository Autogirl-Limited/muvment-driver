const BLUE = "#1D9BF0";
const BUMPS = 8;

/** A scalloped seal: a circle with soft bumps round its edge, as on verified badges. */
const sealPath = (size: number) => {
  const c = size / 2;
  const radius = size * 0.46;
  const depth = 0.075;
  const steps = 96;
  const points = Array.from({ length: steps }, (_, index) => {
    const angle = (index / steps) * Math.PI * 2;
    const r = radius * (1 - depth + depth * Math.cos(BUMPS * angle));

    return `${(c + r * Math.cos(angle)).toFixed(2)} ${(c + r * Math.sin(angle)).toFixed(2)}`;
  });

  return `M ${points.join(" L ")} Z`;
};

/** The verified tick, as on Twitter/X and Instagram: a blue scalloped seal with a white check. */
export const VerifiedTick = ({ size = 22, color = BLUE }: { size?: number; color?: string }) => {
  const s = size / 24;

  return (
    <svg width={size} height={size} role="img" aria-label="Verified">
      <path d={sealPath(size)} fill={color} />
      <path
        d={`M ${7.4 * s} ${12.4 * s} L ${10.6 * s} ${15.4 * s} L ${16.6 * s} ${9 * s}`}
        stroke="#FFFFFF"
        strokeWidth={2.3 * s}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
};
