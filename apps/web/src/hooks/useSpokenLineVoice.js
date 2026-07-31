/**
 * Voice-first visibility for a single spoken office line (desk talk, walk-by).
 *
 * Narrates when `narration` is on, tracks whether the line was heard, and
 * derives `showSpokenText` via `shouldShowSpokenText`. CC off + voice
 * succeeded → hide duplicate text; TTS muted or failed → fall back to text.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { shouldShowSpokenText } from '../utils/officeCaptions.js';
import { isOfficeNarrationBusy } from '../utils/officeNarration.js';

/**
 * @param {{
 *   captions?: boolean,
 *   narration?: boolean,
 *   narrateLine?: (line: { speakerId: string, text: string }) =>
 *     Promise<{ spoken?: boolean } | void>,
 *   speakerId?: string,
 *   text?: string,
 *   lineKey?: string | null
 * }} options
 */
export function useSpokenLineVoice({
  captions = false,
  narration = false,
  narrateLine,
  speakerId = '',
  text = '',
  lineKey = null
} = {}) {
  const [voiceActive, setVoiceActive] = useState(false);
  const prevKeyRef = useRef(/** @type {string | null} */ (null));

  const speakLine = useCallback(async () => {
    if (!narration || typeof narrateLine !== 'function' || !text || !speakerId) {
      setVoiceActive(false);
      return;
    }
    setVoiceActive(true);
    try {
      const result = await narrateLine({ speakerId, text });
      setVoiceActive(Boolean(result?.spoken));
    } catch {
      setVoiceActive(false);
    }
  }, [narration, narrateLine, speakerId, text]);

  useEffect(() => {
    if (!lineKey) {
      prevKeyRef.current = null;
      setVoiceActive(false);
      return undefined;
    }
    if (lineKey === prevKeyRef.current) return undefined;
    prevKeyRef.current = lineKey;
    if (isOfficeNarrationBusy()) return undefined;
    void speakLine();
    return undefined;
  }, [lineKey, speakLine]);

  const showSpokenText = shouldShowSpokenText({ captions, voiceActive });

  return { showSpokenText, voiceActive };
}

export default useSpokenLineVoice;
