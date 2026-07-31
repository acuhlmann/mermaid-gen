import { useCallback } from 'react';
import { officeChromeCopy, officeSenderInfo } from '../utils/officeCast.js';
import {
  HUDDLE_SEAT_STAGGER_MS,
  delegatablePrompt,
  useHuddleRingControls
} from '../hooks/useHuddleRingControls.js';
import { formatLocale } from '../i18n/formatLocale.js';
import { PersonaFace } from './personaFaces/index.jsx';

export {
  HUDDLE_SEAT_STAGGER_MS,
  HUDDLE_LINE_PACE_MS,
  HUDDLE_TAIL_MS
} from '../hooks/useHuddleRingControls.js';

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

/**
 * A pair does not surround you, they sit beside you. Reusing `SEAT_SLOTS[0]`
 * (top edge, off-centre) puts the lone face where the first of six would stand,
 * which reads as a mob nobody turned up to. The right edge at eye level reads
 * as the chair they pulled over.
 */
const PAIR_SLOT = { side: 'right', pos: '46%' };

function seatFor(index, pairing = false) {
  if (pairing) return PAIR_SLOT;
  return SEAT_SLOTS[index % SEAT_SLOTS.length];
}

/**
 * Team huddle (docs/office-parody.md) — desk renderer #1. The floor version is
 * `FloorHuddle` (ADR-0011). Both share `useHuddleRingControls`.
 */
export default function HuddleOverlay({
  huddle,
  /** When set, pacing/interaction is owned by `OfficeLayer`. */
  ringControls: ringControlsProp,
  onHardStop,
  onAdoptPrompt,
  onRequestSuggestion,
  narrateLine,
  prefetchLine,
  onCancelNarration
}) {
  const copy = officeChromeCopy().huddle;
  const internalRing = useHuddleRingControls({
    huddle,
    onHardStop,
    onAdoptPrompt,
    onRequestSuggestion,
    narrateLine,
    prefetchLine,
    onCancelNarration,
    disabled: ringControlsProp !== undefined
  });
  const {
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
    showText,
    unpin,
    handleDoIt,
    handleSeatClick
  } = ringControlsProp ?? internalRing;

  const handleShadeClick = useCallback(() => {
    if (pinnedSpeakerId) unpin();
  }, [pinnedSpeakerId, unpin]);

  if (!huddle) return null;

  const delegateSpeakerId = watching ? null : (pinnedSpeakerId ?? activeSpeakerId);
  const delegatePrompt = watching ? null : (pinnedPrompt ?? delegatablePrompt(activeBeat));
  /*
   * One overlay, two registers. Everything visual is shared — the same seats,
   * the same paced bubbles, the same Do-it — so the mode only changes the words
   * and how you get out. A pair is one attendee by construction, so the name is
   * always available for the chair-side copy.
   */
  const partner = pairing ? officeSenderInfo(huddle.attendees[0]) : null;
  const endLabel = pairing ? (copy.pairEnd ?? copy.hardStop) : copy.hardStop;
  const endTitle = pairing
    ? formatLocale(copy.pairEndTitle ?? copy.hardStopTitle, { name: partner?.name ?? '' })
    : copy.hardStopTitle;

  return (
    <div
      className={[
        'office-huddle-layer',
        'is-anchor-canvas',
        pairing ? 'is-pairing' : '',
        watching ? 'is-watching' : '',
        pinnedSpeakerId ? 'has-pinned-suggestion' : ''
      ]
        .filter(Boolean)
        .join(' ')}
      role="dialog"
      aria-label={pairing ? (copy.pairSceneAria ?? copy.sceneAria) : copy.sceneAria}
      data-testid="office-huddle"
      data-mode={huddle.mode ?? 'mob'}
      data-phase={huddle.phase}
    >
      <div
        className="office-huddle-shade"
        aria-hidden={!pinnedSpeakerId}
        onClick={pinnedSpeakerId ? handleShadeClick : undefined}
        data-testid={pinnedSpeakerId ? 'office-huddle-shade' : undefined}
      />
      {huddle.attendees.map((id, index) => {
        const slot = seatFor(index, pairing);
        const person = officeSenderInfo(id);
        const isSpeaking = activeSpeakerId === id;
        const isPinned = pinnedSpeakerId === id;
        const isFetching = fetchingSpeakerId === id;
        const isRepeating = repeatingSpeakerId === id;
        const beat = isPinned ? pinnedBeat : isSpeaking ? activeBeat : null;
        const actionPrompt = isPinned ? pinnedPrompt : delegatablePrompt(beat);
        const hideRemarkText =
          (isPinned && (isRepeating || isFetching)) || ((isSpeaking || isPinned) && !showText);
        const showRemarkText = Boolean(beat?.text) && !hideRemarkText;
        const showFetching = isFetching && !beat?.text;
        const showBubble = showRemarkText || showFetching;
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
            data-testid={isPinned ? `office-huddle-pinned-${id}` : `office-huddle-seat-${id}`}
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
              >
                {showFetching ? (
                  <p className="office-huddle-fetching-label">
                    {copy.fetchingLabel ?? 'Thinking\u2026'}
                  </p>
                ) : showRemarkText ? (
                  <p className="office-huddle-line">{beat.text}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
      <div className="office-huddle-chrome">
        {!speaking && !watching ? (
          <p className="office-huddle-gathering" role="status" aria-live="polite">
            {pairing
              ? formatLocale(copy.pairGathering ?? copy.gathering, { name: partner?.name ?? '' })
              : copy.gathering}
          </p>
        ) : null}
        {watching ? (
          <p className="office-huddle-watching" role="status" aria-live="polite">
            {pairing
              ? formatLocale(copy.pairWatching ?? copy.watching, { name: partner?.name ?? '' })
              : (copy.watching ?? 'The team is watching the notebook…')}
          </p>
        ) : null}
        {delegatePrompt && delegateSpeakerId ? (
          <button
            type="button"
            className="office-do-it office-huddle-chrome-do-it"
            onClick={() => handleDoIt(delegateSpeakerId, delegatePrompt)}
            title={copy.delegateTitle ?? 'Open the notebook with this ask'}
          >
            {copy.delegate ?? officeChromeCopy().doIt}
          </button>
        ) : null}
        <button
          type="button"
          className="office-huddle-hard-stop"
          data-testid="office-huddle-end"
          onClick={() => onHardStop?.()}
          title={endTitle}
        >
          <span aria-hidden="true">{pairing ? '🪑' : '✋'}</span> {endLabel}
        </button>
      </div>
    </div>
  );
}
