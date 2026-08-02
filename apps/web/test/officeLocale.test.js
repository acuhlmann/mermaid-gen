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
