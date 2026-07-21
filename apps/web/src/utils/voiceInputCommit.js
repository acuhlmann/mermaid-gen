/**
 * Helpers for committing Web Speech API transcripts without duplicating speech.
 *
 * Chrome's continuous recognition often re-emits the last word of a final
 * segment as the start of the next one, and interim hypotheses revise earlier
 * wording. Appending deltas causes "word word" stutter; instead we rebuild the
 * full session transcript on every result and replace the voice contribution.
 */

const CJK_CHAR_RE = /[\u3400-\u9fff\uf900-\ufaff]/;

/**
 * Map archislop UI locales to SpeechRecognition `lang` BCP-47 tags.
 * @param {string | null | undefined} uiLocale
 * @returns {string}
 */
export function speechRecognitionLangForUiLocale(uiLocale) {
  switch (uiLocale) {
    case 'en-AU':
      return 'en-AU';
    case 'zh-CN':
      return 'zh-CN';
    case 'zh-TW':
      return 'zh-TW';
    case 'en':
    default:
      return 'en-US';
  }
}

function normalizeSpaces(text) {
  return String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isCjkHeavy(text) {
  const sample = String(text ?? '');
  if (!sample) return false;
  let cjk = 0;
  for (const ch of sample) {
    if (CJK_CHAR_RE.test(ch)) cjk += 1;
  }
  return cjk / sample.length >= 0.3;
}

/**
 * Collapse consecutive repeated tokens ("the the" / "你好 你好") and
 * immediate CJK character stutters ("的的").
 * @param {string} text
 * @returns {string}
 */
export function collapseRepeatedSpeechTokens(text) {
  const trimmed = normalizeSpaces(text);
  if (!trimmed) return '';

  if (isCjkHeavy(trimmed) && !/\s/.test(trimmed)) {
    let out = '';
    for (const ch of trimmed) {
      if (out.endsWith(ch) && CJK_CHAR_RE.test(ch)) continue;
      out += ch;
    }
    return out;
  }

  const parts = trimmed.split(' ');
  const out = [];
  for (const part of parts) {
    if (!part) continue;
    if (out.length && out[out.length - 1].toLowerCase() === part.toLowerCase()) continue;
    out.push(part);
  }
  return out.join(' ');
}

/**
 * Merge two transcript fragments, dropping the longest suffix/prefix overlap
 * so segment-boundary repeats ("world" + "world how") collapse cleanly.
 * @param {string} left
 * @param {string} right
 * @returns {string}
 */
export function mergeSpeechTranscript(left, right) {
  const a = normalizeSpaces(left);
  const b = normalizeSpaces(right);
  if (!b) return a;
  if (!a) return b;
  if (a === b) return a;
  if (a.endsWith(b)) return a;
  if (b.startsWith(a)) return b;

  const aWords = a.split(' ');
  const bWords = b.split(' ');
  const spaced = aWords.length > 1 || bWords.length > 1 || /\s/.test(left) || /\s/.test(right);

  if (spaced) {
    const max = Math.min(aWords.length, bWords.length);
    for (let n = max; n >= 1; n -= 1) {
      const suffix = aWords.slice(-n).join(' ');
      const prefix = bWords.slice(0, n).join(' ');
      if (suffix.toLowerCase() === prefix.toLowerCase()) {
        return collapseRepeatedSpeechTokens([...aWords, ...bWords.slice(n)].join(' '));
      }
    }
    return collapseRepeatedSpeechTokens(`${a} ${b}`);
  }

  // CJK / no-space: prefer substantial character overlap (≥1 Han char).
  const maxChars = Math.min(a.length, b.length);
  const minOverlap = isCjkHeavy(a + b) ? 1 : 3;
  for (let n = maxChars; n >= minOverlap; n -= 1) {
    if (a.slice(-n) === b.slice(0, n)) {
      return collapseRepeatedSpeechTokens(a + b.slice(n));
    }
  }

  const needSpace =
    /\S$/.test(a) && /^\S/.test(b) && !CJK_CHAR_RE.test(a.slice(-1)) && !CJK_CHAR_RE.test(b[0]);
  return collapseRepeatedSpeechTokens(needSpace ? `${a} ${b}` : a + b);
}

/**
 * Build the authoritative session transcript from a SpeechRecognitionResultList.
 * Finals are merge-joined; the latest interim is merge-joined after finals.
 * @param {ArrayLike<{ isFinal?: boolean, 0?: { transcript?: string } }> | null | undefined} results
 * @param {{ includeInterim?: boolean }} [options]
 * @returns {{ finalsText: string, interim: string, sessionText: string }}
 */
export function buildSessionTranscript(results, options = {}) {
  const includeInterim = options.includeInterim !== false;
  let finalsText = '';
  let interim = '';
  if (!results?.length) {
    return { finalsText: '', interim: '', sessionText: '' };
  }

  for (let i = 0; i < results.length; i += 1) {
    const result = results[i];
    const transcript = result?.[0]?.transcript ?? '';
    if (!result?.isFinal) continue;
    finalsText = mergeSpeechTranscript(finalsText, transcript);
  }

  for (let i = results.length - 1; i >= 0; i -= 1) {
    const result = results[i];
    if (!result?.isFinal) {
      interim = result?.[0]?.transcript ?? '';
      break;
    }
  }

  const sessionText = includeInterim ? mergeSpeechTranscript(finalsText, interim) : finalsText;

  return {
    finalsText: collapseRepeatedSpeechTokens(finalsText),
    interim: normalizeSpaces(interim),
    sessionText: collapseRepeatedSpeechTokens(sessionText)
  };
}

/**
 * @deprecated Prefer {@link buildSessionTranscript}. Kept for older call sites/tests.
 */
export function extractSpeechResultSnapshot(results) {
  const built = buildSessionTranscript(results, { includeInterim: true });
  return { finalsText: built.finalsText, interim: built.interim };
}

/**
 * Join a prompt that existed before dictation with the live session transcript.
 * @param {string} basePrompt
 * @param {string} sessionText
 * @returns {string}
 */
export function combinePromptWithVoiceSession(basePrompt, sessionText) {
  const base = String(basePrompt ?? '').trimEnd();
  const voice = collapseRepeatedSpeechTokens(sessionText);
  if (!voice) return base;
  if (!base) return voice;
  return `${base} ${voice}`;
}

export function sliceNewSpeechText(fullText, committedLength) {
  if (!fullText || fullText.length <= committedLength) return '';
  return fullText.slice(committedLength).trimStart();
}

export function sliceInterimBeyondFinals(finalsText, interim) {
  const trimmedInterim = normalizeSpaces(interim);
  const trimmedFinals = normalizeSpaces(finalsText);
  if (!trimmedInterim) return '';
  if (!trimmedFinals) return collapseRepeatedSpeechTokens(trimmedInterim);
  if (trimmedInterim === trimmedFinals) return '';
  if (trimmedFinals.startsWith(trimmedInterim)) return '';
  if (trimmedFinals.endsWith(trimmedInterim)) return '';

  const merged = mergeSpeechTranscript(trimmedFinals, trimmedInterim);
  if (!merged || merged === trimmedFinals) return '';
  if (merged.startsWith(trimmedFinals)) {
    return merged.slice(trimmedFinals.length).trim();
  }
  // Overlap merge revised earlier wording — nothing additive to flush.
  return '';
}
