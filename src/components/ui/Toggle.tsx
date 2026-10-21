"use client";

interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label?: string;
}

/** iOS switch: 51x31 track, spring-eased knob, green when on. */
export const Toggle = ({ checked, onChange, disabled = false, label }: ToggleProps) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 ${
      checked ? "bg-success" : "bg-fill-strong"
    } ${disabled ? "opacity-50" : ""}`}
  >
    <span
      className="absolute top-[2px] left-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15),0_1px_1px_rgba(0,0,0,0.16)]"
      style={{
        transform: checked ? "translateX(20px)" : "translateX(0)",
        transition: "transform var(--dur) var(--ease-spring)",
      }}
    />
  </button>
);
