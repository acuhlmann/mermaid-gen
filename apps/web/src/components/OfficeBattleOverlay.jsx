import { useEffect, useMemo, useRef, useState } from 'react';
import { officeChromeCopy, officeSenderInfo } from '../utils/officeCast.js';
import { OFFICE_NARRATION_GAP_MS } from '../utils/officeNarration.js';
import { formatLocale } from '../i18n/formatLocale.js';
import { useNarrowLayout } from '../hooks/useAppLayoutMedia.js';
import { PersonaFace } from './personaFaces/index.jsx';
import FloatingWindow, { FloatingWindowDragHandle } from './FloatingWindow.jsx';

export const BATTLE_LINE_PACE_MS = 1900;

/**
 * Cubicle battle (docs/office-parody.md). Three-phase: a small invite pill
 * ([Grab popcorn] / [Not my circus]), an arena scene where the two combatants'
 * lines pace in one by one for drama (spoken when narrateLine is provided —
 * overheard argument, not inbox text), then a verdict — the user settles the
 * holy war by siding with someone (worth a small XP nudge, wired by
 * OfficeLayer via onVote) and the winner gets the last word.
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

  // Restart the pacing whenever a new battle enters the arena.
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

  // Winner's closing zinger — overheard after the floor rules.
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

  if (!accepted) {
    return (
      <FloatingWindow
        id="office-battle-invite"
        open
        group="officeChrome"
        className="office-battle-invite"
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

  return (
    <div className="office-battle-scene" role="dialog" aria-label={copy.battle.sceneAria}>
      <div className="office-battle-card">
        <div className="office-battle-head">
          <span aria-hidden="true">🥊</span> {copy.battle.sceneTitle}
          <span className="office-battle-topic">“{battle.topic}”</span>
        </div>
        <div className="office-battle-versus" aria-hidden="true">
          {[sideA, sideB].map((side, index) => (
            <span key={side.id} className="office-battle-versus-side">
              {index === 1 ? <span className="office-battle-vs">{copy.battle.versus}</span> : null}
              <span
                className="office-battle-versus-avatar"
                title={side.title ? `${side.name} · ${side.title}` : side.name}
              >
                <PersonaFace id={side.id} size={34} />
              </span>
              <span className="office-battle-versus-name">{side.name}</span>
            </span>
          ))}
        </div>
        <ul className="office-battle-lines" aria-live="polite">
          {battle.lines.slice(0, visibleLines).map((line, index) => {
            const speaker = officeSenderInfo(line.speakerId);
            return (
              <li key={`${battle.id}-${index}`} className="office-battle-line">
                <span
                  className="office-battle-line-avatar"
                  aria-hidden="true"
                  title={speaker.title ? `${speaker.name} · ${speaker.title}` : speaker.name}
                >
                  <PersonaFace id={line.speakerId} size={24} />
                </span>
                <span>
                  <span
                    className="office-battle-speaker"
                    style={{ color: speaker.accentColor }}
                    title={speaker.title ? `${speaker.name} · ${speaker.title}` : speaker.name}
                  >
                    {speaker.name}:
                  </span>{' '}
                  {line.text}
                </span>
              </li>
            );
          })}
        </ul>
        {!votedFor && !allLinesIn ? (
          <div className="office-battle-bail">
            <button type="button" className="office-battle-getout" onClick={onDone}>
              {copy.battle.getOut}
            </button>
          </div>
        ) : null}
        {allLinesIn && !votedFor ? (
          <div className="office-battle-settle">
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
          <div className="office-battle-verdict" role="status">
            <div className="office-battle-verdict-head">
              🏆 {copy.battle.verdictHead}: {winner.avatarEmoji} {winner.name}
            </div>
            <p className="office-battle-verdict-text">{verdictText}</p>
            <button type="button" className="office-battle-done" onClick={onDone}>
              {copy.battle.done}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
