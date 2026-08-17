/**
 * localStorage persistence for the office ambience layer — mirrors
 * advisorMuteStorage.js. Focus Time is the office DND toggle; cadence memory
 * keeps canned templates from repeating and prevents an instant moment on
 * every reload.
 */

export const OFFICE_FOCUS_TIME_STORAGE_KEY = 'archislop:office-focus-time';
export const OFFICE_SOUNDSCAPE_STORAGE_KEY = 'archislop:office-soundscape';
export const OFFICE_NARRATION_STORAGE_KEY = 'archislop:office-narration';
/** Captions / CC for spoken office lines (arrival + floor bubbles). Opt-in. */
export const OFFICE_CAPTIONS_STORAGE_KEY = 'archislop:office-captions';
/**
 * Headphones posture: the one control that replaced the Voice / Noise / CC
 * checkboxes. It does not gate anything itself — `setOfficeHeadphones` writes
 * the three flags above — so this key exists only to remember which posture the
 * desk menu should show after a reload, independent of any per-scene CC nudge.
 */
export const OFFICE_HEADPHONES_STORAGE_KEY = 'archislop:office-headphones';
export const OFFICE_MEETING_DOCKED_STORAGE_KEY = 'archislop:office-meeting-docked';
export const OFFICE_CADENCE_STORAGE_KEY = 'archislop:office-cadence';
/**
 * The office log — what the cast remembers happened today (see
 * `officeLogDigest.js`). Day-stamped, and a stamp from any other day is
 * discarded on read: a reload should not cost the office its morning, but
 * Tuesday's "09:12 you shipped a diagram" recounted on Thursday is a character
 * being wrong rather than a character remembering.
 */
export const OFFICE_LOG_STORAGE_KEY = 'archislop:office-log';
/**
 * Per-colleague working memory for this office day (docs/office-continuity.md).
 * Same day-stamp rule as the log: a same-day reload keeps it, a new calendar
 * day clears it. It records; it never fires a moment.
 */
export const OFFICE_WORKING_MEMORY_STORAGE_KEY = 'archislop:office-working-memory';
/** Last few beats kept per colleague — enough for a second approach, not a memoir. */
export const OFFICE_WORKING_MEMORY_BEAT_CAP = 4;
/**
 * Slop Chat™ scrollback. Deliberately *not* day-stamped, unlike the log above:
 * a messenger that forgets your threads overnight is a broken messenger, and
 * the scrollback is the user's own record rather than the cast's memory.
 */
export const OFFICE_IM_HISTORY_STORAGE_KEY = 'archislop:office-im-history';
export const OFFICE_WELCOME_STORAGE_KEY = 'archislop:office-welcomed';
export const OFFICE_DIRECTORY_STORAGE_KEY = 'archislop:office-directory-seen';
export const OFFICE_DAY_ONE_BADGE_STORAGE_KEY = 'archislop:day-one-badge-seen';
export const OFFICE_ENTRY_DESK_INTRO_STORAGE_KEY = 'archislop:entry-desk-intro-seen';
export const OFFICE_USER_NAME_STORAGE_KEY = 'archislop:user-name';

const SEEN_TEMPLATE_CAP = 60;

/**
 * Cap the stored display name so a paste-bomb can't bloat every office slot
 * fill (the name rides into emails, IMs, and TTS lines). Comfortably longer
 * than any real first name, short enough to never wrap the lanyard badge.
 */
export const USER_NAME_MAX_LENGTH = 24;

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
 * @returns {boolean} True when the user put headphones on (read-first: office
 * silent, captions on). Defaults OFF — sound-first is the house posture, so
 * only the opt-in is stored.
 */
export function readOfficeHeadphones() {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(OFFICE_HEADPHONES_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeOfficeHeadphones(enabled) {
  if (typeof window === 'undefined') return;
  try {
    if (enabled) {
      window.localStorage.setItem(OFFICE_HEADPHONES_STORAGE_KEY, '1');
    } else {
      window.localStorage.removeItem(OFFICE_HEADPHONES_STORAGE_KEY);
    }
  } catch {
    // Ignore quota / privacy errors.
  }
}

/**
 * Headphones is the desk-menu posture; narration / soundscape / captions are
 * what consumers read. Before the macro, Voice / CC were independent keys — and
 * a half-cleared localStorage (or a pre-macro "Voice off") can leave the menu
 * saying headphones off while narration is still `'0'`. Reconcile on boot so the
 * checkbox never lies about whether the office speaks.
 *
 * Captions may stay on when headphones are off (floor CC nudge). When headphones
 * are on, captions must be on (read-first).
 *
 * @returns {{ headphones: boolean, narration: boolean, soundscape: boolean, captions: boolean }}
 */
export function reconcileOfficeHeadphonesPosture() {
  const headphones = readOfficeHeadphones();
  let narration = readOfficeNarrationEnabled();
  let soundscape = readOfficeSoundscapeEnabled();
  let captions = readOfficeCaptionsEnabled();

  if (headphones) {
    if (narration || soundscape || !captions) {
      narration = false;
      soundscape = false;
      captions = true;
      writeOfficeNarrationEnabled(false);
      writeOfficeSoundscapeEnabled(false);
      writeOfficeCaptionsEnabled(true);
    }
  } else if (!narration || !soundscape) {
    narration = true;
    soundscape = true;
    writeOfficeNarrationEnabled(true);
    writeOfficeSoundscapeEnabled(true);
  }

  return { headphones, narration, soundscape, captions };
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
 * @returns {boolean} True when the user wants spoken dialogue as on-screen text
 * (CC). Defaults OFF — voice-first, matching the Meet-the-Office card tour.
 */
export function readOfficeCaptionsEnabled() {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(OFFICE_CAPTIONS_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeOfficeCaptionsEnabled(enabled) {
  if (typeof window === 'undefined') return;
  try {
    if (enabled) {
      window.localStorage.setItem(OFFICE_CAPTIONS_STORAGE_KEY, '1');
    } else {
      window.localStorage.removeItem(OFFICE_CAPTIONS_STORAGE_KEY);
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
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(OFFICE_DIRECTORY_STORAGE_KEY) === '1';
  } catch {
    // Prefer showing orientation over skipping it when storage is unavailable.
    return false;
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

/**
 * True once the first-run desk welcome (EntryDeskIntro + tooltip pointers) has
 * been shown and dismissed — either by shipping a first deliverable or by
 * completing the orientation skip path.
 */
export function readEntryDeskIntroSeen() {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(OFFICE_ENTRY_DESK_INTRO_STORAGE_KEY) === '1';
  } catch {
    return true;
  }
}

export function writeEntryDeskIntroSeen() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(OFFICE_ENTRY_DESK_INTRO_STORAGE_KEY, '1');
  } catch {
    // Ignore quota / privacy errors.
  }
}

/**
 * The user's chosen display name — the handle the office cast uses when it
 * addresses "you" (Linda's welcome, Chad's IM, the name badge). Stored raw and
 * possibly empty; the funny default lives in userIdentityStore.resolveUserName
 * so a nameless new hire is still greeted as someone.
 *
 * @returns {string} The trimmed stored name, or '' when the badge is blank.
 */
export function readUserName() {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(OFFICE_USER_NAME_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

/**
 * Persist the display name (trimmed + capped). An empty value clears the key
 * so the office falls back to the default handle rather than storing '' .
 *
 * @param {string} name
 */
export function writeUserName(name) {
  if (typeof window === 'undefined') return;
  try {
    const trimmed = String(name ?? '')
      .trim()
      .slice(0, USER_NAME_MAX_LENGTH);
    if (trimmed) {
      window.localStorage.setItem(OFFICE_USER_NAME_STORAGE_KEY, trimmed);
    } else {
      window.localStorage.removeItem(OFFICE_USER_NAME_STORAGE_KEY);
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

/** Entries the office log keeps; older ones fall off the front. */
export const OFFICE_LOG_ENTRY_CAP = 24;

/**
 * Which day a stored log belongs to, in the reader's own zone.
 *
 * A plain local date string rather than a timestamp comparison: "is this the
 * same calendar day the user is looking at" is the actual question, and it
 * survives a laptop that slept through midnight.
 *
 * @param {number} at epoch ms
 * @returns {string}
 */
function dayStampOf(at) {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

/**
 * @param {number} [now] epoch ms, for tests
 * @returns {Array<{at: number, kind: string, colleagueId?: string, detail?: string}>}
 *   Empty when the stored log is from another day — see
 *   `OFFICE_LOG_STORAGE_KEY`.
 */
export function readOfficeLog(now = Date.now()) {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(OFFICE_LOG_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return [];
    if (parsed.day !== dayStampOf(now)) return [];
    if (!Array.isArray(parsed.entries)) return [];
    return parsed.entries
      .filter((entry) => entry && typeof entry.kind === 'string' && Number.isFinite(entry.at))
      .slice(-OFFICE_LOG_ENTRY_CAP);
  } catch {
    return [];
  }
}

/**
 * @param {Array<{at: number, kind: string}>} entries
 * @param {number} [now] epoch ms, for tests
 */
export function writeOfficeLog(entries, now = Date.now()) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      OFFICE_LOG_STORAGE_KEY,
      JSON.stringify({
        day: dayStampOf(now),
        entries: Array.isArray(entries) ? entries.slice(-OFFICE_LOG_ENTRY_CAP) : []
      })
    );
  } catch {
    // Ignore quota / privacy errors.
  }
}

/**
 * @param {unknown} beat
 * @returns {{ at: number, theirs?: string, yours?: string, pitchTaken?: boolean } | null}
 */
function sanitizeWorkingMemoryBeat(beat) {
  if (!beat || typeof beat !== 'object') return null;
  if (!Number.isFinite(beat.at)) return null;
  const next = { at: beat.at };
  if (typeof beat.theirs === 'string' && beat.theirs.trim()) {
    next.theirs = beat.theirs.trim().slice(0, 200);
  }
  if (typeof beat.yours === 'string' && beat.yours.trim()) {
    next.yours = beat.yours.trim().slice(0, 200);
  }
  if (beat.pitchTaken === true) next.pitchTaken = true;
  if (!next.theirs && !next.yours && !next.pitchTaken) return null;
  return next;
}

/**
 * @param {number} [now] epoch ms, for tests
 * @returns {{ [colleagueId: string]: { beats: Array<object>, boardFingerprint?: string } }}
 */
export function readOfficeWorkingMemory(now = Date.now()) {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(OFFICE_WORKING_MEMORY_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    if (parsed.day !== dayStampOf(now)) return {};
    if (!parsed.byColleague || typeof parsed.byColleague !== 'object') return {};
    const byColleague = {};
    for (const [id, row] of Object.entries(parsed.byColleague)) {
      if (!id || !row || typeof row !== 'object') continue;
      const beats = Array.isArray(row.beats)
        ? row.beats
            .map(sanitizeWorkingMemoryBeat)
            .filter(Boolean)
            .slice(-OFFICE_WORKING_MEMORY_BEAT_CAP)
        : [];
      const boardFingerprint =
        typeof row.boardFingerprint === 'string' && row.boardFingerprint.trim()
          ? row.boardFingerprint.trim().slice(0, 240)
          : undefined;
      if (!beats.length && !boardFingerprint) continue;
      byColleague[id] = boardFingerprint ? { beats, boardFingerprint } : { beats };
    }
    return byColleague;
  } catch {
    return {};
  }
}

/**
 * @param {{ [colleagueId: string]: { beats?: Array<object>, boardFingerprint?: string } }} byColleague
 * @param {number} [now] epoch ms, for tests
 */
export function writeOfficeWorkingMemory(byColleague, now = Date.now()) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      OFFICE_WORKING_MEMORY_STORAGE_KEY,
      JSON.stringify({
        day: dayStampOf(now),
        byColleague: byColleague && typeof byColleague === 'object' ? byColleague : {}
      })
    );
  } catch {
    // Ignore quota / privacy errors.
  }
}

/**
 * Slop Chat scrollback across a reload.
 *
 * `talk`-channel lines are dropped on the way out rather than on the way in:
 * they are speech at your desk or on the floor, the messenger never rendered
 * them, and a spoken remark that reappears in a chat window three days later
 * is the wrong kind of memory. What you typed persists; what was said aloud
 * does not.
 *
 * @param {number} cap
 * @returns {Array<object>}
 */
export function readOfficeImHistory(cap) {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(OFFICE_IM_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (msg) =>
          msg &&
          typeof msg.id === 'string' &&
          typeof msg.colleagueId === 'string' &&
          typeof msg.body === 'string'
      )
      .slice(-cap);
  } catch {
    return [];
  }
}

/**
 * @param {Array<object>} history already filtered to Slop Chat messages
 * @param {number} cap
 */
export function writeOfficeImHistory(history, cap) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      OFFICE_IM_HISTORY_STORAGE_KEY,
      JSON.stringify(Array.isArray(history) ? history.slice(-cap) : [])
    );
  } catch {
    // Ignore quota / privacy errors.
  }
}
