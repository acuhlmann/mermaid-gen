/**
 * Office ambience pub/sub store — same hand-rolled useSyncExternalStore
 * pattern as errorToastStore.js. Holds everything the OfficeLayer chrome
 * renders: the email inbox, IM ping stack, active walk-by, coffee-break scene,
 * pending meeting invite, the Focus Time (DND) flag, Soundscape, and Narration
 * (walk-bys + meetings spoken aloud; emails stay silent).
 *
 * The useOfficeAmbience hook is the only producer; components subscribe via
 * useSyncExternalStore(subscribe, getOfficeSnapshot).
 */

import {
  readOfficeFocusTime,
  readOfficeNarrationEnabled,
  readOfficeSoundscapeEnabled,
  writeOfficeFocusTime,
  writeOfficeNarrationEnabled,
  writeOfficeSoundscapeEnabled
} from '../utils/officeAmbienceStorage.js';

export const IM_PING_TTL_MS = 9000;
export const IM_PING_MAX_VISIBLE = 2;
export const WALKBY_TTL_MS = 11_000;

function initialState() {
  return {
    focusTime: readOfficeFocusTime(),
    soundscape: readOfficeSoundscapeEnabled(),
    narration: readOfficeNarrationEnabled(),
    /** @type {Array<{id: string, colleagueId: string, subject: string, body: string, actionPrompt?: string, createdAt: number, read: boolean}>} */
    emails: [],
    unreadCount: 0,
    /** @type {Array<{id: string, colleagueId: string, body: string, createdAt: number}>} */
    imPings: [],
    /** @type {{id: string, colleagueId: string, body: string, actionPrompt?: string, createdAt: number} | null} */
    walkBy: null,
    /** @type {{id: string, lines: Array<{speakerId: string, text: string}>, accepted: boolean, createdAt: number} | null} */
    coffee: null,
    /** @type {{id: string, topic: string, lines: Array<{speakerId: string, text: string}>, verdicts: Record<string, string>, accepted: boolean, votedFor: string | null, createdAt: number} | null} */
    battle: null,
    /** @type {{id: string, colleagueId: string, title: string, body: string, attendees: string[], createdAt: number} | null} */
    meetingInvite: null
  };
}

let state = initialState();
let nextId = 1;
const listeners = new Set();
const expiryTimers = new Map();

function emit() {
  for (const fn of listeners) {
    try {
      fn();
    } catch (err) {
      console.warn('officeMomentStore: listener threw:', err?.message ?? err);
    }
  }
}

function update(patch) {
  state = { ...state, ...patch };
  emit();
}

function makeId(prefix) {
  return `${prefix}-${nextId++}`;
}

function scheduleExpiry(id, ttlMs, expire) {
  if (ttlMs <= 0) return;
  const timer = setTimeout(() => {
    expiryTimers.delete(id);
    expire();
  }, ttlMs);
  expiryTimers.set(id, timer);
}

function clearExpiry(id) {
  const timer = expiryTimers.get(id);
  if (timer != null) {
    clearTimeout(timer);
    expiryTimers.delete(id);
  }
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getOfficeSnapshot() {
  return state;
}

export function setOfficeFocusTime(enabled) {
  writeOfficeFocusTime(Boolean(enabled));
  update({ focusTime: Boolean(enabled) });
}

export function setOfficeSoundscape(enabled) {
  writeOfficeSoundscapeEnabled(Boolean(enabled));
  update({ soundscape: Boolean(enabled) });
}

export function setOfficeNarration(enabled) {
  writeOfficeNarrationEnabled(Boolean(enabled));
  update({ narration: Boolean(enabled) });
}

/** True when any interruptive office surface is currently on screen. */
export function hasActiveOfficeSurface() {
  return Boolean(
    state.walkBy ||
    state.coffee ||
    state.battle ||
    state.meetingInvite ||
    state.imPings.length >= IM_PING_MAX_VISIBLE
  );
}

export function pushOfficeEmail({ colleagueId, subject, body, actionPrompt }) {
  const email = {
    id: makeId('email'),
    colleagueId,
    subject: String(subject ?? '(no subject)'),
    body: String(body ?? ''),
    ...(actionPrompt ? { actionPrompt } : {}),
    createdAt: Date.now(),
    read: false
  };
  const emails = [email, ...state.emails];
  update({ emails, unreadCount: emails.filter((e) => !e.read).length });
  return email.id;
}

export function markOfficeEmailRead(id) {
  const emails = state.emails.map((email) =>
    email.id === id && !email.read ? { ...email, read: true } : email
  );
  update({ emails, unreadCount: emails.filter((e) => !e.read).length });
}

export function markAllOfficeEmailsRead() {
  if (state.unreadCount === 0) return;
  update({ emails: state.emails.map((e) => (e.read ? e : { ...e, read: true })), unreadCount: 0 });
}

export function pushOfficeImPing({ colleagueId, body }) {
  const ping = { id: makeId('im'), colleagueId, body: String(body ?? ''), createdAt: Date.now() };
  const imPings = [...state.imPings, ping].slice(-IM_PING_MAX_VISIBLE);
  update({ imPings });
  scheduleExpiry(ping.id, IM_PING_TTL_MS, () => dismissOfficeImPing(ping.id));
  return ping.id;
}

export function dismissOfficeImPing(id) {
  clearExpiry(id);
  const imPings = state.imPings.filter((ping) => ping.id !== id);
  if (imPings.length === state.imPings.length) return;
  update({ imPings });
}

export function pushOfficeWalkBy({ colleagueId, body, actionPrompt }) {
  if (state.walkBy) clearExpiry(state.walkBy.id);
  const walkBy = {
    id: makeId('walkby'),
    colleagueId,
    body: String(body ?? ''),
    ...(actionPrompt ? { actionPrompt } : {}),
    createdAt: Date.now()
  };
  update({ walkBy });
  scheduleExpiry(walkBy.id, WALKBY_TTL_MS, () => dismissOfficeWalkBy(walkBy.id));
  return walkBy.id;
}

export function dismissOfficeWalkBy(id) {
  if (!state.walkBy || (id != null && state.walkBy.id !== id)) return;
  clearExpiry(state.walkBy.id);
  update({ walkBy: null });
}

export function pushOfficeCoffeeInvite({ lines }) {
  const coffee = {
    id: makeId('coffee'),
    lines: Array.isArray(lines) ? lines : [],
    accepted: false,
    createdAt: Date.now()
  };
  update({ coffee });
  return coffee.id;
}

export function acceptOfficeCoffee() {
  if (!state.coffee || state.coffee.accepted) return;
  update({ coffee: { ...state.coffee, accepted: true } });
}

export function dismissOfficeCoffee() {
  if (!state.coffee) return;
  update({ coffee: null });
}

/**
 * A cubicle battle (docs/office-parody.md): invite pill → arena scene (lines
 * pace in) → the user settles it by voting for a side → the winner's verdict
 * zinger. `votedFor` doubles as the "battle is settled" flag.
 */
export function pushOfficeBattleInvite({ topic, lines, verdicts }) {
  const battle = {
    id: makeId('battle'),
    topic: String(topic ?? ''),
    lines: Array.isArray(lines) ? lines : [],
    verdicts: verdicts && typeof verdicts === 'object' ? verdicts : {},
    accepted: false,
    votedFor: null,
    createdAt: Date.now()
  };
  update({ battle });
  return battle.id;
}

export function acceptOfficeBattle() {
  if (!state.battle || state.battle.accepted) return;
  update({ battle: { ...state.battle, accepted: true } });
}

export function voteOfficeBattle(colleagueId) {
  if (!state.battle || !state.battle.accepted || state.battle.votedFor) return;
  if (typeof colleagueId !== 'string' || !(colleagueId in state.battle.verdicts)) return;
  update({ battle: { ...state.battle, votedFor: colleagueId } });
}

export function dismissOfficeBattle() {
  if (!state.battle) return;
  update({ battle: null });
}

export function pushOfficeMeetingInvite({ colleagueId, title, body, attendees }) {
  const meetingInvite = {
    id: makeId('meeting'),
    colleagueId,
    title: String(title ?? ''),
    body: String(body ?? ''),
    attendees: Array.isArray(attendees) ? attendees : [],
    createdAt: Date.now()
  };
  update({ meetingInvite });
  return meetingInvite.id;
}

export function dismissOfficeMeetingInvite() {
  if (!state.meetingInvite) return;
  update({ meetingInvite: null });
}

export function _resetForTests() {
  for (const timer of expiryTimers.values()) clearTimeout(timer);
  expiryTimers.clear();
  listeners.clear();
  state = initialState();
  nextId = 1;
}
