import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { officeChromeCopy, officeSenderInfo } from '../utils/officeCast.js';
import { shouldShowSpokenText } from '../utils/officeCaptions.js';
import { getOfficeSnapshot, subscribe } from '../state/officeMomentStore.js';
import { useScenePacing } from '../hooks/useScenePacing.js';
import { formatLocale } from '../i18n/formatLocale.js';
import { PersonaFace } from './personaFaces/index.jsx';

/** Per-seat entry delay. Six faces are all in within ~0.4 s. */
export const HUDDLE_SEAT_STAGGER_MS = 55;
/** Reading-pace gap between remarks when voice is off or unavailable. */
export const HUDDLE_LINE_PACE_MS = 3000;
/**
 * How long the last speaker holds after the final remark. Longer than the scene
 * default so a closing "Do it" is still clickable before everyone wanders off.
 */
export const HUDDLE_TAIL_MS = 4000;

/**
 * Where each teammate leans in from. Order matters: the first four cover all
 * four edges, so a short-handed huddle still surrounds you, and the last two
 * double up top and bottom where there is the most room.
 */
const SEAT_SLOTS = [
  { side: 'top', pos: '28%' },
  { side: 'right', pos: '36%' },
  { side: 'bottom', pos: '68%' },
  { side: 'left', pos: '42%' },
  { side: 'top', pos: '72%' },
  { side: 'bottom', pos: '30%' }
];

function seatFor(index) {
  return SEAT_SLOTS[index % SEAT_SLOTS.length];
}

function beatForSpeaker(huddle, speakerId) {
  if (!huddle || !speakerId) return null;
  return (
    (huddle.beats ?? []).find((b) => b.speakerId === speakerId) ??
    huddle.suggestions?.[speakerId] ??
    null
  );
}

/** Notebook prompt for a pinned remark — mirrors on-spot suggest actionable rules. */
function delegatablePrompt(beat, speakerId) {
  if (!beat?.text) return null;
  if (beat.actionPrompt) return beat.actionPrompt;
  if (speakerId === 'richard') return null;
  return beat.text;
}

/**
 * Team huddle (docs/office-parody.md) — the face-to-face counterpart to the
 * remote WG meeting. Your teammates crowd in from every edge of the canvas and
 * take turns saying one thing about the diagram, replacing the bottom-nav
 * advisor bubble for the duration.
 *
 * Click any head to pin that teammate: they repeat their take aloud (never flash
 * stale text from earlier in the queue), a Do-it button lets you delegate, and
 * clicking anywhere else unpins. "Do it" opens the notebook while the ring
 * keeps watching, then the huddle resumes when the run finishes.
 *
 * Motion is deliberately the opposite of `OfficeWalkBy`: that one is a single
 * head dropping in over 720 ms and then looming at you forever, because it is
 * an ambient interruption you did not ask for. A huddle you *called*, so the
 * ring snaps into place (240 ms, staggered) and then holds still — the movement
 * is the arrival, not the presence.
 *
 * Voice-first, same rule as every other spoken office surface: when narration
 * is speaking and CC is off, the remark text is hidden and only the speaker's
 * name shows. You hear them; you do not also read them.
 */
export default function HuddleOverlay({
  huddle,
  onHardStop,
  onAdoptPrompt,
  onRequestSuggestion,
  narrateLine,
  prefetchLine,
  onCancelNarration
}) {
  const snapshot = useSyncExternalStore(subscribe, getOfficeSnapshot, getOfficeSnapshot);
  const copy = officeChromeCopy().huddle;
  const beats = huddle?.beats ?? [];
  const speaking = huddle?.phase === 'speaking';
  const watching = huddle?.phase === 'watching';
  const pacingActive = (speaking || watching) && beats.length > 0;

  const [pinnedSpeakerId, setPinnedSpeakerId] = useState(/** @type {string | null} */ (null));
  const [fetchingSpeakerId, setFetchingSpeakerId] = useState(/** @type {string | null} */ (null));
  const [repeatingSpeakerId, setRepeatingSpeakerId] = useState(/** @type {string | null} */ (null));
  const pinGenerationRef = useRef(0);

  // Clear pin / fetch chrome when the huddle dissolves or a new one starts.
  useEffect(() => {
    setPinnedSpeakerId(null);
    setFetchingSpeakerId(null);
    setRepeatingSpeakerId(null);
    pinGenerationRef.current += 1;
  }, [huddle?.id]);

  // Do-it handoff dissolves the pin — the ring is watching the notebook now.
  useEffect(() => {
    if (huddle?.phase === 'watching') {
      setPinnedSpeakerId(null);
      setFetchingSpeakerId(null);
      setRepeatingSpeakerId(null);
    }
  }, [huddle?.phase]);

  // useScenePacing reveals every line at once when it has no narrator, which is
  // right for a card of overheard chat and wrong for a ring of faces lighting up
  // one at a time. Always hand it a narrator; the wrapper reports spoken:false
  // when voice is off so it falls back to the reading-pace timer per line.
  const speakLine = useCallback(
    async (line) => {
      if (typeof narrateLine !== 'function') return { spoken: false };
      const result = await narrateLine(line);
      return { spoken: Boolean(result?.spoken) };
    },
    [narrateLine]
  );

  const visibleLines = useScenePacing({
    lines: beats,
    active: pacingActive,
    paused: watching || Boolean(pinnedSpeakerId),
    narrateLine: speakLine,
    prefetchLine,
    paceMs: HUDDLE_LINE_PACE_MS,
    silentDurationMs: HUDDLE_LINE_PACE_MS * Math.max(beats.length, 1),
    tailMs: HUDDLE_TAIL_MS,
    sceneId: huddle?.id ?? null,
    onDone: onHardStop
  });

  useEffect(() => {
    if (!huddle) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onHardStop?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [huddle, onHardStop]);

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
        // No Do-it → they said it again, huddle continues from where it paused.
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

  const handleShadeClick = useCallback(() => {
    if (pinnedSpeakerId) unpin();
  }, [pinnedSpeakerId, unpin]);

  if (!huddle) return null;

  const activeBeat = speaking || watching ? beats[visibleLines - 1] : null;
  const activeSpeakerId = watching || pinnedSpeakerId ? null : (activeBeat?.speakerId ?? null);
  const pinnedBeat = pinnedSpeakerId ? beatForSpeaker(huddle, pinnedSpeakerId) : null;
  const pinnedPrompt = pinnedSpeakerId ? delegatablePrompt(pinnedBeat, pinnedSpeakerId) : null;
  // Voice intent, not the wrapper: OfficeLayer only passes narrateLine when
  // narration is on, so this is "somebody is about to say this out loud".
  const showText = shouldShowSpokenText({
    captions: snapshot.captions,
    voiceActive: typeof narrateLine === 'function' && speaking
  });

  return (
    <div
      className={[
        'office-huddle-layer',
        'is-anchor-canvas',
        watching ? 'is-watching' : '',
        pinnedSpeakerId ? 'has-pinned-suggestion' : ''
      ]
        .filter(Boolean)
        .join(' ')}
      role="dialog"
      aria-label={copy.sceneAria}
      data-testid="office-huddle"
      data-phase={huddle.phase}
    >
      <div
        className="office-huddle-shade"
        aria-hidden={!pinnedSpeakerId}
        onClick={pinnedSpeakerId ? handleShadeClick : undefined}
        data-testid={pinnedSpeakerId ? 'office-huddle-shade' : undefined}
      />
      {huddle.attendees.map((id, index) => {
        const slot = seatFor(index);
        const person = officeSenderInfo(id);
        const isSpeaking = activeSpeakerId === id;
        const isPinned = pinnedSpeakerId === id;
        const isFetching = fetchingSpeakerId === id;
        const isRepeating = repeatingSpeakerId === id;
        const beat = isPinned ? pinnedBeat : isSpeaking ? activeBeat : null;
        const showBubble = Boolean(beat) || isFetching || isPinned;
        const delegatePrompt = isPinned ? pinnedPrompt : delegatablePrompt(beat, id);
        const hidePinnedText = isPinned && (isRepeating || isFetching || !showText);
        return (
          <div
            key={id}
            className={[
              'office-huddle-seat',
              `is-side-${slot.side}`,
              isSpeaking ? 'is-speaking' : '',
              activeSpeakerId && !isSpeaking && !isPinned ? 'is-listening' : '',
              isPinned ? 'is-pinned' : '',
              isFetching ? 'is-fetching' : '',
              isRepeating ? 'is-repeating' : '',
              watching ? 'is-watching' : ''
            ]
              .filter(Boolean)
              .join(' ')}
            style={{
              '--huddle-pos': slot.pos,
              '--huddle-accent': person.accentColor,
              animationDelay: `${index * HUDDLE_SEAT_STAGGER_MS}ms`
            }}
            data-testid={`office-huddle-seat-${id}`}
            data-speaking={isSpeaking ? 'true' : undefined}
            data-pinned={isPinned ? 'true' : undefined}
          >
            <button
              type="button"
              className="office-huddle-seat-hit"
              onClick={() => void handleSeatClick(id)}
              aria-label={formatLocale(copy.pinSpeakerAria ?? 'Pin {name}\u2019s suggestion', {
                name: person.name
              })}
              title={formatLocale(
                copy.pinSpeakerTitle ?? 'Pin {name}\u2019s take — or ask them now',
                {
                  name: person.name
                }
              )}
            >
              <PersonaFace id={id} size={72} className="office-huddle-face" />
              <span className="office-huddle-name">{person.name}</span>
            </button>
            {showBubble ? (
              <div
                className={[
                  'office-huddle-bubble',
                  isPinned ? 'is-pinned' : '',
                  isFetching ? 'is-fetching' : '',
                  isRepeating ? 'is-repeating' : ''
                ]
                  .filter(Boolean)
                  .join(' ')}
                role="status"
                aria-live="polite"
                data-testid={isPinned ? `office-huddle-pinned-${id}` : undefined}
              >
                {isFetching && !beat ? (
                  <p className="office-huddle-speaking-label">
                    {formatLocale(copy.fetchingLabel ?? '{name} is thinking\u2026', {
                      name: person.name
                    })}
                  </p>
                ) : hidePinnedText || (isSpeaking && !showText) ? (
                  <p className="office-huddle-speaking-label">
                    {formatLocale(copy.speakingLabel, { name: person.name })}
                  </p>
                ) : (
                  <p className="office-huddle-line">{beat?.text}</p>
                )}
                {delegatePrompt ? (
                  <button
                    type="button"
                    className="office-do-it office-huddle-do-it"
                    onClick={() => handleDoIt(id, delegatePrompt)}
                    title={formatLocale(
                      copy.delegateTitle ?? 'Delegate to {name} — open the notebook',
                      { name: person.name }
                    )}
                  >
                    {copy.delegate ?? officeChromeCopy().doIt}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
      <div className="office-huddle-chrome">
        {!speaking && !watching ? (
          <p className="office-huddle-gathering" role="status" aria-live="polite">
            {copy.gathering}
          </p>
        ) : null}
        {watching ? (
          <p className="office-huddle-watching" role="status" aria-live="polite">
            {copy.watching ?? 'The team is watching the notebook…'}
          </p>
        ) : null}
        <button
          type="button"
          className="office-huddle-hard-stop"
          onClick={() => onHardStop?.()}
          title={copy.hardStopTitle}
        >
          <span aria-hidden="true">✋</span> {copy.hardStop}
        </button>
      </div>
    </div>
  );
}
