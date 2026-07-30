export const RADIAL_SELECTION_INTRO_SEEN_KEY = 'archislop:radial-selection-intro-seen';

/**
 * True once the first-run radial selection spotlight has been shown. Persists
 * across sessions so we only explain precision editing once.
 *
 * @returns {boolean}
 */
export function readRadialSelectionIntroSeen() {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(RADIAL_SELECTION_INTRO_SEEN_KEY) === '1';
  } catch {
    return true;
  }
}

/** Mark the first-run radial selection spotlight as shown. */
export function writeRadialSelectionIntroSeen() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(RADIAL_SELECTION_INTRO_SEEN_KEY, '1');
  } catch {
    // Ignore quota / privacy errors.
  }
}
