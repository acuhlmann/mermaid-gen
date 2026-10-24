import { describe, expect, it } from 'vitest';
import { getUiLocaleBundle } from '../src/i18n/getUiLocaleBundle.js';
import {
  OFFICE_COLLEAGUES,
  OFFICE_IM_TEMPLATES,
  officeSenderInfo
} from '../src/utils/officeCast.js';
import { OFFICE_WALKBY_FALLBACKS } from '../src/utils/officeWalkbyFallbacks.js';
import {
  OFFICE_IM_REPLY_TEMPLATES,
  OFFICE_TALK_REPLY_FALLBACKS
} from '../src/utils/officeImReplyFallbacks.js';
import { OFFICE_DWELL_FALLBACKS } from '../src/utils/officeDwellFallbacks.js';
import { OFFICE_EMAIL_REPLY_TEMPLATES } from '../src/utils/officeEmailReplyFallbacks.js';

/**
 * The provoked canned banks — the lines dealt when the user said something and
 * the model did not answer.
 *
 * These pins are **not** a funniness measurement. `docs/agents/domains/office.md`
 * § never-score-register-with-a-regex records why: a keyword regex scored Pam as
 * "conceding" when she was objecting, and the wrong number nearly reversed a
 * shipped decision. Comedy in a generated line is judged by a reader. What is
 * mechanical here is the wiring under it, and all three of these fail loudly
 * with a real symptom:
 *
 * 1. **Casting.** A `colleagueId` nobody resolves renders the line with no name
 *    and no face, so a good line arrives unsigned.
 * 2. **Slots.** `fillOfficeSlots` (utils/officeCast.js) knows exactly four
 *    tokens. A fifth — `{labl}`, or a `{name}` copied in from the chrome-copy
 *    convention — reaches the user as literal braces. The ambient banks fill
 *    other tokens through other code, so the check is scoped to these five
 *    banks, where `fillOfficeSlots` is the only filler in the path.
 * 3. **Register drift.** The blanket tone caps came off on 2026-10-24, and the
 *    cards above the lines now say *who each colleague aims at and how often*.
 *    The lines below are what a user reads when no backend is configured, so a
 *    nightly rung that "restores the friendly version" re-creates the exact
 *    contradiction the register pass removed: a card promising bite over a line
 *    that promises nothing. These are exact retired strings, not a tone proxy.
 */

const BANKS = [
  ['OFFICE_WALKBY_FALLBACKS', OFFICE_WALKBY_FALLBACKS],
  ['OFFICE_IM_REPLY_TEMPLATES', OFFICE_IM_REPLY_TEMPLATES],
  ['OFFICE_TALK_REPLY_FALLBACKS', OFFICE_TALK_REPLY_FALLBACKS],
  ['OFFICE_DWELL_FALLBACKS', OFFICE_DWELL_FALLBACKS],
  ['OFFICE_EMAIL_REPLY_TEMPLATES', OFFICE_EMAIL_REPLY_TEMPLATES],
  // Ambient, not provoked, but the same register and the same filler, and it is
  // the bank that repeats most often on a cold backend — so it carries the same
  // weight in the voice the room sounds like.
  ['OFFICE_IM_TEMPLATES', OFFICE_IM_TEMPLATES]
];

const KNOWN_SLOTS = new Set(['{label}', '{userName}', '{userTitle}', '{snippet}']);

/** The walk-by bank is the only one of the five mirrored into locale bundles. */
const LOCALES = ['en-AU', 'zh-CN', 'zh-TW'];

describe('provoked canned banks are wired to the cast', () => {
  it('casts every line to somebody the office can name', () => {
    for (const [bankName, bank] of BANKS) {
      for (const entry of bank) {
        if (!entry.colleagueId) continue; // an uncast line is any-colleague filler
        expect(officeSenderInfo(entry.colleagueId), `${bankName} ${entry.id}`).toBeTruthy();
      }
    }
  });

  // The reply banks filter `!colleagueId || colleagueId === target`, so an
  // uncast line is the house fallback when the person asked has no line of
  // their own; the walk-by bank is ambient and every line is attributed on
  // purpose. Pinning "every bank has an uncast entry" was wrong — the delivery
  // code already handles the empty-filter case by dealing from the whole bank.
});

describe('canned copy fills', () => {
  it('uses only the four slots fillOfficeSlots actually replaces', () => {
    for (const [bankName, bank] of BANKS) {
      for (const entry of bank) {
        for (const field of ['body', 'subject']) {
          const text = entry[field];
          if (typeof text !== 'string') continue;
          for (const token of text.match(/\{[a-zA-Z]+\}/g) ?? []) {
            expect(KNOWN_SLOTS.has(token), `${bankName} ${entry.id} ${field} ${token}`).toBe(true);
          }
        }
      }
    }
  });

  it('keeps the slot set legal in every mirrored locale bank', () => {
    for (const locale of LOCALES) {
      const bundle = getUiLocaleBundle(locale).office;
      const banks = [
        ['OFFICE_WALKBY_FALLBACKS', bundle.OFFICE_WALKBY_FALLBACKS],
        ['OFFICE_IM_TEMPLATES', bundle.OFFICE_IM_TEMPLATES]
      ];
      for (const [bankName, bank] of banks) {
        for (const entry of bank) {
          for (const token of entry.body.match(/\{[a-zA-Z]+\}/g) ?? []) {
            expect(KNOWN_SLOTS.has(token), `${locale} ${bankName} ${entry.id} ${token}`).toBe(true);
          }
        }
      }
    }
  });
});

describe('the register the persona cards promise is the register the canned lines deliver', () => {
  // Retired 2026-10-24, with the voice-card pass. Bare cheer with no target is
  // the thing the owner rejected; `docs/automations/office-life.md` § 3 carries
  // the standing rule for the next tone slice.
  const RETIRED = [
    'Amazing energy. Parking lot pending.',
    'Thank you so much for the visibility!!',
    "We'll circle back with so much care.",
    'love the wellness energy',
    'great wellness energy',
    "Let's time-box a follow-up after standup",
    'shall we time-box a follow-up?',
    'blocking anything I should capture',
    'Amazing energy either way',
    'Love that for us',
    'Parking-lotting the feelings with so much care'
  ];

  it.each(BANKS)(
    'has retired the targetless cheer in every English bank (%s)',
    (bankName, bank) => {
      const text = bank.map((entry) => `${entry.subject ?? ''} ${entry.body ?? ''}`).join('\n');
      for (const phrase of RETIRED) {
        expect(text, `${bankName} still says: ${phrase}`).not.toContain(phrase);
      }
    }
  );

  // The roster card and the directory replay both speak `introLine`, so it is
  // the most-heard thing anybody says about Pam — and the locale bundles carry
  // their own copy of it, which is why the retired phrases are checked there
  // too: a translation that renders "Love that for us" faithfully has simply
  // kept the line that was cut from the English.
  it('has retired it from every intro line, in every locale', () => {
    const english = Object.values(OFFICE_COLLEAGUES)
      .map((person) => person.introLine ?? '')
      .join('\n');
    for (const phrase of RETIRED) {
      expect(english, `introLine still says: ${phrase}`).not.toContain(phrase);
    }
    for (const locale of LOCALES) {
      const localized = getUiLocaleBundle(locale).office.OFFICE_COLLEAGUES ?? {};
      const text = Object.values(localized)
        .map((person) => person.introLine ?? '')
        .join('\n');
      for (const phrase of RETIRED) {
        expect(text, `${locale} introLine still says: ${phrase}`).not.toContain(phrase);
      }
    }
  });

  it('keeps the cheer aimed: every Pam line names a ceremony artefact', () => {
    // Not a funniness proxy — Pam's card makes the ceremony *the weapon* ("the
    // facilitation is the weapon, not the vocabulary"), so a Pam line with no
    // ceremony object in it is a line written for anyone, which is how the
    // saccharine version got in. Grep: {count: 0} would be the drift.
    const INSTRUMENT =
      /time-box|parking lot|standup|story.?point|sprint|velocity|retro|pulse|board|spike|doc/i;
    for (const [bankName, bank] of BANKS) {
      for (const entry of bank) {
        if (entry.colleagueId !== 'scrumMaster') continue;
        expect(INSTRUMENT.test(entry.body), `${bankName} ${entry.id}`).toBe(true);
      }
    }
  });

  it("keeps the mechanical floor: no canned line refuses the user's work", () => {
    // The invariant that survived the tone change ("never block, gate, or
    // withhold the user's work") is mechanical, so it can be pinned by the
    // shape of a refusal rather than by a judgment about warmth.
    const REFUSAL = /\b(i won't|we won't|can't help you|not until you|refuse to)\b/i;
    for (const [bankName, bank] of BANKS) {
      for (const entry of bank) {
        expect(REFUSAL.test(entry.body), `${bankName} ${entry.id}`).toBe(false);
      }
    }
  });
});
