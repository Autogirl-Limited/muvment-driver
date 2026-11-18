"use client";

import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";

export interface FilterMenuItem<V> {
  label: string;
  value: V;
  selected?: boolean;
  /** Secondary text shown under the label, e.g. the chosen date. */
  detail?: string;
}

export interface FilterMenuSection<V> {
  title: string;
  items: FilterMenuItem<V>[];
}

/**
 * A sectioned pull-down menu (iOS style): small section titles, a check beside
 * what's chosen. Opens under the header's filter button.
 */
export function FilterMenu<V>({
  open,
  onClose,
  sections,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  sections: FilterMenuSection<V>[];
  onSelect: (value: V) => void;
}) {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setTarget(document.body);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !target) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80]" onClick={onClose} role="presentation">
      <div
        role="menu"
        className="glass anim-scale-in absolute right-4 max-h-[70vh] w-64 origin-top-right overflow-y-auto rounded-2xl shadow-float"
        style={{ top: "calc(var(--safe-top) + 128px)" }}
        onClick={(event) => event.stopPropagation()}
      >
        {sections.map((section, index) => (
          <div key={section.title} className={index > 0 ? "border-t-[6px] border-fill" : ""}>
            <p className="px-4 pb-1 pt-3 text-[12px] font-semibold uppercase tracking-wide text-text-4">
              {section.title}
            </p>
            {section.items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitemradio"
                aria-checked={Boolean(item.selected)}
                onClick={() => onSelect(item.value)}
                className="pressable-row flex w-full items-center gap-3 px-4 py-2.5 text-left text-[15px] text-text"
              >
                <span className="flex-1">
                  {item.label}
                  {item.detail && <span className="block text-[12px] text-text-3">{item.detail}</span>}
                </span>
                {item.selected && <Check size={16} className="text-accent" />}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>,
    target,
  );
}
