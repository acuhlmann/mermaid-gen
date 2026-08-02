/**
 * Lightweight Chinese script detection so agents reply in the same language
 * the user wrote. Single-pass, no LLM calls — only appends a prompt suffix
 * when enough Han characters are present or the UI locale requires it.
 */

const CJK_HAN_RE = /\p{Script=Han}/gu;

/** Minimum share of letters that must be Han before we treat text as Chinese. */
const HAN_RATIO_THRESHOLD = 0.25;

/** [simplified, traditional] — high-signal pairs only; built into Sets once. */
const SCRIPT_PAIRS: readonly (readonly [string, string])[] = [
  ['国', '國'],
  ['学', '學'],
  ['体', '體'],
  ['网', '網'],
  ['为', '為'],
  ['这', '這'],
  ['们', '們'],
  ['说', '說'],
  ['与', '與'],
  ['产', '產'],
  ['发', '發'],
  ['经', '經'],
  ['现', '現'],
  ['动', '動'],
  ['处', '處'],
  ['过', '過'],
  ['进', '進'],
  ['选', '選'],
  ['达', '達'],
  ['连', '連'],
  ['运', '運'],
  ['问', '問'],
  ['听', '聽'],
  ['见', '見'],
  ['认', '認'],
  ['计', '計'],
  ['议', '議'],
  ['论', '論'],
  ['关', '關'],
  ['开', '開'],
  ['门', '門'],
  ['时', '時'],
  ['长', '長'],
  ['东', '東'],
  ['书', '書'],
  ['鱼', '魚'],
  ['鸟', '鳥'],
  ['龙', '龍'],
  ['风', '風'],
  ['飞', '飛'],
  ['电', '電'],
  ['云', '雲'],
  ['团', '團'],
  ['场', '場'],
  ['线', '線'],
  ['条', '條'],
  ['备', '備'],
  ['复', '復'],
  ['迁', '遷'],
  ['级', '級'],
  ['务', '務'],
  ['员', '員'],
  ['众', '眾'],
  ['专', '專'],
  ['业', '業'],
  ['标', '標'],
  ['总', '總'],
  ['类', '類'],
  ['数', '數'],
  ['据', '據'],
  ['质', '質'],
  ['权', '權'],
  ['显', '顯'],
  ['压', '壓'],
  ['调', '調'],
  ['协', '協'],
  ['护', '護'],
  ['储', '儲'],
  ['测', '測'],
  ['试', '試'],
  ['验', '驗'],
  ['证', '證'],
  ['码', '碼'],
  ['锁', '鎖'],
  ['钥', '鑰'],
  ['签', '簽'],
  ['户', '戶'],
  ['录', '錄'],
  ['页', '頁'],
  ['扩', '擴'],
  ['败', '敗'],
  ['买', '買'],
  ['卖', '賣'],
  ['价', '價'],
  ['钱', '錢'],
  ['单', '單'],
  ['独', '獨'],
  ['环', '環'],
  ['应', '應'],
  ['响', '響'],
  ['属', '屬'],
  ['层', '層'],
  ['际', '際'],
  ['随', '隨'],
  ['险', '險'],
  ['碍', '礙'],
  ['创', '創'],
  ['构', '構'],
  ['设', '設'],
  ['库', '庫'],
  ['执', '執'],
  ['订', '訂'],
  ['览', '覽'],
  ['载', '載'],
  ['启', '啟'],
  ['闭', '閉'],
  ['结', '結'],
  ['组', '組'],
  ['织', '織'],
  ['统', '統'],
  ['维', '維']
];

const SIMPLIFIED_MARKERS = new Set(SCRIPT_PAIRS.map(([s]) => s));
const TRADITIONAL_MARKERS = new Set(SCRIPT_PAIRS.map(([, t]) => t));

export type PromptLanguageHint =
  'Simplified Chinese (zh-CN)' | 'Traditional Chinese (zh-TW)' | 'Chinese (zh)';

export type OutputLanguageHint = PromptLanguageHint | 'English';

export type LanguageLockOptions = {
  uiLocale?: string | null | undefined;
};

function resolveUiLocaleOutputHint(
  uiLocale?: string | null | undefined
): OutputLanguageHint | null {
  const raw = typeof uiLocale === 'string' ? uiLocale.trim().toLowerCase() : '';
  if (!raw) return null;
  if (raw.startsWith('zh-tw') || raw.startsWith('cmn-tw')) {
    return 'Traditional Chinese (zh-TW)';
  }
  if (raw.startsWith('zh') || raw.startsWith('cmn')) {
    return 'Simplified Chinese (zh-CN)';
  }
  if (raw === 'en-au' || raw === 'en' || raw.startsWith('en')) {
    return 'English';
  }
  return null;
}

function classifyChineseVariant(text: string): PromptLanguageHint {
  let simplified = 0;
  let traditional = 0;
  for (const ch of text) {
    if (SIMPLIFIED_MARKERS.has(ch)) simplified += 1;
    else if (TRADITIONAL_MARKERS.has(ch)) traditional += 1;
  }
  if (traditional > simplified) return 'Traditional Chinese (zh-TW)';
  if (simplified > traditional) return 'Simplified Chinese (zh-CN)';
  return 'Chinese (zh)';
}

/**
 * Detect Chinese when Han characters dominate the prompt.
 * Returns null for Latin-only or mixed text with too few Han characters.
 */
export function detectPromptLanguageHint(
  text: string | null | undefined
): PromptLanguageHint | null {
  if (typeof text !== 'string' || !text.trim()) return null;

  const han = text.match(CJK_HAN_RE) ?? [];
  const totalLetters = text.match(/\p{L}/gu)?.length ?? 0;
  if (totalLetters === 0) return null;

  if (han.length / totalLetters < HAN_RATIO_THRESHOLD) return null;

  return classifyChineseVariant(text);
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

/** Map a UI locale tag to the output language agents must use. */
export function uiLocaleToOutputHint(uiLocale: string): OutputLanguageHint | null {
  return resolveUiLocaleOutputHint(uiLocale);
}

/**
 * Resolve the output language from user text first, then the UI locale.
 * User-written Chinese always wins over an English UI locale.
 */
export function resolveOutputLanguageHint(
  uiLocale?: string | null | undefined,
  ...sources: (string | null | undefined)[]
): OutputLanguageHint | null {
  const fromText = resolvePromptLanguageHint(...sources);
  if (fromText) return fromText;
  return resolveUiLocaleOutputHint(uiLocale);
}

function parseLanguageLockArgs(args: Array<string | null | undefined | LanguageLockOptions>): {
  sources: Array<string | null | undefined>;
  options: LanguageLockOptions;
} {
  const last = args[args.length - 1];
  if (last != null && typeof last === 'object' && 'uiLocale' in last) {
    return {
      sources: args.slice(0, -1) as Array<string | null | undefined>,
      options: last as LanguageLockOptions
    };
  }
  return { sources: args as Array<string | null | undefined>, options: {} };
}

const LANGUAGE_LOCK_BODY =
  'Do NOT translate unprompted. Do NOT convert between simplified and traditional unless the user asked. Do NOT add second-language alternates. This is NON-NEGOTIABLE for this turn.';

const ENGLISH_NON_LATIN_GUARD =
  'Do NOT emit Chinese (Simplified or Traditional), Japanese, or Korean unless the user explicitly requested that language.';

function formatDiagramLanguageLock(hint: OutputLanguageHint): string {
  if (hint === 'English') {
    return `\n\nLANGUAGE LOCK: Output ALL reader-facing text (labels, titles, headings, edge labels, prose summaries) in English. ${ENGLISH_NON_LATIN_GUARD} Keep proper nouns, product names, and technical acronyms as-is. ${LANGUAGE_LOCK_BODY}`;
  }
  return `\n\nLANGUAGE LOCK: Output ALL reader-facing text (labels, titles, headings, edge labels, prose summaries) in ${hint}. ${LANGUAGE_LOCK_BODY}`;
}

function formatProseLanguageLock(hint: OutputLanguageHint): string {
  if (hint === 'English') {
    return `\n\nLANGUAGE LOCK: Write ALL prose (Markdown section headings and body text) in English. ${ENGLISH_NON_LATIN_GUARD} Keep proper nouns and technical acronyms as-is. ${LANGUAGE_LOCK_BODY}`;
  }
  return `\n\nLANGUAGE LOCK: Write ALL prose (Markdown section headings and body text) in ${hint}. Keep proper nouns and technical acronyms as-is. ${LANGUAGE_LOCK_BODY}`;
}

/**
 * Hard lock for diagram labels, titles, and mixed prose+label output.
 * Appends nothing when no language hint resolves.
 */
export function buildLanguageInstruction(
  ...args: Array<string | null | undefined | LanguageLockOptions>
): string {
  const { sources, options } = parseLanguageLockArgs(args);
  const hint = resolveOutputLanguageHint(options.uiLocale, ...sources);
  if (!hint) return '';
  return formatDiagramLanguageLock(hint);
}

/**
 * Hard lock for read-only analysis (Explain / Critique) section prose.
 */
export function buildProseLanguageInstruction(
  ...args: Array<string | null | undefined | LanguageLockOptions>
): string {
  const { sources, options } = parseLanguageLockArgs(args);
  const hint = resolveOutputLanguageHint(options.uiLocale, ...sources);
  if (!hint) return '';
  return formatProseLanguageLock(hint);
}

/** Append {@link buildLanguageInstruction} when a language hint resolves. */
export function appendLanguageInstruction(
  content: string,
  ...args: Array<string | null | undefined | LanguageLockOptions>
): string {
  const instruction = buildLanguageInstruction(...args);
  return instruction ? `${content}${instruction}` : content;
}

/** Append {@link buildProseLanguageInstruction} when a language hint resolves. */
export function appendProseLanguageInstruction(
  content: string,
  ...args: Array<string | null | undefined | LanguageLockOptions>
): string {
  const instruction = buildProseLanguageInstruction(...args);
  return instruction ? `${content}${instruction}` : content;
}

/** Shared one-liner for system prompts (all agents). */
export const MATCH_USER_LANGUAGE_RULE =
  "Match the language of the user's request for every reader-facing reply; never translate unprompted.";
