/**
 * Voice-first visibility for a single spoken office line (desk talk, walk-by).
 *
 * Narrates when `narration` is on, tracks whether the line was heard, and
 * derives `showSpokenText` via `shouldShowSpokenText`. CC off + narration on →
 * hide text immediately (optimistic, matching walk-by / FloorTalk); TTS failed
 * → fall back to text so the line is never lost.
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
  // Optimistic hide when headphones-off / narration-on: first paint must not
  // flash the spoken line as text before TTS starts (walk-by gates the same
  // way on the narration preference). A silent result flips this back off.
  const [voiceActive, setVoiceActive] = useState(() =>
    Boolean(narration && text && speakerId && !captions)
  );
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
    // Hide before the first paint after a new line — same optimistic gate as
    // FloorTalk's narrateTracked. Failure below restores the text.
    if (narration && !captions) setVoiceActive(true);
    if (isOfficeNarrationBusy()) return undefined;
    void speakLine();
    return undefined;
  }, [lineKey, speakLine, narration, captions]);

  const showSpokenText = shouldShowSpokenText({ captions, voiceActive });

  return { showSpokenText, voiceActive };
}

export default useSpokenLineVoice;
