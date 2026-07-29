import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { officeChromeCopy, officeSenderInfo } from '../utils/officeCast.js';
import { OFFICE_NARRATION_GAP_MS } from '../utils/officeNarration.js';
import { formatLocale } from '../i18n/formatLocale.js';
import { shouldShowSpokenText } from '../utils/officeCaptions.js';
import { getOfficeSnapshot, subscribe } from '../state/officeMomentStore.js';
import { useNarrowLayout } from '../hooks/useAppLayoutMedia.js';
import { PersonaFace } from './personaFaces/index.jsx';
import FloatingWindow, { FloatingWindowDragHandle } from './FloatingWindow.jsx';

export const BATTLE_LINE_PACE_MS = 1900;

const FACE_SIZE = 128;
const FACE_SIZE_SPEAKING = 140;

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
  onAccept,
  onVote,
  onDone,
  narrateLine,
  prefetchLine
}) {
  const narrowLayout = useNarrowLayout();
  const snapshot = useSyncExternalStore(subscribe, getOfficeSnapshot, getOfficeSnapshot);
  const accepted = Boolean(battle?.accepted);
  const battleId = battle?.id ?? null;
  const lineCount = battle?.lines?.length ?? 0;
  const [visibleLines, setVisibleLines] = useState(1);
  const narrateRef = useRef(narrateLine);
  const prefetchRef = useRef(prefetchLine);
  useEffect(() => {
    narrateRef.current = narrateLine;
    prefetchRef.current = prefetchLine;
  });

  useEffect(() => {
    setVisibleLines(1);
  }, [battleId]);

  useEffect(() => {
    if (!accepted || !battle || lineCount <= 0) return undefined;
    let cancelled = false;
    const lines = battle.lines;

    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    void (async () => {
      for (let index = 0; index < lineCount; index += 1) {
        if (cancelled) return;
        setVisibleLines(index + 1);
        const line = lines[index];
        const nextLine = lines[index + 1];
        if (nextLine) prefetchRef.current?.(nextLine);
        const narrate = narrateRef.current;
        let spoken = false;
        if (typeof narrate === 'function' && line) {
          try {
            const result = await narrate(line);
            spoken = Boolean(result?.spoken);
          } catch {
            spoken = false;
          }
        }
        if (cancelled) return;
        if (index < lineCount - 1) {
          await wait(spoken ? OFFICE_NARRATION_GAP_MS : BATTLE_LINE_PACE_MS);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accepted, battleId, lineCount]);

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
    return (
      <FloatingWindow
        id="office-battle-invite"
        open
        group="officeChrome"
        className="office-battle-invite"
        manageable={false}
        defaultCorner="top-center"
        defaultOffsetX={16}
        defaultOffsetY={narrowLayout ? 92 : 76}
        cascade={1}
        role="status"
        aria-live="polite"
      >
        <FloatingWindowDragHandle className="office-battle-invite-head" title="Drag to move">
          <p className="office-moment-kind office-moment-kind--battle" aria-hidden="true">
            {copy.battle.kindLabel}
          </p>
        </FloatingWindowDragHandle>
        <span aria-hidden="true">🥊</span>
        <span className="office-battle-invite-text">
          {formatLocale(copy.battle.inviteLine, {
            a: sideA.name,
            b: sideB.name,
            topic: battle.topic
          })}
        </span>
        <div className="office-battle-invite-actions">
          <button type="button" className="office-battle-accept" onClick={onAccept}>
            {copy.battle.accept}
          </button>
          <button type="button" className="office-battle-decline" onClick={onDone}>
            {copy.battle.decline}
          </button>
        </div>
      </FloatingWindow>
    );
  }

  const allLinesIn = visibleLines >= lineCount;
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
      <div className="office-battle-shade" aria-hidden="true" />
      <div className="office-battle-chrome">
        <p className="office-battle-kind" aria-hidden="true">
          <span aria-hidden="true">🥊</span> {copy.battle.sceneTitle}
        </p>
        <p className="office-battle-topic">“{battle.topic}”</p>
        {!votedFor && !allLinesIn ? (
          <button type="button" className="office-battle-getout" onClick={onDone}>
            {copy.battle.getOut}
          </button>
        ) : null}
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
