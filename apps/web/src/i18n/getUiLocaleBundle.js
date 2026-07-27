import { DEFAULT_UI_LOCALE, normalizeUiLocale } from '@archislop/shared';
import * as officeEn from '../utils/officeCast.js';
import * as slopitectEn from '../utils/slopitectCopy.js';
import { deepMergeLocale } from './deepMergeLocale.js';
import { CONTROLS_EN } from './locales/controls.en.js';
import { CONTROLS_EN_AU } from './locales/controls.en-AU.js';
import { CONTROLS_ZH_CN } from './locales/controls.zh-CN.js';
import { CONTROLS_ZH_TW } from './locales/controls.zh-TW.js';
import { OFFICE_EN_AU } from './locales/office.en-AU.js';
import { OFFICE_ZH_CN } from './locales/office.zh-CN.js';
import { OFFICE_ZH_TW } from './locales/office.zh-TW.js';
import { SLOPITECT_GAMIFICATION_EN } from './locales/slopitectGamification.en.js';
import { SLOPITECT_EN_AU } from './locales/slopitect.en-AU.js';
import { SLOPITECT_ZH_CN } from './locales/slopitect.zh-CN.js';
import { SLOPITECT_ZH_TW } from './locales/slopitect.zh-TW.js';

function buildEnglishBundle() {
  return {
    locale: DEFAULT_UI_LOCALE,
    controls: CONTROLS_EN,
    slopitect: {
      PROMPT_ACTION_COPY: slopitectEn.PROMPT_ACTION_COPY,
      STAKEHOLDERS_MUTE_COPY: slopitectEn.STAKEHOLDERS_MUTE_COPY,
      VARIANT_PERSONAS: slopitectEn.VARIANT_PERSONAS,
      VARIANT_QUOTES: slopitectEn.VARIANT_QUOTES,
      PHASE_CEREMONIES: slopitectEn.PHASE_CEREMONIES,
      VARIANT_TAGLINES: slopitectEn.VARIANT_TAGLINES,
      VARIANT_BOOT_HEADLINES: slopitectEn.VARIANT_BOOT_HEADLINES,
      IDLE_TIPS: slopitectEn.IDLE_TIPS,
      PRESTIGE_TIERS: slopitectEn.PRESTIGE_TIERS,
      LEVELS: slopitectEn.LEVELS,
      VARIANT_MASTERY_ACHIEVEMENTS: slopitectEn.VARIANT_MASTERY_ACHIEVEMENTS,
      ACHIEVEMENTS: slopitectEn.ACHIEVEMENTS,
      LEVEL_UP_BANNER: slopitectEn.LEVEL_UP_BANNER,
      KONAMI_ACHIEVEMENT: slopitectEn.KONAMI_ACHIEVEMENT,
      CONSOLE_STAMP_LINES: slopitectEn.CONSOLE_STAMP_LINES,
      PROMPT_EASTER_EGGS: slopitectEn.PROMPT_EASTER_EGGS,
      ACTION_PERSONA_SHORT_NAMES: {
        gilfoyle: 'Gilfoyle',
        erlich: 'Erlich',
        explain: 'Architect'
      },
      ...SLOPITECT_GAMIFICATION_EN
    },
    office: {
      OFFICE_COLLEAGUES: officeEn.OFFICE_COLLEAGUES,
      SENIOR_STAKEHOLDERS: officeEn.SENIOR_STAKEHOLDERS,
      OFFICE_SLOT_FALLBACKS: officeEn.OFFICE_SLOT_FALLBACKS,
      OFFICE_EMAIL_TEMPLATES: officeEn.OFFICE_EMAIL_TEMPLATES,
      SENIOR_EMAIL_TEMPLATES: officeEn.SENIOR_EMAIL_TEMPLATES,
      OFFICE_WELCOME_EMAIL: officeEn.OFFICE_WELCOME_EMAIL,
      OFFICE_WELCOME_IM: officeEn.OFFICE_WELCOME_IM,
      OFFICE_IM_TEMPLATES: officeEn.OFFICE_IM_TEMPLATES,
      OFFICE_WALKBY_FALLBACKS: officeEn.OFFICE_WALKBY_FALLBACKS,
      OFFICE_COFFEE_SCENES: officeEn.OFFICE_COFFEE_SCENES,
      OFFICE_BATTLE_SCENES: officeEn.OFFICE_BATTLE_SCENES,
      OFFICE_MEETING_COPY: officeEn.OFFICE_MEETING_COPY,
      OFFICE_IM_QUICK_REPLIES: officeEn.OFFICE_IM_QUICK_REPLIES,
      OFFICE_CHROME_COPY: officeEn.OFFICE_CHROME_COPY
    }
  };
}

const EN_BUNDLE = buildEnglishBundle();

const LOCALE_OVERRIDES = {
  'en-AU': {
    controls: CONTROLS_EN_AU,
    slopitect: SLOPITECT_EN_AU,
    office: OFFICE_EN_AU
  },
  'zh-CN': {
    controls: CONTROLS_ZH_CN,
    slopitect: SLOPITECT_ZH_CN,
    office: OFFICE_ZH_CN
  },
  'zh-TW': {
    controls: CONTROLS_ZH_TW,
    slopitect: SLOPITECT_ZH_TW,
    office: OFFICE_ZH_TW
  }
};

/** @param {UiLocale} locale */
export function getUiLocaleBundle(locale) {
  const normalized = normalizeUiLocale(locale);
  if (normalized === 'en') return EN_BUNDLE;
  const overrides = LOCALE_OVERRIDES[normalized];
  return {
    locale: normalized,
    controls: deepMergeLocale(EN_BUNDLE.controls, overrides.controls),
    slopitect: deepMergeLocale(EN_BUNDLE.slopitect, overrides.slopitect),
    office: deepMergeLocale(EN_BUNDLE.office, overrides.office)
  };
}

export { EN_BUNDLE };
