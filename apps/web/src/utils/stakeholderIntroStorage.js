export const STAKEHOLDER_INTRO_SEEN_KEY = 'archislop:stakeholder-intro-seen';

/**
 * True once the first-run stakeholder spotlight has been shown. It is a
 * once-ever onboarding beat, so this persists across sessions and the spotlight
 * never fires again after it is set.
 *
 * @returns {boolean}
 */
export function readStakeholderIntroSeen() {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(STAKEHOLDER_INTRO_SEEN_KEY) === '1';
  } catch {
    // Treat storage failures as "already seen" so we never nag in a loop.
    return true;
  }
}

/** Mark the first-run stakeholder spotlight as shown. */
export function writeStakeholderIntroSeen() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STAKEHOLDER_INTRO_SEEN_KEY, '1');
  } catch {
    // Ignore quota / privacy errors.
  }
}
