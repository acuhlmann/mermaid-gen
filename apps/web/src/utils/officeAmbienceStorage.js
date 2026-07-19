/**
 * localStorage persistence for the office ambience layer — mirrors
 * advisorMuteStorage.js. Focus Time is the office DND toggle; cadence memory
 * keeps canned templates from repeating and prevents an instant moment on
 * every reload.
 */

export const OFFICE_FOCUS_TIME_STORAGE_KEY = 'archislop:office-focus-time';
export const OFFICE_SOUNDSCAPE_STORAGE_KEY = 'archislop:office-soundscape';
export const OFFICE_NARRATION_STORAGE_KEY = 'archislop:office-narration';
export const OFFICE_MEETING_DOCKED_STORAGE_KEY = 'archislop:office-meeting-docked';
export const OFFICE_CADENCE_STORAGE_KEY = 'archislop:office-cadence';
export const OFFICE_WELCOME_STORAGE_KEY = 'archislop:office-welcomed';
export const OFFICE_DIRECTORY_STORAGE_KEY = 'archislop:office-directory-seen';
export const OFFICE_DAY_ONE_BADGE_STORAGE_KEY = 'archislop:day-one-badge-seen';

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

/**
 * @returns {boolean} True unless the user switched the soundscape off — the
 * room tone defaults ON (it is quiet, sparse, and behind the global sound
 * toggle) and only stores the opt-out.
 */
export function readOfficeSoundscapeEnabled() {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(OFFICE_SOUNDSCAPE_STORAGE_KEY) !== '0';
  } catch {
    return true;
  }
}

export function writeOfficeSoundscapeEnabled(enabled) {
  if (typeof window === 'undefined') return;
  try {
    if (enabled) {
      window.localStorage.removeItem(OFFICE_SOUNDSCAPE_STORAGE_KEY);
    } else {
      window.localStorage.setItem(OFFICE_SOUNDSCAPE_STORAGE_KEY, '0');
    }
  } catch {
    // Ignore quota / privacy errors.
  }
}

/**
 * @returns {boolean} True unless the user switched narration off — walk-bys
 * and meeting beats default to spoken aloud (emails stay silent); only the
 * opt-out is persisted, matching the soundscape toggle.
 */
export function readOfficeNarrationEnabled() {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(OFFICE_NARRATION_STORAGE_KEY) !== '0';
  } catch {
    return true;
  }
}

export function writeOfficeNarrationEnabled(enabled) {
  if (typeof window === 'undefined') return;
  try {
    if (enabled) {
      window.localStorage.removeItem(OFFICE_NARRATION_STORAGE_KEY);
    } else {
      window.localStorage.setItem(OFFICE_NARRATION_STORAGE_KEY, '0');
    }
  } catch {
    // Ignore quota / privacy errors.
  }
}

/**
 * @returns {boolean} True when the user prefers meetings docked to a corner
 * (canvas visible) rather than centred over the diagram. Defaults OFF — the
 * centred room is the first-run "you're in a meeting" beat; docking is the
 * learned escape hatch, so we only store the opt-in.
 */
export function readOfficeMeetingDocked() {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(OFFICE_MEETING_DOCKED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeOfficeMeetingDocked(docked) {
  if (typeof window === 'undefined') return;
  try {
    if (docked) {
      window.localStorage.setItem(OFFICE_MEETING_DOCKED_STORAGE_KEY, '1');
    } else {
      window.localStorage.removeItem(OFFICE_MEETING_DOCKED_STORAGE_KEY);
    }
  } catch {
    // Ignore quota / privacy errors.
  }
}

/**
 * True once the first-run office welcome sequence (Linda's email + Chad's IM)
 * has been delivered. Once-ever, like the stakeholder intro spotlight; storage
 * failures count as "already welcomed" so we never re-onboard in a loop.
 */
export function readOfficeWelcomeSeen() {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(OFFICE_WELCOME_STORAGE_KEY) === '1';
  } catch {
    return true;
  }
}

export function writeOfficeWelcomeSeen() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(OFFICE_WELCOME_STORAGE_KEY, '1');
  } catch {
    // Ignore quota / privacy errors.
  }
}

/**
 * True once the entry-screen office directory has been dismissed — it then
 * collapses to the "Meet the office" chip on later visits.
 */
export function readOfficeDirectorySeen() {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(OFFICE_DIRECTORY_STORAGE_KEY) === '1';
  } catch {
    return true;
  }
}

export function writeOfficeDirectorySeen() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(OFFICE_DIRECTORY_STORAGE_KEY, '1');
  } catch {
    // Ignore quota / privacy errors.
  }
}

/**
 * True once the Day One badge on the entry screen has been dismissed — the
 * new-hire framing then stays out of the way on later visits.
 */
export function readDayOneBadgeSeen() {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(OFFICE_DAY_ONE_BADGE_STORAGE_KEY) === '1';
  } catch {
    return true;
  }
}

export function writeDayOneBadgeSeen() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(OFFICE_DAY_ONE_BADGE_STORAGE_KEY, '1');
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
