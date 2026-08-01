/**
 * Shared huddle ring behaviour for desk (`HuddleOverlay`) and floor
 * (`FloorHuddle`) — ADR-0011 one state, two renderers.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { shouldShowSpokenText } from '../utils/officeCaptions.js';
import {
  getOfficeSnapshot,
  setOfficeHuddleActiveLineIndex,
  subscribe
} from '../state/officeMomentStore.js';
import { useScenePacing } from './useScenePacing.js';

/** Per-seat entry delay. Six faces are all in within ~0.4 s. */
export const HUDDLE_SEAT_STAGGER_MS = 55;
/** Reading-pace gap between remarks when voice is off or unavailable. */
export const HUDDLE_LINE_PACE_MS = 3000;
/**
 * How long the last speaker holds after the final remark. Longer than the scene
 * default so a closing "Do it" is still clickable before everyone wanders off.
 */
export const HUDDLE_TAIL_MS = 4000;

export function beatForSpeaker(huddle, speakerId) {
  if (!huddle || !speakerId) return null;
  return (
    (huddle.beats ?? []).find((b) => b.speakerId === speakerId) ??
    huddle.suggestions?.[speakerId] ??
    null
  );
}

/** Notebook prompt — only when the beat carries an explicit action item. */
export function delegatablePrompt(beat) {
  return beat?.actionPrompt ?? null;
}

/**
 * Prefer an explicit actionPrompt; optionally fall back to the spoken remark so
 * desk chrome still offers Do it when the model skipped the optional field.
 */
export function adoptPromptFor(beat, { fallbackToText = false } = {}) {
  const explicit = delegatablePrompt(beat);
  if (explicit) return explicit;
  if (!fallbackToText || !beat) return null;
  const text = typeof beat.text === 'string' ? beat.text.trim() : '';
  return text || null;
}

/**
 * @param {{
 *   huddle: any,
 *   onHardStop?: () => void,
 *   onAdoptPrompt?: (prompt: string, colleagueId: string) => void,
 *   onRequestSuggestion?: (speakerId: string) => Promise<any>,
 *   narrateLine?: (line: any) => Promise<{ spoken?: boolean }>,
 *   prefetchLine?: (line: any) => void,
 *   onCancelNarration?: () => void,
 *   disabled?: boolean
 * }} options `disabled` — when true, skip pacing; caller owns the performance (OfficeLayer).
 */
export function useHuddleRingControls({
  huddle,
  onHardStop,
  onAdoptPrompt,
  onRequestSuggestion,
  narrateLine,
  prefetchLine,
  onCancelNarration,
  disabled = false
}) {
  const snapshot = useSyncExternalStore(subscribe, getOfficeSnapshot, getOfficeSnapshot);
  const beats = huddle?.beats ?? [];
  const speaking = huddle?.phase === 'speaking';
  const watching = huddle?.phase === 'watching';
  const pacingActive = (speaking || watching) && beats.length > 0;
  /**
   * The one behavioural difference between the two modes, and the whole reason
   * pairing is a mode rather than a roster: a mob dissolves when the last
   * remark lands, a pair does not. Somebody who pulled up a chair does not
   * evaporate because they finished a sentence — you end it, or nobody does.
   */
  const pairing = huddle?.mode === 'pair';

  const [pinnedSpeakerId, setPinnedSpeakerId] = useState(/** @type {string | null} */ (null));
  const [fetchingSpeakerId, setFetchingSpeakerId] = useState(/** @type {string | null} */ (null));
  const [repeatingSpeakerId, setRepeatingSpeakerId] = useState(/** @type {string | null} */ (null));
  const pinGenerationRef = useRef(0);

  useEffect(() => {
    setPinnedSpeakerId(null);
    setFetchingSpeakerId(null);
    setRepeatingSpeakerId(null);
    pinGenerationRef.current += 1;
  }, [huddle?.id]);

  useEffect(() => {
    if (huddle?.phase === 'watching') {
      setPinnedSpeakerId(null);
      setFetchingSpeakerId(null);
      setRepeatingSpeakerId(null);
    }
  }, [huddle?.phase]);

  const speakLine = useCallback(
    async (line) => {
      if (typeof narrateLine !== 'function') return { spoken: false };
      const result = await narrateLine(line);
      return {
        spoken: Boolean(result?.spoken),
        // Preserve cancel so Hard stop can cut the pacing loop before React
        // re-renders and flips `active` (see useScenePacing).
        ...(result?.cancelled ? { cancelled: true } : {})
      };
    },
    [narrateLine]
  );

  const visibleLines = useScenePacing({
    lines: beats,
    active: !disabled && pacingActive,
    paused: watching || Boolean(pinnedSpeakerId),
    narrateLine: speakLine,
    prefetchLine,
    paceMs: HUDDLE_LINE_PACE_MS,
    silentDurationMs: HUDDLE_LINE_PACE_MS * Math.max(beats.length, 1),
    tailMs: HUDDLE_TAIL_MS,
    sceneId: huddle?.id ?? null,
    onDone: pairing ? undefined : onHardStop
  });

  useEffect(() => {
    if (disabled || !huddle?.id || !pacingActive) return;
    setOfficeHuddleActiveLineIndex(huddle.id, Math.max(0, visibleLines - 1));
  }, [disabled, huddle?.id, pacingActive, visibleLines]);

  useEffect(() => {
    if (disabled || !huddle) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onHardStop?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [disabled, huddle, onHardStop]);

  const unpin = useCallback(() => {
    pinGenerationRef.current += 1;
    setPinnedSpeakerId(null);
    setFetchingSpeakerId(null);
    setRepeatingSpeakerId(null);
    onCancelNarration?.();
  }, [onCancelNarration]);

  const repeatPinnedBeat = useCallback(
    async (speakerId, beat, generation) => {
      if (!beat?.text) return;
      setRepeatingSpeakerId(speakerId);
      try {
        const { spoken } = await speakLine(beat);
        if (generation !== pinGenerationRef.current) return;
        if (!spoken) {
          await new Promise((resolve) => setTimeout(resolve, HUDDLE_LINE_PACE_MS));
        }
      } finally {
        if (generation !== pinGenerationRef.current) return;
        setRepeatingSpeakerId(null);
        setPinnedSpeakerId(null);
      }
    },
    [speakLine]
  );

  const handleDoIt = useCallback(
    (speakerId, prompt) => {
      if (!prompt || !speakerId) return;
      pinGenerationRef.current += 1;
      setRepeatingSpeakerId(null);
      onCancelNarration?.();
      onAdoptPrompt?.(prompt, speakerId);
    },
    [onAdoptPrompt, onCancelNarration]
  );

  const handleSeatClick = useCallback(
    async (speakerId) => {
      if (!huddle || !speakerId || watching) return;
      if (pinnedSpeakerId === speakerId) {
        unpin();
        return;
      }

      const generation = ++pinGenerationRef.current;
      setPinnedSpeakerId(speakerId);
      setRepeatingSpeakerId(null);
      onCancelNarration?.();

      const existing = beatForSpeaker(huddle, speakerId);
      if (existing?.text) {
        void repeatPinnedBeat(speakerId, existing, generation);
        return;
      }
      if (typeof onRequestSuggestion !== 'function') return;
      if (fetchingSpeakerId) return;

      setFetchingSpeakerId(speakerId);
      try {
        const beat = await onRequestSuggestion(speakerId);
        if (generation !== pinGenerationRef.current) return;
        if (beat?.text) {
          void repeatPinnedBeat(speakerId, beat, generation);
        }
      } finally {
        setFetchingSpeakerId((current) => (current === speakerId ? null : current));
      }
    },
    [
      huddle,
      watching,
      pinnedSpeakerId,
      unpin,
      onCancelNarration,
      repeatPinnedBeat,
      onRequestSuggestion,
      fetchingSpeakerId
    ]
  );

  const activeBeat = speaking || watching ? beats[visibleLines - 1] : null;
  const activeSpeakerId = watching || pinnedSpeakerId ? null : (activeBeat?.speakerId ?? null);
  const pinnedBeat = pinnedSpeakerId ? beatForSpeaker(huddle, pinnedSpeakerId) : null;
  const pinnedPrompt = pinnedSpeakerId
    ? adoptPromptFor(pinnedBeat, { fallbackToText: true })
    : null;
  const showText = shouldShowSpokenText({
    captions: snapshot.captions,
    voiceActive: typeof narrateLine === 'function' && speaking
  });

  return {
    speaking,
    watching,
    pairing,
    pinnedSpeakerId,
    fetchingSpeakerId,
    repeatingSpeakerId,
    activeBeat,
    activeSpeakerId,
    pinnedBeat,
    pinnedPrompt,
    /** How many beats have been revealed (1-based). Seats use this to keep
     * Do-it available after someone has already spoken. */
    visibleLines: pacingActive ? visibleLines : 0,
    showText,
    unpin,
    handleDoIt,
    handleSeatClick
  };
}

export default useHuddleRingControls;
