import { describe, expect, it } from 'vitest';
import { interruptSpeech, interruptionFor } from '../src/utils/officeFloorInterrupt.js';
import { officeChromeCopy } from '../src/utils/officeCast.js';
import { propHandsFor } from '../src/utils/officeFloorProps.js';

/**
 * "Excuse me" — the reaction half of slice 18.
 *
 * The trip machine's half lives in `officeFloorWander.test.jsx`, where the
 * interruption is actually caused; this file is the pure derivation on its own,
 * which is where the bank arithmetic and the locale defences are cheap to pin.
 */

const copy = officeChromeCopy().floor;

describe('which reaction a cut-short errand earns', () => {
  it('reads the phase, which is the same fact the hand reads', () => {
    /*
     * The invariant the whole slice rests on: `goHome` decides what somebody
     * carries home from `phase === 'dwell'`, and this decides what they say
     * about it from the same field. Asserted as the pair rather than as two
     * literals, so the day somebody changes what "arrived" means, both halves
     * move together or this fails.
     */
    expect(interruptionFor({ phase: 'dwell' }, () => 0).reaction).toBe('gotIt');
    expect(interruptionFor({ phase: 'out' }, () => 0).reaction).toBe('gaveUp');
  });

  it('gives a trip already walking home nothing to say', () => {
    // `goHome` early-returns on this phase for the same reason: a tile somebody
    // is merely crossing is not one you took off them.
    expect(interruptionFor({ phase: 'home' }, () => 0)).toBeNull();
    expect(interruptionFor(null, () => 0)).toBeNull();
    expect(interruptionFor(undefined, () => 0)).toBeNull();
  });

  it('stores a roll rather than an index', () => {
    /*
     * The bank is copy and copy is per-locale, so an index chosen against the
     * English bank can point past the end of a shorter one. A fraction is valid
     * against any length, including one a later slice adds a line to.
     */
    const said = interruptionFor({ phase: 'out' }, () => 0.42);
    expect(said.roll).toBe(0.42);
    expect(Number.isInteger(said.roll)).toBe(false);
  });
});

describe('the line itself', () => {
  const trip = (reaction, roll, kind = 'printer') => ({
    seatId: 'intern',
    kind,
    interrupted: { reaction, roll }
  });

  it('says nothing at all about a trip nobody interrupted', () => {
    // Every tick of every ordinary errand, which is nearly all of them.
    expect(interruptSpeech({ seatId: 'intern', kind: 'printer' }, copy)).toBeNull();
    expect(interruptSpeech({ seatId: 'intern', interrupted: null }, copy)).toBeNull();
    expect(interruptSpeech(null, copy)).toBeNull();
  });

  it('names the prop the room sent them to, with no placeholder left over', () => {
    const said = interruptSpeech(trip('gaveUp', 0.25), copy);
    expect(said.speakerId).toBe('intern');
    expect(said.reaction).toBe('gaveUp');
    expect(said.text).toContain(copy.props.items.printer.name);
    expect(said.text).not.toContain('{prop}');
  });

  it('does not double the article the prop name already carries', () => {
    /*
     * Found by writing the bank: English prop names are "the printer", not
     * "printer", so a line reading "the {prop}" renders "the the printer". The
     * zh bundles have the opposite shape (bare nouns), which is why the article
     * belongs to the name rather than to the sentence.
     */
    for (const bank of Object.values(copy.interrupt)) {
      for (const line of bank) {
        expect(line, line).not.toMatch(/\bthe \{prop\}/i);
      }
    }
  });

  it('never rolls past the end of the bank', () => {
    // `Math.random()` cannot return 1, but a stored roll survives a reload and a
    // locale switch, and the bank it lands in may be shorter than the one it
    // was rolled against.
    for (const reaction of ['gotIt', 'gaveUp']) {
      for (const roll of [0, 0.5, 0.999, 1]) {
        const said = interruptSpeech(trip(reaction, roll), copy);
        expect(said?.text, `${reaction} @ ${roll}`).toBeTruthy();
        expect(copy.interrupt[reaction].length).toBeGreaterThan(0);
      }
    }
  });

  it('drops placeholder lines rather than rendering a hole', () => {
    /*
     * Unreachable on the shipped floor — every wander destination is a
     * `propTileFor` kind and every one of those has a name — but the failure it
     * prevents is silent and ugly: "I did not need  that badly."
     */
    const nameless = { ...copy, props: { items: {} } };
    const said = interruptSpeech(trip('gaveUp', 0.25, 'mystery'), nameless);
    expect(said.text).toBeTruthy();
    expect(said.text).not.toContain('{prop}');
    expect(said.text).not.toMatch(/\s{2}/);
  });

  it('goes quiet rather than throwing when a bundle has no bank at all', () => {
    // `officeChromeCopy()` swaps whole bundles and never merges, so a locale
    // that has not been backfilled must degrade to silence, not to a crash.
    expect(interruptSpeech(trip('gotIt', 0), { props: copy.props })).toBeNull();
    expect(interruptSpeech(trip('gotIt', 0), {})).toBeNull();
  });
});

describe('the two reactions describe two different hands', () => {
  it('only the errand that reached the machine hands anything over', () => {
    /*
     * Ties the sentence to the art it has to agree with. `gotIt` is the phase
     * that fills a hand from the prop table; `gaveUp` is the one that comes back
     * with nothing. Somebody apologising for a coffee they are visibly holding —
     * or thanking you for one they are not — is what this pair prevents.
     */
    expect(interruptionFor({ phase: 'dwell' }, () => 0).reaction).toBe('gotIt');
    expect(propHandsFor('coffeeMachine')).toBe('coffee');
    expect(interruptionFor({ phase: 'out' }, () => 0).reaction).toBe('gaveUp');
  });
});
