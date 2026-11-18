/**
 * The clock behind a conversation you are only near
 * (docs/office-isometric-mode.md § 5 slice 22).
 *
 * `officeFloorShopTalk.js` answers *who is talking and what they say*; this owns
 * *when it starts, how it is paced and when it is over*, and hands the view the
 * one line that is currently in the air. Same division as slice 19's
 * `dwellTargetAt` / `useFloorDwell` pair, and for the same reason: the derivation
 * is pure and testable without a renderer, and the timing is not.
 *
 * **Armed once per trip, and the trip is what re-arms it.** A wanderer settles at
 * a prop, the exchange is rolled, and that roll is stored for as long as they are
 * stood there — so a re-render cannot re-roll the pair mid-sentence and walking
 * away cannot restart it. `wanderKey` is the identity: seat plus leg, which
 * changes exactly when a new errand begins. This is `useFloorDwell`'s "one line
 * per approach" rule, applied to an errand instead of to an approach.
 *
 * **Why the roll is held here rather than on the trip.** `useFloorWander` stores
 * `carrying` and `interrupted` on the trip itself, and this is deliberately not a
 * third field. Both of those are facts about the *errand* — what it achieved, who
 * ended it — and the trip is the right owner. Whether you happened to be standing
 * near enough to overhear it is a fact about **you**, and putting it on the trip
 * would make the wanderer's own state depend on where the player is stood.
 *
 * **Paced by `useScenePacing`, which is the third performance it drives** after
 * the coffee break and the cubicle battle — and shop talk is the same kind of
 * thing, so the reuse is the point rather than a saving. It matters that the
 * narrator is a *wrapper* and never `undefined`: with no narrator the hook
 * reveals every line at once, which is right for a card that stacks its script
 * and wrong here, where two speakers a tile apart would get simultaneous
 * balloons over adjacent heads (§ 6 rule 29). A wrapper returning
 * `{ spoken: false }` keeps the one-at-a-time reveal when TTS is off.
 *
 * **Since slice 23 it also answers "can I be part of this".** `join` is the
 * offer, and it is deliberately the *same* fact the exchange is built from
 * rather than a second derivation: you may join precisely while you are placed
 * to overhear, which is the ladder's middle rung and nothing more. What joining
 * *does* is not this hook's business at all — it hands the view two ids and the
 * view fires the talk verb it already has.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useScenePacing } from '../../hooks/useScenePacing.js';
import { OFFICE_SHOP_TALK_CAP } from '../../utils/officeCadence.js';
import { overheardPartnerFor, shopTalkExchange } from '../../utils/officeFloorShopTalk.js';

/**
 * The gap between the opener and the reply when nobody is narrating, and the
 * beat of silence after the last line before the balloon clears.
 *
 * Longer than a scene card's pace on purpose: those are read in a panel you are
 * looking at, and this is read over somebody's head while you are doing
 * something else. The tail is what stops the second line vanishing on the frame
 * it finishes — the same problem slice 18's `LINGER_MS` solved for a walk home.
 */
const SHOP_TALK_PACE_MS = 2_600;
const SHOP_TALK_TAIL_MS = 1_600;

/**
 * Where to hang the balloon for whichever of the two is speaking.
 *
 * `FloorDeskSpeech`'s convention, which is inverted from what it looks like: a
 * tile means "they are on their feet here", and **`null` means "look up their
 * chair"** — so the person who never moved is the one this returns nothing for.
 * Passing a resolved tile for both would cost the seated speaker their seat lift
 * and float the reply a tile above their head (§ 6 rules 15 and 20).
 *
 * Its own function rather than a ternary at the return, because it is four
 * operators in a hook that has a complexity budget — § 8's finding that
 * extracting is the fix that works, since complexity is counted per function.
 */
function speechTileFor(said, wandererId, mark) {
  if (!said || said.speakerId !== wandererId) return null;
  return mark ?? null;
}

/**
 * @param {{
 *   wanderer: { seatId: string, kind: string, to: { x: number, y: number }, phase: string, leg: number } | null,
 *   youTile: { x: number, y: number } | null,
 *   floorState?: { wanderer?: unknown, awayIds?: string[] },
 *   copy: Record<string, any>,
 *   active?: boolean,
 *   muted?: boolean,
 *   suspended?: boolean,
 *   narrateLine?: (line: { speakerId: string, text: string }) => unknown
 * }} options `active` is whether you are free to be idly listening at all — a
 *   card, a conversation or a prop in your hands is a reason to be stood there,
 *   and each of those surfaces speaks for itself. `muted` is the narrower
 *   thing: something *else* is talking. The two are not one flag, because only
 *   the first means the room can no longer honour an offer to join — see the
 *   two gates below.
 * @returns {{
 *   said: { speakerId: string, text: string } | null,
 *   at: { x: number, y: number } | null,
 *   lineSpoken: boolean,
 *   join: { colleagueId: string, partnerId: string, kind: string } | null
 * }} `said` is the single line currently in the air — never both — and `at`
 *   follows `FloorDeskSpeech`'s convention: a tile for the speaker who is stood
 *   at the prop, `null` for the one who never left their chair. `join` outlives
 *   `said`: the two lines are over in seven seconds and they are still standing
 *   there.
 */
export function useFloorShopTalk({
  wanderer,
  youTile,
  floorState,
  copy,
  /* No defaults on any of the three: `OfficeFloor` always passes them and each
     is read for truthiness once, so `= true` / `= false` would buy a branch
     apiece — § 8's finding that most of what puts a floor module over its
     complexity budget is default parameters. */
  active,
  muted,
  suspended,
  narrateLine
}) {
  const [armed, setArmed] = useState(null);
  /*
   * **State rather than a ref**, and that distinction is not bookkeeping: the
   * count decides whether a line renders, so reading it during render is exactly
   * what a ref may not be used for. A ref here reads correctly nearly always and
   * then silently misses the render where the cap is reached.
   */
  const [overheard, setOverheard] = useState(0);

  /*
   * Both rungs of the proximity ladder in one call, asked every render because
   * you are the one who moves.
   */
  const partnerId = overheardPartnerFor(wanderer, youTile, floorState);
  const wanderKey = partnerId ? `${wanderer.seatId}:${wanderer.leg}` : null;

  /*
   * **Two gates, because `eligible` was answering two different questions and
   * only one of them should cost you the way in.**
   *
   * `offerable` is the room's side: these two are still standing at the prop,
   * you are still in the ring, and the cap has something left. `playable` adds
   * your own side — nothing else has your attention and nothing else is
   * talking. A single flag conflated them, and the loser was slice 23's offer:
   * `active` is `standingFree && !hasOtherSpeech`, so *any* other voice tore
   * `armed` down and took the invitation with it.
   *
   * That is the common case rather than a corner, and the arithmetic says so.
   * Nearly every tile you can listen from has a third colleague inside
   * `NAME_CHIP_RANGE_TILES` (measured: 237 of 307 listening positions —
   * `officeFloorShopTalk.test.jsx`), `DWELL_MS` is 5 s, and the exchange runs
   * 2.6 + 2.6 + 1.6 = 6.8 s. So somebody who is in neither half of the
   * conversation looks up at you *before* the pair have finished, and the room
   * withdrew a door it had just shown you because a bystander said hello.
   */
  const offerable = Boolean(wanderKey && overheard < OFFICE_SHOP_TALK_CAP);
  const playable = Boolean(offerable && active && !suspended);

  useEffect(() => {
    if (!playable) {
      /*
       * Clearing on the way out rather than letting the exchange play to the end
       * once it has started. Walking out of earshot mid-sentence is the one
       * interaction this slice has, and a conversation that follows you across
       * the room is worse than one that never started — `useScenePacing`'s
       * cleanup cancels the voice with it.
       */
      // eslint-disable-next-line react-hooks/set-state-in-effect -- (reason: leaving earshot is a transition out of a performance, not a projection; the roll it drops is exactly what a derived value could not have held)
      setArmed(null);
      return;
    }
    if (muted) {
      /*
       * `done` rather than `null`, which is the whole of this fix: another voice
       * having the room is exactly as much of an ending as the second line
       * landing, and `done` is already the state that stops the balloon while
       * leaving the offer standing. It also keeps the roll, so the exchange
       * cannot replay itself at you when the room goes quiet again — one errand,
       * one conversation, heard or half-heard.
       *
       * It does **not** spend `overheard`: that counter bounds how often the
       * office makes a noise at you, and a muted exchange made none. The cap is
       * safe anyway, because a `done` key can never re-arm.
       */
      // eslint-disable-next-line react-hooks/set-state-in-effect -- (reason: a voice taking the room is a transition out of a performance, same as leaving earshot above; the roll it keeps is what a derived value could not hold)
      setArmed((current) => (!current || current.done ? current : { ...current, done: true }));
      return;
    }
    /*
     * Rolled here rather than in render for `goHome`'s reason: React may run a
     * render more than once, and an impure derivation would hand the balloon and
     * the narrator different pairs out of the same bank.
     */
    setArmed((current) =>
      current?.key === wanderKey ? current : { key: wanderKey, roll: Math.random() }
    );
  }, [playable, muted, wanderKey]);

  /*
   * `done` rather than clearing `armed`, which is the one thing slice 23 had to
   * change in here. The balloon still has to go when the exchange ends — a null
   * exchange is how it goes — but the *offer* must not, because two people who
   * have finished a sentence are still two people standing next to each other,
   * and an invitation that expires seven seconds after it appears is a reflex
   * test rather than an invitation. Keeping the same roll under a flag also
   * keeps the effect below from re-rolling: `current.key === wanderKey` still
   * matches, so an errand you have already overheard cannot replay itself while
   * you stand there.
   */
  const exchange = useMemo(() => {
    if (!armed || armed.done || armed.key !== wanderKey || !partnerId) return null;
    return shopTalkExchange(wanderer, partnerId, copy, armed.roll);
  }, [armed, wanderKey, partnerId, wanderer, copy]);

  /*
   * The way in (slice 23), and it is the *same* gate as the exchange rather
   * than a second one: you may join exactly while you are placed to overhear.
   * `armed.key === wanderKey` is what makes it an offer about a conversation
   * that is actually happening — without it the card would appear at the cap,
   * or while another voice has the room, next to two people saying nothing.
   *
   * It names the **wanderer** and not the replier, which is not a coin toss.
   * The replier is in their chair and will be there all day; the wanderer's
   * errand ends in four to nine seconds and then they are back at a desk you
   * may be nowhere near. The offer is for the speaker who is about to leave —
   * and the geometry agrees, since the conversation is happening at the prop.
   *
   * Read off the **exchange** rather than off `armed` alone, which is what
   * keeps the untranslated-locale path honest: a missing bank yields no
   * exchange and therefore no offer, instead of inviting you to join two people
   * who are standing in silence. `done` is the second half of the same fact —
   * an exchange that played is one you heard.
   */
  const joinable = Boolean(exchange) || Boolean(armed?.done && armed.key === wanderKey);
  const join = useMemo(
    () => (joinable ? { colleagueId: wanderer.seatId, partnerId, kind: wanderer.kind } : null),
    [joinable, partnerId, wanderer]
  );

  const lines = exchange?.lines ?? [];

  /*
   * Never `undefined`, which is the trap CLAUDE.md records about this hook: with
   * no narrator every line is revealed at once, and two balloons over two
   * adjacent heads is the one thing the § 6 rule 29 work was about. A wrapper
   * that reports nothing was heard keeps the reveal one-at-a-time and lets the
   * pacing fall back to `paceMs`.
   */
  const narrate = useCallback(
    (line) => {
      if (typeof narrateLine !== 'function') return Promise.resolve({ spoken: false });
      return Promise.resolve(narrateLine(line)).catch(() => ({ spoken: false }));
    },
    [narrateLine]
  );

  const handleDone = useCallback(() => {
    setOverheard((count) => count + 1);
    setArmed((current) => (current ? { ...current, done: true } : current));
  }, []);

  const { visibleLines, lineSpoken } = useScenePacing({
    lines,
    active: lines.length > 0,
    narrateLine: narrate,
    paceMs: SHOP_TALK_PACE_MS,
    silentDurationMs: SHOP_TALK_PACE_MS * 2,
    tailMs: SHOP_TALK_TAIL_MS,
    sceneId: armed?.key ?? null,
    onDone: handleDone
  });

  /*
   * **One line at a time, which is where this parts company with the scene
   * cards.** They accumulate, because a card is a transcript you read down. Two
   * speakers a tile apart on the floor are two balloons in the same square of
   * screen, so the reveal is a hand-off instead: the opener clears when the reply
   * lands. It also happens to be how a conversation reads.
   */
  const index = Math.min(visibleLines, lines.length) - 1;
  const said = index >= 0 ? lines[index] : null;

  return { said, at: speechTileFor(said, wanderer?.seatId, exchange?.at), lineSpoken, join };
}

export default useFloorShopTalk;
