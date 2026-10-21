import { useEffect, useState } from "react";

import { storage } from "./storage";

const IDEMPOTENCY_KEY_STORAGE_PREFIX = "checklist-idempotency-";

const generateIdempotencyKey = (scope: string) =>
  `${scope}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * A dropped submission (lost connection, tab killed mid-request) can leave a
 * checklist step "existing" server-side without having completed. The
 * backend's Idempotency-Key header lets a retry reuse the same key and get the
 * original response back, but only if the retry sends the SAME key. This
 * persists one key per scope (tracker + step) across reloads.
 */
export const usePersistentIdempotencyKey = (scope: string) => {
  const [key, setKey] = useState(() => generateIdempotencyKey(scope));

  useEffect(() => {
    if (!scope) {
      return;
    }

    const storageKey = `${IDEMPOTENCY_KEY_STORAGE_PREFIX}${scope}`;
    const stored = storage.get(storageKey);

    if (stored) {
      setKey(stored);
      return;
    }

    const freshKey = generateIdempotencyKey(scope);
    setKey(freshKey);
    storage.set(storageKey, freshKey);
  }, [scope]);

  return key;
};
