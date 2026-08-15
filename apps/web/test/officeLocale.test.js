import { afterEach, describe, expect, it } from 'vitest';
import { getUiLocaleBundle } from '../src/i18n/getUiLocaleBundle.js';
import {
  fillOfficeSlots,
  officeChromeCopy,
  officeEmailTemplates,
  officeImQuickReplies,
  officeMeetingCopy,
  officeSenderInfo,
  setActiveOfficeBundle,
  OFFICE_CHROME_COPY,
  OFFICE_EMAIL_TEMPLATES
} from '../src/utils/officeCast.js';

const LOCALES = ['en-AU', 'zh-CN', 'zh-TW'];
const TEMPLATE_BANKS = [
  'OFFICE_EMAIL_TEMPLATES',
  'SENIOR_EMAIL_TEMPLATES',
  'OFFICE_IM_TEMPLATES',
  'OFFICE_WALKBY_FALLBACKS',
  'OFFICE_COFFEE_SCENES',
  'OFFICE_BATTLE_SCENES'
];

function deepKeys(value, prefix = '') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [prefix];
  return Object.keys(value).flatMap((key) =>
    deepKeys(value[key], prefix ? `${prefix}.${key}` : key)
  );
}

/** @param {string[]} expected @param {string[]} actual */
function formatKeyDiff(expected, actual) {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  const missing = expected.filter((key) => !actualSet.has(key));
  const extra = actual.filter((key) => !expectedSet.has(key));
  const lines = [];
  if (missing.length > 0) {
    lines.push(
      `missing (${missing.length}): ${missing.slice(0, 12).join(', ')}${missing.length > 12 ? '…' : ''}`
    );
  }
  if (extra.length > 0) {
    lines.push(
      `extra (${extra.length}): ${extra.slice(0, 12).join(', ')}${extra.length > 12 ? '…' : ''}`
    );
  }
  return lines.join('; ') || 'no key diff';
}

afterEach(() => {
  setActiveOfficeBundle(null);
});

describe('office locale bundles', () => {
  it('exposes the English office bank on the default bundle', () => {
    const bundle = getUiLocaleBundle('en');
    expect(bundle.office.OFFICE_EMAIL_TEMPLATES).toBe(OFFICE_EMAIL_TEMPLATES);
    expect(bundle.office.OFFICE_CHROME_COPY.doIt).toBe('Do it');
  });

  // The seen-template memory persists template ids across locale switches, so
  // every locale must keep ids, colleagueIds, and speakers aligned with English.
  it.each(LOCALES)('keeps template ids and casting aligned with English (%s)', (locale) => {
    const en = getUiLocaleBundle('en').office;
    const localized = getUiLocaleBundle(locale).office;
    for (const bank of TEMPLATE_BANKS) {
      expect(localized[bank].map((t) => t.id)).toEqual(en[bank].map((t) => t.id));
      expect(localized[bank].map((t) => t.colleagueId ?? null)).toEqual(
        en[bank].map((t) => t.colleagueId ?? null)
      );
    }
    for (const [index, scene] of en.OFFICE_COFFEE_SCENES.entries()) {
      expect(localized.OFFICE_COFFEE_SCENES[index].lines.map((l) => l.speakerId)).toEqual(
        scene.lines.map((l) => l.speakerId)
      );
    }
    // Battles additionally carry a verdict per side — the speakers and the
    // pair of verdict keys must survive translation, or votes stop resolving.
    for (const [index, scene] of en.OFFICE_BATTLE_SCENES.entries()) {
      const localizedScene = localized.OFFICE_BATTLE_SCENES[index];
      expect(localizedScene.lines.map((l) => l.speakerId)).toEqual(
        scene.lines.map((l) => l.speakerId)
      );
      expect(Object.keys(localizedScene.verdicts).sort()).toEqual(
        Object.keys(scene.verdicts).sort()
      );
      expect(Boolean(localizedScene.topic)).toBe(true);
    }
  });

  // {label} is the "comedy from specificity" hook — a translation that drops
  // the slot silently degrades every diagram-aware gag.
  it.each(LOCALES)('preserves {label} and {userTitle} slot fills (%s)', (locale) => {
    const en = getUiLocaleBundle('en').office;
    const localized = getUiLocaleBundle(locale).office;
    for (const bank of TEMPLATE_BANKS) {
      for (const [index, template] of en[bank].entries()) {
        const enTexts = [
          template.subject,
          template.body,
          template.topic,
          ...(template.lines?.map((l) => l.text) ?? []),
          ...Object.values(template.verdicts ?? {})
        ];
        const localizedTemplate = localized[bank][index];
        const locTexts = [
          localizedTemplate.subject,
          localizedTemplate.body,
          localizedTemplate.topic,
          ...(localizedTemplate.lines?.map((l) => l.text) ?? []),
          ...Object.values(localizedTemplate.verdicts ?? {})
        ];
        for (const slot of ['{label}', '{userTitle}']) {
          const enHasSlot = enTexts.some((text) => text?.includes(slot));
          const locHasSlot = locTexts.some((text) => text?.includes(slot));
          expect(locHasSlot, `${locale} ${bank}[${index}] ${slot}`).toBe(enHasSlot);
        }
      }
    }
  });

  // Set-piece markers (§10.1 training, §10.2 phishing) decide whether an email
  // grows a CTA at all. They are not text, so the slot-fill test above sails
  // straight past a missing one — and the symptom is that the whole set piece
  // is simply unreachable in that locale, with nothing rendered to notice.
  it.each(LOCALES)('carries the set-piece markers into every locale (%s)', (locale) => {
    const en = getUiLocaleBundle('en').office;
    const localized = getUiLocaleBundle(locale).office;
    for (const bank of ['OFFICE_EMAIL_TEMPLATES', 'SENIOR_EMAIL_TEMPLATES']) {
      for (const [index, template] of en[bank].entries()) {
        const localizedTemplate = localized[bank][index];
        expect(localizedTemplate.training ?? null, `${locale} ${bank}[${index}] training`).toBe(
          template.training ?? null
        );
        expect(Boolean(localizedTemplate.phishing), `${locale} ${bank}[${index}] phishing`).toBe(
          Boolean(template.phishing)
        );
        // Slice 26's marker is the same class again, and the *value* matters
        // rather than its presence: it names who you are being sent to see, so
        // a locale that mistranslated it into a different cast id would send
        // you across the room to the wrong person.
        expect(localizedTemplate.errand ?? null, `${locale} ${bank}[${index}] errand`).toBe(
          template.errand ?? null
        );
        // Same class again: an email's Do-it is a field, not a slot-bearing
        // string. A locale that drops it loses the whole action — the Re-org
        // (§10.5) is nothing but its actionPrompt.
        expect(
          Boolean(localizedTemplate.actionPrompt),
          `${locale} ${bank}[${index}] actionPrompt`
        ).toBe(Boolean(template.actionPrompt));
      }
    }
  });

  it.each(['zh-CN', 'zh-TW'])('translates every email and the meeting copy (%s)', (locale) => {
    const en = getUiLocaleBundle('en').office;
    const localized = getUiLocaleBundle(locale).office;
    for (const [index, template] of en.OFFICE_EMAIL_TEMPLATES.entries()) {
      expect(localized.OFFICE_EMAIL_TEMPLATES[index].subject).not.toBe(template.subject);
      expect(localized.OFFICE_EMAIL_TEMPLATES[index].body).not.toBe(template.body);
    }
    for (const key of Object.keys(en.OFFICE_MEETING_COPY)) {
      expect(localized.OFFICE_MEETING_COPY[key], `${locale} ${key}`).toBeTruthy();
      expect(localized.OFFICE_MEETING_COPY[key]).not.toBe(en.OFFICE_MEETING_COPY[key]);
    }
    expect(localized.OFFICE_SLOT_FALLBACKS.label).not.toBe(en.OFFICE_SLOT_FALLBACKS.label);
  });

  // The welcome beats are pushed by id-less first-run code paths — casting and
  // slot fills must stay aligned so the sequence reads the same in any locale.
  it.each(LOCALES)('keeps the welcome beats aligned with English (%s)', (locale) => {
    const en = getUiLocaleBundle('en').office;
    const localized = getUiLocaleBundle(locale).office;
    for (const key of ['OFFICE_WELCOME_EMAIL', 'OFFICE_WELCOME_IM']) {
      expect(localized[key].id).toBe(en[key].id);
      expect(localized[key].colleagueId).toBe(en[key].colleagueId);
      for (const field of ['subject', 'body']) {
        const enHasSlot = Boolean(en[key][field]?.includes('{userTitle}'));
        const locHasSlot = Boolean(localized[key][field]?.includes('{userTitle}'));
        expect(locHasSlot, `${locale} ${key} ${field} {userTitle}`).toBe(enHasSlot);
      }
    }
  });

  it.each(['zh-CN', 'zh-TW'])('translates the welcome beats and blurbs (%s)', (locale) => {
    const en = getUiLocaleBundle('en').office;
    const localized = getUiLocaleBundle(locale).office;
    expect(localized.OFFICE_WELCOME_EMAIL.subject).not.toBe(en.OFFICE_WELCOME_EMAIL.subject);
    expect(localized.OFFICE_WELCOME_EMAIL.body).not.toBe(en.OFFICE_WELCOME_EMAIL.body);
    expect(localized.OFFICE_WELCOME_IM.body).not.toBe(en.OFFICE_WELCOME_IM.body);
    for (const id of Object.keys(en.OFFICE_COLLEAGUES)) {
      expect(localized.OFFICE_COLLEAGUES[id].blurb, `${locale} ${id} blurb`).toBeTruthy();
      expect(localized.OFFICE_COLLEAGUES[id].blurb).not.toBe(en.OFFICE_COLLEAGUES[id].blurb);
    }
  });

  it.each(LOCALES)('keeps chrome copy structurally complete (%s)', (locale) => {
    const localized = getUiLocaleBundle(locale).office;
    const expectedKeys = deepKeys(OFFICE_CHROME_COPY).sort();
    const actualKeys = deepKeys(localized.OFFICE_CHROME_COPY).sort();
    expect(
      actualKeys,
      `${locale} OFFICE_CHROME_COPY keys must match officeCast.js — ${formatKeyDiff(expectedKeys, actualKeys)}. When editing OFFICE_CHROME_COPY.directory, sync apps/web/src/i18n/locales/office.*.js`
    ).toEqual(expectedKeys);
    expect(localized.OFFICE_IM_QUICK_REPLIES).toHaveLength(8);
  });

  it.each(LOCALES)('localizes floor chrome (%s)', (locale) => {
    const localized = getUiLocaleBundle(locale).office;
    const floor = localized.OFFICE_CHROME_COPY.floor;
    expect(floor?.title).toBeTruthy();
    expect(floor.title).not.toBe(OFFICE_CHROME_COPY.floor.title);
    expect(floor.zones?.kitchen).toBeTruthy();
    expect(floor.narration?.inHuddle).toBeTruthy();
  });

  /*
   * The floor's prop copy is the one chrome branch where a *missing* key is a
   * silently dead feature rather than an English fallback: `officeChromeCopy()`
   * swaps whole bundles (`office()?.OFFICE_CHROME_COPY ?? OFFICE_CHROME_COPY`),
   * it does not merge, and `FloorPropCard` hides the **Look closer** button
   * entirely when `details` is empty. Nothing rendered, nothing to notice — the
   * same failure mode the set-piece marker test above exists to catch.
   *
   * Found for real: en-AU shipped without `look`, `lookTitle` or any `details`
   * at all, so slice 9's follow-up had never worked in that locale.
   */
  it.each(LOCALES)('keeps every usable prop lookable (%s)', (locale) => {
    const props = getUiLocaleBundle(locale).office.OFFICE_CHROME_COPY.floor.props;
    expect(props.look, `${locale} floor.props.look`).toBeTruthy();
    expect(props.lookTitle, `${locale} floor.props.lookTitle`).toBeTruthy();
    for (const kind of Object.keys(OFFICE_CHROME_COPY.floor.props.items)) {
      const en = OFFICE_CHROME_COPY.floor.props.items[kind];
      if (!en.details?.length) continue;
      expect(props.items[kind]?.details?.length ?? 0, `${locale} ${kind}.details`).toBe(
        en.details.length
      );
    }
  });

  /*
   * Slice 26. Third instance of the dead-feature class, and the one with the
   * longest fuse: `FloorErrandCard` withholds itself when `floor.errand` is
   * missing, so an untranslated locale hands you an errand from the inbox and
   * then offers no way to run it on the floor — the card slot silently falls
   * back to the hint and nothing anywhere says why. `{from}` and `{name}` carry
   * the two people, so a translation that drops them loses which of them sent
   * you and which you are looking for.
   */
  it.each(LOCALES)('carries the errand copy onto both renderers (%s)', (locale) => {
    const office = getUiLocaleBundle(locale).office.OFFICE_CHROME_COPY;
    for (const key of ['startCta', 'startCtaTitle']) {
      expect(office.errand?.[key], `${locale} errand.${key}`).toBeTruthy();
    }
    expect(office.errand.startCta).toContain('{name}');

    const card = office.floor?.errand;
    for (const key of ['eyebrow', 'body', 'action', 'actionTitle', 'drop', 'dropTitle']) {
      expect(card?.[key], `${locale} floor.errand.${key}`).toBeTruthy();
    }
    for (const slot of ['{from}', '{name}']) {
      expect(card.body, `${locale} floor.errand.body ${slot}`).toContain(slot);
      expect(
        office.floor.narration.onErrand,
        `${locale} floor.narration.onErrand ${slot}`
      ).toContain(slot);
    }
  });

  /*
   * Slice 16: the whiteboard's filled state. `lineYours` is what
   * `FloorPropCard` branches on, so a locale missing it quietly keeps showing
   * the empty-state architecture from two re-orgs ago even with your diagram on
   * the board — and `{count}` / `{labels}` are the whole point of the line, so
   * a translation that drops them loses the specificity the joke runs on.
   */
  it.each(LOCALES)('carries the board-aware whiteboard copy (%s)', (locale) => {
    const item = getUiLocaleBundle(locale).office.OFFICE_CHROME_COPY.floor.props.items.whiteboard;
    const en = OFFICE_CHROME_COPY.floor.props.items.whiteboard;
    expect(item.lineYours, `${locale} whiteboard.lineYours`).toBeTruthy();
    expect(item.lineYours).toContain('{count}');
    expect(item.detailsYours?.length ?? 0).toBe(en.detailsYours.length);
    expect(item.detailsYours.some((d) => d.includes('{labels}'))).toBe(true);
  });

  /*
   * Slice 18. Same failure mode as the two above and worth its own case for the
   * reason `interruptSpeech` is built the way it is: an absent bank is not an
   * English fallback, it is a colleague who walks away from an errand you ruined
   * without a word, in that locale only, forever. The module degrades to silence
   * rather than throwing, which is right at runtime and is exactly why nothing
   * would ever surface it.
   *
   * Lengths are pinned rather than merely non-empty because the roll that picks
   * a line is stored on the trip: a locale with a shorter bank still renders
   * (`Math.min` clamps it), but it would quietly bias every reaction towards its
   * last entry.
   */
  it.each(LOCALES)('has something to say when you take somebody s square (%s)', (locale) => {
    const interrupt = getUiLocaleBundle(locale).office.OFFICE_CHROME_COPY.floor.interrupt;
    for (const [reaction, en] of Object.entries(OFFICE_CHROME_COPY.floor.interrupt)) {
      expect(interrupt?.[reaction]?.length ?? 0, `${locale} floor.interrupt.${reaction}`).toBe(
        en.length
      );
      // Translated, not copied: a bank that came back in English is the other
      // half of this suite's job (values, not key shapes).
      expect(interrupt[reaction], `${locale} ${reaction} untranslated`).not.toEqual(en);
      // `{prop}` is what names the machine they did not get to. `formatLocale`
      // silently leaves a dropped placeholder unsubstituted, so nothing else
      // notices a translator losing it.
      expect(
        interrupt[reaction].filter((line) => line.includes('{prop}')).length,
        `${locale} ${reaction} {prop}`
      ).toBe(en.filter((line) => line.includes('{prop}')).length);
    }
  });

  /*
   * Slice 22, and the same failure mode as `interrupt` above with one extra way
   * to go wrong: this bank is **pairs**, so a locale can be present, the right
   * length, fully translated — and still ship an entry with one line in it,
   * which `shopTalkExchange` drops on the floor. The result is a colleague who
   * opens a conversation nobody answers, in that language only.
   *
   * Prop keys are pinned as a set rather than counted because they are not
   * decorative: `shopTalkPartnerFor` derives *who replies* from the layout, and
   * the key is what decides which voice the reply is written in. A locale
   * missing `printer` is not a shorter bank, it is Ticket Bot Dave gone silent
   * at his own desk.
   */
  it.each(LOCALES)('carries both halves of every overheard exchange (%s)', (locale) => {
    const shopTalk = getUiLocaleBundle(locale).office.OFFICE_CHROME_COPY.floor.shopTalk;
    const en = OFFICE_CHROME_COPY.floor.shopTalk;
    expect(Object.keys(shopTalk ?? {}).sort(), `${locale} shopTalk props`).toEqual(
      Object.keys(en).sort()
    );
    for (const [kind, pairs] of Object.entries(en)) {
      expect(shopTalk[kind]?.length ?? 0, `${locale} shopTalk.${kind}`).toBe(pairs.length);
      expect(shopTalk[kind], `${locale} shopTalk.${kind} untranslated`).not.toEqual(pairs);
      for (const [index, pair] of shopTalk[kind].entries()) {
        expect(pair, `${locale} shopTalk.${kind}[${index}] is not a pair`).toHaveLength(2);
        for (const line of pair) expect(typeof line).toBe('string');
        expect(pair.every((line) => line.trim().length > 0)).toBe(true);
      }
    }
  });

  /*
   * Slice 23. `officeChromeCopy()` swaps bundles rather than merging, so a
   * locale with no `join` block is a floor that overhears conversations and
   * never offers a way into one — in that language only, with nothing rendered
   * to notice. `FloorJoinCard` degrades to no card rather than an untitled one,
   * which is right at runtime and is exactly why this has to be pinned here.
   *
   * `{name}` / `{partner}` / `{prop}` are checked by name because
   * `formatLocale` leaves a dropped placeholder unsubstituted in silence: a
   * translator who loses `{partner}` ships a card that names one half of a
   * two-hander, and the only thing that ever sees it is this assertion.
   */
  it.each(LOCALES)('offers a way into a conversation you overhear (%s)', (locale) => {
    const join = getUiLocaleBundle(locale).office.OFFICE_CHROME_COPY.floor.join;
    const en = OFFICE_CHROME_COPY.floor.join;
    expect(Object.keys(join ?? {}).sort(), `${locale} floor.join`).toEqual(Object.keys(en).sort());
    /*
     * The block as a whole rather than key by key: a locale that never wrote
     * this key at all deep-merges to English and comes back *identical*, which
     * is the failure this catches, while an `eyebrow` that happens to read the
     * same in en-AU is a label rather than a missing translation.
     */
    expect(join, `${locale} floor.join untranslated`).not.toEqual(en);
    for (const key of Object.keys(en)) {
      expect(String(join[key]).trim().length, `${locale} floor.join.${key} empty`).toBeGreaterThan(
        0
      );
    }
    for (const slot of ['{name}', '{partner}', '{prop}']) {
      expect(join.body, `${locale} floor.join.body lost ${slot}`).toContain(slot);
    }
    // The live region says the same thing in its own register, and it names the
    // same two people.
    const narration = getUiLocaleBundle(locale).office.OFFICE_CHROME_COPY.floor.narration;
    expect(narration.overhearing, `${locale} floor.narration.overhearing`).toBeTruthy();
    expect(narration.overhearing).not.toBe(OFFICE_CHROME_COPY.floor.narration.overhearing);
    for (const slot of ['{name}', '{partner}']) {
      expect(narration.overhearing, `${locale} overhearing lost ${slot}`).toContain(slot);
    }
  });

  /*
   * Slice 28, and the same failure mode as `join` above with one extra way to
   * hurt: `line` is not chrome, it is a **spoken beat**. A locale missing this
   * block has no card — that much matches the join rung — but `handleJoinCoffee`
   * also reads `line` from it, and refuses the verb when it is blank. So an
   * untranslated bundle does not ship a broken button; it ships a coffee break
   * that cannot be joined at all, in that language only, with nothing rendered
   * to notice. That is precisely the class `officeChromeCopy()`'s swap-don't-
   * merge behaviour keeps producing, so it gets pinned the same way.
   *
   * `{name}` by name for `formatLocale`'s reason: a dropped placeholder is
   * substituted with nothing and in silence, and this body names the one person
   * whose invitation you turned down.
   */
  /*
   * Slice 30 gave the cubicle battle its own block rather than a `{kind}`
   * branch inside this one, so the sweep is over both. A locale that translated
   * only the coffee break offers only the coffee break — which is the intended
   * degradation, and exactly what an untranslated `sceneJoinBattle` would look
   * like if nothing swept it.
   */
  const JOIN_BLOCKS = ['sceneJoin', 'sceneJoinBattle'];

  it.each(LOCALES.flatMap((locale) => JOIN_BLOCKS.map((block) => [locale, block])))(
    'offers a way into a set piece you turned down (%s %s)',
    (locale, block) => {
      const sceneJoin = getUiLocaleBundle(locale).office.OFFICE_CHROME_COPY.floor[block];
      const en = OFFICE_CHROME_COPY.floor[block];
      expect(Object.keys(en ?? {}).length, `${block} missing from English`).toBeGreaterThan(0);
      expect(Object.keys(sceneJoin ?? {}).sort(), `${locale} floor.${block}`).toEqual(
        Object.keys(en).sort()
      );
      expect(sceneJoin, `${locale} floor.${block} untranslated`).not.toEqual(en);
      for (const key of Object.keys(en)) {
        expect(
          String(sceneJoin[key]).trim().length,
          `${locale} floor.${block}.${key} empty`
        ).toBeGreaterThan(0);
      }
      expect(sceneJoin.body, `${locale} floor.${block}.body lost {name}`).toContain('{name}');
      /*
       * The closing beat must name nobody: it is spoken by whichever colleague
       * asked you, so a `{placeholder}` here would go unsubstituted and a proper
       * noun would put one cast member's name in another's mouth.
       */
      expect(sceneJoin.line, `${locale} floor.${block}.line takes a placeholder`).not.toMatch(
        /\{[a-z]+\}/i
      );
    }
  );

  it('routes localized copy through the officeCast accessors', () => {
    setActiveOfficeBundle(getUiLocaleBundle('zh-CN').office);
    expect(officeEmailTemplates()[0].subject).toContain('冰箱');
    expect(officeMeetingCopy().minutesTitle).toBe('会议纪要');
    expect(officeChromeCopy().doIt).toBe('就这么办');
    expect(officeImQuickReplies()).toContain('请指示');
    expect(officeImQuickReplies()).toContain('已记入你的档案');
    expect(officeSenderInfo('facilities').title).toContain('冰箱');
    expect(officeSenderInfo('facilities').name).toBe('Gary');
    expect(officeSenderInfo('facilities').accentColor).toBeTruthy();
    expect(fillOfficeSlots('看看 {label}', {})).toBe('看看 这张图');
    setActiveOfficeBundle(null);
    expect(officeChromeCopy().doIt).toBe('Do it');
    expect(fillOfficeSlots('see {label}', {})).toBe('see the diagram');
  });
});
