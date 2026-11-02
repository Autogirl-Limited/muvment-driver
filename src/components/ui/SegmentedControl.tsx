"use client";

interface SegmentedControlProps<T extends string> {
  options: Array<{ label: string; value: T }>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}

/** iOS segmented control with a sliding thumb (same look as the Appearance picker). */
export const SegmentedControl = <T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className = "",
}: SegmentedControlProps<T>) => {
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const count = options.length;

  return (
    <div
      className={`relative grid rounded-xl bg-fill p-1 ${className}`}
      style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
      role="tablist"
      aria-label={ariaLabel}
    >
      <span
        aria-hidden="true"
        className="absolute top-1 bottom-1 rounded-[9px] bg-bg-elevated shadow-float"
        style={{
          left: 4,
          width: `calc((100% - 8px) / ${count})`,
          transform: `translateX(calc(${activeIndex} * 100%))`,
          transition: "transform var(--dur) var(--ease-spring)",
        }}
      />
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.value)}
            className={`relative z-10 flex h-9 items-center justify-center px-2 text-[13px] font-semibold transition-colors ${
              selected ? "text-text" : "text-text-3"
            }`}
          >
            <span className="truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
};
