/**
 * Global error-toast pub/sub. Surfaces transient, user-visible failures
 * (network errors, unrecoverable handshake/explain errors) without prop drilling.
 *
 * Not for happy-path status — that flows through App.jsx's inline `status`
 * memo. Use this only when the user can act on the message (retry, reconnect).
 */

const DEFAULT_TTL_MS = 6000;
const MAX_VISIBLE = 5;
const DEDUPE_WINDOW_MS = 1000;

let toasts = [];
let nextId = 1;
const listeners = new Set();
const lastSeenByMessage = new Map();

function emit() {
  for (const fn of listeners) {
    try {
      fn();
    } catch (err) {
      console.warn('errorToastStore: listener threw:', err?.message ?? err);
    }
  }
}

export function pushError(message, options = {}) {
  const text = String(message ?? '').trim();
  if (!text) return null;

  const now = Date.now();
  const lastSeen = lastSeenByMessage.get(text);
  if (lastSeen != null && now - lastSeen < DEDUPE_WINDOW_MS) {
    return null;
  }
  lastSeenByMessage.set(text, now);

  const id = options.id ?? `err-${nextId++}`;
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const toast = { id, message: text, createdAt: now };

  toasts = [...toasts, toast];
  if (toasts.length > MAX_VISIBLE) toasts = toasts.slice(-MAX_VISIBLE);

  if (ttlMs > 0) {
    setTimeout(() => dismissError(id), ttlMs);
  }

  emit();
  return id;
}

export function dismissError(id) {
  const next = toasts.filter((t) => t.id !== id);
  if (next.length === toasts.length) return;
  toasts = next;
  emit();
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getErrors() {
  return toasts;
}

export function _resetForTests() {
  toasts = [];
  nextId = 1;
  listeners.clear();
  lastSeenByMessage.clear();
}
