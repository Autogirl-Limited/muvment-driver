"use client";

import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label: string;
  isPassword?: boolean;
  hasError?: boolean;
  errorMessage?: string;
  hint?: string;
  leading?: ReactNode;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, isPassword, hasError, errorMessage, hint, leading, className = "", id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const [isSecure, setIsSecure] = useState(Boolean(isPassword));
    const showError = hasError || Boolean(errorMessage);

    return (
      <div className={`${errorMessage ? "mb-3" : "mb-5"} ${className}`}>
        <label htmlFor={inputId} className="text-callout mb-2 block font-medium text-text">
          {label}
        </label>
        <div
          className={`flex h-12 items-center rounded-xl border bg-surface px-4 transition-[border-color,box-shadow] duration-200 focus-within:border-accent focus-within:shadow-[0_0_0_3px_rgba(6,115,255,0.15)] ${
            showError ? "border-danger" : "border-border-strong"
          }`}
        >
          {leading && <span className="mr-2 text-text-3">{leading}</span>}
          <input
            ref={ref}
            id={inputId}
            type={isPassword ? (isSecure ? "password" : "text") : props.type ?? "text"}
            aria-invalid={showError || undefined}
            className="h-full min-w-0 flex-1 bg-transparent text-[16px] text-text outline-none placeholder:text-text-4"
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setIsSecure((value) => !value)}
              className="pressable-soft -mr-1 ml-2 p-1 text-text-2"
              aria-label={isSecure ? "Show password" : "Hide password"}
            >
              {isSecure ? <Eye size={20} /> : <EyeOff size={20} />}
            </button>
          )}
        </div>
        {errorMessage ? (
          <p className="text-footnote mt-1.5 ml-1 text-danger">{errorMessage}</p>
        ) : hint ? (
          <p className="text-footnote mt-1.5 ml-1 text-text-3">{hint}</p>
        ) : null}
      </div>
    );
  },
);

TextField.displayName = "TextField";
