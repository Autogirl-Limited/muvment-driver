"use client";

import { forwardRef, useId, useMemo, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

import { Sheet } from "@/components/ui/Dialog";
import { COUNTRIES, COUNTRY_BY_ISO } from "@/lib/data/countries";
import { changePhoneCountry, examplePhone, interpretPhoneInput, type PhoneValue } from "@/lib/utils/phone";

/** A flag from the two-letter region code, e.g. NG becomes the Nigerian flag. */
const flagOf = (iso: string) =>
  iso
    .toUpperCase()
    .split("")
    .map((letter) => String.fromCodePoint(0x1f1e6 + letter.charCodeAt(0) - 65))
    .join("");

interface PhoneNumberFieldProps {
  label: string;
  value: PhoneValue;
  onChange: (value: PhoneValue) => void;
  errorMessage?: string;
  /** Shown instead of the country's example number. */
  hint?: string;
  action?: { label: string; onClick: () => void };
}

/**
 * A phone field with a country picker. The number is shown the way that
 * country writes it, and pasting an international number (+234…) switches the
 * country to match. What it holds converts to E.164 with `toE164`.
 */
export const PhoneNumberField = forwardRef<HTMLInputElement, PhoneNumberFieldProps>(
  ({ label, value, onChange, errorMessage, hint, action }, ref) => {
    const id = useId();
    const [pickerOpen, setPickerOpen] = useState(false);
    const [search, setSearch] = useState("");
    const country = COUNTRY_BY_ISO.get(value.country);
    const sample = useMemo(() => examplePhone(value.country), [value.country]);
    const matches = useMemo(() => {
      const query = search.trim().toLowerCase().replace(/^\+/, "");

      return query
        ? COUNTRIES.filter((entry) => entry.name.toLowerCase().includes(query) || entry.dialCode.startsWith(query) || entry.iso.toLowerCase() === query)
        : COUNTRIES;
    }, [search]);

    return (
      <div className={errorMessage ? "mb-3" : "mb-5"}>
        <div className="mb-2 flex items-center justify-between">
          <label htmlFor={id} className="text-callout font-medium text-text">
            {label}
          </label>
          {action && (
            <button type="button" onClick={action.onClick} className="pressable-soft text-[14px] font-medium text-accent-text">
              {action.label}
            </button>
          )}
        </div>
        <div
          className={`flex h-12 items-center rounded-xl border bg-surface transition-[border-color,box-shadow] duration-200 focus-within:border-accent focus-within:shadow-[0_0_0_3px_rgba(6,115,255,0.15)] ${
            errorMessage ? "border-danger" : "border-border-strong"
          }`}
        >
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            aria-label={`Country: ${country?.name ?? value.country}, +${country?.dialCode ?? ""}. Change`}
            className="pressable-soft flex h-full shrink-0 items-center gap-1.5 border-r border-border pl-3.5 pr-2.5"
          >
            <span className="text-[20px] leading-none">{flagOf(value.country)}</span>
            <span className="text-[15px] tabular-nums text-text-2">+{country?.dialCode}</span>
            <ChevronDown size={14} className="text-text-4" />
          </button>
          <input
            ref={ref}
            id={id}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={value.text}
            placeholder={sample}
            aria-invalid={Boolean(errorMessage) || undefined}
            onChange={(event) => onChange(interpretPhoneInput(event.target.value, value))}
            className="h-full min-w-0 flex-1 bg-transparent px-3 text-[16px] tabular-nums text-text outline-none placeholder:text-text-4"
          />
        </div>
        {errorMessage ? (
          <p className="text-footnote ml-1 mt-1.5 text-danger">{errorMessage}</p>
        ) : (
          <p className="text-footnote ml-1 mt-1.5 text-text-3">{hint ?? (sample ? `For example ${sample}` : "")}</p>
        )}

        <Sheet
          open={pickerOpen}
          onClose={() => {
            setPickerOpen(false);
            setSearch("");
          }}
          title="Choose a country"
        >
          <div className="mb-3 flex h-11 items-center gap-2 rounded-xl bg-fill px-3">
            <Search size={16} className="text-text-4" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search country or code"
              aria-label="Search countries"
              className="h-full min-w-0 flex-1 bg-transparent text-[16px] text-text outline-none placeholder:text-text-4"
            />
          </div>
          <div className="card max-h-[52dvh] overflow-y-auto p-0">
            {matches.length === 0 ? (
              <p className="text-callout px-4 py-4 text-text-3">No country matches &ldquo;{search}&rdquo;.</p>
            ) : (
              matches.map((entry) => (
                <button
                  key={entry.iso}
                  type="button"
                  onClick={() => {
                    onChange(changePhoneCountry(value, entry.iso));
                    setPickerOpen(false);
                    setSearch("");
                  }}
                  className="pressable-row flex w-full items-center gap-3 border-b border-separator px-4 py-3 text-left last:border-b-0"
                >
                  <span className="text-[22px] leading-none">{flagOf(entry.iso)}</span>
                  <span className="text-body min-w-0 flex-1 truncate text-text">{entry.name}</span>
                  <span className="text-[15px] tabular-nums text-text-3">+{entry.dialCode}</span>
                  {entry.iso === value.country && <Check size={16} className="text-accent" />}
                </button>
              ))
            )}
          </div>
        </Sheet>
      </div>
    );
  },
);

PhoneNumberField.displayName = "PhoneNumberField";
