import { useEffect, useMemo, useState } from 'react';
import { officeChromeCopy, officeSenderInfo } from '../utils/officeCast.js';
import { formatLocale } from '../i18n/formatLocale.js';

export const BATTLE_LINE_PACE_MS = 1900;

/**
 * Cubicle battle (docs/office-parody.md). Three-phase: a small invite pill
 * ([Grab popcorn] / [Not my circus]), an arena scene where the two combatants'
 * lines pace in one by one for drama, then a verdict — the user settles the
 * holy war by siding with someone (worth a small XP nudge, wired by
 * OfficeLayer via onVote) and the winner gets the last word.
 */
export default function OfficeBattleOverlay({ battle, onAccept, onVote, onDone }) {
  const accepted = Boolean(battle?.accepted);
  const battleId = battle?.id ?? null;
  const lineCount = battle?.lines?.length ?? 0;
  const [visibleLines, setVisibleLines] = useState(1);

  // Restart the pacing whenever a new battle enters the arena.
  useEffect(() => {
    setVisibleLines(1);
  }, [battleId]);

  useEffect(() => {
    if (!accepted || visibleLines >= lineCount) return undefined;
    const timer = setTimeout(() => setVisibleLines((count) => count + 1), BATTLE_LINE_PACE_MS);
    return () => clearTimeout(timer);
  }, [accepted, visibleLines, lineCount]);

  const sides = useMemo(() => {
    if (!battle) return [];
    return Object.keys(battle.verdicts ?? {}).map((id) => officeSenderInfo(id));
  }, [battle]);

  if (!battle || sides.length < 2) return null;
  const copy = officeChromeCopy();
  const [sideA, sideB] = sides;

  if (!accepted) {
    return (
      <div className="office-battle-invite" role="status" aria-live="polite">
        <span aria-hidden="true">🥊</span>
        <span className="office-battle-invite-text">
          {formatLocale(copy.battle.inviteLine, {
            a: sideA.name,
            b: sideB.name,
            topic: battle.topic
          })}
        </span>
        <button type="button" className="office-battle-accept" onClick={onAccept}>
          {copy.battle.accept}
        </button>
        <button type="button" className="office-battle-decline" onClick={onDone}>
          {copy.battle.decline}
        </button>
      </div>
    );
  }

  const allLinesIn = visibleLines >= lineCount;
  const winner = battle.votedFor ? officeSenderInfo(battle.votedFor) : null;
  const verdictText = battle.votedFor ? battle.verdicts[battle.votedFor] : null;

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
                style={{ borderColor: side.accentColor }}
                title={side.title ? `${side.name} · ${side.title}` : side.name}
              >
                {side.avatarEmoji}
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
                  {speaker.avatarEmoji}
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
        {allLinesIn && !battle.votedFor ? (
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
