import {
  detectPromptLanguageHint,
  resolvePromptLanguageHint,
  type PromptLanguageHint
} from './promptLanguage.js';

/** BCP-47-ish locale codes the web UI can render. */
export type UiLocale = 'en' | 'zh-CN' | 'zh-TW';

export const DEFAULT_UI_LOCALE: UiLocale = 'en';

const UI_LOCALE_SET = new Set<UiLocale>(['en', 'zh-CN', 'zh-TW']);

/** Map agent prompt-language hints to a UI locale. */
export function promptHintToUiLocale(hint: PromptLanguageHint | null): UiLocale | null {
  if (!hint) return null;
  if (hint === 'Simplified Chinese (zh-CN)') return 'zh-CN';
  if (hint === 'Traditional Chinese (zh-TW)') return 'zh-TW';
  return 'zh-CN';
}

/**
 * Resolve a UI locale from user text (prompt, diagram labels, etc.).
 * Returns null when no non-English language is detected — callers keep the current locale.
 *
 * @deprecated Prefer {@link resolveUiLocaleFromExplicitRequest} for UI locale switches;
 * automatic Han-ratio detection is for agent reply language only.
 */
export function resolveUiLocaleFromText(
  ...sources: (string | null | undefined)[]
): UiLocale | null {
  return promptHintToUiLocale(resolvePromptLanguageHint(...sources));
}

type ExplicitLocaleRule = { locale: UiLocale; re: RegExp };

/** Weigh-in / prompt phrases that explicitly request a UI language change. */
const EXPLICIT_UI_LOCALE_RULES: ExplicitLocaleRule[] = [
  {
    locale: 'zh-TW',
    re: /\b(?:switch|change|use|show|display|set)\b[^.\n]{0,48}\b(?:traditional|taiwan(?:ese)?)\s+chinese\b/i
  },
  {
    locale: 'zh-TW',
    re: /\b(?:switch|change|use|show|display|set)\b[^.\n]{0,48}\b(?:to\s+)?(?:zh[- ]?tw|zh[- ]?hant)\b/i
  },
  { locale: 'zh-TW', re: /(?:切换|改用|显示|使用|换成).{0,24}(?:繁体|繁體|正體|台灣).{0,12}中文/ },
  {
    locale: 'zh-TW',
    re: /(?:界面|UI|介面).{0,16}(?:改成|切换为|切換為|使用).{0,16}(?:繁体|繁體|正體)/
  },
  {
    locale: 'zh-CN',
    re: /\b(?:switch|change|use|show|display|set)\b[^.\n]{0,48}\b(?:simplified\s+)?chinese\b/i
  },
  {
    locale: 'zh-CN',
    re: /\b(?:switch|change|use|show|display|set)\b[^.\n]{0,48}\b(?:to\s+)?(?:zh[- ]?cn|zh[- ]?hans)\b/i
  },
  { locale: 'zh-CN', re: /(?:切换|改用|显示|使用|换成).{0,24}(?:简体)?中文(?:界面|UI|介面)?/ },
  { locale: 'zh-CN', re: /(?:界面|UI|介面).{0,16}(?:改成|切换为|切換為|使用).{0,16}(?:简体)?中文/ },
  { locale: 'zh-CN', re: /用中文(?:界面|UI|介面)?/ },
  {
    locale: 'en',
    re: /\b(?:switch|change|use|show|display|set)\b[^.\n]{0,48}\b(?:to\s+)?english\b/i
  },
  { locale: 'en', re: /(?:切换|改用|显示|使用|换成).{0,16}(?:英文|英语|英語)(?:界面|UI|介面)?/ },
  {
    locale: 'en',
    re: /(?:界面|UI|介面).{0,16}(?:改成|切换为|切換為|使用).{0,16}(?:英文|英语|英語)/
  },
  { locale: 'en', re: /用英文(?:界面|UI|介面)?/ }
];

function firstExplicitLocaleMatch(text: string): UiLocale | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  for (const { locale, re } of EXPLICIT_UI_LOCALE_RULES) {
    if (re.test(trimmed)) return locale;
  }
  return null;
}

/**
 * Resolve a UI locale only when the user explicitly asks to change language
 * (e.g. via the Weigh In prompt). Returns null when no switch is requested.
 */
export function resolveUiLocaleFromExplicitRequest(
  ...sources: (string | null | undefined)[]
): UiLocale | null {
  for (const src of sources) {
    if (typeof src !== 'string' || !src.trim()) continue;
    const locale = firstExplicitLocaleMatch(src);
    if (locale) return locale;
  }
  return null;
}

/** Coerce unknown values to a supported UI locale (defaults to English). */
export function normalizeUiLocale(value: string | null | undefined): UiLocale {
  if (value && UI_LOCALE_SET.has(value as UiLocale)) return value as UiLocale;
  return DEFAULT_UI_LOCALE;
}

export { detectPromptLanguageHint, resolvePromptLanguageHint };
