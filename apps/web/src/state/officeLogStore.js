/**
 * The office log — a rolling record of what happened today, which is the one
 * thing this office has never had.
 *
 * §11 of docs/office-parody.md names it: *"a rolling client-built digest of
 * runs, pitches, meetings, notable moments — what makes six voices one
 * office."* Until now every character spoke from a blank slate, so nobody could
 * refer to the meeting you just sat through or the argument you just settled.
 *
 * **It only records.** Nothing here schedules, triggers, or decides — writing
 * an entry never causes a moment. That is what keeps a memory feature on the
 * right side of ADR-0010: the cast gets a past to talk about, not a reason to
 * act on its own. (An office log that fired a moment when it noticed you had
 * been quiet would be `auto-fix-on-idle` wearing a different hat.)
 *
 * **It is state, not a component.** Presentation-agnostic per ADR-0011 rule 1,
 * so the desk chrome and the isometric floor can both read it — and so the
 * prompt builders can, which is today's only consumer.
 *
 * Same hand-rolled pub/sub as `officeMomentStore.js`; kept beside it rather
 * than inside it because that store is already at its size budget (ADR-0005)
 * and because "what is happening now" and "what has happened" are genuinely
 * different questions with different lifetimes.
 */

import {
  OFFICE_LOG_ENTRY_CAP,
  officeDayStamp,
  readOfficeLog,
  writeOfficeLog
} from '../utils/officeAmbienceStorage.js';
import { buildOfficeLogDigest, buildOfficeRelationship } from '../utils/officeLogDigest.js';

/** @type {Array<{at: number, kind: string, colleagueId?: string, detail?: string}>} */
let entries = readOfficeLog();
/** Calendar day the in-memory entries belong to — cleared when the day rolls over without reload. */
let loadedDay = officeDayStamp();
const listeners = new Set();

function reconcileOfficeDay() {
  const today = officeDayStamp();
  if (today === loadedDay) return;
  entries = [];
  loadedDay = today;
}

function emit() {
  for (const fn of listeners) {
    try {
      fn();
    } catch (err) {
      console.warn('officeLogStore: listener threw:', err?.message ?? err);
    }
  }
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** @returns {Array<{at: number, kind: string, colleagueId?: string, detail?: string}>} */
export function getOfficeLogSnapshot() {
  reconcileOfficeDay();
  return entries;
}

/**
 * Record something that happened.
 *
 * Callers are the surfaces that already know — the office event funnel, the run
 * ceremony, the moment delivery pipeline. None of them gained an observer to
 * feed this; each one already had the fact in hand and now says it out loud.
 *
 * Consecutive duplicates collapse (same kind, same colleague, inside a minute)
 * so a burst of replies in one thread reads as one conversation rather than as
 * eight identical lines eating the digest budget.
 *
 * @param {string} kind see `OFFICE_LOG_KINDS` in officeLogDigest.js
 * @param {{colleagueId?: string, detail?: string, now?: number}} [meta]
 */
export function recordOfficeLogEntry(kind, meta = {}) {
  if (typeof kind !== 'string' || !kind) return;
  const at = Number.isFinite(meta.now) ? meta.now : Date.now();
  reconcileOfficeDay();
  const entry = { at, kind };
  if (meta.colleagueId) entry.colleagueId = String(meta.colleagueId);
  if (meta.detail) entry.detail = String(meta.detail);

  const last = entries[entries.length - 1];
  const isRepeat =
    last && last.kind === kind && last.colleagueId === entry.colleagueId && at - last.at < 60_000;

  entries = isRepeat
    ? [...entries.slice(0, -1), entry]
    : [...entries, entry].slice(-OFFICE_LOG_ENTRY_CAP);
  writeOfficeLog(entries, at);
  emit();
}

/**
 * The log as prompt lines, ready for an office request's `officeLog` field.
 *
 * @returns {string[]}
 */
export function getOfficeLogDigest() {
  reconcileOfficeDay();
  return buildOfficeLogDigest(entries);
}

/**
 * One colleague's own history with the user, from the same entries.
 *
 * A second *projection*, not a second store — which is the point. The log is
 * already the record of who did what with whom; the digest reads it as the
 * office's shared memory and this reads it as one person's. Nothing new is
 * written and nothing new is observed, so the ADR-0010 line holds: still only
 * records.
 *
 * @param {string} colleagueId
 * @returns {string[]}
 */
export function getOfficeRelationshipWith(colleagueId) {
  reconcileOfficeDay();
  return buildOfficeRelationship(entries, colleagueId);
}

/** @internal Reset between tests. */
export function _resetOfficeLogForTests() {
  entries = [];
  loadedDay = officeDayStamp();
  listeners.clear();
}
