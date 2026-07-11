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
 */
export function resolveUiLocaleFromText(
  ...sources: (string | null | undefined)[]
): UiLocale | null {
  return promptHintToUiLocale(resolvePromptLanguageHint(...sources));
}

/** Coerce unknown values to a supported UI locale (defaults to English). */
export function normalizeUiLocale(value: string | null | undefined): UiLocale {
  if (value && UI_LOCALE_SET.has(value as UiLocale)) return value as UiLocale;
  return DEFAULT_UI_LOCALE;
}

export { detectPromptLanguageHint, resolvePromptLanguageHint };
