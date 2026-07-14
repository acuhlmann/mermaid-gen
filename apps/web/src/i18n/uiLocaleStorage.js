/** @typedef {import('@archislop/shared').UiLocale} UiLocale */

const STORAGE_KEY = 'archislop.uiLocale';

/** @returns {UiLocale | null} */
export function readStoredUiLocale() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === 'en' || raw === 'en-AU' || raw === 'zh-CN' || raw === 'zh-TW') return raw;
  } catch {
    // ignore quota / private mode
  }
  return null;
}

/** @param {UiLocale} locale */
export function writeStoredUiLocale(locale) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // ignore
  }
}
