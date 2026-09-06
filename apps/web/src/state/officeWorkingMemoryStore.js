/**
 * Per-colleague working memory for this office day
 * (docs/office-continuity.md, ADR-0013).
 *
 * Not the office log (shared, lossy, 12 lines). Not `buildOfficeRelationship`
 * (counts and recency only). Those stay. This is what makes a second approach
 * the same day not a first meeting: the last few beats between you and them,
 * plus the last board fingerprint they "saw".
 *
 * **It only records.** Nothing here schedules, triggers, or decides — writing
 * a beat never causes a moment. That is ADR-0010: the cast gets a past to
 * talk about, not a reason to act on its own. Cadence and ambience must not
 * import this module as a trigger.
 *
 * **It is state, not a component.** Presentation-agnostic per ADR-0011 rule 1,
 * so the desk and the isometric floor can both read it.
 *
 * Fingerprint writers are deliberately few: the run-reaction speaker, plus
 * anyone the user later dwells or talks with. Stamping everyone on a
 * board-sample edge would be omniscience.
 */

import {
  OFFICE_WORKING_MEMORY_BEAT_CAP,
  normalizeWorkingMemoryBeat,
  officeDayStamp,
  readOfficeWorkingMemory,
  writeOfficeWorkingMemory
} from '../utils/officeAmbienceStorage.js';

/**
 * What each interruption reads like to the model.
 *
 * The phrasing lives here beside `you said:` / `they said:` rather than in the
 * floor, because the beat carries the *fact* and this function owns every
 * sentence in the prompt — the same split `pitchTaken` already uses. Both
 * entries state the circumstance and stop: naming a consequence the prompt does
 * not otherwise carry is how a moment ends up fabricating one (the situation
 * rule in `docs/agents/domains/office.md`).
 */
const INTERRUPTION_PROMPT_LINES = Object.freeze({
  gotIt: 'you took the spot they were using; they had finished and stepped aside',
  gaveUp: 'you got in the way of their errand; they went back to their desk empty-handed'
});

/** @typedef {{ at: number, theirs?: string, yours?: string, pitchTaken?: boolean, interrupted?: 'gotIt' | 'gaveUp' }} WorkingMemoryBeat */
/** @typedef {{ beats: WorkingMemoryBeat[], boardFingerprint?: string }} WorkingMemoryRow */

/** @type {{ [colleagueId: string]: WorkingMemoryRow }} */
let byColleague = readOfficeWorkingMemory();
/** Calendar day the in-memory rows belong to — cleared when the day rolls over without reload. */
let loadedDay = officeDayStamp();
const listeners = new Set();

function reconcileOfficeDay() {
  const today = officeDayStamp();
  if (today === loadedDay) return;
  byColleague = {};
  loadedDay = today;
}

function emit() {
  for (const fn of listeners) {
    try {
      fn();
    } catch (err) {
      console.warn('officeWorkingMemoryStore: listener threw:', err?.message ?? err);
    }
  }
}

function persist(now) {
  reconcileOfficeDay();
  writeOfficeWorkingMemory(byColleague, now);
  emit();
}

function rowFor(colleagueId) {
  reconcileOfficeDay();
  const existing = byColleague[colleagueId];
  if (existing) return existing;
  const created = { beats: [] };
  byColleague = { ...byColleague, [colleagueId]: created };
  return created;
}

/**
 * Compact fingerprint of the board as it stands — content type, a handful of
 * labels, source length. Display-only `boardFrom()` is the wrong input: that
 * is what the room draws, not what this colleague noticed.
 *
 * @param {{ contentType?: string, labels?: string[], diagramSource?: string }} ctx
 * @returns {string}
 */
export function boardFingerprintOf(ctx = {}) {
  const type = typeof ctx.contentType === 'string' && ctx.contentType ? ctx.contentType : 'mermaid';
  const labels = Array.isArray(ctx.labels)
    ? ctx.labels
        .filter((label) => typeof label === 'string' && label.trim())
        .slice(0, 8)
        .join('|')
    : '';
  const len = typeof ctx.diagramSource === 'string' ? ctx.diagramSource.length : 0;
  return `${type}:${labels}:${len}`;
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * @param {string} colleagueId
 * @returns {WorkingMemoryRow | null}
 */
export function getWorkingMemoryWith(colleagueId) {
  reconcileOfficeDay();
  if (!colleagueId) return null;
  return byColleague[colleagueId] ?? null;
}

/**
 * True when this colleague has anything from today worth noticing — a beat or
 * a board they already saw. The dwell LLM gate spends its cap only then.
 *
 * @param {string} colleagueId
 * @returns {boolean}
 */
export function hasWorkingMemoryFact(colleagueId) {
  const row = getWorkingMemoryWith(colleagueId);
  if (!row) return false;
  return row.beats.length > 0 || Boolean(row.boardFingerprint);
}

/**
 * Colleague ids that already have memory today, most-recent beat first so the
 * run-reaction picker prefers someone you have already dealt with.
 *
 * @returns {string[]}
 */
export function listWorkingMemoryColleagueIds() {
  reconcileOfficeDay();
  return Object.entries(byColleague)
    .filter(([, row]) => row.beats.length > 0 || row.boardFingerprint)
    .sort((a, b) => {
      const lastA = a[1].beats.at(-1)?.at ?? 0;
      const lastB = b[1].beats.at(-1)?.at ?? 0;
      return lastB - lastA;
    })
    .map(([id]) => id);
}

/**
 * @param {string} colleagueId
 * @param {{ theirs?: string, yours?: string, pitchTaken?: boolean,
 *   interrupted?: 'gotIt' | 'gaveUp', now?: number }} beat
 *   `interrupted` is the one beat field that is not something either of you
 *   said: you walked into their errand and it ended because of you. It is still
 *   only a record — writing it schedules nothing (ADR-0010) — but it is what
 *   makes `hasWorkingMemoryFact` true for somebody you have never spoken to,
 *   which is the whole point: the next time you stand next to them, the office
 *   has something to say instead of a deck to deal from.
 */
export function rememberWorkingMemoryBeat(colleagueId, beat = {}) {
  if (typeof colleagueId !== 'string' || !colleagueId) return;
  const at = Number.isFinite(beat.now) ? beat.now : Date.now();
  // Shared with the read-back sanitizer on purpose: a field one of them knows
  // and the other does not is a memory that survives until the next reload.
  const next = normalizeWorkingMemoryBeat(beat, at);
  if (!next) return;

  const current = rowFor(colleagueId);
  const row = {
    ...current,
    beats: [...current.beats, next].slice(-OFFICE_WORKING_MEMORY_BEAT_CAP)
  };
  byColleague = { ...byColleague, [colleagueId]: row };
  persist(at);
}

/**
 * @param {string} colleagueId
 * @param {string} fingerprint
 * @param {number} [now]
 */
export function stampWorkingMemoryBoard(colleagueId, fingerprint, now = Date.now()) {
  if (typeof colleagueId !== 'string' || !colleagueId) return;
  if (typeof fingerprint !== 'string' || !fingerprint.trim()) return;
  const current = rowFor(colleagueId);
  const row = {
    ...current,
    beats: [...current.beats],
    boardFingerprint: fingerprint.trim().slice(0, 240)
  };
  byColleague = { ...byColleague, [colleagueId]: row };
  persist(now);
}

/**
 * @param {string} colleagueId
 * @param {number} [now]
 */
export function markWorkingMemoryPitchTaken(colleagueId, now = Date.now()) {
  rememberWorkingMemoryBeat(colleagueId, { pitchTaken: true, now });
}

/**
 * Prompt lines for `/moment`'s `officeWorkingMemory` field. Empty when there
 * is nothing, so the server drops the heading rather than announcing an absence.
 *
 * @param {string} colleagueId
 * @returns {string[]}
 */
export function workingMemoryPromptLines(colleagueId) {
  const row = getWorkingMemoryWith(colleagueId);
  if (!row) return [];
  const lines = [];
  if (row.boardFingerprint) {
    lines.push(`last board they noticed: ${row.boardFingerprint}`);
  }
  for (const beat of row.beats) {
    /*
     * Before the quote, not after it: the interruption is what *you* did, and a
     * line they said about it reads as a non-sequitur ahead of the thing it is
     * about. Same reason `yours` precedes `theirs`.
     */
    if (beat.interrupted) lines.push(INTERRUPTION_PROMPT_LINES[beat.interrupted]);
    if (beat.yours) lines.push(`you said: ${beat.yours}`);
    if (beat.theirs) lines.push(`they said: ${beat.theirs}`);
    if (beat.pitchTaken) lines.push('you took their suggestion earlier');
  }
  return lines.slice(-6);
}

/** @internal Reset between tests. */
export function _resetOfficeWorkingMemoryForTests() {
  byColleague = {};
  loadedDay = officeDayStamp();
  listeners.clear();
}
