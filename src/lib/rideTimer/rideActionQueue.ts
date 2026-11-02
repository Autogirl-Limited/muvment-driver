/**
 * Persistent outbox for ride timer actions (start / pause / resume / end).
 *
 * A driver taps "End ride" in an underground car park and the request is
 * lost: the ride keeps counting extra time. So every action is written to
 * localStorage first, with the device time it happened (`reportedAt`) and an
 * Idempotency-Key, and then sent. Anything not sent yet is retried in order
 * when the phone is back online (see RideActionQueueSync). The backend keeps
 * `reportedAt` as the ride time and is safe to replay with the same key.
 */
import { apiFetchClient, ApiRequestError } from "../api/client";
import type { RideAction, RideActionPayload, RideTimer, RideTimerResponse } from "../api/types";
import { isAppKnownOffline, OFFLINE_ERROR_CODE } from "../utils/networkStatus";
import { storage } from "../utils/storage";

const QUEUE_STORAGE_KEY = "ride-action-queue";

export interface QueuedRideAction {
  id: string;
  tripId: string;
  action: RideAction;
  body: RideActionPayload;
  idempotencyKey: string;
  createdAt: string;
  attempts: number;
}

export type RideActionOutcome =
  | { type: "sent"; item: QueuedRideAction; timer: RideTimer }
  | { type: "rejected"; item: QueuedRideAction; message: string };

type Listener = () => void;

const listeners = new Set<Listener>();
let cachedQueue: QueuedRideAction[] | null = null;
let inFlightFlush: Promise<RideActionOutcome[]> | null = null;

const readQueue = (): QueuedRideAction[] => {
  if (cachedQueue) {
    return cachedQueue;
  }

  const stored = storage.getJSON<QueuedRideAction[]>(QUEUE_STORAGE_KEY);
  cachedQueue = Array.isArray(stored) ? stored : [];
  return cachedQueue;
};

const writeQueue = (queue: QueuedRideAction[]) => {
  cachedQueue = queue;

  if (queue.length === 0) {
    storage.remove(QUEUE_STORAGE_KEY);
  } else {
    storage.setJSON(QUEUE_STORAGE_KEY, queue);
  }

  listeners.forEach((listener) => listener());
};

const randomId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const getQueuedRideActions = () => readQueue();

export const getQueuedRideActionsForTrip = (tripId: string) => readQueue().filter((item) => item.tripId === tripId);

export const subscribeToRideActionQueue = (listener: Listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const enqueueRideAction = (
  tripId: string,
  action: RideAction,
  body: Omit<RideActionPayload, "reportedAt"> = {},
): QueuedRideAction => {
  const item: QueuedRideAction = {
    id: randomId(),
    tripId,
    action,
    body: { ...body, reportedAt: new Date().toISOString() },
    idempotencyKey: `ride-${action}-${tripId}-${randomId()}`,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };

  writeQueue([...readQueue(), item]);
  return item;
};

const removeFromQueue = (id: string) => writeQueue(readQueue().filter((item) => item.id !== id));

const bumpAttempts = (id: string) =>
  writeQueue(readQueue().map((item) => (item.id === id ? { ...item, attempts: item.attempts + 1 } : item)));

/** Network trouble or a server hiccup: keep the action and try again later. */
const isRetryable = (error: unknown) => {
  if (!(error instanceof ApiRequestError)) {
    return true;
  }

  if (error.code === OFFLINE_ERROR_CODE || error.code === "ERR_NETWORK" || error.code === "ERR_UNKNOWN") {
    return true;
  }

  const status = error.status;
  return status === undefined || status === 401 || status === 408 || status === 429 || status >= 500;
};

/**
 * The backend refuses a `reportedAt` more than 2 minutes ahead of its clock
 * (400 "The time can't be in the future."): the phone's clock is fast.
 */
const isFutureTimeRefusal = (error: unknown) =>
  error instanceof ApiRequestError && error.status === 400 && /in the future/i.test(error.message);

const sendRideAction = async (item: QueuedRideAction) => {
  const post = (body: RideActionPayload) =>
    apiFetchClient.post<RideTimerResponse, RideActionPayload>(
      `/driver-app/trips/${encodeURIComponent(item.tripId)}/${item.action}`,
      body,
      { "Idempotency-Key": item.idempotencyKey },
    );

  try {
    return (await post(item.body)).data.data;
  } catch (error) {
    if (!item.body.reportedAt || !isFutureTimeRefusal(error)) throw error;
    // Send it again without the device time, so the server records "now"
    // instead of dropping the action.
    const { reportedAt: _skipped, ...rest } = item.body;
    void _skipped;
    return (await post(rest)).data.data;
  }
};

/**
 * Sends queued actions oldest first. Stops at the first retryable failure so
 * a trip's actions are never applied out of order. An action the server
 * refuses (4xx, e.g. "ride already ended") is dropped and reported.
 */
export const flushRideActions = (
  onSent?: (item: QueuedRideAction, timer: RideTimer) => void,
): Promise<RideActionOutcome[]> => {
  if (inFlightFlush) {
    return inFlightFlush;
  }

  inFlightFlush = (async () => {
    const outcomes: RideActionOutcome[] = [];

    while (!isAppKnownOffline()) {
      const next = readQueue()[0];

      if (!next) {
        break;
      }

      try {
        const timer = await sendRideAction(next);
        // Apply the server's timer before dropping the queued copy, so the
        // screen never flickers back to the pre-action state.
        onSent?.(next, timer);
        removeFromQueue(next.id);
        outcomes.push({ type: "sent", item: next, timer });
      } catch (error) {
        if (isRetryable(error)) {
          bumpAttempts(next.id);
          break;
        }

        removeFromQueue(next.id);
        outcomes.push({
          type: "rejected",
          item: next,
          message: error instanceof Error ? error.message : "The server refused this ride update.",
        });
      }
    }

    return outcomes;
  })().finally(() => {
    inFlightFlush = null;
  });

  return inFlightFlush;
};
