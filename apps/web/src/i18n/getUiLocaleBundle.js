import { DEFAULT_UI_LOCALE, normalizeUiLocale } from '@archislop/shared';
import * as slopitectEn from '../utils/slopitectCopy.js';
import { deepMergeLocale } from './deepMergeLocale.js';
import { CONTROLS_EN } from './locales/controls.en.js';
import { CONTROLS_ZH_CN } from './locales/controls.zh-CN.js';
import { CONTROLS_ZH_TW } from './locales/controls.zh-TW.js';
import { SLOPITECT_GAMIFICATION_EN } from './locales/slopitectGamification.en.js';
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
        refine: 'Engineer',
        innovate: 'Innovator',
        explain: 'Architect'
      },
      ...SLOPITECT_GAMIFICATION_EN
    }
  };
}

const EN_BUNDLE = buildEnglishBundle();

const LOCALE_OVERRIDES = {
  'zh-CN': {
    controls: CONTROLS_ZH_CN,
    slopitect: SLOPITECT_ZH_CN
  },
  'zh-TW': {
    controls: CONTROLS_ZH_TW,
    slopitect: SLOPITECT_ZH_TW
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
    slopitect: deepMergeLocale(EN_BUNDLE.slopitect, overrides.slopitect)
  };
}

export { EN_BUNDLE };
