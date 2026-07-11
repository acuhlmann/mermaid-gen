/**
 * Lightweight prompt-language detection so agents reply in the same language
 * the user wrote — especially CJK (Chinese is the highest-priority case).
 */

const HANGUL_RE = /[\uAC00-\uD7AF]/g;
const KANA_RE = /[\u3040-\u30FF]/g;
const CJK_HAN_RE = /[\u4E00-\u9FFF]/g;

/** Ratio thresholds tuned for short UI prompts (not long documents). */
const HANGUL_RATIO_THRESHOLD = 0.15;
const KANA_RATIO_THRESHOLD = 0.1;
const CJK_HAN_RATIO_THRESHOLD = 0.25;

export type PromptLanguageHint = 'Chinese (zh)' | 'Japanese (ja)' | 'Korean (ko)';

/**
 * Detect a dominant non-Latin language in free text.
 * Returns null when the text is empty or predominantly Latin-script — callers
 * should still tell models to match the user's language via system prompts.
 */
export function detectPromptLanguageHint(
  text: string | null | undefined
): PromptLanguageHint | null {
  if (typeof text !== 'string' || !text.trim()) return null;

  const hangul = text.match(HANGUL_RE) ?? [];
  const kana = text.match(KANA_RE) ?? [];
  const cjkHan = text.match(CJK_HAN_RE) ?? [];
  const totalLetters = text.match(/\p{L}/gu)?.length ?? 0;
  if (totalLetters === 0) return null;

  const hangulRatio = hangul.length / totalLetters;
  const kanaRatio = kana.length / totalLetters;
  const cjkHanRatio = cjkHan.length / totalLetters;

  if (hangulRatio >= HANGUL_RATIO_THRESHOLD) return 'Korean (ko)';
  if (kanaRatio >= KANA_RATIO_THRESHOLD) return 'Japanese (ja)';
  if (cjkHanRatio >= CJK_HAN_RATIO_THRESHOLD) return 'Chinese (zh)';

  return null;
}

/** First non-null hint wins — typical order: user prompt, then diagram content. */
export function resolvePromptLanguageHint(
  ...sources: (string | null | undefined)[]
): PromptLanguageHint | null {
  for (const src of sources) {
    const hint = detectPromptLanguageHint(src);
    if (hint) return hint;
  }
  return null;
}

const LANGUAGE_LOCK_BODY =
  'Do NOT translate unprompted. Do NOT add second-language alternates. This is NON-NEGOTIABLE for this turn.';

/**
 * Hard lock for diagram labels, titles, and mixed prose+label output.
 * Appends nothing when no CJK script is detected.
 */
export function buildLanguageInstruction(...sources: (string | null | undefined)[]): string {
  const hint = resolvePromptLanguageHint(...sources);
  if (!hint) return '';
  return `\n\nLANGUAGE LOCK: Output ALL reader-facing text (labels, titles, headings, edge labels, prose summaries) in ${hint}. ${LANGUAGE_LOCK_BODY}`;
}

/**
 * Hard lock for read-only analysis (Explain / Critique) section prose.
 */
export function buildProseLanguageInstruction(...sources: (string | null | undefined)[]): string {
  const hint = resolvePromptLanguageHint(...sources);
  if (!hint) return '';
  return `\n\nLANGUAGE LOCK: Write ALL prose (Markdown section headings and body text) in ${hint}. Keep proper nouns and technical acronyms as-is. ${LANGUAGE_LOCK_BODY}`;
}

/** Append {@link buildLanguageInstruction} when a CJK hint resolves. */
export function appendLanguageInstruction(
  content: string,
  ...sources: (string | null | undefined)[]
): string {
  const instruction = buildLanguageInstruction(...sources);
  return instruction ? `${content}${instruction}` : content;
}

/** Append {@link buildProseLanguageInstruction} when a CJK hint resolves. */
export function appendProseLanguageInstruction(
  content: string,
  ...sources: (string | null | undefined)[]
): string {
  const instruction = buildProseLanguageInstruction(...sources);
  return instruction ? `${content}${instruction}` : content;
}

/** Shared one-liner for system prompts (all agents). */
export const MATCH_USER_LANGUAGE_RULE =
  "Match the language of the user's request for every reader-facing reply; never translate unprompted.";
