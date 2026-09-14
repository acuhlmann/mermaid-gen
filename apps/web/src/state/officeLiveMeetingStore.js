/**
 * Live glass-room / headset meeting playback lives in React state
 * (`useMeetingPlayback`), not in `officeMomentStore`. Soundscape directors
 * mount from ArchiSlop and need the same occupancy signal the floor gets as a
 * prop — this store is the narrow bridge: `{ attendees, modality }` only.
 */

/** @type {{ attendees?: string[], modality?: string, state?: string } | null} */
let liveMeeting = null;

/** @type {Set<() => void>} */
const listeners = new Set();

function emit() {
  for (const fn of listeners) {
    try {
      fn();
    } catch (err) {
      console.warn('officeLiveMeetingStore: listener threw:', err?.message ?? err);
    }
  }
}

/**
 * @param {() => void} listener
 * @returns {() => void}
 */
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** @returns {typeof liveMeeting} */
export function getOfficeLiveMeeting() {
  return liveMeeting;
}

/**
 * @param {typeof liveMeeting} meeting
 */
export function setOfficeLiveMeeting(meeting) {
  liveMeeting = meeting;
  emit();
}

/** @internal Reset between tests. */
export function _resetOfficeLiveMeetingForTests() {
  liveMeeting = null;
  listeners.clear();
}
