/**
 * Voice-first spoken copy on the isometric floor.
 *
 * Wraps `narrateLine`, tracks whether the current line was spoken aloud, and
 * derives whether speech bubbles should render. CC off + voice succeeded → hide
 * the balloon for that line; TTS muted or failed → fall back to the bubble.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { shouldShowSpokenText } from '../../utils/officeCaptions.js';
import { cancelOfficeNarration, isOfficeNarrationBusy } from '../../utils/officeNarration.js';
import { deskWorkFor } from '../../utils/officeDeskWork.js';

/** Poll interval for lifted-scene TTS — only gates bubble visibility. */
const NARRATION_BUSY_POLL_MS = 80;

/**
 * Speak a one-off aside exactly once, and never over the top of something else.
 *
 * Slice 18's line — what somebody says on the way back from an errand you walked
 * into. Its own hook rather than a fifth effect in the body below, for the
 * reason § 8 records: `useFloorSpokenText` is already over its complexity
 * budget, and extracting is the fix that actually works when the cost is
 * `?.`/`??` rather than logic.
 *
 * Keyed on the **text**, not on the object it arrives in: the trip carrying it
 * is a fresh object on every leg of the walk home, so an identity-keyed effect
 * would say the same sentence again each time the figure moved. The busy guard
 * is the walk-by's, for the walk-by's reason — an aside that queues behind a
 * scripted scene arrives after the speaker has sat back down.
 *
 * @param {{ speakerId: string, text: string } | null | undefined} said
 * @param {(line: { speakerId: string, text: string }) => unknown} narrate
 */
function useNarratedAside(said, narrate) {
  const spokenRef = useRef('');
  const text = said?.text ?? '';
  const speakerId = said?.speakerId ?? '';

  useEffect(() => {
    if (!text) {
      spokenRef.current = '';
      return undefined;
    }
    if (text === spokenRef.current) return undefined;
    spokenRef.current = text;
    if (isOfficeNarrationBusy()) return undefined;
    void narrate({ speakerId, text });
    return undefined;
  }, [text, speakerId, narrate]);
}

/**
 * @param {{
 *   captions?: boolean,
 *   sceneHandlers?: Record<string, any>,
 *   talkColleagueId?: string | null,
 *   talkLine?: string,
 *   peekColleagueId?: string | null,
 *   walkBy?: { id?: string, colleagueId?: string, body?: string } | null,
 *   wandererSaid?: { speakerId: string, text: string } | null,
 *   hasActiveSpeech?: boolean,
 *   liftedSceneSpeech?: boolean
 * }} options
 */
export function useFloorSpokenText({
  captions = false,
  sceneHandlers = {},
  talkColleagueId = null,
  talkLine = '',
  peekColleagueId = null,
  walkBy = null,
  /* No default: `OfficeFloor` always passes it and it is only read for
     truthiness, so `= null` would cost a branch for nothing (§ 8's finding
     about what actually puts floor modules over their complexity budget). */
  wandererSaid,
  hasActiveSpeech = false,
  /** Coffee/battle pacing lives in `OfficeLayer` — track busy TTS separately. */
  liftedSceneSpeech = false,
  /** True when the current lifted coffee/battle line was actually heard (or is speaking). */
  liftedLineSpoken = false
}) {
  const [voiceActive, setVoiceActive] = useState(false);
  const [liftedNarrationBusy, setLiftedNarrationBusy] = useState(false);
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
    if (captions || !liftedSceneSpeech) {
      setLiftedNarrationBusy(false);
      return undefined;
    }
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      setLiftedNarrationBusy(isOfficeNarrationBusy());
    };
    tick();
    const timer = setInterval(tick, NARRATION_BUSY_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [captions, liftedSceneSpeech]);

  useEffect(() => {
    if (!talkColleagueId) {
      if (prevTalkLineRef.current) cancelOfficeNarration();
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
      if (prevWalkByIdRef.current) cancelOfficeNarration();
      prevWalkByIdRef.current = null;
      return undefined;
    }
    if (!walkBy?.body || walkById === prevWalkByIdRef.current) return undefined;
    prevWalkByIdRef.current = walkById;
    if (isOfficeNarrationBusy()) return undefined;
    void narrateTracked({ speakerId: walkBy.colleagueId, text: walkBy.body });
    return undefined;
  }, [walkBy, narrateTracked]);

  useNarratedAside(wandererSaid, narrateTracked);

  // Paced coffee/battle lines are narrated in `OfficeLayer`. Prefer the
  // per-line spoken flag from pacing so a failed TTS falls back to bubbles;
  // busy polling covers the in-flight window between optimistic hide and
  // the result.
  const showSpokenText = shouldShowSpokenText({
    captions,
    voiceActive: voiceActive || liftedNarrationBusy || (liftedSceneSpeech && liftedLineSpoken)
  });

  return { showSpokenText, sceneHandlersWithVoice };
}

export default useFloorSpokenText;
