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
 * anyone the user later dwells with, talks to, walks into, or emails. Stamping
 * everyone on a board-sample edge would be omniscience.
 *
 * "Few" is a rule about the *edge*, not a count — each writer is a moment the
 * user aimed at one named person, which is why the set has grown six times
 * since v1's dwell-and-talk pair (an interruption, an email, a dropped errand,
 * a declined invite, a declined set piece, then reading somebody's screen)
 * without the rule moving. An ambient moment must still never write here.
 *
 * The newest one is the clearest statement of what the rule is *for*: a peek
 * costs nobody anything and refuses nobody anything, and it is still the most
 * deliberate approach the floor has — you cross the room to one named person
 * and stand behind them. The edge is aimed; the beat follows.
 *
 * The three refusals are the clearest case of why the rule is about the edge: a
 * press on _Not today_, _Decline_ or _Not my circus_ is aimed at the person who
 * asked, so the beat lands on **them** and on nobody else. The colleague you
 * were sent to never heard the message, the other invitees were not told your
 * answer, and the second half of a coffee pair was standing there but was not
 * the one doing the asking — none of them may remember it.
 *
 * A declined set piece is the odd one out and worth naming: it is the only
 * writer here whose edge changes nothing else at all. The scene keeps its cast,
 * walks to the machine and plays out; the floor is still offering you a way in.
 * The memory is the *entire* consequence, which is as pure a statement of
 * record-never-trigger as this file contains.
 */

import { boardRecallLine } from '../utils/officeBoardRecall.js';
import {
  OFFICE_WORKING_MEMORY_BEAT_CAP,
  normalizeWorkingMemoryBeat,
  officeDayStamp,
  readOfficeWorkingMemory,
  reconcileOfficeCalendarDay,
  writeOfficeWorkingMemory
} from '../utils/officeAmbienceStorage.js';

/**
 * What each interruption reads like to the model.
 *
 * The phrasing lives here beside the two quote prefixes rather than in the
 * floor, because the beat carries the *fact* and this function owns every
 * sentence in the prompt — the same split `pitchTaken` already uses. Both
 * entries state the circumstance and stop: naming a consequence the prompt does
 * not otherwise carry is how a moment ends up fabricating one (the situation
 * rule in `docs/agents/domains/office.md`).
 *
 * **Every line in this file is written in the SPEAKER's second person**, and it
 * has to be: the block these lines land in (`buildOfficeWorkingMemoryBlock`)
 * addresses the colleague as "you", and so does the system prompt above it
 * ("You are writing ONE office moment", "The user just emailed you"). The
 * bullets were written from the user's side until 2026-11-10, three lines under
 * a frame saying the opposite, and the model read the frame: asked to recall the
 * day it reported **23 of 24 facts with the two people swapped** — it had read
 * the user's screen, the user had pitched and it had declined — against 0 of 24
 * once the parties were named, with a no-block control inventing none of them.
 *
 * So the convention is not a pronoun flip but a **naming** one: say `the user`
 * out loud wherever the other party appears. Measured against the flip on the
 * same arms, naming is referenced more often (6 of 16 vs 2 of 16 on a stance
 * probe), it cannot be re-broken by a later rewording of the frame, and the one
 * risk it looked like it carried is not real — "the user" never once leaked
 * into a spoken line, while the control arm, which has no block at all, said it
 * 4 times in 8 about the funnel's own end-users.
 */
const INTERRUPTION_PROMPT_LINES = Object.freeze({
  gotIt: 'the user took the spot you were using; you had finished and stepped aside',
  gaveUp: 'the user got in the way of your errand; you went back to your desk empty-handed'
});

/**
 * The same two quotes, for a beat that was not spoken.
 *
 * Speech is the default because until the email channel started writing
 * beats every one of them was a dwell, a talk or an interruption — somebody in
 * the room, in earshot. An email is the one exchange the office deliberately
 * keeps off every talk surface, so quoting it as speech hands the next prompt a
 * conversation that never happened, and a colleague who "remembers" talking to
 * you when you typed at their inbox is the fabrication the situation rule
 * warns about, arriving through memory instead of through a situation.
 *
 * Keyed by `medium`, with the absent case falling through to the default pair,
 * so adding a member here is a copy row rather than a branch.
 */
/*
 * `yours` / `theirs` name whose words the beat holds — the user's and the
 * colleague's — and the prefixes are in the speaker's second person, so the
 * pair reads inverted against the field names on purpose. `theirs` is the
 * speaker's own line, and a prefix is the one place where getting this backwards
 * is not a nuance: `you said:` over the user's sentence tells the model it said
 * something it did not.
 */
const MEDIUM_PROMPT_LINES = Object.freeze({
  email: { yours: 'the user emailed you:', theirs: 'you wrote back:' }
});

const SPOKEN_PROMPT_LINES = Object.freeze({
  yours: 'the user said:',
  theirs: 'you said:'
});

/**
 * What dropping their errand reads like to the model
 * (`docs/automations/office-life.md` queue 13).
 *
 * Written on the **asker**, never on the person you were sent to: they were
 * never told, and a colleague who remembers a conversation that did not reach
 * them is the fabrication the situation rule warns about. The asker is the one
 * who knows, because they are the one still waiting.
 *
 * It states the circumstance and stops, for `INTERRUPTION_PROMPT_LINES`'
 * reason: naming the consequence ("so they are annoyed with you") hands the
 * next line a mood the prompt cannot check, and a situation that states a delta
 * is measurably how a moment ends up inventing one.
 */
const ERRAND_DROPPED_PROMPT_LINE = 'you sent the user to have a word with somebody; they let it go';

/**
 * What declining their meeting reads like to the model
 * (`docs/automations/office-life.md` queue 13, the second instance).
 *
 * Written on the **organizer** and on nobody else. A calendar decline reaches
 * the person who sent the invite; the other attendees are not told, and giving
 * one of them a memory of your answer is the fabrication the situation rule in
 * `docs/agents/domains/office.md` warns about, arriving through memory instead
 * of through a prompt.
 *
 * **One line for both exits.** The toast ends two ways — the decline button,
 * and "Propose new time", where the organizer turns your counter-offer down
 * 2.6 s later and the invite closes itself. They differ in whose no it was and
 * agree on the only thing the office can see: the meeting was on your calendar
 * and you did not go to it. Saying that much is the circumstance; saying which
 * refusal it was would need a field the beat does not carry, and a line that
 * guesses is `INTERRUPTION_PROMPT_LINES`' failure mode.
 *
 * It names no title, for the reason the hearsay note on the whiteboard had to
 * learn twice: an invite's `title` is free text, a prompt line is capped at
 * 200 characters on both sides, and a fixed sentence cannot spend somebody
 * else's budget.
 */
const INVITE_DECLINED_PROMPT_LINE =
  "you put a meeting on the user's calendar; they did not go to it";

/**
 * What turning down their set piece reads like to the model
 * (`docs/automations/office-life.md` queue 13, the third and last instance the
 * playbook names by file: *"`sceneJoin`'s decline path in particular ends the
 * offer and records nothing"*).
 *
 * Written on the **first participant** and on nobody else, which is the person
 * `sceneJoinOfferFor` already calls "the one that asked you in the first
 * place". The other half of the pair was standing there, but the invitation was
 * one person's and so is the answer; handing the second one a memory of your no
 * is the fabrication the situation rule in `docs/agents/domains/office.md`
 * warns about, arriving through memory instead of through a prompt.
 *
 * **Two lines, not one, and that is the whole argument for the enum.** The
 * other two refusals each describe something that can only have happened one
 * way, so a single sentence is the circumstance. A declined scene cannot: a
 * coffee break you did not want is company turned down, and a shouting match
 * you walked away from is a side nobody took. One sentence covering both would
 * have to say "you did not join their thing", which is the vague-to-the-point-
 * of-useless end of the same mistake `INTERRUPTION_PROMPT_LINES` avoids at the
 * specific end.
 *
 * **Both state the circumstance and stop**, for that module's reason, and both
 * carry the one fact that makes this refusal different from the other two: the
 * scene went ahead. `declineOfficeCoffee` leaves the cast standing, so the
 * person holding this memory is somebody who heard you say no and then had
 * their coffee anyway — and if you later walk over, `sceneJoinOfferFor` is
 * still offering you the way in. Neither line names a consequence, and neither
 * can chase you for one.
 */
const SCENE_DECLINED_PROMPT_LINES = Object.freeze({
  coffee: 'you asked the user along for a coffee; they stayed at their desk and you went anyway',
  battle: 'you wanted the user in on an argument; they walked away and it carried on without them'
});

/**
 * What reading their screen over their shoulder reads like to the model
 * (`docs/automations/office-life.md` question 1 — the first thing its own list
 * names, *"click them"*).
 *
 * Desk peeking was the one verb aimed at a single named person that left
 * nothing behind. You cross the room, stand at their desk, and read what is on
 * their monitor; they say something about it; and the next time you stood next
 * to them the room was as blank as if you had never been there. The CISO's own
 * peek line has been *"Do not read that. You have now read it. Noted in your
 * file."* since the surface was built, and nothing was noted in anybody's file.
 *
 * **It states the circumstance and stops**, for `INTERRUPTION_PROMPT_LINES`'
 * reason: not *"so they are guarded with you"* and not what was on the screen.
 * Which screen they had up is `deskWorkFor`'s answer and rides the same request
 * on its own block, so naming it here would be one fact in two places — and a
 * line that said what you saw would hand the next prompt a delta it cannot
 * check, which is measurably how a moment ends up inventing one.
 *
 * **The one beat writer that deliberately does not quote what it heard.** The
 * interruption beat carries `theirs: said.text` because the line was improvised
 * out of a bank the user never sees twice; a peek's line is the one fixed
 * sentence that colleague has, and `deskWorkPromptLines` already refuses to
 * send it (*"handing the model its own canned answer is an invitation to recite
 * it back"*). So the beat records that you looked and leaves the sentence where
 * it was said.
 */
const PEEKED_PROMPT_LINE = 'the user walked over and read what was on your screen';

/**
 * The two answers to the one question a colleague actually asks you
 * (`docs/automations/office-life.md` queue 13 — the fourth and last ✕ on the
 * original sweep's list).
 *
 * A walk-by carrying an `actionPrompt` is the only moment in this office that
 * is a *question with two buttons*: **Do it** and ✕, on the same bubble, in
 * both renderers. `taken` has been written since working memory existed — it
 * is the oldest beat field here that is not a quote. `declined` was not, so
 * the office remembered every idea of theirs you used and forgot every one you
 * waved away, which is the asymmetry a room has when it is keeping score of
 * its own successes.
 *
 * **Both state the circumstance and stop**, for `INTERRUPTION_PROMPT_LINES`'
 * reason. Not *"so they have stopped offering"* — a mood the prompt cannot
 * check — and not *what* they suggested: a walk-by's body is deliberately
 * absent from the office log too (*"who came by, never what they said"*), an
 * `actionPrompt` is free text against a 200-character cap on both sides, and a
 * fixed sentence cannot spend somebody else's budget (the lesson the hearsay
 * note on the whiteboard had to learn twice).
 *
 * **`declined` says "came over" and `taken` does not, and that is not sloppy
 * symmetry.** Every adopt surface writes `taken` — an email, a Slop Chat ping,
 * a huddle card — so its line has to be true of all of them. Only the walk-by
 * writes `declined`, because only the walk-by's ✕ is an answer rather than the
 * closing of a panel; a later slice that gives the inbox's dismiss a beat owes
 * this line a second, surface-neutral form rather than a wider claim here.
 *
 * **Two booleans and not an enum**, unlike `sceneDeclined`: the two can both be
 * true of one colleague and that reading is correct, not contradictory. You
 * turned down one of Gilfoyle's ideas this morning and took a different one
 * after lunch — that is two beats, two lines, and a relationship.
 */
const PITCH_PROMPT_LINES = Object.freeze({
  taken: 'the user took your suggestion earlier',
  declined: 'you came over with a suggestion; the user did not take it'
});

/** @typedef {{ at: number, theirs?: string, yours?: string, pitchTaken?: boolean, pitchDeclined?: boolean, errandDropped?: boolean, inviteDeclined?: boolean, interrupted?: 'gotIt' | 'gaveUp', interruptedProp?: string, sceneDeclined?: 'coffee' | 'battle', peeked?: boolean, medium?: 'email' }} WorkingMemoryBeat */
/** @typedef {{ beats: WorkingMemoryBeat[], boardFingerprint?: string }} WorkingMemoryRow */

/** @type {{ [colleagueId: string]: WorkingMemoryRow }} */
let byColleague = readOfficeWorkingMemory();
/** Calendar day the in-memory rows belong to — cleared when the day rolls over without reload. */
let loadedDay = officeDayStamp();
const listeners = new Set();

function reconcileOfficeDay() {
  loadedDay = reconcileOfficeCalendarDay(loadedDay, () => {
    byColleague = {};
  });
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
 * a board they already saw.
 *
 * It used to be the dwell LLM **gate**: false meant the remark came from the
 * canned deck, always. It is now the dwell LLM **reserve** — everybody may
 * spend, and this decides who may spend the last of the three
 * (`OFFICE_DWELL_STRANGER_LLM_CAP`). The difference matters to anyone reading
 * the caller: a `false` here no longer means silence from the model, it means
 * standing further back in the same queue.
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
 *   pitchDeclined?: boolean, errandDropped?: boolean, inviteDeclined?: boolean,
 *   interrupted?: 'gotIt' | 'gaveUp', interruptedProp?: string,
 *   sceneDeclined?: 'coffee' | 'battle', peeked?: boolean,
 *   medium?: 'email', now?: number }} beat
 *   `interruptedProp` is the only field here the prompt never reads: it names
 *   the errand an interruption ruined so the floor can send them back for it
 *   (`unfinishedErrandFrom`), and it is kept out of
 *   `workingMemoryPromptLines` on purpose — a line naming the machine would
 *   state a delta the rest of the prompt cannot check.
 *   `interrupted`, `errandDropped`, `inviteDeclined`, `sceneDeclined`,
 *   `peeked` and `pitchDeclined` are the beat fields that are not something
 *   either of you said —
 *   the first is their errand ending because of you, the second is yours ending
 *   because you dropped it, the third is their meeting ending because you would
 *   not go, the fourth is the one where nothing ended at all (you turned down
 *   the coffee break or the argument and it went ahead without you), the
 *   fifth is the only one where you did not refuse anybody anything (you stood
 *   at their desk and read their screen), and the sixth is the refusal with a
 *   twin — `pitchDeclined` is ✕ on the bubble whose other button writes
 *   `pitchTaken`. All are still
 *   only a record — writing one schedules nothing (ADR-0010) — but it is what
 *   makes `hasWorkingMemoryFact` true for somebody you have never spoken to,
 *   which is the whole point: the next time you stand next to them, the office
 *   has something *about you* to say. Since the dwell gate became a reserve it
 *   is no longer the difference between a written line and a dealt one — it is
 *   the difference between a line that knows what you did to them and one that
 *   only knows what they were doing.
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
 * `boardNow` is the fingerprint of the board as it stands, handed in by the
 * caller rather than read here — the same discipline `wanderNewsFrom` and
 * `ambientSpeakerFrom` get, so the board is sampled at the moment the request
 * is built and this module still only ever reads its own rows (ADR-0010: record,
 * never trigger, and never subscribe from a producer).
 *
 * Omitting it is not an error: a caller with no board in hand gets the
 * `unknown` recall line, which is the part of the fact that does not need a
 * comparison. What it must never do is pass the fingerprint through unread —
 * see `officeBoardRecall.js` for why a machine id is not a sentence.
 *
 * @param {string} colleagueId
 * @param {{ boardNow?: string }} [options]
 * @returns {string[]}
 */
export function workingMemoryPromptLines(colleagueId, { boardNow = '' } = {}) {
  const row = getWorkingMemoryWith(colleagueId);
  if (!row) return [];
  const lines = [];
  const recall = boardRecallLine(row.boardFingerprint, boardNow);
  if (recall) lines.push(recall);
  for (const beat of row.beats) {
    /*
     * Before the quote, not after it: the interruption is what *you* did, and a
     * line they said about it reads as a non-sequitur ahead of the thing it is
     * about. Same reason `yours` precedes `theirs`.
     */
    if (beat.interrupted) lines.push(INTERRUPTION_PROMPT_LINES[beat.interrupted]);
    if (beat.errandDropped) lines.push(ERRAND_DROPPED_PROMPT_LINE);
    if (beat.inviteDeclined) lines.push(INVITE_DECLINED_PROMPT_LINE);
    if (beat.sceneDeclined) lines.push(SCENE_DECLINED_PROMPT_LINES[beat.sceneDeclined]);
    if (beat.peeked) lines.push(PEEKED_PROMPT_LINE);
    const quote = MEDIUM_PROMPT_LINES[beat.medium] ?? SPOKEN_PROMPT_LINES;
    if (beat.yours) lines.push(`${quote.yours} ${beat.yours}`);
    if (beat.theirs) lines.push(`${quote.theirs} ${beat.theirs}`);
    if (beat.pitchTaken) lines.push(PITCH_PROMPT_LINES.taken);
    if (beat.pitchDeclined) lines.push(PITCH_PROMPT_LINES.declined);
  }
  return lines.slice(-6);
}

/** @internal Reset between tests. */
export function _resetOfficeWorkingMemoryForTests() {
  byColleague = {};
  loadedDay = officeDayStamp();
  listeners.clear();
}
