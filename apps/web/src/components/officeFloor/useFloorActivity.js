/**
 * What you are doing on the floor, as one thing.
 *
 * `useFloorPresence` answers "where are you"; this composes it with the three
 * reasons you might have gone there (a peek, a conversation, a prop you went to
 * use) and the derived marks that decide whether any of them is possible at
 * all. The view component then consumes one object instead of assembling nine.
 *
 * All three reasons are the same shape on purpose: a destination with an
 * `intent`, projected into a `{ subject, phase }` view that the cards and
 * bubbles read. Slice 9 is what that claim was written for — a third reason to
 * walk somewhere cost one more projection and one more `start*`, and the only
 * thing it had to generalize was that a subject need not be a person.
 */

import { useCallback, useEffect, useMemo } from 'react';
import { useFloorPresence } from './useFloorPresence.js';
import { useFloorPropUse } from './useFloorPropUse.js';
import { useFloorTalk } from './useFloorTalk.js';
import { propTileFor } from '../../utils/officeFloorMovement.js';
import { conversationSpeakerId } from '../../utils/officeFloorActivity.js';
import { YOU_SEAT_ID, seatFor } from '../../utils/officeFloorPlan.js';
/**
 * `phase` names differ because the cards read as sentences: looking / talking /
 * using. `subjectKey` is which field of the intent names what you went there
 * for — a colleague for the two social reasons, a prop kind for the third.
 */
function intentView(presence, kind, arrivedName, subjectKey = 'colleagueId') {
  if (presence?.intent?.kind !== kind) return null;
  return {
    [subjectKey]: presence.intent[subjectKey],
    phase: presence.phase === 'standing' ? arrivedName : 'walking'
  };
}

/** Whoever this view is about, once you have actually got to them. */
function arrivedTarget(view) {
  if (!view || view.phase === 'walking') return null;
  return view.colleagueId;
}

/** Nothing said yet — a frozen pair so the no-conversation case allocates once. */
const NO_TALK = Object.freeze({ line: '', pitch: null });

/**
 * The last thing they said, out of the shared IM log — the floor reads this
 * state, it never owns it (ADR-0011 rule 1). Outbound messages are yours, and
 * you do not need a speech bubble to tell you what you just typed.
 *
 * Returns the **line and its pitch together** because they are one scan of one
 * message: `actionPrompt` is optional on every IM (`pushOfficeImPing`), and
 * ADR-0012 made a pitch something any of the cast may attach when they actually
 * have something. Reading them separately would mean two walks of the history
 * that could disagree about which message is newest.
 *
 * The `?.`/`??` live here rather than at the call site on purpose: complexity is
 * counted per function, `useFloorActivity` is already at 14 against a max of 12,
 * and § 8's finding is that these operators are most of what puts floor modules
 * over. Destructuring the result costs the hook nothing.
 *
 * @returns {{ line: string, pitch: string | null }}
 */
function lastInboundFrom(imHistory, colleagueId) {
  if (!colleagueId) return NO_TALK;
  for (let i = (imHistory?.length ?? 0) - 1; i >= 0; i -= 1) {
    const msg = imHistory[i];
    if (msg.colleagueId === colleagueId && !msg.outbound) {
      return { line: msg.body ?? '', pitch: msg.actionPrompt ?? null };
    }
  }
  return NO_TALK;
}

/**
 * @param {{
 *   suspended: boolean,
 *   imHistory?: Array<{ colleagueId: string, body: string, outbound?: boolean }>,
 *   onTalkGreet?: (colleagueId: string) => Promise<void> | void,
 *   onTalkReply?: (colleagueId: string, body: string) => Promise<void> | void,
 *   onTalkingChange?: (colleagueId: string | null) => void,
 *   onGetCoffee?: () => Promise<boolean> | boolean,
 *   onPropCue?: (propKind: string) => void,
 *   onFloorCue?: (cue: string, options?: object) => void,
 *   onEngage?: () => void
 * }} options `onEngage` fires when you set off somewhere with a reason — the
 *   person card that offered the verb has served its purpose.
 */
export function useFloorActivity({
  suspended,
  imHistory = [],
  onTalkGreet,
  onTalkReply,
  onTalkingChange,
  onGetCoffee,
  onPropCue,
  onFloorCue,
  onEngage
}) {
  const { presence, playerRef, walkTo, peekAt, talkTo, reachFor, goHome, handleArrive } =
    useFloorPresence(suspended);

  const peek = intentView(presence, 'peek', 'looking');
  const talk = intentView(presence, 'talk', 'talking');
  const prop = intentView(presence, 'use', 'using', 'propKind');
  const talkingTo = talk?.colleagueId ?? null;
  const { line: talkLine, pitch: talkPitch } = lastInboundFrom(imHistory, talkingTo);

  const composer = useFloorTalk({
    colleagueId: talkingTo,
    onReply: onTalkReply
  });

  /*
   * `useFloorTalk` deliberately "holds a text box" and nothing else, so the
   * pitch is composed on top of it here, where `imHistory` is already being
   * read. It rides in this bundle rather than as an extra top-level `talk*`
   * prop because it *is* conversation state — the actionable half of the newest
   * thing they said — and because `FloorCardSlot` threads `conversation`
   * already, so the card slot's prop list does not grow.
   */
  const conversation = { ...composer, pitch: talkPitch };

  const propUse = useFloorPropUse({
    propKind: prop?.propKind ?? null,
    arrived: prop?.phase === 'using',
    onGetCoffee,
    onPropCue,
    onFloorCue
  });

  // Renderer #1 needs to know who you are stood in front of, so it can hold
  // their toast back — otherwise the same line arrives twice, and the narrator
  // reads it out twice with it.
  useEffect(() => {
    onTalkingChange?.(talkingTo);
  }, [talkingTo, onTalkingChange]);

  // Where you are for the purposes of "can I get there from here". While a walk
  // is in flight that is where it is taking you: the next click queues from the
  // destination, not from the corridor.
  const origin = useMemo(() => {
    if (presence) return presence.to;
    const home = seatFor(YOU_SEAT_ID);
    return home ? { x: home.x, y: home.y } : null;
  }, [presence]);

  /*
   * The two social verbs are handed their mark rather than deriving one, which
   * since slice 12 is the only correct arrangement: the person card decides
   * whether to *offer* a verb by asking the room for a mark, and where somebody
   * is standing is not a question this hook can answer — `whereaboutsOf` needs
   * the wanderer, and the wanderer needs `origin`, which comes from here. Ask
   * twice and the two answers can differ, which is a verb aimed at a chair its
   * occupant has left. One derivation, one consumer.
   */
  const startPeek = useCallback(
    (id, mark) => {
      if (!mark) return;
      onEngage?.();
      peekAt(id, mark);
    },
    [peekAt, onEngage]
  );

  const startTalk = useCallback(
    (id, mark) => {
      if (!mark) return;
      onEngage?.();
      talkTo(id, mark);
    },
    [talkTo, onEngage]
  );

  const startUseProp = useCallback(
    (kind) => {
      const mark = propTileFor(kind);
      if (!mark) return;
      onEngage?.();
      reachFor(kind, mark);
    },
    [reachFor, onEngage]
  );

  return {
    presence,
    playerRef,
    peek,
    talk,
    talkLine,
    conversation,
    prop,
    propUse,
    origin,
    walkTo,
    goHome,
    handleArrive,
    startPeek,
    startTalk,
    startUseProp,
    /**
     * Whoever holds the floor gets the indicator the ceremony and glass room
     * use — but only once you have arrived. Marking somebody you are still
     * walking towards announces the beat before it happens.
     *
     * In a conversation that is **whoever spoke last**, not whoever you walked
     * up to. Slice 8 marked your partner for as long as you stood there, which
     * answers "who are you with"; the IM log already knows which way the newest
     * message went (`conversationSpeakerId`), so the indicator can follow the
     * turn — including onto you — with no timer and no new state. Nobody is
     * marked before the opener lands, which is correct: nobody has said
     * anything yet.
     */
    speakingId:
      (talk?.phase === 'talking'
        ? conversationSpeakerId(imHistory, talkingTo, YOU_SEAT_ID)
        : null) ?? arrivedTarget(peek),
    /**
     * The prop you are actually stood at, so it can glow — the same "only once
     * you have arrived" rule `speakingId` follows, for the same reason: a
     * machine lighting up while you are still walking announces the beat early.
     */
    activePropKind: prop?.phase === 'using' ? prop.propKind : null,
    /** On your feet with no card of your own already offering a way back. */
    standingFree: Boolean(presence) && !peek && !talk && !prop
  };
}

export default useFloorActivity;
