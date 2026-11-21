import type { RideTimer } from "../api/driverPaymentTypes";
import { parseLagosMs } from "../utils/lagosTime";

/**
 * Total time the ride has spent paused, in ms. An open pause (no `resumedAt`)
 * counts up to `nowMs`, so the total grows while paused and stops growing the
 * moment the driver resumes.
 */
export const getPausedMs = (timer: RideTimer | null | undefined, nowMs: number): number => {
  if (!timer) return 0;

  const pauses = [...(timer.pauses ?? [])];

  // The open pause normally appears in `pauses` too; add it only if it doesn't.
  if (timer.currentPause && !pauses.some((pause) => pause.id === timer.currentPause?.id)) {
    pauses.push(timer.currentPause);
  }

  return pauses.reduce((total, pause) => {
    const pausedAtMs = parseLagosMs(pause.pausedAt);

    if (pausedAtMs === undefined) return total;

    const resumedAtMs = parseLagosMs(pause.resumedAt);
    const endMs = resumedAtMs ?? (timer.paused ? nowMs : pausedAtMs);

    return total + Math.max(0, endMs - pausedAtMs);
  }, 0);
};

/**
 * The booked end pushed back by the time spent paused: a paused ride does not
 * use up its booked time, so the countdown holds still and resumes where it
 * left off.
 */
export const getEffectiveBookedEndMs = (
  timer: RideTimer | null | undefined,
  bookedEndMs: number | undefined,
  nowMs: number,
) => (bookedEndMs === undefined ? undefined : bookedEndMs + getPausedMs(timer, nowMs));
