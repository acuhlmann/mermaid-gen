export const ADVISOR_MUTED_STORAGE_KEY = 'archislop:advisor-muted';

/** @returns {boolean} True when the user explicitly muted the stakeholders (default false). */
export function readAdvisorMuted() {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(ADVISOR_MUTED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Persist explicit stakeholders mute; does not apply to silent idle pause. */
export function writeAdvisorMuted(muted) {
  if (typeof window === 'undefined') return;
  try {
    if (muted) {
      window.localStorage.setItem(ADVISOR_MUTED_STORAGE_KEY, '1');
    } else {
      window.localStorage.removeItem(ADVISOR_MUTED_STORAGE_KEY);
    }
  } catch {
    // Ignore quota / privacy errors.
  }
}
