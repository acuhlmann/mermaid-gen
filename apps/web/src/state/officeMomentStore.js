/**
 * Office ambience pub/sub store — same hand-rolled useSyncExternalStore
 * pattern as errorToastStore.js. Holds everything the OfficeLayer chrome
 * renders: the email inbox, desk arrival toasts, active walk-by, coffee-break scene,
 * pending meeting invite, the active team huddle, the Focus Time (DND) flag,
 * and the sound flags — Soundscape, Narration (walk-bys + meetings spoken
 * aloud; emails stay silent), and Captions / CC (show spoken dialogue as
 * on-screen text when voice is playing). The desk menu drives those three
 * through one Headphones posture; see setOfficeHeadphones.
 *
 * The useOfficeAmbience hook is the only producer; components subscribe via
 * useSyncExternalStore(subscribe, getOfficeSnapshot).
 */

import {
  readOfficeCaptionsEnabled,
  readOfficeFocusTime,
  readOfficeHeadphones,
  readOfficeNarrationEnabled,
  readOfficeSoundscapeEnabled,
  writeOfficeCaptionsEnabled,
  writeOfficeFocusTime,
  writeOfficeHeadphones,
  writeOfficeNarrationEnabled,
  writeOfficeSoundscapeEnabled
} from '../utils/officeAmbienceStorage.js';

export const DESK_ARRIVAL_TTL_MS = 9000;
export const DESK_ARRIVAL_MAX_VISIBLE = 2;
/** @deprecated Use DESK_ARRIVAL_TTL_MS */
export const IM_PING_TTL_MS = DESK_ARRIVAL_TTL_MS;
/** @deprecated Use DESK_ARRIVAL_MAX_VISIBLE */
export const IM_PING_MAX_VISIBLE = DESK_ARRIVAL_MAX_VISIBLE;
/** Mirrors the server's huddle floor — below this it is a walk-by, not a huddle. */
export const HUDDLE_MIN_SEATS = 2;
/**
 * Slop Chat™ scrollback. Desk arrival toasts expire after DESK_ARRIVAL_TTL_MS and only two
 * show at once, so without a separate log every IM the user didn't catch in
 * nine seconds was gone forever. History is capped rather than unbounded —
 * this is ambience, not a compliance archive.
 */
export const IM_HISTORY_MAX = 60;
export const WALKBY_TTL_MS = 24_000;
/** After the user walks away from a battle, hold off the next invite. */
export const OFFICE_BATTLE_REENTRY_COOLDOWN_MS = 90_000;

function initialState() {
  return {
    focusTime: readOfficeFocusTime(),
    /**
     * Headphones posture — the desk menu's single sound control. A macro over
     * the three flags below, never read by a consumer directly.
     */
    headphones: readOfficeHeadphones(),
    soundscape: readOfficeSoundscapeEnabled(),
    narration: readOfficeNarrationEnabled(),
    /** Opt-in CC for spoken lines (arrival + floor bubbles). */
    captions: readOfficeCaptionsEnabled(),
    /** @type {Array<{id: string, colleagueId: string, subject: string, body: string, actionPrompt?: string, createdAt: number, read: boolean}>} */
    emails: [],
    unreadCount: 0,
    /** Transient desk-side arrival toasts — TTL-expired, max DESK_ARRIVAL_MAX_VISIBLE.
     * @type {Array<{id: string, kind: 'email' | 'im', colleagueId: string, subject?: string, createdAt: number}>} */
    deskArrivals: [],
    /** Durable scrollback for the messenger, oldest first. Never TTL-expired.
     * @type {Array<{id: string, colleagueId: string, body: string, createdAt: number, outbound?: boolean, read: boolean}>} */
    imHistory: [],
    imUnreadCount: 0,
    /** @type {{id: string, colleagueId: string, body: string, actionPrompt?: string, createdAt: number} | null} */
    walkBy: null,
    /** @type {{id: string, lines: Array<{speakerId: string, text: string}>, accepted: boolean, createdAt: number} | null} */
    coffee: null,
    /** @type {{id: string, topic: string, lines: Array<{speakerId: string, text: string}>, verdicts: Record<string, string>, accepted: boolean, votedFor: string | null, createdAt: number} | null} */
    battle: null,
    /** @type {{id: string, colleagueId: string, title: string, body: string, attendees: string[], createdAt: number} | null} */
    meetingInvite: null,
    /**
     * Team huddle — everyone crowds the canvas and speaks in turn. Presentation-
     * agnostic on purpose (ADR-0011 rule 1): the desk overlay is renderer #1 and
     * a floor version can read this same slice without forking state.
     * `watching` freezes turn-taking while a teammate runs a delegated "Do it"
     * (notebook open, faces stay seated) and flips back to `speaking` when done.
     * `suggestions` holds on-spot pin-able remarks that are not in the spoken queue.
     * @type {{id: string, attendees: string[], beats: Array<{speakerId: string, text: string, actionPrompt?: string}>, suggestions?: Record<string, {speakerId: string, text: string, actionPrompt?: string}>, phase: 'gathering' | 'speaking' | 'watching', createdAt: number} | null}
     */
    huddle: null
  };
}

let state = initialState();
let nextId = 1;
let battleReentryBlockedUntil = 0;
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

export function setOfficeCaptions(enabled) {
  writeOfficeCaptionsEnabled(Boolean(enabled));
  update({ captions: Boolean(enabled) });
}

/**
 * The one sound control in the desk menu, replacing the old Voice / Noise / CC
 * checkboxes. Headphones ON is the read-first posture (office silent, captions
 * on); OFF is sound-first (voice + room tone, no duplicate text).
 *
 * Deliberately a *macro* over the three existing flags rather than a fifth flag
 * to thread through the app: every consumer (room tone, soundscape, narration,
 * shouldShowSpokenText) keeps reading exactly what it read before. Per-scene CC
 * buttons on the floor still nudge `captions` on their own — headphones sets the
 * posture, it does not own captions forever.
 */
export function setOfficeHeadphones(enabled) {
  const on = Boolean(enabled);
  writeOfficeHeadphones(on);
  writeOfficeNarrationEnabled(!on);
  writeOfficeSoundscapeEnabled(!on);
  writeOfficeCaptionsEnabled(on);
  update({ headphones: on, narration: !on, soundscape: !on, captions: on });
}

/** True when any interruptive office surface is currently on screen. */
export function hasActiveOfficeSurface() {
  return Boolean(
    state.walkBy ||
    state.coffee ||
    state.battle ||
    state.meetingInvite ||
    state.huddle ||
    state.deskArrivals.some((arrival) => arrival.kind === 'im')
  );
}

/**
 * True when the ambient director (timer + run reactions + welcome) should hold
 * fire. Only active surfaces count — a walk-by on screen, a coffee invite, an
 * IM toast, etc. Unread inbox / Slop Chat backlog must not block the office
 * forever; cadence gaps (`lastFiredAt` in officeCadence.js) already stagger
 * moments so they do not pile on in the same breath.
 */
export function shouldHoldAmbientOfficeMoments() {
  return hasActiveOfficeSurface();
}

/**
 * Seat the huddle before a single word exists. The overlay draws the ring from
 * `attendees` during 'gathering', so the arrival animation runs while the LLM
 * is still writing — the crowd is the feedback that the click landed.
 */
export function startOfficeHuddle(attendees) {
  const seats = Array.isArray(attendees) ? attendees.filter(Boolean) : [];
  // Two is the floor the server enforces too — one person leaning in is a
  // walk-by, and seating a lone face would flash a ring that cannot be scripted.
  if (seats.length < HUDDLE_MIN_SEATS) return null;
  const huddle = {
    id: makeId('huddle'),
    attendees: seats,
    beats: [],
    /** @type {Record<string, {speakerId: string, text: string, actionPrompt?: string}>} */
    suggestions: {},
    phase: /** @type {'gathering'} */ ('gathering'),
    /** 0-based index of the line currently being spoken (drives diagram refresh). */
    activeLineIndex: 0,
    /** Snapshot of diagram source when beats last matched the canvas. */
    diagramFingerprint: '',
    createdAt: Date.now()
  };
  update({ huddle });
  return huddle.id;
}

/** Script landed — the ring starts talking. Ignored once the huddle is gone. */
export function setOfficeHuddleBeats(id, beats, { diagramFingerprint = '' } = {}) {
  if (!state.huddle || state.huddle.id !== id) return;
  const next = Array.isArray(beats) ? beats : [];
  // Don't yank out of watching if a late script races a Do-it handoff.
  const phase = state.huddle.phase === 'watching' ? 'watching' : 'speaking';
  update({
    huddle: {
      ...state.huddle,
      beats: next,
      phase,
      activeLineIndex: 0,
      diagramFingerprint: typeof diagramFingerprint === 'string' ? diagramFingerprint : ''
    }
  });
}

/** Track which remark is live so diagram refreshes keep already-spoken lines. */
export function setOfficeHuddleActiveLineIndex(id, index) {
  if (!state.huddle || state.huddle.id !== id) return;
  const next = Number.isFinite(Number(index)) ? Math.max(0, Math.floor(Number(index))) : 0;
  if (state.huddle.activeLineIndex === next) return;
  update({ huddle: { ...state.huddle, activeLineIndex: next } });
}

/**
 * Replace unspoken beats when the canvas changes mid-huddle. Keeps remarks at
 * indices below `fromIndex` intact.
 *
 * @param {string} id
 * @param {number} fromIndex
 * @param {Array<{speakerId: string, text: string, actionPrompt?: string}>} newBeats
 * @param {string} diagramFingerprint
 */
export function refreshOfficeHuddleBeats(id, fromIndex, newBeats, diagramFingerprint) {
  if (!state.huddle || state.huddle.id !== id) return;
  const keep = Math.max(0, Math.floor(Number(fromIndex) || 0));
  const existing = state.huddle.beats ?? [];
  const tail = Array.isArray(newBeats) ? newBeats : [];
  const beats = [...existing.slice(0, keep), ...tail];
  update({
    huddle: {
      ...state.huddle,
      beats,
      diagramFingerprint: typeof diagramFingerprint === 'string' ? diagramFingerprint : '',
      suggestions: {}
    }
  });
}

/**
 * Upsert one teammate's remark. Scripted beats (`pacing: true`, default) stay in
 * `beats` and drive turn-taking. On-spot click suggestions use `pacing: false`
 * so they land in `suggestions` — pin-able without restarting the spoken queue.
 *
 * @param {string} id
 * @param {{speakerId: string, text: string, actionPrompt?: string}} beat
 * @param {{ pacing?: boolean }} [opts]
 */
export function upsertOfficeHuddleBeat(id, beat, opts = {}) {
  if (!state.huddle || state.huddle.id !== id) return;
  if (!beat?.speakerId || typeof beat.text !== 'string' || !beat.text.trim()) return;
  const speakerId = beat.speakerId;
  const nextBeat = {
    speakerId,
    text: beat.text.trim(),
    ...(beat.actionPrompt ? { actionPrompt: String(beat.actionPrompt) } : {})
  };
  const pacing = opts.pacing !== false;
  if (pacing) {
    const existing = state.huddle.beats ?? [];
    const index = existing.findIndex((b) => b.speakerId === speakerId);
    const beats =
      index >= 0 ? existing.map((b, i) => (i === index ? nextBeat : b)) : [...existing, nextBeat];
    update({ huddle: { ...state.huddle, beats } });
    return;
  }
  const suggestions = { ...(state.huddle.suggestions ?? {}), [speakerId]: nextBeat };
  update({ huddle: { ...state.huddle, suggestions } });
}

/** Freeze turn-taking while a delegated Do-it runs — faces stay in the ring. */
export function pauseOfficeHuddleForWatching(id = null) {
  if (!state.huddle) return;
  if (id && state.huddle.id !== id) return;
  if (state.huddle.phase === 'watching') return;
  update({ huddle: { ...state.huddle, phase: 'watching' } });
}

/** Resume turn-taking after the notebook run finishes. */
export function resumeOfficeHuddleSpeaking(id = null) {
  if (!state.huddle) return;
  if (id && state.huddle.id !== id) return;
  if (state.huddle.phase !== 'watching') return;
  update({ huddle: { ...state.huddle, phase: 'speaking' } });
}

/** Hard stop, last line spoken, or a failed fetch — all end the same way. */
export function endOfficeHuddle(id = null) {
  if (!state.huddle) return;
  if (id && state.huddle.id !== id) return;
  update({ huddle: null });
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
  pushDeskArrival({ kind: 'email', colleagueId, subject: email.subject });
  return email.id;
}

function pushDeskArrival({ kind, colleagueId, subject }) {
  const arrival = {
    id: makeId('arrival'),
    kind,
    colleagueId,
    ...(subject ? { subject: String(subject) } : {}),
    createdAt: Date.now()
  };
  const deskArrivals = [...state.deskArrivals, arrival].slice(-DESK_ARRIVAL_MAX_VISIBLE);
  update({ deskArrivals });
  scheduleExpiry(arrival.id, DESK_ARRIVAL_TTL_MS, () => dismissDeskArrival(arrival.id));
  return arrival.id;
}

export function dismissDeskArrival(id) {
  clearExpiry(id);
  const deskArrivals = state.deskArrivals.filter((arrival) => arrival.id !== id);
  if (deskArrivals.length === state.deskArrivals.length) return;
  update({ deskArrivals });
}

/** Clears transient desk arrival toasts without touching inbox or chat history. */
export function clearDeskArrivals() {
  for (const arrival of state.deskArrivals) clearExpiry(arrival.id);
  if (state.deskArrivals.length === 0) return;
  update({ deskArrivals: [] });
}

/** @deprecated Use dismissDeskArrival */
export const dismissOfficeImPing = dismissDeskArrival;

/** @deprecated Use clearDeskArrivals */
export const clearOfficeImPings = clearDeskArrivals;

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

/**
 * A new IM lands in two places: a transient desk arrival (expires) and the
 * durable history (does not). Dismissing or expiring an arrival must NOT touch
 * history — that separation is the whole point of the messenger.
 */
export function pushOfficeImPing({ colleagueId, body }) {
  const ping = { id: makeId('im'), colleagueId, body: String(body ?? ''), createdAt: Date.now() };
  const imHistory = [...state.imHistory, { ...ping, read: false }].slice(-IM_HISTORY_MAX);
  update({ imHistory, imUnreadCount: countUnreadIms(imHistory) });
  pushDeskArrival({ kind: 'im', colleagueId });
  return ping.id;
}

function countUnreadIms(history) {
  return history.reduce((total, msg) => (msg.read || msg.outbound ? total : total + 1), 0);
}

/** Records the user's side of the conversation (quick replies + composer). */
export function pushOfficeImReply({ colleagueId, body }) {
  const text = String(body ?? '').trim();
  if (!text) return null;
  const message = {
    id: makeId('im'),
    colleagueId,
    body: text,
    createdAt: Date.now(),
    outbound: true,
    read: true
  };
  const imHistory = [...state.imHistory, message].slice(-IM_HISTORY_MAX);
  update({ imHistory });
  return message.id;
}

/** Marks a colleague's thread read; omit the id to clear the whole log. */
export function markOfficeImsRead(colleagueId) {
  const imHistory = state.imHistory.map((msg) =>
    !msg.read && (!colleagueId || msg.colleagueId === colleagueId) ? { ...msg, read: true } : msg
  );
  const imUnreadCount = countUnreadIms(imHistory);
  if (imUnreadCount === state.imUnreadCount) return;
  update({ imHistory, imUnreadCount });
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

export function canOfferOfficeBattle(now = Date.now()) {
  return !state.battle && now >= battleReentryBlockedUntil;
}

/**
 * A cubicle battle (docs/office-parody.md): invite pill → arena scene (lines
 * pace in) → the user settles it by voting for a side → the winner's verdict
 * zinger. `votedFor` doubles as the "battle is settled" flag.
 */
export function pushOfficeBattleInvite({ topic, lines, verdicts }) {
  if (!canOfferOfficeBattle()) return null;
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
  battleReentryBlockedUntil = Date.now() + OFFICE_BATTLE_REENTRY_COOLDOWN_MS;
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
  battleReentryBlockedUntil = 0;
}
