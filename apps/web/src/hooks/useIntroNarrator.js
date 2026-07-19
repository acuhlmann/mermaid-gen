import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchOfficeCloudAudio } from '../utils/officeSpeechClient.js';
import { cancelOfficeNarration, speakOfficeLine } from '../utils/officeNarration.js';
import { officeDialogueLocale } from '../utils/officeCast.js';

/**
 * Click-to-hear narrator for the first-run orientation (docs/office-parody.md).
 *
 * The whole point of gating narration here is cost: the office voices are
 * Google Cloud TTS (officeTts.js), and the GCP Chirp free tier is finite. So
 * the orientation NEVER autoplays a voice — a line is only ever synthesized on
 * an explicit ▶ click, which a scraper or link-preview bot will never perform.
 * The click doubles as the autoplay gesture the browser needs, so the audio
 * actually plays on mobile Safari/Chrome too.
 *
 * `play(id, line)` speaks one beat in-character and records which beat is
 * talking (`speakingId`) so the button can flip to a "stop" affordance; a
 * second click, a different beat, or unmount stops it. `speakOfficeLine`
 * already enforces one voice at a time process-wide.
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
    if (!speakerId || !text) return;
    const gen = ++genRef.current;
    setSpeakingId(id);
    const sessionId = sessionRef.current?.() ?? '';
    void speakOfficeLine({
      speakerId,
      text,
      lang: lang ?? officeDialogueLocale(),
      fetchCloudAudio: (args) => fetchOfficeCloudAudio({ ...args, sessionId })
    }).then(() => {
      if (gen === genRef.current) setSpeakingId((current) => (current === id ? null : current));
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
