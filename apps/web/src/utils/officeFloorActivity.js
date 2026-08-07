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
 * 5. Otherwise the trait row.
 *
 * `moving` drops the pose but keeps the hold: the walk animation owns the body
 * while somebody is mid-stride (`.is-walking` retimes the same keyframes), and
 * a colleague carrying their mug to the kitchen is the entire point of letting
 * a hold survive a walk.
 *
 * @param {string} id
 * @param {{
 *   onCall?: boolean,
 *   headphones?: boolean,
 *   coffee?: boolean,
 *   carrying?: string | null,
 *   moving?: boolean
 * }} [context]
 * @returns {FloorActivity}
 */
export function floorActivityFor(id, context = {}) {
  const {
    onCall = false,
    headphones = false,
    coffee = false,
    carrying = null,
    moving = false
  } = context;
  const base = deskDoingFor(id);
  return {
    pose: onCall ? 'call' : moving ? 'idle' : base.pose,
    hold: coffee ? 'coffee' : (carrying ?? base.hold),
    headwear: onCall ? 'headset' : headphones ? 'headphones' : base.headwear
  };
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
