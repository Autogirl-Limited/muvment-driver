"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export interface StatusOption<T extends string> {
  label: string;
  value: T;
  /** Undefined while the count is still loading. */
  count?: number;
}

type Frame = { left: number; width: number };

/**
 * A scrolling scope bar: status chips sit on the page and a single pill
 * slides between them (like the selection in an iOS segmented control),
 * resizing to fit each label. The chosen chip scrolls toward the middle so
 * its neighbours stay visible.
 */
export function TripStatusScroller<T extends string>({
  options,
  value,
  onChange,
}: {
  options: StatusOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef(new Map<T, HTMLButtonElement>());
  const placed = useRef(false);
  const [frame, setFrame] = useState<Frame | null>(null);
  const [animate, setAnimate] = useState(false);

  const measure = useCallback(() => {
    const chip = chipRefs.current.get(value);
    const track = trackRef.current;
    const scroller = scrollRef.current;

    if (!chip || !track || !scroller) return;

    const next = { left: chip.offsetLeft, width: chip.offsetWidth };
    setFrame((current) =>
      current && current.left === next.left && current.width === next.width ? current : next,
    );

    scroller.scrollTo({
      behavior: placed.current ? "smooth" : "auto",
      left: Math.max(0, next.left + next.width / 2 - scroller.clientWidth / 2),
    });
  }, [value]);

  // Chip widths change as counts arrive, so re-measure when the labels change.
  const signature = options.map((option) => `${option.label}:${option.count ?? ""}`).join("|");

  useLayoutEffect(() => {
    measure();
  }, [measure, signature]);

  useEffect(() => {
    if (!frame || placed.current) return;
    // First placement happens without sliding in from zero.
    const id = requestAnimationFrame(() => {
      placed.current = true;
      setAnimate(true);
    });
    return () => cancelAnimationFrame(id);
  }, [frame]);

  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  return (
    <div ref={scrollRef} className="scrollbar-none overflow-x-auto px-5 pb-3" role="tablist" aria-label="Trip status">
      <div ref={trackRef} className="relative flex w-max gap-1.5">
        <span
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 h-9 rounded-full bg-navy-mid shadow-float dark:bg-accent"
          style={{
            opacity: frame ? 1 : 0,
            transform: `translateX(${frame?.left ?? 0}px)`,
            transition: animate
              ? "transform var(--dur) var(--ease-spring), width var(--dur) var(--ease-spring), opacity var(--dur-fast)"
              : "none",
            width: frame?.width ?? 0,
          }}
        />
        {options.map((option) => {
          const selected = option.value === value;

          return (
            <button
              key={option.value}
              ref={(node) => {
                if (node) chipRefs.current.set(option.value, node);
                else chipRefs.current.delete(option.value);
              }}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(option.value)}
              className={`pressable relative z-10 flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-[14px] font-medium transition-colors ${
                selected ? "text-white" : "bg-fill text-text-2"
              }`}
            >
              {option.label}
              {option.count !== undefined && (
                <span className={`text-[12px] tabular-nums ${selected ? "text-white/80" : "text-text-4"}`}>
                  {option.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
