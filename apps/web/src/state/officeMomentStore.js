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
  readOfficeFocusTime,
  readOfficeImHistory,
  reconcileOfficeHeadphonesPosture,
  writeOfficeCaptionsEnabled,
  writeOfficeFocusTime,
  writeOfficeHeadphones,
  writeOfficeImHistory,
  writeOfficeNarrationEnabled,
  writeOfficeSoundscapeEnabled
} from '../utils/officeAmbienceStorage.js';
import { isSlopChatMessage } from '../utils/officeImThreads.js';
import { recordOfficeLogEntry } from './officeLogStore.js';

export const DESK_ARRIVAL_TTL_MS = 9000;
export const DESK_ARRIVAL_MAX_VISIBLE = 2;
/** @deprecated Use DESK_ARRIVAL_TTL_MS */
export const IM_PING_TTL_MS = DESK_ARRIVAL_TTL_MS;
/** @deprecated Use DESK_ARRIVAL_MAX_VISIBLE */
export const IM_PING_MAX_VISIBLE = DESK_ARRIVAL_MAX_VISIBLE;
/** Mirrors the server's huddle floor — below this it is a walk-by, not a huddle. */
export const HUDDLE_MIN_SEATS = 2;
/**
 * A pair is exactly one chair pulled up next to you. Not "at least one": a
 * two-person pair is a small mob, which is a different scene with a different
 * script (one remark each, then everyone leaves) — see `startOfficeHuddle`.
 */
export const PAIR_SEATS = 1;
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

/**
 * Scrollback restored from the last visit (see `readOfficeImHistory`). Read
 * once, at module load, so `initialState` and the id counter below agree on
 * exactly one array.
 */
const restoredImHistory = readOfficeImHistory(IM_HISTORY_MAX);

/**
 * Ids are `im-1`, `im-2`, … from a counter that resets every load, so a
 * restored thread would collide with the first new message of the session and
 * hand React two children with the same key. Resume the counter past whatever
 * came back instead.
 *
 * @param {Array<{id?: string}>} history
 * @returns {number}
 */
function highestIdSuffix(history) {
  let highest = 0;
  for (const msg of history) {
    const suffix = Number.parseInt(
      String(msg?.id ?? '')
        .split('-')
        .pop() ?? '',
      10
    );
    if (Number.isFinite(suffix) && suffix > highest) highest = suffix;
  }
  return highest;
}

/**
 * @param {Array<object>} [imHistory] scrollback to open with. Defaults to what
 *   the last visit left behind; `_resetForTests` passes an empty array so a
 *   test starts from a clean office rather than from whatever the module
 *   happened to read at import time.
 */
function initialState(imHistory = restoredImHistory) {
  const posture = reconcileOfficeHeadphonesPosture();
  return {
    focusTime: readOfficeFocusTime(),
    /**
     * Headphones posture — the desk menu's single sound control. A macro over
     * the three flags below, never read by a consumer directly. Boot runs
     * `reconcileOfficeHeadphonesPosture` so a stale narration key cannot leave
     * the menu saying "off" while the office stays silent.
     */
    headphones: posture.headphones,
    soundscape: posture.soundscape,
    narration: posture.narration,
    /** Opt-in CC for spoken lines (arrival + floor bubbles). */
    captions: posture.captions,
    /** @type {Array<{id: string, colleagueId: string, subject: string, body: string, actionPrompt?: string, createdAt: number, read: boolean}>} */
    emails: [],
    unreadCount: 0,
    /** Transient desk-side arrival toasts — TTL-expired, max DESK_ARRIVAL_MAX_VISIBLE.
     * @type {Array<{id: string, kind: 'email' | 'im', colleagueId: string, subject?: string, createdAt: number}>} */
    deskArrivals: [],
    /** Durable scrollback for the messenger, oldest first. Never TTL-expired.
     * @type {Array<{id: string, colleagueId: string, body: string, channel?: string, actionPrompt?: string, createdAt: number, outbound?: boolean, read: boolean}>} */
    imHistory,
    imUnreadCount: countUnreadIms(imHistory),
    /** @type {{id: string, colleagueId: string, body: string, actionPrompt?: string, createdAt: number} | null} */
    walkBy: null,
    /** @type {{id: string, lines: Array<{speakerId: string, text: string}>, accepted: boolean, createdAt: number} | null} */
    coffee: null,
    /** @type {{id: string, topic: string, lines: Array<{speakerId: string, text: string}>, verdicts: Record<string, string>, accepted: boolean, votedFor: string | null, createdAt: number} | null} */
    battle: null,
    /** @type {{id: string, colleagueId: string, title: string, body: string, attendees: string[], createdAt: number} | null} */
    meetingInvite: null,
    /**
     * The gathered-around-your-screen slice, in two modes. Presentation-agnostic
     * on purpose (ADR-0011 rule 1): the desk overlay is renderer #1 and a floor
     * version can read this same slice without forking state.
     *
     * `mode: 'mob'` is the whole team crowding the canvas — one remark each, in
     * turn, and it ends itself when the last one lands. `mode: 'pair'` is one
     * teammate in the chair next to you with a train of thought, and it does
     * **not** end itself: somebody sitting with you does not evaporate because
     * they finished a sentence. Two acts, one slice, because what they share
     * (seated faces, paced remarks, a Do-it, pausing for a delegated run) is
     * everything except how many people and how it ends.
     *
     * `watching` freezes turn-taking while a teammate runs a delegated "Do it"
     * (notebook open, faces stay seated) and flips back to `speaking` when done.
     * `suggestions` holds on-spot pin-able remarks that are not in the spoken queue.
     * @type {{id: string, mode: 'mob' | 'pair', attendees: string[], beats: Array<{speakerId: string, text: string, actionPrompt?: string}>, suggestions?: Record<string, {speakerId: string, text: string, actionPrompt?: string}>, phase: 'gathering' | 'speaking' | 'watching', createdAt: number} | null}
     */
    huddle: null,
    /**
     * A soft errand — somebody asked you to go and speak to somebody else
     * (docs/office-isometric-mode.md § 5 slice 26).
     *
     * The one moment in this store with **no timer of any kind**: no TTL, no
     * reminder, no second ask. ADR-0010 consequence #4 rules out the shape
     * where an office task nags — an errand that chased you would be
     * `auto-fix-on-idle` in a lanyard. It is raised by a button you pressed,
     * it waits, and it ends when you speak to the person or drop it.
     *
     * Single occupancy, like `walkBy` and for the same reason: two open
     * errands is a quest log, and the entry that chose this slice ruled a quest
     * log out by name.
     * @type {{id: string, fromId: string, colleagueId: string, createdAt: number} | null}
     */
    errand: null
  };
}

let state = initialState();
let nextId = highestIdSuffix(restoredImHistory) + 1;
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

/**
 * True when any interruptive office surface is currently on screen.
 *
 * `errand` is deliberately absent, and it is the one slice where leaving it out
 * needs saying. An errand is a *standing* fact rather than a surface with your
 * attention — it has no timer, so it can sit open for the rest of the session,
 * and counting it here would hold the entire ambient office silent until you
 * ran it. That is the difference between something interrupting you and
 * something waiting for you.
 */
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
 * Seat the scene before a single word exists. The overlay draws the ring from
 * `attendees` during 'gathering', so the arrival animation runs while the LLM
 * is still writing — the crowd (or the one chair) is the feedback that the
 * click landed.
 *
 * @param {string[]} attendees
 * @param {{ mode?: 'mob' | 'pair' }} [opts]
 */
export function startOfficeHuddle(attendees, { mode = 'mob' } = {}) {
  const seats = Array.isArray(attendees) ? attendees.filter(Boolean) : [];
  const pairing = mode === 'pair';
  // Two is the floor the server enforces too — one person leaning in is a
  // walk-by, and seating a lone face would flash a ring that cannot be scripted.
  // Pairing is the deliberate exception: it asks for a script written for one
  // voice, so the lone face has something to say.
  if (pairing ? seats.length !== PAIR_SEATS : seats.length < HUDDLE_MIN_SEATS) return null;
  const huddle = {
    id: makeId('huddle'),
    mode: pairing ? 'pair' : 'mob',
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

/**
 * @param {{
 *   colleagueId: string,
 *   subject?: string,
 *   body?: string,
 *   actionPrompt?: string,
 *   training?: number,
 *   phishing?: boolean,
 *   errand?: string
 * }} email
 *   `training` (a module number), `phishing` and `errand` (the cast id you are
 *   being sent to see) are inert markers that let the inbox render an extra
 *   affordance — Linda's "Begin Module N", Sasha's too-good-to-be-true link,
 *   Linda's "go and find Chad". They are offers, never actions: nothing happens
 *   until the human clicks, which is ADR-0010's whole line. Same shape as the
 *   existing `actionPrompt`, which is likewise inert text until Do-it.
 *
 *   `errand` in particular is a marker and **not** the errand: arriving mail
 *   does not put a task on you. Pressing the button it grows is what calls
 *   `pushOfficeErrand`, so an errand you never read cannot exist.
 */
export function pushOfficeEmail({
  colleagueId,
  subject,
  body,
  actionPrompt,
  training,
  phishing,
  errand
}) {
  const email = {
    id: makeId('email'),
    colleagueId,
    subject: String(subject ?? '(no subject)'),
    body: String(body ?? ''),
    ...(actionPrompt ? { actionPrompt } : {}),
    ...(Number.isFinite(training) ? { training } : {}),
    ...(phishing ? { phishing: true } : {}),
    ...(errand ? { errand: String(errand) } : {}),
    createdAt: Date.now(),
    read: false
  };
  const emails = [email, ...state.emails];
  update({ emails, unreadCount: emails.filter((e) => !e.read).length });
  recordOfficeLogEntry('email', { colleagueId, detail: email.subject });
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
 *
 * `channel` marks *how the line was said*, not where it renders — it stays
 * renderer-agnostic (ADR-0011 rule 1), and both renderers read it. `'talk'` is
 * the out-loud/turn-to-someone channel: it answers as speech at your desk
 * (`OfficeDeskSpeech`) or as a bubble over their head on the floor, so it
 * deliberately skips the arrival toast — an answer to something you just said
 * is not a notification that someone messaged you. It also stays out of Slop
 * Chat unread / threads: physical speech is not a typed IM.
 *
 * `actionPrompt` is an optional **pitch**: a concrete diagram edit the speaker
 * proposed while saying this. Emails and walk-bys have carried one since the
 * beginning; IMs did not, which quietly made the talk channel the one place a
 * colleague could have an idea and no way to hand it over. Storing it does not
 * weaken ADR-0010 — a pitch is still inert text until the user presses the
 * button a renderer puts under it.
 */
export function pushOfficeImPing({ colleagueId, body, channel = 'im', actionPrompt }) {
  const talk = channel === 'talk';
  const ping = {
    id: makeId('im'),
    colleagueId,
    body: String(body ?? ''),
    ...(channel && channel !== 'im' ? { channel } : {}),
    ...(actionPrompt ? { actionPrompt: String(actionPrompt) } : {}),
    createdAt: Date.now()
  };
  const imHistory = [...state.imHistory, { ...ping, read: talk }].slice(-IM_HISTORY_MAX);
  update({ imHistory, imUnreadCount: countUnreadIms(imHistory) });
  persistImHistory(imHistory);
  recordOfficeLogEntry('chat', { colleagueId });
  if (!talk) pushDeskArrival({ kind: 'im', colleagueId });
  return ping.id;
}

/**
 * Keep the scrollback across a reload. Only Slop Chat lines are stored —
 * `talk` is speech, and `readOfficeImHistory` explains why speech should not
 * come back.
 *
 * @param {Array<object>} history
 */
function persistImHistory(history) {
  writeOfficeImHistory(history.filter(isSlopChatMessage), IM_HISTORY_MAX);
}

function countUnreadIms(history) {
  return history.reduce((total, msg) => {
    if (!isSlopChatMessage(msg) || msg.read || msg.outbound) return total;
    return total + 1;
  }, 0);
}

/** Records the user's side of the conversation (quick replies + composer). */
export function pushOfficeImReply({ colleagueId, body, channel = 'im' }) {
  const text = String(body ?? '').trim();
  if (!text) return null;
  const message = {
    id: makeId('im'),
    colleagueId,
    body: text,
    ...(channel && channel !== 'im' ? { channel } : {}),
    createdAt: Date.now(),
    outbound: true,
    read: true
  };
  const imHistory = [...state.imHistory, message].slice(-IM_HISTORY_MAX);
  update({ imHistory });
  persistImHistory(imHistory);
  return message.id;
}

/** Marks a colleague's thread read; omit the id to clear the whole log. */
export function markOfficeImsRead(colleagueId) {
  const imHistory = state.imHistory.map((msg) =>
    !msg.read && (!colleagueId || msg.colleagueId === colleagueId) ? { ...msg, read: true } : msg
  );
  const imUnreadCount = countUnreadIms(imHistory);
  // Unchanged count means no message flipped: the map only ever turns unread
  // into read, so a drop is the only way the count can move.
  if (imUnreadCount === state.imUnreadCount) return;
  update({ imHistory, imUnreadCount });
  persistImHistory(imHistory);
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
  // Who came by, never what they said: a walk-by line quoted into the digest
  // comes back word-for-word next time (the lesson §2 of the character recipe
  // learned the hard way). The office remembers the visit, not the script.
  recordOfficeLogEntry('walkby', { colleagueId });
  update({ walkBy });
  scheduleExpiry(walkBy.id, WALKBY_TTL_MS, () => dismissOfficeWalkBy(walkBy.id));
  return walkBy.id;
}

export function dismissOfficeWalkBy(id) {
  if (!state.walkBy || (id != null && state.walkBy.id !== id)) return;
  clearExpiry(state.walkBy.id);
  update({ walkBy: null });
}

/**
 * Take on a soft errand: `fromId` has asked you to go and speak to
 * `colleagueId` (§ 5 slice 26).
 *
 * **Nothing is scheduled here and nothing may be.** The three lines below are
 * the whole lifecycle — raised by a press, settled by a sentence, dropped by a
 * press — and the absence of a `scheduleExpiry` call is the feature, not an
 * omission somebody should tidy up later. ADR-0010 consequence #4 names the
 * failure mode this avoids: an office task that fires on its own is the
 * retracted commission machinery wearing a lanyard.
 *
 * Rejects an errand to nobody and an errand to the asker, which are the two
 * ways a bad marker in a copy bank could produce a card offering to walk you
 * to yourself.
 *
 * @param {{ fromId: string, colleagueId: string }} errand
 * @returns {string | null} the new errand's id, or null when it was refused
 */
export function pushOfficeErrand({ fromId, colleagueId }) {
  if (!colleagueId || !fromId || colleagueId === fromId) return null;
  const errand = {
    id: makeId('errand'),
    fromId: String(fromId),
    colleagueId: String(colleagueId),
    createdAt: Date.now()
  };
  update({ errand });
  return errand.id;
}

/**
 * You said something to somebody; if that is who you were sent to see, the
 * errand is discharged.
 *
 * Returns the errand it settled — truthy is how the caller knows to spend an XP
 * beat, and the object carries `fromId`, which the log line needs and which is
 * gone from the store a line later. Deliberately **not** self-awarding: XP and
 * the office log both live behind `onOfficeEvent`, and a store that paid out
 * would be a second funnel into the ceremony.
 *
 * What you said is not inspected. Linda asked you to have a conversation, not
 * to file a report, and the office has never been able to tell whether you
 * actually raised the subject — which is also true of Linda.
 *
 * @param {string} colleagueId
 * @returns {{id: string, fromId: string, colleagueId: string, createdAt: number} | null}
 */
export function settleOfficeErrand(colleagueId) {
  if (!colleagueId || state.errand?.colleagueId !== colleagueId) return null;
  const settled = state.errand;
  update({ errand: null });
  return settled;
}

/** Drop it. Soft means droppable — an errand you cannot refuse is a ticket. */
export function dismissOfficeErrand(id) {
  if (!state.errand || (id != null && state.errand.id !== id)) return;
  update({ errand: null });
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

/**
 * @param {{
 *   colleagueId: string,
 *   title?: string,
 *   body?: string,
 *   attendees: string[],
 *   audience?: string[]
 * }} invite
 *   `audience` is the all-hands crowd (docs/office-parody.md §10.4) — everyone
 *   present who will not speak. Absent on an ordinary invite, where being in
 *   the room and being scripted are the same thing.
 */
export function pushOfficeMeetingInvite({ colleagueId, title, body, attendees, audience }) {
  const meetingInvite = {
    id: makeId('meeting'),
    colleagueId,
    title: String(title ?? ''),
    body: String(body ?? ''),
    attendees: Array.isArray(attendees) ? attendees : [],
    ...(Array.isArray(audience) && audience.length > 0 ? { audience } : {}),
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
  state = initialState([]);
  nextId = 1;
  battleReentryBlockedUntil = 0;
}
