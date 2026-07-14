/**
 * Helpers for committing Web Speech API transcripts without duplicating prefixes.
 * Finals are concatenated across the session; interim flush on end must not repeat
 * text already committed from finals.
 */

export function extractSpeechResultSnapshot(results) {
  let finalsText = '';
  let interim = '';
  if (!results?.length) return { finalsText, interim };

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const transcript = result[0]?.transcript ?? '';
    if (result.isFinal) finalsText += transcript;
  }

  for (let i = results.length - 1; i >= 0; i--) {
    const result = results[i];
    if (!result.isFinal) {
      interim = result[0]?.transcript ?? '';
      break;
    }
  }

  return { finalsText, interim };
}

export function sliceNewSpeechText(fullText, committedLength) {
  if (!fullText || fullText.length <= committedLength) return '';
  return fullText.slice(committedLength).trimStart();
}

export function sliceInterimBeyondFinals(finalsText, interim) {
  const trimmedInterim = interim?.trim() ?? '';
  if (!trimmedInterim) return '';

  const trimmedFinals = finalsText?.trimEnd() ?? '';
  if (!trimmedFinals) return trimmedInterim;
  if (trimmedInterim === trimmedFinals) return '';

  if (trimmedFinals.startsWith(trimmedInterim)) return '';

  if (trimmedInterim.startsWith(trimmedFinals)) {
    return trimmedInterim.slice(trimmedFinals.length).trim();
  }

  if (trimmedFinals.endsWith(trimmedInterim)) return '';
  return trimmedInterim;
}
