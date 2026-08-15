/**
 * What a figure on the floor is visibly doing, as one object
 * (docs/office-isometric-mode.md § 5 slice 13).
 *
 * The floor already knew where everybody was; it did not show what any of them
 * was *up to*. Sixteen identical torsos bobbing at sixteen desks is a room full
 * of people waiting rather than a room full of people working, and the tells
 * that fix it — a mug, a phone, a headset, your own headphones — are the same
 * kind of thing said about very different state: a trait row, a live meeting, a
 * preference in the moment store, a set piece that is running.
 *
 * So the composition happens **here**, once, as pure data, and `FloorFigure` is
 * handed the answer. That is the same division `officeFloorReach.js` draws for
 * marks and for the same reason: two consumers deriving "is Dave on a call"
 * separately is two consumers that can disagree, and the one that is wrong is
 * whichever one you are not looking at.
 *
 * **It derives, it never stores** (ADR-0011 rule 1). Every input below is state
 * something else already owns — `officeDeskWork.js` for the baked half, the
 * moment store for headphones and coffee, `useMeetingPlayback` for who is on a
 * call. Nothing here is written anywhere, and the floor is free to stop asking.
 */

import { deskWorkFor } from './officeDeskWork.js';

/**
 * What can be in a hand. Closed set — each is a handful of paths on a 34 × 24
 * torso whose bottom half a desk hides (§ 6 rule 31), so the whole vocabulary
 * has to work in a ~6 × 8 px window beside the shoulder.
 *
 * @type {readonly string[]}
 */
export const FLOOR_HOLDS = Object.freeze(['coffee', 'mug', 'papers', 'phone']);

/**
 * What the body is doing, which is only ever an idle rhythm — the art budget
 * for a pose goes on the held item, because at 34 px a shoulder angle is not a
 * signal and a mug is.
 *
 * @type {readonly string[]}
 */
export const FLOOR_POSES = Object.freeze(['idle', 'typing', 'call', 'reading']);

/**
 * What each `doing` value looks like. Two of them carry headwear rather than a
 * hold, which is the reason `doing` is one field and not two: "on a headset" and
 * "holding a phone" are the same fiction wearing different art, and a character
 * should pick the fiction, not the layer it lands on.
 *
 * @type {Record<string, { pose: string, hold: string | null, headwear: string | null }>}
 */
const DOING_ART = {
  typing: { pose: 'typing', hold: null, headwear: null },
  phone: { pose: 'call', hold: 'phone', headwear: null },
  headset: { pose: 'call', hold: null, headwear: 'headset' },
  papers: { pose: 'reading', hold: 'papers', headwear: null },
  mug: { pose: 'idle', hold: 'mug', headwear: null }
};

/** Anybody with no desk-work row — which is exactly one person, and it is you. */
const DEFAULT_ART = DOING_ART.typing;

/**
 * What the hour does to the room (`officeCadence.js` decides which hour it is).
 *
 * A phase is a **general truth about right now**, which is the same register as
 * a trait row and a different one from anything that is *happening* — so it
 * sits directly above `deskDoingFor` in the ladder below and under every live
 * input. Dave keeps his headset on an actual call at 8 am; what he loses is the
 * headset he was wearing at 8 am for no reason.
 *
 * Only three of the five phases have art, and the two blanks are the design
 * rather than gaps in it. **Midday is the baseline** — the longest stretch of
 * the day, and the one where the baked characterization the whole room was
 * built on is what you see. **After hours has no art either**, because the
 * people still at their desks at nine at night are doing their usual thing;
 * what is different about that hour is the light, and the light is CSS.
 *
 * Whole-office rather than per-person, and that is a deliberate reversal of the
 * usual "don't erase somebody's character" instinct: sixteen people holding a
 * mug at the same time reads as *the office at 9 am*, while four holding one
 * reads as four people who happen to have mugs. The set piece precedent is
 * already here — a coffee break puts a cup in every hand including Dave's.
 *
 * @type {Record<string, { pose: string, hold: string | null, headwear: string | null }>}
 */
const PHASE_ART = {
  earlyMorning: { pose: 'idle', hold: 'mug', headwear: null },
  // The remote stand-up: everybody on the same call, nobody in the same room.
  standUp: { pose: 'call', hold: null, headwear: 'headset' },
  windDown: { pose: 'reading', hold: 'papers', headwear: null }
};

/**
 * The baked half: what they are doing when nothing is happening to them.
 *
 * You have no `OFFICE_DESK_WORK` row on purpose (your screen is the deliverable,
 * not ambience — `officeDeskWork.test.js` pins that), so you fall through to
 * `typing`, which is both the honest answer and the one that makes your own desk
 * read like everybody else's.
 *
 * @param {string} id
 * @returns {{ pose: string, hold: string | null, headwear: string | null }}
 */
export function deskDoingFor(id) {
  return DOING_ART[deskWorkFor(id)?.doing] ?? DEFAULT_ART;
}

/**
 * The baked half, as the hour leaves it: the phase's art when that hour has
 * any, otherwise the person's own row.
 *
 * Split out rather than inlined because it is the one line of this module a
 * reader is likely to disagree with — "the hour overrules the character" is a
 * claim, and a named function is where a claim can be argued with.
 *
 * @param {string} id
 * @param {string | null} [dayPhase]
 * @returns {{ pose: string, hold: string | null, headwear: string | null }}
 */
export function baseDoingFor(id, dayPhase = null) {
  return (dayPhase && PHASE_ART[dayPhase]) ?? deskDoingFor(id);
}

/**
 * @typedef {object} FloorActivity
 * @property {string} pose idle rhythm class suffix (`FLOOR_POSES`)
 * @property {string | null} hold what is in their hand (`FLOOR_HOLDS`)
 * @property {string | null} headwear accessory override for `PersonaFace`
 */

/**
 * Compose the baked half with whatever is happening right now.
 *
 * The precedence is the whole design, so it is written down rather than left in
 * the order of some `??` chain:
 *
 * 1. **A call outranks everything.** A remote sync puts a headset on every
 *    attendee including you, over the top of your own headphones — you did not
 *    join the call to listen to music, and two bits of headwear is one drawing.
 * 2. **Your headphones are next**, and are yours alone: `headphones` is the
 *    Admin menu's posture (`setOfficeHeadphones`), not a thing the cast has.
 *    This is the one place a *preference* reaches the room, which is exactly
 *    what "the office reaches you or it does not" should look like from outside.
 * 3. **A coffee in your hand beats whatever else was in it**, because a set
 *    piece is a thing that is happening and a trait row is a thing that is
 *    generally true.
 * 4. **Then whatever they picked up on the way**, which is the same argument one
 *    rung quieter: an errand is also a thing that is happening, but a running
 *    set piece outranks ambient traffic everywhere else on this floor and there
 *    is no reason for the hand to be the exception. In practice the two never
 *    collide — `coffee` is the moment store's set piece and only ever describes
 *    *you*, while `carrying` only ever describes a wanderer — so the order is
 *    written down for the day somebody makes them overlap rather than to settle
 *    a fight happening today.
 * 5. **Then the hour**, which is the lowest rung that can still override
 *    anybody, because it is the only other input here that is *general* rather
 *    than *live*. Everything above this line is something happening to one
 *    person; a phase is something true of the whole room, and the ladder has
 *    always let the specific beat the general.
 * 6. Otherwise the trait row.
 *
 * `moving` drops the pose but keeps the hold: the walk animation owns the body
 * while somebody is mid-stride (`.is-walking` retimes the same keyframes), and
 * a colleague carrying their mug to the kitchen is the entire point of letting
 * a hold survive a walk.
 *
 * `dayPhase` is absent for anybody a **moment** is drawing — a walk-by, a
 * coffee break, somebody commuting to one. That is not an omission: those
 * figures are mid-something, and rung 5's whole argument is that a thing
 * happening outranks a thing generally true. The hour applies to the room's
 * standing population — the chairs, you, and the ambient wanderer.
 *
 * @param {string} id
 * @param {{
 *   onCall?: boolean,
 *   headphones?: boolean,
 *   coffee?: boolean,
 *   carrying?: string | null,
 *   moving?: boolean,
 *   dayPhase?: string | null
 * }} [context]
 * @returns {FloorActivity}
 */
export function floorActivityFor(id, context = {}) {
  const {
    onCall = false,
    headphones = false,
    coffee = false,
    carrying = null,
    moving = false,
    dayPhase = null
  } = context;
  const base = baseDoingFor(id, dayPhase);
  return {
    pose: onCall ? 'call' : moving ? 'idle' : base.pose,
    hold: coffee ? 'coffee' : (carrying ?? base.hold),
    headwear: onCall ? 'headset' : headphones ? 'headphones' : base.headwear
  };
}

/**
 * The agenda: what the person who called the meeting is working from.
 *
 * @type {FloorActivity}
 */
const MEETING_AGENDA = Object.freeze({ pose: 'reading', hold: 'papers', headwear: null });

/** Everybody else, which is the honest answer for most of a meeting. */
const MEETING_LISTENING = Object.freeze({ pose: 'idle', hold: null, headwear: null });

/**
 * What somebody has in front of them **in the glass room**
 * (docs/office-isometric-mode.md § 5 slice 29).
 *
 * The glass room was the last surface that drew a figure without asking this
 * module anything, so sixteen people sat round a table holding nothing. § 8
 * recorded the wiring as one prop and the blocker as a content question —
 * *who brings what to a meeting* — and this is the answer:
 *
 * 1. **The person who called it brought the agenda.** It is the only role a
 *    meeting actually has, `meetingSeating` already knows who it is (they take
 *    the head of the table), and it needs no per-character data to be true.
 * 2. **Then the hour, but only what it puts in a hand.** `PHASE_ART`'s own
 *    argument is that a tell everybody shows at once reads as *the time of
 *    day* rather than as a coincidence — and eight people in one room are the
 *    most synchronised group in the building, so it lands harder here than it
 *    does across the desks. It reuses art that already exists; nothing new is
 *    drawn.
 * 3. **Otherwise they are listening**, empty-handed.
 *
 * Two things it deliberately does **not** do.
 *
 * It never takes the hour's **headwear**. At the `standUp` hour `PHASE_ART`'s
 * tell is a headset, and a headset means *on a call from your desk* — these
 * people walked to a room. Drawing it would paint the **remote** modality on
 * top of the **physical** one, which is the single distinction `FloorMeeting`
 * exists to make. (Only the hold is copied, so that holds for any phase added
 * later, not just for the one that has a headset today.) Dave keeps his, but
 * that is his **face** and not his activity — a `null` headwear cannot take a
 * baked trait off, the same limit a day phase hit in slice 20.
 *
 * And it never falls through to the **desk trait row**, which is the one thing
 * a meeting can be certain is wrong: seven of the sixteen rows say `typing` and
 * two say `phone`, so `floorActivityFor`'s rung 6 would seat a table of people
 * typing through the meeting they walked to, with Russ taking another call in
 * it. This is not an exception to that ladder's rung 5 (`dayPhase` is absent
 * for anybody a *moment* is drawing) so much as the case it never covered:
 * rung 5 assumes a moment supplies a tell of its own — a walk-by is moving, a
 * coffee break puts a cup in every hand — and the meeting was the one moment
 * that supplied none. Where a moment has nothing of its own to say, the hour
 * is a better answer than the desk they are not sitting at.
 *
 * Whether the person currently **speaking** should look different is left
 * alone on purpose: `is-speaking` already marks them and the bubble names them,
 * and re-posing a figure on every beat is churn at 34 px.
 *
 * @param {string} _id present for symmetry with `floorActivityFor`; the rule is
 *   deliberately about the role and the hour, never about who they are.
 * @param {{ facilitator?: boolean, dayPhase?: string | null }} [context]
 * @returns {FloorActivity}
 */
export function meetingActivityFor(_id, context = {}) {
  const { facilitator = false, dayPhase = null } = context;
  if (facilitator) return MEETING_AGENDA;
  const phase = (dayPhase && PHASE_ART[dayPhase]) ?? null;
  if (!phase?.hold) return MEETING_LISTENING;
  return { pose: phase.pose, hold: phase.hold, headwear: null };
}

/**
 * Who is talking in a conversation you are stood in, or `null` while nobody has
 * said anything yet.
 *
 * Slice 8 glowed at whoever you had walked up to, for as long as you stood
 * there — which answers "who are you with", not "who is talking", and left the
 * indicator on through everything you typed. The IM log already carries the
 * answer: every message it stores knows whether it was `outbound`, so the newest
 * one names the speaker without a timer, without new state, and without the
 * floor and Slop Chat™ being able to disagree about it.
 *
 * @param {Array<{ colleagueId?: string, outbound?: boolean }> | null | undefined} imHistory
 * @param {string | null} colleagueId whoever you are stood in front of
 * @param {string} playerId
 * @returns {string | null}
 */
export function conversationSpeakerId(imHistory, colleagueId, playerId) {
  if (!colleagueId) return null;
  for (let i = (imHistory?.length ?? 0) - 1; i >= 0; i -= 1) {
    if (imHistory[i]?.colleagueId !== colleagueId) continue;
    return imHistory[i].outbound ? playerId : colleagueId;
  }
  return null;
}

export default floorActivityFor;
