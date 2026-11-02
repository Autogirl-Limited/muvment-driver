"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock, CloudOff, Pause, Play, Square, Timer } from "lucide-react";

import { Pill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AlertDialog, Sheet } from "@/components/ui/Dialog";
import type { DriverTripStatus, RidePauseReason, RideTimer } from "@/lib/api/types";
import { PAUSE_REASON_LABELS, PAUSE_REASONS } from "@/lib/payments/labels";
import {
  AUTO_START_COUNTDOWN_SECONDS,
  computeRideClock,
  isPreRideStatus,
  isRidingStatus,
  type RideClock,
} from "@/lib/rideTimer/rideClock";
import { formatClock, formatLagosTime, formatMinutes } from "@/lib/utils/lagosTime";

export const END_RIDE_TITLE = "End the ride?";
export const END_RIDE_MESSAGE = "End the ride only when the customer has left the car for the last time.";
export const EXTRA_HOURS_NOTE = "Customer support will confirm any extra hours.";

/* ------------------------------------------------------------------ counter */
const getCounterView = (clock: RideClock) => {
  switch (clock.phase) {
    case "EXTRA_TIME":
      return { eyebrow: "Extra time", value: `+${formatClock(clock.extraSeconds)}`, tone: "extra" as const };
    case "PAUSED":
      return {
        eyebrow: "Paused",
        value: clock.pastBookedEnd ? `+${formatClock(clock.extraSeconds)}` : formatClock(clock.secondsLeft),
        tone: "paused" as const,
      };
    default:
      return { eyebrow: "Time left", value: formatClock(clock.secondsLeft), tone: "running" as const };
  }
};

const COUNTER_TONES = {
  running: { card: "bg-surface border-border", eyebrow: "text-success-text", value: "text-text" },
  extra: { card: "bg-warning-soft border-warning/40", eyebrow: "text-warning-text", value: "text-warning-text" },
  paused: { card: "bg-surface-alt border-border", eyebrow: "text-text-2", value: "text-text-3" },
} as const;

export const RideCounter = ({
  clock,
  timer,
  compact = false,
}: {
  clock: RideClock;
  timer?: RideTimer | null;
  compact?: boolean;
}) => {
  const view = getCounterView(clock);
  const tone = COUNTER_TONES[view.tone];
  const bookedEnd = formatLagosTime(timer?.bookedEndAt);
  const extended = Boolean(timer?.originalEndAt && timer.bookedEndAt && timer.originalEndAt !== timer.bookedEndAt);
  const pauseReason = timer?.currentPause?.reason ? PAUSE_REASON_LABELS[timer.currentPause.reason] : undefined;
  const subline =
    view.tone === "paused"
      ? [pauseReason, clock.pastBookedEnd ? "extra time" : "time left", "booked time keeps running"].filter(Boolean).join(" · ")
      : view.tone === "extra"
        ? `Booked end ${bookedEnd ?? "—"} has passed`
        : bookedEnd
          ? `${extended ? "Extended to" : "Ends at"} ${bookedEnd}`
          : undefined;

  return (
    <div
      className={`rounded-[20px] border ${tone.card} ${compact ? "px-4 py-3" : "px-5 py-4"}`}
      role="timer"
      aria-live="off"
      aria-label={`${view.eyebrow} ${view.value}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className={`text-eyebrow flex items-center gap-1.5 ${tone.eyebrow}`}>
          {view.tone === "paused" ? <Pause size={12} /> : view.tone === "extra" ? <Timer size={12} /> : <Clock size={12} />}
          {view.eyebrow}
        </p>
        {timer?.startMethod === "AUTO" && <Pill tone="neutral">Auto-started</Pill>}
      </div>
      <p
        className={`mt-1 font-bold tracking-[-0.02em] tabular-nums ${tone.value} ${
          compact ? "text-[28px] leading-[34px]" : "text-[44px] leading-[52px]"
        }`}
      >
        {view.value}
      </p>
      {subline && <p className="text-footnote mt-0.5 text-text-3">{subline}</p>}
    </div>
  );
};

/* ------------------------------------------------------------------ pause sheet */
export const PauseReasonSheet = ({
  open,
  onClose,
  onConfirm,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: RidePauseReason, note?: string) => void;
  loading?: boolean;
}) => {
  const [reason, setReason] = useState<RidePauseReason | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      setReason(null);
      setNote("");
    }
  }, [open]);

  return (
    <Sheet open={open} onClose={onClose} title="Why are you pausing?">
      <p className="text-footnote -mt-1 mb-3 text-center text-text-3">
        Pauses are recorded for customer support. The booked time keeps running.
      </p>
      <div className="inset-group [&>*+*]:border-t [&>*+*]:border-separator" role="radiogroup" aria-label="Pause reason">
        {PAUSE_REASONS.map((value) => {
          const selected = reason === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setReason(value)}
              className="pressable-row flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <span className="text-body text-text">{PAUSE_REASON_LABELS[value]}</span>
              {selected ? (
                <CheckCircle2 size={20} className="text-accent" />
              ) : (
                <span className="h-5 w-5 rounded-full border-2 border-border-strong" />
              )}
            </button>
          );
        })}
      </div>
      <label className="text-callout mt-4 mb-2 block font-medium text-text" htmlFor="pause-note">
        Note {reason === "OTHER" ? "" : "(optional)"}
      </label>
      <textarea
        id="pause-note"
        value={note}
        onChange={(event) => setNote(event.target.value.slice(0, 300))}
        rows={2}
        placeholder="Anything support should know"
        className="w-full resize-none rounded-xl border border-border-strong bg-surface px-4 py-3 text-[16px] text-text outline-none placeholder:text-text-4 focus:border-accent"
      />
      <div className="mt-4">
        <Button
          loading={loading}
          disabled={!reason || (reason === "OTHER" && !note.trim())}
          onClick={() => reason && onConfirm(reason, note.trim() || undefined)}
          icon={<Pause size={18} />}
        >
          Pause ride
        </Button>
      </div>
    </Sheet>
  );
};

/* ------------------------------------------------------------------ auto-start countdown */
export const AutoStartCountdown = ({ seconds }: { seconds: number }) => (
  <div className="anim-fade-in fixed inset-0 z-[70] flex flex-col items-center justify-center bg-scrim px-8 text-center" role="alert">
    <div className="anim-scale-in rounded-[28px] bg-bg-elevated px-10 py-8 shadow-float">
      <p className="text-headline text-text-2">Ride starting in</p>
      <p key={seconds} className="anim-scale-in mt-2 text-[72px] leading-none font-bold tabular-nums text-accent">
        {seconds}
      </p>
      <p className="text-footnote mt-4 max-w-[220px] text-text-3">The booked time starts now, so the counter starts by itself.</p>
    </div>
  </div>
);

/**
 * Shows the 3-2-1 countdown just before the booked start of a ride the driver
 * hasn't started, then asks the caller to refetch: the server sweep starts the
 * ride (startMethod AUTO), the app doesn't.
 */
export const useAutoStartCountdown = ({
  clock,
  status,
  onReachedStart,
}: {
  clock: RideClock;
  status?: DriverTripStatus | null;
  onReachedStart: () => void;
}) => {
  const watching = isPreRideStatus(status) && clock.phase === "NOT_STARTED" && clock.secondsToStart !== undefined;
  const secondsToStart = clock.secondsToStart ?? Number.POSITIVE_INFINITY;
  const firedRef = useRef(false);
  const callbackRef = useRef(onReachedStart);
  callbackRef.current = onReachedStart;

  useEffect(() => {
    if (!watching) {
      firedRef.current = false;
      return;
    }

    if (secondsToStart <= 0 && secondsToStart > -5 && !firedRef.current) {
      firedRef.current = true;
      callbackRef.current();
    }
  }, [secondsToStart, watching]);

  return watching && secondsToStart > 0 && secondsToStart <= AUTO_START_COUNTDOWN_SECONDS ? secondsToStart : null;
};

/* ------------------------------------------------------------------ ended summary */
const SummaryRow = ({ label, value, tone }: { label: string; value: string; tone?: "warning" }) => (
  <div className="flex items-center justify-between py-2.5">
    <dt className="text-callout text-text-3">{label}</dt>
    <dd className={`text-callout font-semibold tabular-nums ${tone === "warning" ? "text-warning-text" : "text-text"}`}>{value}</dd>
  </div>
);

export const RideEndedSummary = ({ timer }: { timer: RideTimer }) => {
  const extraMinutes = timer.extraTimeMinutes ?? 0;

  return (
    <div className="card px-4 py-2">
      <dl className="[&>*+*]:border-t [&>*+*]:border-separator">
        <SummaryRow
          label="Started"
          value={`${formatLagosTime(timer.actualStartAt) ?? "—"}${timer.startMethod === "AUTO" ? " (auto)" : ""}`}
        />
        <SummaryRow
          label="Ended"
          value={`${formatLagosTime(timer.actualEndAt) ?? "—"}${timer.endMethod === "SUPPORT" ? " (by support)" : ""}`}
        />
        <SummaryRow label="Booked end" value={formatLagosTime(timer.bookedEndAt) ?? "—"} />
        <SummaryRow label="Extra time" value={extraMinutes > 0 ? formatMinutes(extraMinutes) : "None"} tone={extraMinutes > 0 ? "warning" : undefined} />
        {(timer.pauses?.length ?? 0) > 0 && <SummaryRow label="Pauses" value={String(timer.pauses?.length ?? 0)} />}
      </dl>
      <p className="text-footnote border-t border-separator py-3 text-text-3">{EXTRA_HOURS_NOTE}</p>
    </div>
  );
};

/* ------------------------------------------------------------------ panel */
interface RideTimerPanelProps {
  status: DriverTripStatus;
  timer?: RideTimer | null;
  nowMs: number;
  pendingCount: number;
  pendingAction?: string | null;
  onStart: () => void;
  onPause: (reason: RidePauseReason, note?: string) => Promise<unknown> | void;
  onResume: () => void;
  onEnd: () => void;
  /** Hide the Start button (e.g. when the screen has its own). */
  showStart?: boolean;
}

/** Counter + Pause/Resume + End ride for the trip screen. */
export const RideTimerPanel = ({
  status,
  timer,
  nowMs,
  pendingCount,
  pendingAction,
  onStart,
  onPause,
  onResume,
  onEnd,
  showStart = true,
}: RideTimerPanelProps) => {
  const clock = computeRideClock(timer, nowMs);
  const [isPauseSheetOpen, setPauseSheetOpen] = useState(false);
  const [isEndConfirmOpen, setEndConfirmOpen] = useState(false);
  const riding = isRidingStatus(status) && clock.phase !== "ENDED";
  const canStart = isPreRideStatus(status) && clock.phase === "NOT_STARTED";

  if (status === "CANCELLED") {
    return null;
  }

  return (
    <section className="mb-6" aria-label="Ride timer">
      {/* Not while this screen is still sending the action: that one isn't waiting. */}
      {pendingCount > 0 && !pendingAction && (
        <div className="mb-3 flex items-center gap-2 rounded-2xl bg-warning-soft px-4 py-2.5">
          <CloudOff size={16} className="shrink-0 text-warning-text" />
          <p className="text-footnote text-warning-text">
            {pendingCount === 1 ? "1 ride update is" : `${pendingCount} ride updates are`} saved on this phone and will be
            sent when you&apos;re online.
          </p>
        </div>
      )}

      {canStart && showStart && (
        <div className="card px-4 py-4">
          <p className="text-eyebrow text-text-3">Booked time</p>
          <p className="text-headline mt-1 text-text">
            {formatLagosTime(timer?.bookedStartAt) ?? "—"} – {formatLagosTime(timer?.bookedEndAt) ?? "—"}
          </p>
          <p className="text-footnote mt-1 text-text-3">
            {clock.secondsToStart !== undefined && clock.secondsToStart > 0
              ? `Starts in ${formatClock(clock.secondsToStart)}. If you haven't started by then, the counter starts by itself.`
              : "The booked start has passed. The counter starts by itself shortly."}
          </p>
          <div className="mt-4">
            <Button size="md" loading={pendingAction === "start"} icon={<Play size={18} />} onClick={onStart}>
              Start ride
            </Button>
          </div>
        </div>
      )}

      {riding && (
        <>
          <RideCounter clock={clock} timer={timer} />
          <div className="mt-3 grid grid-cols-2 gap-3">
            {timer?.paused ? (
              <Button variant="secondary" size="md" loading={pendingAction === "resume"} icon={<Play size={18} />} onClick={onResume}>
                Resume
              </Button>
            ) : (
              <Button variant="outline" size="md" loading={pendingAction === "pause"} icon={<Pause size={18} />} onClick={() => setPauseSheetOpen(true)}>
                Pause
              </Button>
            )}
            <Button variant="danger" size="md" loading={pendingAction === "end"} icon={<Square size={16} />} onClick={() => setEndConfirmOpen(true)}>
              End ride
            </Button>
          </div>
        </>
      )}

      {clock.phase === "ENDED" && timer && (
        <>
          <p className="text-eyebrow mb-3 text-text-3">Ride times</p>
          <RideEndedSummary timer={timer} />
        </>
      )}

      <PauseReasonSheet
        open={isPauseSheetOpen}
        onClose={() => setPauseSheetOpen(false)}
        loading={pendingAction === "pause"}
        onConfirm={(reason, note) => {
          setPauseSheetOpen(false);
          void onPause(reason, note);
        }}
      />

      <AlertDialog
        open={isEndConfirmOpen}
        onClose={() => setEndConfirmOpen(false)}
        onConfirm={() => {
          setEndConfirmOpen(false);
          onEnd();
        }}
        title={END_RIDE_TITLE}
        message={END_RIDE_MESSAGE}
        confirmText="End ride"
        confirmVariant="danger"
      />
    </section>
  );
};
