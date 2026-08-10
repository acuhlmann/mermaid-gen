/**
 * "Excuse me" — the floor answers back when you take the square it wanted
 * (docs/office-isometric-mode.md § 5 slice 18).
 *
 * This slice adds **no physics**. Everything it needs already happened: slice 11
 * sends somebody to a prop, slice 12 lets you walk to the same tile, and
 * `useFloorWander`'s `inYourWay` already turns them round and walks them home
 * empty-handed if they never reached the machine. The room models the whole beat
 * — a colleague's errand, ruined by you, with the right thing missing from their
 * hand — and then says nothing at all about it. This module is the mouth.
 *
 * **Why an ambient wanderer is allowed to speak here, having been silent since
 * slice 11.** That slice's rule reads "the instant a wanderer could say
 * something they would be a walk-by, and walk-bys belong to the moment store",
 * and it is still right about ambient traffic. But `office-parody.md` § 11 draws
 * the line by **who started it**, not by where somebody is standing: a trip you
 * did not cause stays silent, and a trip you personally walked into is reactive.
 * The distinction is load-bearing rather than a loophole — the trigger is not a
 * timer, it is you claiming a tile, so nothing here can fire while you are
 * sitting still. That is the same self-limiting property that makes reactive
 * spend safe everywhere else in the office.
 *
 * **Canned on purpose, and not out of thrift.** The reactive LLM budget exists
 * because a generated reply to a sentence you *typed* is the one thing a bank
 * cannot fake (`officeCadence.js`). Nobody typed anything here; you stepped on
 * somebody's toe. One line from a small bank is what a real person would say,
 * and a model asked to improvise it would write a paragraph.
 *
 * **The reaction and the held item are one fact seen twice.** `goHome` decides
 * what somebody carries home by reading `phase === 'dwell'` — the room's own
 * record of having stood at the thing — and this module reads the same phase to
 * decide what they say about it. Somebody who got their coffee is being polite;
 * somebody who did not is going back with nothing, which is exactly what
 * `carrying: null` already draws. Deriving both from one field is what stops the
 * hand and the sentence from ever disagreeing.
 */

import { formatLocale } from '../i18n/formatLocale.js';

/**
 * @typedef {{ reaction: 'gotIt' | 'gaveUp', roll: number }} Interruption
 *   What a trip remembers about being cut short. `roll` is a 0–1 float rather
 *   than an index into the bank, and that is deliberate: the bank is copy, copy
 *   is per-locale, and a language switch mid-walk must not index past a shorter
 *   list. A fraction is valid against any bank length, including one somebody
 *   adds a line to later.
 */

/**
 * What this trip earns for being cut short, or `null` when it earns nothing.
 *
 * Called from inside `goHome`'s state updater, which is the only place that
 * still knows the phase the trip was in when you claimed its tile — one tick
 * later it reads `home` and the difference between "had their coffee" and "never
 * got there" is gone.
 *
 * A trip already walking home earns nothing, for the reason `goHome` itself
 * early-returns on that phase: they are on their way back to a chair, and a tile
 * they are merely crossing is not one you took from them.
 *
 * @param {{ phase: string } | null | undefined} trip
 * @param {() => number} [random]
 * @returns {Interruption | null}
 */
export function interruptionFor(trip, random = Math.random) {
  if (!trip || trip.phase === 'home') return null;
  return { reaction: trip.phase === 'dwell' ? 'gotIt' : 'gaveUp', roll: random() };
}

/**
 * The bank entries that can be said about this errand.
 *
 * Only ever narrows on a missing prop name, which the shipped floor cannot
 * produce — every wander destination is a `propTileFor` kind and every one of
 * those has a name (`officeFloorPropsTable.test.js` pins the alignment). It is
 * two lines of defence against the failure that would otherwise be silent and
 * ugly: a locale that gains a prop before it gains the prop's name renders
 * "I did not need the  that badly."
 */
function sayableLines(bank, prop) {
  if (!Array.isArray(bank)) return [];
  if (prop) return bank;
  return bank.filter((line) => !line.includes('{prop}'));
}

/**
 * The line, ready to render and to speak — or `null` when there is nothing to
 * say, which is every tick of every errand nobody interrupted.
 *
 * One derivation with two consumers that must agree, in the same shape the rest
 * of the floor uses for speech: `OfficeFloor` hands the result to
 * `useFloorSpokenText` to be narrated and to `FloorWanderer` to be drawn. Asking
 * twice would let the balloon and the voice pick different variants out of the
 * bank, which is the two-renderers-of-one-line trap ADR-0011 rule 1 exists to
 * close.
 *
 * `reaction` rides along so the stage can mark which of the two beats is on the
 * screen without re-reading the trip — the DOM saying "this figure is
 * apologising for a coffee they did not get" is what makes the pair testable
 * from the outside rather than only through the copy bank.
 *
 * @param {{ seatId: string, kind?: string, interrupted?: Interruption | null } | null} wanderer
 * @param {Record<string, any>} copy the floor's copy bundle
 * @returns {{ speakerId: string, text: string, reaction: string } | null}
 */
export function interruptSpeech(wanderer, copy) {
  const said = wanderer?.interrupted;
  if (!said) return null;

  const prop = copy?.props?.items?.[wanderer.kind]?.name ?? '';
  const lines = sayableLines(copy?.interrupt?.[said.reaction], prop);
  if (lines.length === 0) return null;

  const index = Math.min(lines.length - 1, Math.floor(said.roll * lines.length));
  return {
    speakerId: wanderer.seatId,
    text: formatLocale(lines[index], { prop }),
    reaction: said.reaction
  };
}

export default interruptSpeech;
