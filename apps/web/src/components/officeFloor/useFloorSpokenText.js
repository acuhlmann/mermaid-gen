/**
 * Voice-first spoken copy on the isometric floor.
 *
 * Wraps `narrateLine`, tracks whether the current line was spoken aloud, and
 * derives whether speech bubbles should render. CC off + voice succeeded → hide
 * the balloon for that line; TTS muted or failed → fall back to the bubble.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { shouldShowSpokenText } from '../../utils/officeCaptions.js';
import { deskWorkFor } from '../../utils/officeDeskWork.js';

/**
 * @param {{
 *   captions?: boolean,
 *   sceneHandlers?: Record<string, any>,
 *   talkColleagueId?: string | null,
 *   talkLine?: string,
 *   peekColleagueId?: string | null,
 *   walkBy?: { id?: string, colleagueId?: string, body?: string } | null,
 *   hasActiveSpeech?: boolean
 * }} options
 */
export function useFloorSpokenText({
  captions = false,
  sceneHandlers = {},
  talkColleagueId = null,
  talkLine = '',
  peekColleagueId = null,
  walkBy = null,
  hasActiveSpeech = false
}) {
  const [voiceActive, setVoiceActive] = useState(false);
  const prevTalkLineRef = useRef('');
  const prevPeekKeyRef = useRef('');
  const prevWalkByIdRef = useRef(null);

  const narrateTracked = useCallback(
    (line) => {
      const narrate = sceneHandlers?.narrateLine;
      if (typeof narrate !== 'function') {
        setVoiceActive(false);
        return Promise.resolve({ spoken: false });
      }
      // Optimistic: hide while voice is in flight. A silent result flips this
      // back off so the line is still readable when TTS fails.
      setVoiceActive(true);
      return Promise.resolve(narrate(line))
        .then((result) => {
          const spoken = Boolean(result?.spoken);
          setVoiceActive(spoken);
          return result ?? { spoken: false };
        })
        .catch(() => {
          setVoiceActive(false);
          return { spoken: false };
        });
    },
    [sceneHandlers]
  );

  const sceneHandlersWithVoice = useMemo(() => {
    if (!sceneHandlers?.narrateLine) return sceneHandlers;
    return { ...sceneHandlers, narrateLine: narrateTracked };
  }, [sceneHandlers, narrateTracked]);

  useEffect(() => {
    if (!hasActiveSpeech) setVoiceActive(false);
  }, [hasActiveSpeech]);

  useEffect(() => {
    if (!talkColleagueId) {
      prevTalkLineRef.current = '';
      return undefined;
    }
    if (!talkLine || talkLine === prevTalkLineRef.current) return undefined;
    prevTalkLineRef.current = talkLine;
    void narrateTracked({ speakerId: talkColleagueId, text: talkLine });
    return undefined;
  }, [talkColleagueId, talkLine, narrateTracked]);

  const peekLine = peekColleagueId ? (deskWorkFor(peekColleagueId)?.line ?? '') : '';
  useEffect(() => {
    if (!peekColleagueId) {
      prevPeekKeyRef.current = '';
      return undefined;
    }
    if (!peekLine) return undefined;
    const key = `${peekColleagueId}:${peekLine}`;
    if (key === prevPeekKeyRef.current) return undefined;
    prevPeekKeyRef.current = key;
    void narrateTracked({ speakerId: peekColleagueId, text: peekLine });
    return undefined;
  }, [peekColleagueId, peekLine, narrateTracked]);

  useEffect(() => {
    const walkById = walkBy?.id ?? null;
    if (!walkById) {
      prevWalkByIdRef.current = null;
      return undefined;
    }
    if (!walkBy?.body || walkById === prevWalkByIdRef.current) return undefined;
    prevWalkByIdRef.current = walkById;
    void narrateTracked({ speakerId: walkBy.colleagueId, text: walkBy.body });
    return undefined;
  }, [walkBy, narrateTracked]);

  const showSpokenText = shouldShowSpokenText({ captions, voiceActive });

  return { showSpokenText, sceneHandlersWithVoice };
}

export default useFloorSpokenText;
