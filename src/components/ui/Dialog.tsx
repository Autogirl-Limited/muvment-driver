"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const useLockBodyScroll = (locked: boolean) => {
  useEffect(() => {
    if (!locked) {
      return;
    }

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previous;
    };
  }, [locked]);
};

const usePortalTarget = () => {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setTarget(document.body);
  }, []);

  return target;
};

/* ------------------------------------------------------------------ AlertDialog
   Centered iOS-style alert for confirmations. Scrim dims the page and the
   card scales in from its centre.
--------------------------------------------------------------------------- */
interface AlertDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  cancelText?: string;
  confirmText?: string;
  confirmVariant?: "primary" | "danger";
  confirmLoading?: boolean;
}

export const AlertDialog = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  cancelText = "Cancel",
  confirmText = "Submit",
  confirmVariant = "primary",
  confirmLoading = false,
}: AlertDialogProps) => {
  const target = usePortalTarget();
  useLockBodyScroll(open);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, open]);

  if (!open || !target) {
    return null;
  }

  return createPortal(
    <div
      className="anim-fade-in fixed inset-0 z-[80] flex items-center justify-center bg-scrim px-7"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="alert-title"
        className="anim-scale-in w-full max-w-sm rounded-[22px] bg-bg-elevated p-6 shadow-float"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="alert-title" className="text-title-2 text-text">
          {title}
        </h2>
        <p className="text-callout mt-2 text-text-2">{message}</p>
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="pressable h-11 min-w-[92px] rounded-xl border border-border-strong px-5 text-[15px] font-medium text-text-2"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmLoading}
            className={`pressable h-11 min-w-[92px] rounded-xl px-5 text-[15px] font-semibold text-white ${
              confirmVariant === "danger" ? "bg-danger" : "bg-accent"
            } ${confirmLoading ? "opacity-60" : ""}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    target,
  );
};

/* ------------------------------------------------------------------ Sheet
   Bottom sheet with a scrim. Drag-to-dismiss tracks the finger 1:1, rubber-
   bands when pulled above its resting point, and on release projects the
   finger's velocity to decide between dismissing and springing back.
--------------------------------------------------------------------------- */
interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  ariaLabel?: string;
}

const project = (velocity: number, deceleration = 0.998) =>
  (velocity / 1000) * deceleration / (1 - deceleration);

export const Sheet = ({ open, onClose, children, title, ariaLabel }: SheetProps) => {
  const target = usePortalTarget();
  const sheetRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startY: number; lastY: number; lastT: number; velocity: number } | null>(null);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  useLockBodyScroll(open);

  useEffect(() => {
    if (open) {
      setOffset(0);
    }
  }, [open]);

  if (!open || !target) {
    return null;
  }

  const onPointerDown = (event: React.PointerEvent) => {
    drag.current = { startY: event.clientY, lastY: event.clientY, lastT: performance.now(), velocity: 0 };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!drag.current) {
      return;
    }
    const now = performance.now();
    const dt = Math.max(1, now - drag.current.lastT);
    drag.current.velocity = ((event.clientY - drag.current.lastY) / dt) * 1000;
    drag.current.lastY = event.clientY;
    drag.current.lastT = now;
    const delta = event.clientY - drag.current.startY;
    setOffset(delta >= 0 ? delta : (delta * 60) / (60 - delta));
  };

  const onPointerUp = () => {
    if (!drag.current) {
      return;
    }
    const { velocity } = drag.current;
    const height = sheetRef.current?.offsetHeight ?? 300;
    const projected = offset + project(velocity);
    drag.current = null;
    setDragging(false);

    if (projected > height * 0.45 || velocity > 900) {
      setOffset(height + 40);
      setTimeout(onClose, 220);
      return;
    }

    setOffset(0);
  };

  return createPortal(
    <div className="anim-fade-in fixed inset-0 z-[80] flex items-end justify-center bg-scrim" onClick={onClose} role="presentation">
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? title}
        className="anim-slide-up w-full max-w-lg rounded-t-[28px] bg-bg-elevated px-6 pt-2 shadow-sheet"
        style={{
          paddingBottom: "calc(var(--safe-bottom) + 24px)",
          transform: `translateY(${offset}px)`,
          transition: dragging ? "none" : "transform var(--dur) var(--ease-spring)",
          touchAction: "none",
        }}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="mx-auto mb-4 mt-1 h-1.5 w-11 rounded-full bg-border-strong" />
        {title && <h2 className="text-headline mb-5 text-center text-text">{title}</h2>}
        {children}
      </div>
    </div>,
    target,
  );
};

/* ------------------------------------------------------------------ Popover menu */
interface MenuProps {
  open: boolean;
  onClose: () => void;
  options: string[];
  onSelect: (option: string) => void;
  /** Options rendered with a separator before them (e.g. date filters). */
  separatorBefore?: string[];
}

export const PopoverMenu = ({ open, onClose, options, onSelect, separatorBefore = [] }: MenuProps) => {
  const target = usePortalTarget();

  if (!open || !target) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[80]" onClick={onClose} role="presentation">
      <div
        role="menu"
        className="glass anim-scale-in absolute right-4 w-56 origin-top-right overflow-hidden rounded-2xl shadow-float"
        style={{ top: "calc(var(--safe-top) + 128px)" }}
        onClick={(event) => event.stopPropagation()}
      >
        {options.map((option) => (
          <button
            key={option}
            type="button"
            role="menuitem"
            onClick={() => onSelect(option)}
            className={`pressable-row block w-full px-4 py-3 text-left text-[15px] text-text hairline-b ${
              separatorBefore.includes(option) ? "border-t-[6px] border-fill" : ""
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>,
    target,
  );
};
