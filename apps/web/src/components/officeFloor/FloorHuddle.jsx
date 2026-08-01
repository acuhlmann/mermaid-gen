/**
 * Team huddle on the isometric floor (ADR-0011 renderer #2).
 *
 * Desk mode crowds the edges of your monitor (`HuddleOverlay`); here the same
 * six teammates ring your desk on the stage. Shared interaction lives in
 * `useHuddleRingControls` so pin / Do-it / hard-stop stay mode-agnostic.
 */

import FloorBubble from './FloorBubble.jsx';
import FloorFigure from './FloorFigure.jsx';
import {
  HUDDLE_SEAT_STAGGER_MS,
  adoptPromptFor,
  useHuddleRingControls
} from '../../hooks/useHuddleRingControls.js';
import { officeChromeCopy, officeSenderInfo } from '../../utils/officeCast.js';
import { formatLocale } from '../../i18n/formatLocale.js';
import {
  HUDDLE_TILES,
  bubbleAlignForSpeaker,
  depthOf,
  projectIso
} from '../../utils/officeFloorPlan.js';

const BUBBLE_Z = 9600;

/**
 * @param {{
 *   huddle: any,
 *   scale?: number,
 *   showSpokenText?: boolean,
 *   onHardStop?: () => void,
 *   onAdoptPrompt?: (prompt: string, colleagueId: string) => void,
 *   onRequestSuggestion?: (speakerId: string) => Promise<any>,
 *   narrateLine?: (line: any) => Promise<{ spoken?: boolean }>,
 *   prefetchLine?: (line: any) => void,
 *   onCancelNarration?: () => void
 * }} props
 */
export function FloorHuddle({
  huddle,
  scale = 1,
  showSpokenText = true,
  /** When set, pacing/interaction is owned by `OfficeLayer`. */
  ringControls: ringControlsProp,
  onHardStop,
  onAdoptPrompt,
  onRequestSuggestion,
  narrateLine,
  prefetchLine,
  onCancelNarration
}) {
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
    watching,
    pinnedSpeakerId,
    fetchingSpeakerId,
    repeatingSpeakerId,
    activeBeat,
    activeSpeakerId,
    pinnedBeat,
    pinnedPrompt,
    showText,
    handleDoIt,
    handleSeatClick
  } = ringControlsProp ?? internalRing;

  if (!huddle) return null;

  const voiceShowsText = showSpokenText && showText;

  return (
    <>
      {huddle.attendees.map((id, index) => {
        const tile = HUDDLE_TILES[index % HUDDLE_TILES.length];
        const person = officeSenderInfo(id);
        const { left, top } = projectIso(tile.x, tile.y);
        const isSpeaking = activeSpeakerId === id;
        const isPinned = pinnedSpeakerId === id;
        const isFetching = fetchingSpeakerId === id;
        const isRepeating = repeatingSpeakerId === id;
        const beat = isPinned ? pinnedBeat : isSpeaking ? activeBeat : null;
        const actionPrompt = isPinned
          ? pinnedPrompt
          : adoptPromptFor(beat, { fallbackToText: isSpeaking || isPinned });
        const hideRemarkText =
          (isPinned && (isRepeating || isFetching)) ||
          ((isSpeaking || isPinned) && !voiceShowsText);
        const showRemarkText = Boolean(beat?.text) && !hideRemarkText;
        const showFetching = isFetching && !beat?.text;
        const showBubble = showRemarkText || Boolean(actionPrompt) || showFetching;
        const doItOnly = Boolean(actionPrompt) && !showRemarkText && !showFetching;
        const align = bubbleAlignForSpeaker(tile, id, { standing: true });

        return (
          <div
            key={id}
            className={[
              'office-floor-walker',
              'office-floor-huddle-actor',
              isSpeaking ? 'is-speaking' : '',
              isPinned ? 'is-pinned' : ''
            ]
              .filter(Boolean)
              .join(' ')}
            data-testid={`office-floor-huddle-seat-${id}`}
            data-speaking={isSpeaking ? 'true' : undefined}
            data-pinned={isPinned ? 'true' : undefined}
            style={{
              left,
              top,
              zIndex: showBubble ? BUBBLE_Z : depthOf(tile.x, tile.y),
              animationDelay: `${index * HUDDLE_SEAT_STAGGER_MS}ms`
            }}
          >
            <div className="office-floor-walker-anchor office-floor-walker-anchor--over-standing">
              <button
                type="button"
                className="office-floor-huddle-hit"
                onClick={() => void handleSeatClick(id)}
                aria-label={formatLocale(
                  officeChromeCopy().huddle.pinSpeakerAria ?? "Pin {name}'s suggestion",
                  { name: person.name }
                )}
                title={formatLocale(
                  officeChromeCopy().huddle.pinSpeakerTitle ??
                    "Pin {name}'s take — or ask them now",
                  { name: person.name }
                )}
              >
                <FloorFigure id={id} accent={person.accentColor} idleIndex={index} />
              </button>
              {showBubble ? (
                <FloorBubble
                  name={person.name}
                  title={person.title}
                  scale={scale}
                  align={align}
                  hideBody={doItOnly}
                  footer={
                    actionPrompt ? (
                      <button
                        type="button"
                        className="office-floor-bubble-action"
                        onClick={() => handleDoIt(id, actionPrompt)}
                        title={officeChromeCopy().huddle.delegateTitle}
                      >
                        {officeChromeCopy().huddle.delegate ?? officeChromeCopy().doIt}
                      </button>
                    ) : null
                  }
                >
                  {showFetching
                    ? (officeChromeCopy().huddle.fetchingLabel ?? 'Thinking…')
                    : showRemarkText
                      ? beat.text
                      : null}
                </FloorBubble>
              ) : null}
            </div>
          </div>
        );
      })}
    </>
  );
}

/**
 * Card chrome for a floor huddle — hard stop and status live off-stage (§ 6 rule 12).
 *
 * Carries the pair register too. A pair is one state away from a mob, so the
 * floor must not be the renderer that still calls it a team huddle and offers a
 * hard stop — that would be exactly the state fork ADR-0011 rule 1 exists to
 * prevent, just spelled in copy instead of in a store.
 */
export function FloorHuddleCard({ huddle, copy, onHardStop, ringControls = null }) {
  const huddleCopy = officeChromeCopy().huddle;
  const floorHuddle = copy.huddle ?? {};
  if (!huddle) return null;
  const speaking = huddle.phase === 'speaking';
  const watching = huddle.phase === 'watching';
  const pairing = huddle.mode === 'pair';
  const partnerName = pairing ? officeSenderInfo(huddle.attendees[0])?.name : '';
  const withName = (template) => formatLocale(template, { name: partnerName ?? '' });
  const {
    activeBeat = null,
    activeSpeakerId = null,
    pinnedSpeakerId = null,
    pinnedPrompt = null,
    handleDoIt = null
  } = ringControls ?? {};
  const delegateSpeakerId = watching ? null : (pinnedSpeakerId ?? activeSpeakerId);
  const delegatePrompt = watching
    ? null
    : (pinnedPrompt ?? adoptPromptFor(activeBeat, { fallbackToText: true }));

  return (
    <aside
      className="office-floor-card office-floor-card--huddle"
      data-testid="office-floor-huddle-card"
      data-mode={huddle.mode ?? 'mob'}
      aria-live="polite"
    >
      <span className="office-floor-eyebrow">
        {pairing ? (floorHuddle.pairEyebrow ?? 'PAIRING') : (floorHuddle.eyebrow ?? 'TEAM HUDDLE')}
      </span>
      <strong className="office-floor-card-heading">
        {pairing
          ? withName(floorHuddle.pairHeading ?? '{name}, in the chair next to you')
          : (floorHuddle.heading ?? huddleCopy.sceneAria)}
      </strong>
      {!speaking && !watching ? (
        <p className="office-floor-card-blurb">
          {pairing
            ? withName(huddleCopy.pairGathering ?? huddleCopy.gathering)
            : huddleCopy.gathering}
        </p>
      ) : null}
      {watching ? (
        <p className="office-floor-card-blurb">
          {pairing
            ? withName(huddleCopy.pairWatching ?? huddleCopy.watching)
            : (huddleCopy.watching ?? 'The team is watching the notebook…')}
        </p>
      ) : null}
      <div className="office-floor-card-actions">
        {delegatePrompt && delegateSpeakerId ? (
          <button
            type="button"
            className="office-floor-card-action office-floor-card-action--primary"
            title={huddleCopy.delegateTitle}
            onClick={() => handleDoIt?.(delegateSpeakerId, delegatePrompt)}
          >
            {huddleCopy.delegate ?? officeChromeCopy().doIt}
          </button>
        ) : null}
        <button
          type="button"
          className="office-floor-card-action office-floor-card-action--primary"
          data-testid="office-floor-huddle-end"
          title={pairing ? withName(huddleCopy.pairEndTitle) : huddleCopy.hardStopTitle}
          onClick={() => onHardStop?.()}
        >
          {pairing ? `🪑 ${huddleCopy.pairEnd}` : `✋ ${huddleCopy.hardStop}`}
        </button>
      </div>
    </aside>
  );
}

export default FloorHuddle;
