import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { officeChromeCopy, officeSenderInfo } from '../utils/officeCast.js';
import { formatLocale } from '../i18n/formatLocale.js';
import { shouldShowSpokenText } from '../utils/officeCaptions.js';
import { getOfficeSnapshot, subscribe } from '../state/officeMomentStore.js';
import { useScenePacing } from '../hooks/useScenePacing.js';
import {
  BATTLE_LINE_PACE_MS,
  BATTLE_SILENT_DURATION_MS
} from '../hooks/officeScenePacingConstants.js';
import { PersonaFace } from './personaFaces/index.jsx';

export { BATTLE_LINE_PACE_MS } from '../hooks/officeScenePacingConstants.js';

const FACE_SIZE = 128;
const FACE_SIZE_SPEAKING = 140;
const INVITE_FACE_SIZE = 108;

/**
 * Holy war on the floor (docs/office-parody.md). Three-phase: a small invite pill
 * ([Grab popcorn] / [Not my circus]), a face-off scene where the two combatants
 * lean in from opposite sides of the canvas (huddle/walk-by parity — angry
 * scowls, one bubble at a time), then a verdict — the user settles the holy war
 * by siding with someone (worth a small XP nudge, wired by OfficeLayer via
 * onVote) and the winner gets the last word.
 *
 * @param {{
 *   battle: object | null,
 *   onAccept?: () => void,
 *   onVote?: (colleagueId: string) => void,
 *   onDone?: () => void,
 *   narrateLine?: (line: { speakerId: string, text: string }) => Promise<{ spoken?: boolean } | void>
 * }} props
 */
export default function OfficeBattleOverlay({
  battle,
  /** When set, pacing is owned by `OfficeLayer` so view toggles do not restart. */
  visibleLines: visibleLinesProp,
  /** True once all combat lines have been revealed (lifted from `OfficeLayer`). */
  linesDone: linesDoneProp,
  onAccept,
  onVote,
  onDone,
  narrateLine,
  prefetchLine
}) {
  const snapshot = useSyncExternalStore(subscribe, getOfficeSnapshot, getOfficeSnapshot);
  const accepted = Boolean(battle?.accepted);
  const battleId = battle?.id ?? null;
  const lineCount = battle?.lines?.length ?? 0;
  const [internalLinesDone, setInternalLinesDone] = useState(false);

  useEffect(() => {
    setInternalLinesDone(false);
  }, [battleId]);

  const pacedVisibleLines = useScenePacing({
    lines: battle?.lines ?? [],
    active: visibleLinesProp === undefined && accepted && Boolean(battle) && lineCount > 0,
    narrateLine:
      typeof narrateLine === 'function'
        ? narrateLine
        : visibleLinesProp === undefined
          ? () => ({ spoken: false })
          : undefined,
    prefetchLine,
    paceMs: BATTLE_LINE_PACE_MS,
    silentDurationMs: BATTLE_SILENT_DURATION_MS,
    sceneId: battleId,
    onDone: visibleLinesProp === undefined ? () => setInternalLinesDone(true) : undefined
  });
  const visibleLines = visibleLinesProp ?? pacedVisibleLines;
  const linesDone = linesDoneProp ?? internalLinesDone;

  useEffect(() => {
    if (!accepted || !battle?.votedFor) return undefined;
    const text = battle.verdicts?.[battle.votedFor];
    if (!text || typeof narrateLine !== 'function') return undefined;
    let cancelled = false;
    void (async () => {
      try {
        await narrateLine({ speakerId: battle.votedFor, text });
      } catch {
        // Garnish.
      }
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [accepted, battle?.votedFor, battleId, narrateLine]);

  const sides = useMemo(() => {
    if (!battle) return [];
    return Object.keys(battle.verdicts ?? {}).map((id) => officeSenderInfo(id));
  }, [battle]);

  if (!battle || sides.length < 2) return null;
  const copy = officeChromeCopy();
  const [sideA, sideB] = sides;
  const showText = shouldShowSpokenText({
    captions: snapshot.captions,
    voiceActive: snapshot.narration && typeof narrateLine === 'function'
  });

  if (!accepted) {
    const inviteLine = formatLocale(copy.battle.inviteLine, {
      a: sideA.name,
      b: sideB.name,
      topic: battle.topic
    });

    return (
      <div
        className="office-battle-invite-layer"
        role="status"
        aria-live="polite"
        aria-label={inviteLine}
        data-testid="office-battle-invite"
        data-floating-window="office-battle-invite"
      >
        <div className="office-battle-invite-shade" aria-hidden="true" />
        <div className="office-battle-invite office-battle-invite--shoulder">
          <button
            type="button"
            className="office-battle-invite-dismiss"
            aria-label={formatLocale(copy.battle.declineAria ?? copy.battle.decline, {
              a: sideA.name,
              b: sideB.name
            })}
            onClick={onDone}
          >
            ×
          </button>
          <div className="office-battle-invite-head" aria-hidden="true">
            <div className="office-battle-invite-faceoff">
              <div className="office-battle-invite-fighter">
                <PersonaFace
                  id={sideA.id}
                  size={INVITE_FACE_SIZE}
                  className="office-battle-invite-avatar"
                  expressionOverride="frown"
                />
                <span className="office-battle-invite-name">{sideA.name}</span>
              </div>
              <span className="office-battle-invite-versus" aria-hidden="true">
                🥊
              </span>
              <div className="office-battle-invite-fighter">
                <PersonaFace
                  id={sideB.id}
                  size={INVITE_FACE_SIZE}
                  className="office-battle-invite-avatar"
                  expressionOverride="frown"
                />
                <span className="office-battle-invite-name">{sideB.name}</span>
              </div>
            </div>
          </div>
          <div className="office-battle-invite-presence">
            <p className="office-moment-kind office-moment-kind--battle" aria-hidden="true">
              {copy.battle.kindLabel}
            </p>
            <p className="office-battle-invite-topic">“{battle.topic}”</p>
            <p className="office-battle-invite-ask">{copy.battle.inviteTagline}</p>
            <div className="office-battle-invite-actions">
              <button type="button" className="office-battle-accept" onClick={onAccept}>
                {copy.battle.accept}
              </button>
              <button type="button" className="office-battle-decline" onClick={onDone}>
                {copy.battle.decline}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const allLinesIn = linesDone || visibleLines >= lineCount;
  const votedFor = battle?.votedFor ?? null;
  const winner = votedFor ? officeSenderInfo(votedFor) : null;
  const verdictText = votedFor ? battle.verdicts[votedFor] : null;
  const activeLine = battle.lines[visibleLines - 1] ?? null;
  const activeSpeakerId = votedFor ? null : (activeLine?.speakerId ?? null);

  return (
    <div
      className="office-battle-layer"
      role="dialog"
      aria-label={copy.battle.sceneAria}
      data-testid="office-battle-scene"
    >
      <button
        type="button"
        className="office-battle-scene-dismiss"
        aria-label={copy.battle.dismissAria ?? copy.battle.getOut}
        onClick={onDone}
      >
        ×
      </button>
      <div className="office-battle-shade" aria-hidden="true" />
      <div className="office-battle-chrome">
        <p className="office-battle-kind" aria-hidden="true">
          <span aria-hidden="true">🥊</span> {copy.battle.sceneTitle}
        </p>
        <p className="office-battle-topic">“{battle.topic}”</p>
      </div>

      <BattleFighter
        person={sideA}
        side="left"
        line={
          votedFor === sideA.id && verdictText
            ? verdictText
            : activeSpeakerId === sideA.id
              ? activeLine?.text
              : null
        }
        showText={showText}
        isSpeaking={activeSpeakerId === sideA.id || votedFor === sideA.id}
        isWinner={votedFor === sideA.id}
        copy={copy}
      />
      <BattleFighter
        person={sideB}
        side="right"
        line={
          votedFor === sideB.id && verdictText
            ? verdictText
            : activeSpeakerId === sideB.id
              ? activeLine?.text
              : null
        }
        showText={showText}
        isSpeaking={activeSpeakerId === sideB.id || votedFor === sideB.id}
        isWinner={votedFor === sideB.id}
        copy={copy}
      />

      {allLinesIn && !votedFor ? (
        <div className="office-battle-settle" data-testid="office-battle-settle">
          <p className="office-battle-settle-line">{copy.battle.settleLine}</p>
          <div className="office-battle-settle-buttons">
            {[sideA, sideB].map((side) => (
              <button
                key={side.id}
                type="button"
                className="office-battle-side"
                style={{ borderColor: side.accentColor }}
                onClick={() => onVote?.(side.id)}
              >
                {side.avatarEmoji} {formatLocale(copy.battle.sideLabel, { name: side.name })}
              </button>
            ))}
          </div>
          <button type="button" className="office-battle-walkaway" onClick={onDone}>
            {copy.battle.walkAway}
          </button>
        </div>
      ) : null}

      {winner && verdictText ? (
        <div className="office-battle-verdict" role="status" data-testid="office-battle-verdict">
          <div className="office-battle-verdict-head">
            🏆 {copy.battle.verdictHead}: {winner.avatarEmoji} {winner.name}
          </div>
          <button type="button" className="office-battle-done" onClick={onDone}>
            {copy.battle.done}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * One combatant leaning in from the left or right edge — angry scowl, bubble when
 * they have the floor.
 */
function BattleFighter({ person, side, line, showText, isSpeaking, isWinner, copy }) {
  return (
    <div
      className={[
        'office-battle-fighter',
        `is-side-${side}`,
        isSpeaking ? 'is-speaking' : 'is-listening',
        isWinner ? 'is-winner' : ''
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ '--battle-accent': person.accentColor }}
      data-testid={`office-battle-fighter-${person.id}`}
      data-speaking={isSpeaking ? 'true' : undefined}
    >
      <div className="office-battle-fighter-head">
        <PersonaFace
          id={person.id}
          size={isSpeaking ? FACE_SIZE_SPEAKING : FACE_SIZE}
          className="office-battle-face"
          expressionOverride="frown"
        />
      </div>
      <p className="office-battle-fighter-name">{person.name}</p>
      {line && showText ? (
        <div
          className={[
            'office-battle-bubble',
            isWinner ? 'is-verdict' : '',
            isSpeaking ? 'is-speaking' : ''
          ]
            .filter(Boolean)
            .join(' ')}
          role="status"
          aria-live="polite"
        >
          <p className="office-battle-line">{line}</p>
        </div>
      ) : isSpeaking && !showText ? (
        <p className="office-battle-speaking-label">
          {formatLocale(copy.battle.speakingLabel ?? '{name}…', { name: person.name })}
        </p>
      ) : null}
    </div>
  );
}
