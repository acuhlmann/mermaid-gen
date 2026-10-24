/**
 * Shared huddle ring behaviour for desk (`HuddleOverlay`) and floor
 * (`FloorHuddle`) — ADR-0011 one state, two renderers.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { shouldShowSpokenText } from '../utils/officeCaptions.js';
import { beatFocusIds } from '../utils/officePairPointing.js';
import {
  getOfficeSnapshot,
  setOfficeHuddleActiveLineIndex,
  setOfficeHuddleListening,
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
 *   onAskSpeaker?: (speakerId: string, question: string) => Promise<any>,
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
  onAskSpeaker,
  narrateLine,
  prefetchLine,
  onCancelNarration,
  disabled = false
}) {
  const snapshot = useSyncExternalStore(subscribe, getOfficeSnapshot, getOfficeSnapshot);
  const beats = huddle?.beats ?? [];
  const speaking = huddle?.phase === 'speaking';
  const watching = huddle?.phase === 'watching';
  /**
   * Their line has landed and the pair is waiting on you. Nothing paces from
   * here — this is the phase that turns a script into a conversation, and the
   * reason the last beat stays on screen instead of clearing with the loop.
   */
  const listening = huddle?.phase === 'listening';
  const pacingActive = (speaking || watching) && beats.length > 0;
  /**
   * The one behavioural difference between the two modes, and the whole reason
   * pairing is a mode rather than a roster: a mob dissolves when the last
   * remark lands, a pair does not. Somebody who pulled up a chair does not
   * evaporate because they finished a sentence — you end it, or nobody does.
   */
  const pairing = huddle?.mode === 'pair';
  const turnIndex = huddle?.turnIndex ?? 0;
  /**
   * Per-turn scene id, and the load-bearing half of the conversation loop.
   * `useScenePacing` restarts whenever its `sceneId` or line count changes; a
   * pair whose beats array grew underneath a running loop would therefore
   * re-speak lines already heard. Making each turn its own scene means the
   * restart is the intent — one turn, its own lines, history never in it.
   */
  const sceneId = huddle?.id ? `${huddle.id}:${turnIndex}` : null;

  const [pinnedSpeakerId, setPinnedSpeakerId] = useState(/** @type {string | null} */ (null));
  const [fetchingSpeakerId, setFetchingSpeakerId] = useState(/** @type {string | null} */ (null));
  const [repeatingSpeakerId, setRepeatingSpeakerId] = useState(/** @type {string | null} */ (null));
  /** Whose turn you stopped with a raised hand, while you type the question. */
  const [askingSpeakerId, setAskingSpeakerId] = useState(/** @type {string | null} */ (null));
  /** Each teammate's answer to the question you asked them, played as their pinned line. */
  const [answers, setAnswers] = useState(/** @type {Record<string, any>} */ ({}));
  const pinGenerationRef = useRef(0);

  useEffect(() => {
    setPinnedSpeakerId(null);
    setFetchingSpeakerId(null);
    setRepeatingSpeakerId(null);
    setAskingSpeakerId(null);
    setAnswers({});
    pinGenerationRef.current += 1;
  }, [huddle?.id]);

  useEffect(() => {
    if (huddle?.phase === 'watching') {
      setPinnedSpeakerId(null);
      setFetchingSpeakerId(null);
      setRepeatingSpeakerId(null);
      setAskingSpeakerId(null);
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

  /*
   * A pair's turn ends in `listening`, never in a dissolve: the last remark
   * landing is exactly the moment it is your turn, so the scene hands back
   * instead of ending. `onDone` fires once per turn because each turn is its
   * own scene id.
   *
   * The id is pulled out first so the dependency is the exact value read: the
   * React Compiler refuses to preserve a memo whose declared deps are less
   * specific than what it infers, and `huddle` is not what this closes over.
   */
  const huddleId = huddle?.id ?? null;
  const handleTurnDone = useCallback(() => {
    if (!pairing || !huddleId) return;
    setOfficeHuddleListening(huddleId);
  }, [pairing, huddleId]);

  const { visibleLines, lineSpoken } = useScenePacing({
    lines: beats,
    active: !disabled && pacingActive,
    paused: watching || Boolean(pinnedSpeakerId),
    narrateLine: speakLine,
    prefetchLine,
    paceMs: HUDDLE_LINE_PACE_MS,
    silentDurationMs: HUDDLE_LINE_PACE_MS * Math.max(beats.length, 1),
    tailMs: HUDDLE_TAIL_MS,
    sceneId,
    onDone: pairing ? handleTurnDone : onHardStop
  });

  /*
   * The live line, and it outlives the pacing loop on purpose. `listening` has
   * no running scene, so reading only `speaking || watching` would blank the
   * bubble at exactly the moment they have said something and are waiting to
   * hear what you make of it — the beat clamps because a fresh turn can hold a
   * shorter script than the index the last one left behind.
   */
  const saidCount = Math.min(visibleLines || beats.length, beats.length);
  const heldIndex = Math.max(0, saidCount - 1);

  /*
   * A pair's opening raises several points in a row, and "Do it" or "Why
   * that?" afterwards used to mean only the last one, with nothing on screen
   * saying so. Each point they actually got to is a topic you can pick: the
   * hand, the bubble, Do it, the reply chips and a click on their face all
   * follow the one you picked. Keyed by turn, so a new line from them starts
   * from what they just said rather than from an old pick.
   */
  const turnKey = `${huddle?.id ?? ''}:${turnIndex}`;
  const [topicPick, setTopicPick] = useState({ key: '', index: -1 });
  const topicPicked =
    pairing && listening && topicPick.key === turnKey && topicPick.index < saidCount;
  const topicIndex = topicPicked ? topicPick.index : heldIndex;
  const topics = pairing && listening && saidCount > 1 ? beats.slice(0, saidCount) : [];
  const selectTopic = useCallback(
    (index) => {
      if (!Number.isInteger(index) || index < 0) return;
      setTopicPick({ key: turnKey, index });
    },
    [turnKey]
  );
  /** The pair's line a click on their face repeats: the topic in play. */
  const topicBeat = pairing ? (beats[topicIndex] ?? null) : null;

  useEffect(() => {
    if (disabled || !huddle?.id || !pacingActive) return;
    setOfficeHuddleActiveLineIndex(huddle.id, Math.max(0, visibleLines - 1));
  }, [disabled, huddle?.id, pacingActive, visibleLines]);

  useEffect(() => {
    if (disabled || !huddle) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      // Escape with a hand up takes the hand down; it does not end the stand-up.
      if (askingSpeakerId) {
        pinGenerationRef.current += 1;
        setPinnedSpeakerId(null);
        setAskingSpeakerId(null);
        return;
      }
      onHardStop?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [disabled, huddle, onHardStop, askingSpeakerId]);

  const unpin = useCallback(() => {
    pinGenerationRef.current += 1;
    setPinnedSpeakerId(null);
    setFetchingSpeakerId(null);
    setRepeatingSpeakerId(null);
    setAskingSpeakerId(null);
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

  const askSpeaker = useCallback(
    async (question) => {
      const speakerId = askingSpeakerId;
      if (!speakerId || typeof onAskSpeaker !== 'function') return;
      const generation = pinGenerationRef.current;
      setFetchingSpeakerId(speakerId);
      const answer = await Promise.resolve(onAskSpeaker(speakerId, question)).catch(() => null);
      if (generation !== pinGenerationRef.current) return;
      setFetchingSpeakerId(null);
      setAskingSpeakerId(null);
      if (!answer?.text) {
        setPinnedSpeakerId(null);
        return;
      }
      const beat = { ...answer, speakerId };
      setAnswers((prev) => ({ ...prev, [speakerId]: beat }));
      void repeatPinnedBeat(speakerId, beat, generation);
    },
    [askingSpeakerId, onAskSpeaker, repeatPinnedBeat]
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

      const existing = topicBeat ?? beatForSpeaker(huddle, speakerId);
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
      fetchingSpeakerId,
      topicBeat
    ]
  );

  const shownIndex = pairing && listening ? topicIndex : heldIndex;
  const activeBeat = speaking || watching || listening ? (beats[shownIndex] ?? null) : null;
  const activeSpeakerId = watching || pinnedSpeakerId ? null : (activeBeat?.speakerId ?? null);
  /*
   * A raised hand: "hold on — Dinesh, why that?". The speaker finishes the
   * sentence they are in (narration is deliberately NOT cancelled, the way a
   * person finishes their clause before turning to you), the stand-up holds
   * on their pinned seat, and the strip asks them. Their answer plays as their
   * pinned line, and the stand-up carries on when it ends — the same pause and
   * resume a seat click already uses.
   */
  const holder = pairing || watching ? null : (pinnedSpeakerId ?? activeSpeakerId);
  const raiseHand = useCallback(() => {
    if (pairing || watching || !holder) return;
    pinGenerationRef.current += 1;
    setPinnedSpeakerId(holder);
    setRepeatingSpeakerId(null);
    setAskingSpeakerId(holder);
  }, [pairing, watching, holder]);

  const pinnedBeat = pinnedSpeakerId
    ? (answers[pinnedSpeakerId] ?? topicBeat ?? beatForSpeaker(huddle, pinnedSpeakerId))
    : null;
  const pinnedPrompt = pinnedSpeakerId
    ? adoptPromptFor(pinnedBeat, { fallbackToText: true })
    : null;
  /*
   * Voice-first through `listening` too. A pair's last line is held on screen
   * while they wait for you, and keying this on `speaking` alone flipped the
   * bubble back on at exactly that moment — so a line you had just heard aloud
   * reappeared as text. `lineSpoken` is the pacing loop's own record of whether
   * the line was actually voiced, so a silent or failed TTS still shows it.
   */
  const showText = shouldShowSpokenText({
    captions: snapshot.captions,
    voiceActive: typeof narrateLine === 'function' && (speaking || listening) && lineSpoken
  });
  /**
   * What the speaker is pointing at right now — one box, or two when the line
   * is about a pair of them. A pair keeps pointing while it waits on you; a
   * mob points while each teammate speaks, and again while a pinned head
   * repeats its remark. Only ever set on a mermaid canvas — every other case
   * has no resolvable node id, and a pointer aimed at nothing is worse than no
   * pointer. Memoised on the ids themselves so a re-render does not hand the
   * canvas a "new" point to re-ring.
   */
  const pointBeat = pinnedBeat ?? activeBeat;
  const pointing = !watching && (pairing ? speaking || listening : speaking || Boolean(pinnedBeat));
  const focusA = pointing ? pointBeat?.focusId : undefined;
  const focusB = pointing ? pointBeat?.alsoFocusId : undefined;
  const activeFocusIds = useMemo(
    () => beatFocusIds({ focusId: focusA, alsoFocusId: focusB }),
    [focusA, focusB]
  );

  return {
    speaking,
    watching,
    listening,
    pairing,
    awaitingReply: Boolean(huddle?.awaitingReply),
    turns: huddle?.turns ?? [],
    activeFocusIds,
    pinnedSpeakerId,
    fetchingSpeakerId,
    repeatingSpeakerId,
    activeBeat,
    activeSpeakerId,
    pinnedBeat,
    pinnedPrompt,
    /**
     * The pinned line is the answer to your question, and it should be read as
     * well as heard: a remark you are re-hearing hides its bubble while voiced,
     * but an answer is new, so captions or a missing voice show it.
     */
    showPinnedText:
      Boolean(pinnedSpeakerId && answers[pinnedSpeakerId] === pinnedBeat) &&
      (snapshot.captions || typeof narrateLine !== 'function'),
    /** A pair's points from this turn, when there is more than one to pick from. */
    topics,
    /** Which of `topics` is in play, and whether you picked it (vs. their last line). */
    topicIndex,
    topicPicked,
    selectTopic,
    /** The teammate you raised a hand to, while you type the question. */
    askingSpeakerId,
    /** Who a raised hand would stop right now, or null. */
    canRaiseHandFor: askingSpeakerId || typeof onAskSpeaker !== 'function' ? null : holder,
    raiseHand,
    askSpeaker,
    /** How many beats have been revealed (1-based). Used for active-line sync. */
    visibleLines: pacingActive ? visibleLines : 0,
    showText,
    unpin,
    handleDoIt,
    handleSeatClick
  };
}

export default useHuddleRingControls;
