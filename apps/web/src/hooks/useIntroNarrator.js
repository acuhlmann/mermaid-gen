import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchOfficeCloudAudio } from '../utils/officeSpeechClient.js';
import { cancelOfficeNarration, speakOfficeLine } from '../utils/officeNarration.js';
import { officeDialogueLocale } from '../utils/officeCast.js';

/**
 * Narrator for the Meet the Office orientation (docs/office-parody.md).
 *
 * Cost guardrail: voices are Google Cloud TTS. The orientation never speaks
 * on cold mount — that would let scrapers burn the Chirp free tier. Speech
 * starts only after an explicit user gesture (Press Start / Meet the team),
 * which also unlocks browser autoplay for the rest of a cinematic sequence.
 *
 * `play(id, line)` speaks one beat and returns the settle promise so the tour
 * can auto-advance when the line finishes. `speakingId` flips the ▶ button to
 * a stop affordance. `speakOfficeLine` already enforces one voice at a time.
 *
 * @param {{ getSessionId?: () => string }} [opts]
 */
export function useIntroNarrator({ getSessionId } = {}) {
  const [speakingId, setSpeakingId] = useState(null);
  // Bumped on every play/stop so a late resolve from a superseded line can't
  // clear the indicator for the line that replaced it.
  const genRef = useRef(0);
  const sessionRef = useRef(getSessionId);
  useEffect(() => {
    sessionRef.current = getSessionId;
  });

  const stop = useCallback(() => {
    genRef.current += 1;
    setSpeakingId(null);
    cancelOfficeNarration();
  }, []);

  const play = useCallback((id, { speakerId, text, lang } = {}) => {
    if (!speakerId || !text) {
      return Promise.resolve({ spoken: false });
    }
    const gen = ++genRef.current;
    setSpeakingId(id);
    const sessionId = sessionRef.current?.() ?? '';
    return speakOfficeLine({
      speakerId,
      text,
      lang: lang ?? officeDialogueLocale(),
      fetchCloudAudio: (args) => fetchOfficeCloudAudio({ ...args, sessionId })
    }).then((result) => {
      if (gen === genRef.current) setSpeakingId((current) => (current === id ? null : current));
      return result;
    });
  }, []);

  // Never leave a voice talking into an unmounted tour.
  useEffect(
    () => () => {
      genRef.current += 1;
      cancelOfficeNarration();
    },
    []
  );

  return { speakingId, play, stop };
}
