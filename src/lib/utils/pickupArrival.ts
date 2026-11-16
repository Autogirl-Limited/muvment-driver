/**
 * When the driver tapped "Arrived" at pickup, kept per trip on the device so
 * the waiting time survives leaving the app, a reload, or the OS freezing the
 * page. Waiting time is always `now - arrivedAt`, never a counted-up value.
 */
const KEY_PREFIX = "pickup-arrived-at:";

const getStorage = () => {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
};

export const readPickupArrival = (tripId?: string): number | null => {
  if (!tripId) return null;

  try {
    const value = Number(getStorage()?.getItem(`${KEY_PREFIX}${tripId}`));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
};

export const writePickupArrival = (tripId: string | undefined, arrivedAt: number) => {
  if (!tripId) return;

  try {
    getStorage()?.setItem(`${KEY_PREFIX}${tripId}`, String(arrivedAt));
  } catch {
    // Storage can be blocked; the timer then only lasts while the screen is open.
  }
};

export const clearPickupArrival = (tripId?: string) => {
  if (!tripId) return;

  try {
    getStorage()?.removeItem(`${KEY_PREFIX}${tripId}`);
  } catch {
    // Nothing to clear.
  }
};
