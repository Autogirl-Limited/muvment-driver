"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";

export type ToastType = "success" | "error" | "info";

export interface ToastOptions {
  type?: ToastType;
  title: string;
  message?: string;
  durationMs?: number;
}

interface ToastItem extends Required<Omit<ToastOptions, "message">> {
  id: number;
  message?: string;
  leaving: boolean;
}

interface ToastContextValue {
  show: (options: ToastOptions) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let toastSequence = 0;

const ICONS: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

const ACCENT: Record<ToastType, string> = {
  success: "var(--success)",
  error: "var(--danger)",
  info: "var(--accent)",
};

/**
 * iOS-style notification banner: drops in from the top with a spring,
 * dismisses on tap, on swipe-up, or after a timeout. Only the newest two are
 * shown so a burst of errors never stacks into a wall.
 */
const ToastBanner = ({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) => {
  const Icon = ICONS[toast.type];
  const startY = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);

  return (
    <div
      role="status"
      aria-live="polite"
      onPointerDown={(event) => {
        startY.current = event.clientY;
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (startY.current === null) {
          return;
        }
        // Track 1:1 upward, rubber-band downward.
        const delta = event.clientY - startY.current;
        setDragY(delta < 0 ? delta : (delta * 40) / (40 + delta));
      }}
      onPointerUp={(event) => {
        if (startY.current === null) {
          return;
        }
        const delta = event.clientY - startY.current;
        startY.current = null;
        if (delta < -24) {
          onDismiss(toast.id);
          return;
        }
        if (Math.abs(delta) < 6) {
          onDismiss(toast.id);
          return;
        }
        setDragY(0);
      }}
      className={`glass pointer-events-auto flex w-full items-start gap-3 rounded-[18px] px-4 py-3 shadow-float ${
        toast.leaving ? "" : "anim-slide-down-in"
      }`}
      style={{
        transform: toast.leaving ? "translateY(-120%)" : `translateY(${dragY}px)`,
        opacity: toast.leaving ? 0 : 1,
        transition:
          startY.current === null
            ? "transform var(--dur) var(--ease-spring), opacity var(--dur-fast) ease"
            : "none",
        touchAction: "none",
      }}
    >
      <span
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
        style={{ background: ACCENT[toast.type], color: "#fff" }}
      >
        <Icon size={16} strokeWidth={2.5} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-headline text-text">{toast.title}</p>
        {toast.message && <p className="text-footnote mt-0.5 text-text-2">{toast.message}</p>}
      </div>
    </div>
  );
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);

    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }

    setToasts((current) => current.map((toast) => (toast.id === id ? { ...toast, leaving: true } : toast)));
    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 320);
  }, []);

  const show = useCallback(
    ({ type = "info", title, message, durationMs }: ToastOptions) => {
      const id = ++toastSequence;
      const duration = durationMs ?? (type === "error" ? 5000 : 3200);

      setToasts((current) => [...current.slice(-1), { id, type, title, message, durationMs: duration, leaving: false }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), duration),
      );

      if (type === "error" && typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate?.(12);
      }
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;

    return () => {
      map.forEach((timer) => clearTimeout(timer));
      map.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      show,
      success: (title, message) => show({ type: "success", title, message }),
      error: (title, message) => show({ type: "error", title, message }),
      info: (title, message) => show({ type: "info", title, message }),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col gap-2 px-3"
        style={{ paddingTop: "calc(var(--safe-top) + 10px)" }}
      >
        {toasts.map((toast) => (
          <ToastBanner key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within ToastProvider.");
  }

  return context;
};
