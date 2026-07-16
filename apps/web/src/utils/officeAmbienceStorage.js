/**
 * localStorage persistence for the office ambience layer — mirrors
 * advisorMuteStorage.js. Focus Time is the office DND toggle; cadence memory
 * keeps canned templates from repeating and prevents an instant moment on
 * every reload.
 */

export const OFFICE_FOCUS_TIME_STORAGE_KEY = 'archislop:office-focus-time';
export const OFFICE_CADENCE_STORAGE_KEY = 'archislop:office-cadence';

const SEEN_TEMPLATE_CAP = 60;

/** @returns {boolean} True when the user booked Focus Time (office muted). */
export function readOfficeFocusTime() {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(OFFICE_FOCUS_TIME_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeOfficeFocusTime(enabled) {
  if (typeof window === 'undefined') return;
  try {
    if (enabled) {
      window.localStorage.setItem(OFFICE_FOCUS_TIME_STORAGE_KEY, '1');
    } else {
      window.localStorage.removeItem(OFFICE_FOCUS_TIME_STORAGE_KEY);
    }
  } catch {
    // Ignore quota / privacy errors.
  }
}

/** @returns {{ lastFiredAt: number, seenTemplateIds: string[] }} */
export function readOfficeCadenceMemory() {
  const fallback = { lastFiredAt: 0, seenTemplateIds: [] };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(OFFICE_CADENCE_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return fallback;
    return {
      lastFiredAt: Number.isFinite(parsed.lastFiredAt) ? parsed.lastFiredAt : 0,
      seenTemplateIds: Array.isArray(parsed.seenTemplateIds)
        ? parsed.seenTemplateIds.filter((id) => typeof id === 'string').slice(-SEEN_TEMPLATE_CAP)
        : []
    };
  } catch {
    return fallback;
  }
}

export function writeOfficeCadenceMemory(memory) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      OFFICE_CADENCE_STORAGE_KEY,
      JSON.stringify({
        lastFiredAt: Number.isFinite(memory?.lastFiredAt) ? memory.lastFiredAt : 0,
        seenTemplateIds: Array.isArray(memory?.seenTemplateIds)
          ? memory.seenTemplateIds.slice(-SEEN_TEMPLATE_CAP)
          : []
      })
    );
  } catch {
    // Ignore quota / privacy errors.
  }
}
