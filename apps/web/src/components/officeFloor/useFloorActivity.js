/**
 * What you are doing on the floor, as one thing.
 *
 * `useFloorPresence` answers "where are you"; this composes it with the two
 * reasons you might have gone there (a peek, a conversation) and the derived
 * marks that decide whether either is possible at all. The view component then
 * consumes one object instead of assembling six.
 *
 * Both reasons are the same shape on purpose: a destination with an `intent`,
 * projected into a `{ colleagueId, phase }` view that the cards and bubbles
 * read. Adding a third reason to walk somewhere should mean another projection
 * here, not another state machine.
 */

import { useCallback, useEffect, useMemo } from 'react';
import { useFloorPresence } from './useFloorPresence.js';
import { useFloorTalk } from './useFloorTalk.js';
import { approachTileFor } from '../../utils/officeFloorMovement.js';
import { YOU_SEAT_ID, peekTileFor, seatFor } from '../../utils/officeFloorPlan.js';

/** `phase` names differ because the cards read as sentences: looking / talking. */
function intentView(presence, kind, arrivedName) {
  if (presence?.intent?.kind !== kind) return null;
  return {
    colleagueId: presence.intent.colleagueId,
    phase: presence.phase === 'standing' ? arrivedName : 'walking'
  };
}

/** Whoever this view is about, once you have actually got to them. */
function arrivedTarget(view) {
  if (!view || view.phase === 'walking') return null;
  return view.colleagueId;
}

/**
 * The last thing they said, out of the shared IM log — the floor reads this
 * state, it never owns it (ADR-0011 rule 1). Outbound messages are yours, and
 * you do not need a speech bubble to tell you what you just typed.
 */
function lastLineFrom(imHistory, colleagueId) {
  if (!colleagueId) return '';
  for (let i = (imHistory?.length ?? 0) - 1; i >= 0; i -= 1) {
    const msg = imHistory[i];
    if (msg.colleagueId === colleagueId && !msg.outbound) return msg.body ?? '';
  }
  return '';
}

/**
 * @param {{
 *   suspended: boolean,
 *   imHistory?: Array<{ colleagueId: string, body: string, outbound?: boolean }>,
 *   onTalkGreet?: (colleagueId: string) => Promise<void> | void,
 *   onTalkReply?: (colleagueId: string, body: string) => Promise<void> | void,
 *   onTalkingChange?: (colleagueId: string | null) => void,
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
  onEngage
}) {
  const { presence, playerRef, walkTo, peekAt, talkTo, goHome, handleArrive } =
    useFloorPresence(suspended);

  const peek = intentView(presence, 'peek', 'looking');
  const talk = intentView(presence, 'talk', 'talking');
  const talkingTo = talk?.colleagueId ?? null;
  const talkLine = lastLineFrom(imHistory, talkingTo);

  const conversation = useFloorTalk({
    colleagueId: talkingTo,
    arrived: talk?.phase === 'talking',
    onGreet: onTalkGreet,
    onReply: onTalkReply
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

  const startPeek = useCallback(
    (id) => {
      const mark = peekTileFor(id);
      if (!mark) return;
      onEngage?.();
      peekAt(id, mark);
    },
    [peekAt, onEngage]
  );

  const startTalk = useCallback(
    (id) => {
      const mark = approachTileFor(id);
      if (!mark) return;
      onEngage?.();
      talkTo(id, mark);
    },
    [talkTo, onEngage]
  );

  return {
    presence,
    playerRef,
    peek,
    talk,
    talkLine,
    conversation,
    origin,
    walkTo,
    goHome,
    handleArrive,
    startPeek,
    startTalk,
    /**
     * Whoever holds the floor gets the glow the ceremony and glass room use —
     * but only once you have arrived. Glowing somebody you are still walking
     * towards announces the beat before it happens.
     */
    speakingId: arrivedTarget(talk) ?? arrivedTarget(peek),
    /** On your feet with no card of your own already offering a way back. */
    standingFree: Boolean(presence) && !peek && !talk
  };
}

export default useFloorActivity;
