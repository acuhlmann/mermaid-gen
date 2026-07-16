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
  'OFFICE_IM_TEMPLATES',
  'OFFICE_WALKBY_FALLBACKS',
  'OFFICE_COFFEE_SCENES'
];

function deepKeys(value, prefix = '') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [prefix];
  return Object.keys(value).flatMap((key) =>
    deepKeys(value[key], prefix ? `${prefix}.${key}` : key)
  );
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
          ...(template.lines?.map((l) => l.text) ?? [])
        ];
        const localizedTemplate = localized[bank][index];
        const locTexts = [
          localizedTemplate.subject,
          localizedTemplate.body,
          ...(localizedTemplate.lines?.map((l) => l.text) ?? [])
        ];
        for (const slot of ['{label}', '{userTitle}']) {
          const enHasSlot = enTexts.some((text) => text?.includes(slot));
          const locHasSlot = locTexts.some((text) => text?.includes(slot));
          expect(locHasSlot, `${locale} ${bank}[${index}] ${slot}`).toBe(enHasSlot);
        }
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

  it.each(LOCALES)('keeps chrome copy structurally complete (%s)', (locale) => {
    const localized = getUiLocaleBundle(locale).office;
    expect(deepKeys(localized.OFFICE_CHROME_COPY).sort()).toEqual(
      deepKeys(OFFICE_CHROME_COPY).sort()
    );
    expect(localized.OFFICE_IM_QUICK_REPLIES).toHaveLength(3);
  });

  it('routes localized copy through the officeCast accessors', () => {
    setActiveOfficeBundle(getUiLocaleBundle('zh-CN').office);
    expect(officeEmailTemplates()[0].subject).toContain('冰箱');
    expect(officeMeetingCopy().minutesTitle).toBe('会议纪要');
    expect(officeChromeCopy().doIt).toBe('就这么办');
    expect(officeImQuickReplies()).toContain('开会中');
    expect(officeSenderInfo('facilities').title).toContain('冰箱');
    expect(officeSenderInfo('facilities').name).toBe('Gary');
    expect(officeSenderInfo('facilities').accentColor).toBeTruthy();
    expect(fillOfficeSlots('看看 {label}', {})).toBe('看看 这张图');
    setActiveOfficeBundle(null);
    expect(officeChromeCopy().doIt).toBe('Do it');
    expect(fillOfficeSlots('see {label}', {})).toBe('see the diagram');
  });
});
