import { useSyncExternalStore } from 'react';
import { officeChromeCopy, officeSenderInfo } from '../utils/officeCast.js';
import { shouldShowSpokenText } from '../utils/officeCaptions.js';
import { getOfficeSnapshot, subscribe } from '../state/officeMomentStore.js';
import { useScenePacing } from '../hooks/useScenePacing.js';
import { useSpokenLineVoice } from '../hooks/useSpokenLineVoice.js';
import {
  COFFEE_BREAK_DURATION_MS,
  COFFEE_LINE_PACE_MS
} from '../hooks/officeScenePacingConstants.js';
import { formatLocale } from '../i18n/formatLocale.js';
import { sceneParticipants } from '../utils/officeSceneCast.js';
import { PersonaFace } from './personaFaces/index.jsx';

export {
  COFFEE_BREAK_DURATION_MS,
  COFFEE_LINE_PACE_MS
} from '../hooks/officeScenePacingConstants.js';

const FACE_SIZE = 120;
const FACE_SIZE_SPEAKING = 132;
const INVITE_FACE_SIZE = 168;

/**
 * Coffee break (docs/office-parody.md). Two-phase: a colleague leans over your
 * screen with an empty cup and asks if you're up for coffee ([Take 5] /
 * [Deadline]), then a watercooler scene where participants lean in from
 * opposite sides and trade overheard lines one at a time (battle/huddle
 * parity). When `narrateLine` is provided, lines pace in and are spoken;
 * otherwise all lines show at once and the scene auto-wraps after
 * COFFEE_BREAK_DURATION_MS. Accepting is worth a small work-life-balance
 * XP nudge (wired by OfficeLayer via onAccept/onDone).
 */
export default function CoffeeBreakOverlay({
  coffee,
  /** When set, pacing is owned by `OfficeLayer` so view toggles do not restart. */
  visibleLines: visibleLinesProp,
  /** Spoken-state twin of `visibleLines` when pacing is lifted to OfficeLayer. */
  lineSpoken: lineSpokenProp,
  onAccept,
  onDecline,
  onDone,
  narrateLine,
  prefetchLine
}) {
  const snapshot = useSyncExternalStore(subscribe, getOfficeSnapshot, getOfficeSnapshot);
  const accepted = Boolean(coffee?.accepted);
  const lineCount = coffee?.lines?.length ?? 0;
  const inviterId = coffee?.lines?.[0]?.speakerId ?? 'facilities';
  const inviter = officeSenderInfo(inviterId);
  const inviteAsk = formatLocale(officeChromeCopy().coffee.inviteLine, { name: inviter.name });
  const { showSpokenText: showInviteText } = useSpokenLineVoice({
    captions: snapshot.captions,
    narration: Boolean(snapshot.narration && !accepted),
    narrateLine: accepted ? undefined : narrateLine,
    speakerId: inviterId,
    text: inviteAsk,
    lineKey: !accepted ? (coffee?.id ?? null) : null
  });
  const paced = useScenePacing({
    lines: coffee?.lines ?? [],
    active: visibleLinesProp === undefined && accepted && Boolean(coffee),
    narrateLine,
    prefetchLine,
    paceMs: COFFEE_LINE_PACE_MS,
    silentDurationMs: COFFEE_BREAK_DURATION_MS,
    sceneId: coffee?.id ?? null,
    onDone
  });
  const visibleLines = visibleLinesProp ?? paced.visibleLines;
  const lineSpoken = lineSpokenProp ?? paced.lineSpoken;

  if (!coffee) return null;
  const copy = officeChromeCopy();

  if (!accepted) {
    return (
      <div
        className="office-coffee-invite-layer"
        role="status"
        aria-live="polite"
        data-testid="office-coffee-invite"
        data-floating-window="office-coffee-invite"
      >
        <div className="office-coffee-invite-shade" aria-hidden="true" />
        <div className="office-coffee-invite office-coffee-invite--shoulder">
          <button
            type="button"
            className="office-coffee-invite-dismiss"
            aria-label={formatLocale(copy.coffee.declineAria ?? copy.coffee.decline, {
              name: inviter.name
            })}
            onClick={onDecline}
          >
            ×
          </button>
          <div className="office-coffee-invite-head" aria-hidden="true">
            <span className="office-coffee-empty-cup" title="Empty cup">
              <span className="office-coffee-cup-glyph">☕</span>
            </span>
            <PersonaFace
              id={inviterId}
              size={INVITE_FACE_SIZE}
              className="office-coffee-invite-avatar"
            />
          </div>
          <div className="office-coffee-invite-presence">
            <p className="office-moment-kind office-moment-kind--coffee" aria-hidden="true">
              {copy.coffee.kindLabel}
            </p>
            <div className="office-coffee-invite-name">
              {inviter.name}
              {inviter.title ? (
                <span className="office-coffee-invite-title"> · {inviter.title}</span>
              ) : null}
            </div>
            {showInviteText ? <p className="office-coffee-invite-ask">{inviteAsk}</p> : null}
            <div className="office-coffee-invite-actions">
              <button type="button" className="office-coffee-accept" onClick={onAccept}>
                {copy.coffee.accept}
              </button>
              <button type="button" className="office-coffee-decline" onClick={onDecline}>
                {copy.coffee.decline}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const participants = sceneParticipants(coffee.lines);
  const showText = shouldShowSpokenText({
    captions: snapshot.captions,
    // No narrator prop → silent stub may still pace, but there is nothing to
    // hear, so keep the lines readable (pre-voice-first desk behaviour).
    voiceActive: typeof narrateLine === 'function' ? lineSpoken : false
  });
  const linesToShow = typeof narrateLine === 'function' ? visibleLines : lineCount;
  const activeLine = coffee.lines[linesToShow - 1] ?? null;
  const activeSpeakerId = activeLine?.speakerId ?? null;

  return (
    <div
      className="office-coffee-layer"
      role="dialog"
      aria-label={copy.coffee.sceneAria}
      data-testid="office-coffee-scene"
    >
      <div className="office-coffee-shade" aria-hidden="true" />
      <div className="office-coffee-chrome">
        <p className="office-coffee-kind" aria-hidden="true">
          <span aria-hidden="true">☕</span> {copy.coffee.sceneTitle}
        </p>
        <button type="button" className="office-coffee-done" onClick={onDone}>
          {copy.coffee.done}
        </button>
      </div>

      {participants.map((castId, index) => {
        const person = officeSenderInfo(castId);
        const side = index % 2 === 0 ? 'left' : 'right';
        const isSpeaking = activeSpeakerId === castId;
        const line = isSpeaking ? (activeLine?.text ?? null) : null;
        return (
          <CoffeeFellow
            key={castId}
            person={person}
            side={side}
            line={line && showText ? line : null}
            isSpeaking={isSpeaking}
            copy={copy}
          />
        );
      })}
    </div>
  );
}

/** One colleague at the watercooler — leans in from an edge, bubble when speaking. */
function CoffeeFellow({ person, side, line, isSpeaking, copy }) {
  return (
    <div
      className={[
        'office-coffee-fellow',
        `is-side-${side}`,
        isSpeaking ? 'is-speaking' : 'is-listening'
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ '--coffee-accent': person.accentColor }}
      data-testid={`office-coffee-fellow-${person.id}`}
      data-speaking={isSpeaking ? 'true' : undefined}
    >
      <div className="office-coffee-fellow-head">
        <PersonaFace
          id={person.id}
          size={isSpeaking ? FACE_SIZE_SPEAKING : FACE_SIZE}
          className="office-coffee-face"
        />
      </div>
      <p className="office-coffee-fellow-name">{person.name}</p>
      {line ? (
        <div className="office-coffee-bubble is-speaking" role="status" aria-live="polite">
          <p className="office-coffee-line">{line}</p>
        </div>
      ) : isSpeaking && !line ? (
        <p className="office-coffee-speaking-label">
          {formatLocale(copy.coffee.speakingLabel ?? '{name}…', { name: person.name })}
        </p>
      ) : null}
    </div>
  );
}
