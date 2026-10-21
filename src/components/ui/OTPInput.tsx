"use client";

import { useRef } from "react";

interface OTPInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
}

/**
 * One hidden input drives the boxes, so the keyboard's one-time-code
 * autofill (iOS Messages / Android SMS) works and the cursor never jumps.
 */
export const OTPInput = ({ length = 6, value, onChange }: OTPInputProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const digits = value.slice(0, length).split("");
  const activeIndex = Math.min(value.length, length - 1);

  return (
    <div className="relative my-5" onClick={() => inputRef.current?.focus()}>
      <div className="flex justify-between gap-2">
        {Array.from({ length }, (_, index) => {
          const digit = digits[index] ?? "";
          const isActive = index === activeIndex && value.length < length;

          return (
            <div
              key={index}
              className={`flex h-14 flex-1 items-center justify-center rounded-xl border bg-surface text-[22px] font-semibold text-text transition-[border-color,box-shadow,transform] duration-200 ${
                isActive
                  ? "border-accent shadow-[0_0_0_3px_rgba(6,115,255,0.15)]"
                  : digit
                    ? "border-border-strong"
                    : "border-border"
              }`}
            >
              {digit}
              {isActive && !digit && (
                <span className="h-6 w-0.5 animate-pulse rounded bg-accent" />
              )}
            </div>
          );
        })}
      </div>
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, length))}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={length}
        aria-label="Verification code"
        className="absolute inset-0 h-full w-full opacity-0"
        style={{ caretColor: "transparent" }}
      />
    </div>
  );
};
