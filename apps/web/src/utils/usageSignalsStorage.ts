/**
 * The "Share anonymous usage" preference (ADR-0019). Absent means "not decided": signals default
 * on, unless the browser sends Global Privacy Control, in which case they default off. An explicit
 * choice in Settings always wins over both.
 */
export const USAGE_SIGNALS_KEY = 'archislop:usage-signals';

type NavigatorWithGpc = { globalPrivacyControl?: boolean };

/** The stored choice: true / false, or null when the user never chose. */
export function readUsageSignalsPreference(): boolean | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(USAGE_SIGNALS_KEY);
    if (raw === 'on') return true;
    if (raw === 'off') return false;
    return null;
  } catch {
    return null;
  }
}

/** Persist an explicit choice. */
export function writeUsageSignalsPreference(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(USAGE_SIGNALS_KEY, enabled ? 'on' : 'off');
  } catch {
    // Ignore quota / privacy errors: the in-memory choice still applies for this page.
  }
}

/** The default before any choice: on, unless Global Privacy Control asks otherwise. */
export function defaultUsageSignalsEnabled(nav: NavigatorWithGpc | undefined): boolean {
  return nav?.globalPrivacyControl !== true;
}

/** Whether signals should be sent right now. */
export function resolveUsageSignalsEnabled(): boolean {
  const stored = readUsageSignalsPreference();
  if (stored !== null) return stored;
  const nav = typeof navigator === 'undefined' ? undefined : (navigator as NavigatorWithGpc);
  return defaultUsageSignalsEnabled(nav);
}
