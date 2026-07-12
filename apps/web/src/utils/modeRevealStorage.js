export const MODE_REVEAL_SEEN_KEY = 'archislop:mode-reveal-seen';

/**
 * True once the first-run mode-reveal spotlight has been shown. Like the
 * stakeholder intro, promoting the render modes out of Settings is a once-ever
 * onboarding beat, so this persists across sessions and never fires again after
 * it is set.
 *
 * @returns {boolean}
 */
export function readModeRevealSeen() {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(MODE_REVEAL_SEEN_KEY) === '1';
  } catch {
    // Treat storage failures as "already seen" so we never nag in a loop.
    return true;
  }
}

/** Mark the first-run mode-reveal spotlight as shown. */
export function writeModeRevealSeen() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MODE_REVEAL_SEEN_KEY, '1');
  } catch {
    // Ignore quota / privacy errors.
  }
}
