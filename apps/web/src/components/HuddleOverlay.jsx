import { useCallback, useEffect, useSyncExternalStore } from 'react';
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

/**
 * Team huddle (docs/office-parody.md) — the face-to-face counterpart to the
 * remote WG meeting. Your teammates crowd in from every edge of the canvas and
 * take turns saying one thing about the diagram, replacing the bottom-nav
 * advisor bubble for the duration.
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
  narrateLine,
  prefetchLine
}) {
  const snapshot = useSyncExternalStore(subscribe, getOfficeSnapshot, getOfficeSnapshot);
  const copy = officeChromeCopy().huddle;
  const beats = huddle?.beats ?? [];
  const speaking = huddle?.phase === 'speaking';

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
    active: speaking && beats.length > 0,
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

  if (!huddle) return null;

  const activeBeat = speaking ? beats[visibleLines - 1] : null;
  const activeSpeakerId = activeBeat?.speakerId ?? null;
  // Voice intent, not the wrapper: OfficeLayer only passes narrateLine when
  // narration is on, so this is "somebody is about to say this out loud".
  const showText = shouldShowSpokenText({
    captions: snapshot.captions,
    voiceActive: typeof narrateLine === 'function'
  });

  return (
    <div
      className="office-huddle-layer is-anchor-canvas"
      role="dialog"
      aria-label={copy.sceneAria}
      data-testid="office-huddle"
    >
      <div className="office-huddle-shade" aria-hidden="true" />
      {huddle.attendees.map((id, index) => {
        const slot = seatFor(index);
        const person = officeSenderInfo(id);
        const isSpeaking = activeSpeakerId === id;
        const beat = isSpeaking ? activeBeat : null;
        return (
          <div
            key={id}
            className={[
              'office-huddle-seat',
              `is-side-${slot.side}`,
              isSpeaking ? 'is-speaking' : '',
              activeSpeakerId && !isSpeaking ? 'is-listening' : ''
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
          >
            <PersonaFace id={id} size={72} className="office-huddle-face" />
            <span className="office-huddle-name">{person.name}</span>
            {beat ? (
              <div className="office-huddle-bubble" role="status" aria-live="polite">
                {showText ? (
                  <p className="office-huddle-line">{beat.text}</p>
                ) : (
                  // CC off and somebody is speaking: label only, never the line.
                  <p className="office-huddle-speaking-label">
                    {formatLocale(copy.speakingLabel, { name: person.name })}
                  </p>
                )}
                {beat.actionPrompt ? (
                  <button
                    type="button"
                    className="office-do-it office-huddle-do-it"
                    onClick={() => onAdoptPrompt?.(beat.actionPrompt, id)}
                  >
                    {officeChromeCopy().doIt}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
      <div className="office-huddle-chrome">
        {!speaking ? (
          <p className="office-huddle-gathering" role="status" aria-live="polite">
            {copy.gathering}
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
