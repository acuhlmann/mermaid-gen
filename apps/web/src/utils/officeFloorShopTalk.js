/**
 * Two colleagues, one conversation, none of it about you
 * (docs/office-isometric-mode.md § 5 slice 22).
 *
 * Every line this office has ever spoken has been addressed to the user. Walk-bys
 * come to your desk, IMs arrive in your thread, an interrupted errand apologises
 * to you (slice 18), and somebody you have loitered next to eventually looks up at
 * you (slice 19). The room talks *at* you and is otherwise silent, which is the
 * last big tell that nobody else in it is real. This module is the office
 * overheard rather than addressed: somebody stops at the printer, the person
 * whose desk is next to it answers, and you happen to be standing near enough to
 * catch it.
 *
 * **Why this does not reopen "ambience never speaks".** Slice 11's rule — the
 * instant a wanderer could say something they would be a walk-by — is about
 * lines aimed at the user, because a line aimed at the user demands an answer and
 * therefore belongs to the moment store. Nothing here is aimed at the user: there
 * is no reply, no Do-it, no thread, no unread count, and walking away mid-sentence
 * costs nothing, because it was never yours. An overheard exchange is closer to
 * the soundscape than to a walk-by — it is scenery that happens to have words, and
 * `office-parody.md` § 11 already keeps the two overheard performances this office
 * had (coffee scenes, cubicle battles) as **canned theatre** for exactly that
 * reason. This is a third one, staged in the room instead of on a card.
 *
 * **What stops it being a second reason for ambience to talk** — which CLAUDE.md
 * rules out in as many words — is that the trigger is *your position*. The room
 * does not chatter to itself in a corner you are not in: no exchange exists
 * unless you are stood close enough to hear it, so the voice is spent on where
 * you are rather than on a timer. That is the same inversion slices 18 and 19
 * made, applied to the one kind of line neither of them could reach.
 *
 * **The proximity ladder, which is the design.** `NAME_CHIP_RANGE_TILES` and
 * `EARSHOT_RANGE_TILES` are two rungs of one idea rather than two features that
 * happen to measure distance. Stand next to somebody and they talk to you; take
 * one step back and you overhear them talking to each other; walk away and the
 * room is quiet. The rungs are mutually exclusive **by construction** — an
 * exchange refuses to exist while you are inside chip range of either speaker —
 * so the room can never owe you a line to you and a line past you at the same
 * instant, which is the collision the two slices would otherwise have.
 *
 * **Zero LLM budget**, and not out of thrift. § 11's reactive spend exists because
 * a canned answer to a sentence the user *typed* is the clearest possible tell
 * that nobody is home. Nobody typed anything here, and the whole conceit is that
 * the conversation was already happening before you walked up — a model asked to
 * improvise small talk between two NPCs would write a scene, and a scene is what
 * `FloorScene` is for.
 */

import { tierOf } from './castTiers.js';
import { formatLocale } from '../i18n/formatLocale.js';
import { whereaboutsOf } from './officeFloorReach.js';
import {
  FLOOR_SEATS,
  NAME_CHIP_RANGE_TILES,
  YOU_SEAT_ID,
  isWithinEarshot,
  isWithinNameChipRange,
  seatFor,
  tileDistance
} from './officeFloorPlan.js';

/**
 * @typedef {{ speakerId: string, text: string }} ShopTalkLine
 * @typedef {{ kind: string, at: { x: number, y: number }, lines: ShopTalkLine[] }} ShopTalkExchange
 *   `at` is the wanderer's mark — where the exchange is happening, and what
 *   earshot is measured to. `lines` is always exactly the two the bank stores,
 *   in the order they are said.
 */

/**
 * Whoever is sitting close enough to the prop to be part of a conversation at
 * it, or `null` when nobody is.
 *
 * **The room answers this, not a table.** A wander mark is a prop mark
 * (`officeFloorWander.js`), and every prop mark on this floor was placed so a
 * person could stand at it and be seen — so asking which seats are within
 * `NAME_CHIP_RANGE_TILES` of one is asking a question the layout has already
 * answered. It comes back exactly right without anybody writing down who chats
 * to whom: the coffee machine has Gary next to it, the printer has Ticket Bot
 * Dave, and the whiteboard has the two pod engineers. Move a desk and the
 * pairings move with it.
 *
 * Note this is a *different question* from slice 19's, though it reuses the same
 * radius: that one measures from where **you** are stood, so at the whiteboard it
 * answers Gilfoyle. This one measures from the **mark**, which answers Dinesh.
 * Both are correct about their own subject and they are not expected to agree.
 *
 * Four exclusions, and only the last is new:
 *
 * - **You**, who are the audience.
 * - **The wanderer themselves**, who cannot answer their own opener. This is
 *   reachable rather than theoretical — Dinesh sits a tile from the whiteboard
 *   and is on the wander roster — and it is why the second-nearest seat matters.
 * - **The `senior` tier**, for the glass rather than for manners, exactly as
 *   `dwellTargetAt` and `talkTileFor` do it: leadership are sealed in and a
 *   conversation through a fixed pane is not one.
 * - **Anybody not in their own chair**, which `whereaboutsOf` reports as
 *   anything non-null. Somebody a moment has claimed is already being drawn with
 *   chrome of its own (§ 6 rule 5), and a second wanderer cannot be the partner
 *   because there is only ever one.
 *
 * Ties break on `FLOOR_SEATS` order for `dwellTargetAt`'s reason: two people sit
 * a tile from the whiteboard, and a random pick would re-credit the same
 * exchange to a different person on an unrelated re-render.
 *
 * @param {{ x: number, y: number } | null} mark
 * @param {string} wandererId
 * @param {{ wanderer?: unknown, awayIds?: string[] }} [floorState]
 * @returns {string | null}
 */
function canAnswerFrom(seat, wandererId, floorState) {
  if (seat.id === YOU_SEAT_ID || seat.id === wandererId) return false;
  if (tierOf(seat.id) === 'senior') return false;
  return !whereaboutsOf(seat.id, floorState);
}

export function shopTalkPartnerFor(mark, wandererId, floorState = {}) {
  if (!mark || !wandererId) return null;

  let best = null;
  for (const seat of FLOOR_SEATS) {
    if (!canAnswerFrom(seat, wandererId, floorState)) continue;
    const distance = tileDistance(mark, { x: seat.x, y: seat.y });
    if (distance > NAME_CHIP_RANGE_TILES) continue;
    if (best && best.distance <= distance) continue;
    best = { id: seat.id, distance };
  }

  return best?.id ?? null;
}

/**
 * Whether you are placed to overhear a conversation at `mark` between the two
 * people named — near enough to catch it, far enough not to be in it.
 *
 * Both halves are load-bearing and they fail differently. Without the outer
 * bound the office talks to itself across the room while you stand at reception,
 * which is the timer-driven chatter this whole program has been unwinding.
 * Without the inner bound you get slice 19's remark *and* an exchange from the
 * same two people inside five seconds — three lines, one of them to you and two
 * past you, which reads as a bug in both features rather than as either.
 *
 * The inner bound is measured **per speaker rather than to the mark**, because
 * the partner is a tile off the mark in an arbitrary direction: you can stand
 * two tiles from the whiteboard and still be shoulder to shoulder with Jared.
 *
 * @param {{ x: number, y: number } | null} youTile
 * @param {{ x: number, y: number } | null} mark
 * @param {{ x: number, y: number } | null} partnerTile
 * @returns {boolean}
 */
export function overhearableAt(youTile, mark, partnerTile) {
  if (!youTile || !mark) return false;
  if (!isWithinEarshot(youTile, mark)) return false;
  if (isWithinNameChipRange(youTile, mark)) return false;
  return !isWithinNameChipRange(youTile, partnerTile);
}

/**
 * Who would answer a wanderer at their prop, given where you are stood — or
 * `null`, which is the answer nearly always.
 *
 * The two questions above composed into the one the view actually asks, in the
 * same shape and for the same reason `useFloorDwell` takes the finished beat
 * rather than assembling it at the use site: this is four `?.`/`&&` operators
 * that a component with a complexity budget does not have to spend, and keeping
 * them here means the whole gate is testable without a renderer.
 *
 * Order matters for cost rather than for correctness — the partner lookup walks
 * the seat roster, so the phase check goes first and the overwhelming majority
 * of calls (a wanderer mid-stride, or none at all) stop on it.
 *
 * @param {{ seatId: string, to: { x: number, y: number }, phase: string } | null} wanderer
 * @param {{ x: number, y: number } | null} youTile
 * @param {{ wanderer?: unknown, awayIds?: string[] }} [floorState]
 * @returns {string | null}
 */
export function overheardPartnerFor(wanderer, youTile, floorState = {}) {
  if (wanderer?.phase !== 'dwell') return null;

  const partnerId = shopTalkPartnerFor(wanderer.to, wanderer.seatId, floorState);
  const seat = partnerId ? seatFor(partnerId) : null;
  if (!seat) return null;

  return overhearableAt(youTile, wanderer.to, { x: seat.x, y: seat.y }) ? partnerId : null;
}

/**
 * The exchange itself, ready to pace — or `null` when this prop has nothing in
 * the bank, which is how a locale that has not been translated yet degrades.
 *
 * Silence rather than a throw, and silence rather than an English fallback, for
 * the reason `interruptSpeech` gives: `officeChromeCopy()` swaps whole bundles,
 * so a missing key is a dead feature in that language and the only thing that
 * ever notices is `officeLocale.test.js`. Two lines of defence are cheaper than
 * a room where half a conversation happens.
 *
 * `roll` is a 0–1 float rather than an index for `interruptSpeech`'s reason too:
 * the bank is per-locale copy, and a language switch mid-exchange must not index
 * past a shorter list. It is rolled **once** by the caller and stored, so the
 * bubble and the voice cannot pick different pairs out of the same bank — the
 * two-renderers-of-one-line trap ADR-0011 rule 1 exists to close.
 *
 * @param {{ seatId: string, kind: string, to: { x: number, y: number } }} wanderer
 * @param {string} partnerId
 * @param {Record<string, any>} copy the floor's copy bundle
 * @param {number} roll
 * @returns {ShopTalkExchange | null}
 */
function pairAt(bank, roll) {
  if (!Array.isArray(bank) || bank.length === 0) return null;
  const pair = bank[Math.min(bank.length - 1, Math.floor(roll * bank.length))];
  return Array.isArray(pair) && pair.length >= 2 ? pair : null;
}

export function shopTalkExchange(wanderer, partnerId, copy, roll) {
  if (!wanderer || !partnerId) return null;

  const pair = pairAt(copy?.shopTalk?.[wanderer.kind], roll);
  if (!pair) return null;

  /*
   * `{prop}` is available to both halves for the same reason `interrupt` has it
   * — a line that can name the machine reads as a place rather than as banter —
   * but unlike that bank nothing here is required to use it, because the prop is
   * usually the subject rather than a noun in the sentence.
   */
  const prop = copy?.props?.items?.[wanderer.kind]?.name ?? '';
  return {
    kind: wanderer.kind,
    at: wanderer.to,
    lines: [
      { speakerId: wanderer.seatId, text: formatLocale(pair[0], { prop }) },
      { speakerId: partnerId, text: formatLocale(pair[1], { prop }) }
    ]
  };
}

export default shopTalkExchange;
