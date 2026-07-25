/**
 * Set pieces at their locations (docs/office-isometric-mode.md § 5 slice 4).
 *
 * The same `coffee` / `battle` state the desk-mode overlays render, staged
 * where it would actually happen: the coffee break at the machine, the cubicle
 * battle across the aisle in full view of the floor. Participants leave their
 * desks (which stay, empty) for the duration.
 *
 * Line pacing and narration come from the shared `useScenePacing` hook, so a
 * scene performs identically in both worlds. Only one renderer may be mounted
 * at a time — `OfficeLayer` hides its overlays while you are standing — or the
 * scene would be spoken twice.
 *
 * Everything here lives inside the scaled stage, including the invite and
 * verdict panels: they counter-scale like `FloorBubble`, so the ask appears at
 * the machine (or between the combatants) at a readable size instead of in a
 * corner of the screen divorced from the people it is about.
 */

import { useEffect, useState } from 'react';
import FloorBubble from './FloorBubble.jsx';
import FloorFigure from './FloorFigure.jsx';
import FloorPanel from './FloorPanel.jsx';
import { useScenePacing } from '../../hooks/useScenePacing.js';
import { BATTLE_LINE_PACE_MS } from '../OfficeBattleOverlay.jsx';
import { COFFEE_BREAK_DURATION_MS, COFFEE_LINE_PACE_MS } from '../CoffeeBreakOverlay.jsx';
import { officeChromeCopy, officeSenderInfo } from '../../utils/officeCast.js';
import { formatLocale } from '../../i18n/formatLocale.js';
import { sceneParticipants } from '../../utils/officeSceneCast.js';
import { BATTLE_TILES, COFFEE_TILES, depthOf, projectIso } from '../../utils/officeFloorPlan.js';

/** A battle with narration off still needs an end; matches the coffee timer. */
const BATTLE_SILENT_DURATION_MS = 18_000;

/** Everything that differs between the two kinds of set piece, in one place. */
const SCENE_KINDS = {
  coffee: {
    tiles: COFFEE_TILES,
    paceMs: COFFEE_LINE_PACE_MS,
    silentMs: COFFEE_BREAK_DURATION_MS
  },
  battle: {
    tiles: BATTLE_TILES,
    paceMs: BATTLE_LINE_PACE_MS,
    silentMs: BATTLE_SILENT_DURATION_MS
  }
};

/** Above the signage layer, so a spoken line clears the zone labels. */
const SPEAKING_Z = 9600;

/** One participant standing at their mark, optionally saying something. */
function SceneActor({ castId, tile, line, scale }) {
  const { left, top } = projectIso(tile.x, tile.y);
  const sender = officeSenderInfo(castId);
  return (
    <div
      className="office-floor-walker"
      data-testid={`office-floor-scene-actor-${castId}`}
      style={{ left, top, zIndex: line ? SPEAKING_Z : depthOf(tile.x, tile.y) + 5 }}
    >
      <div className="office-floor-walker-anchor">
        {line ? (
          <FloorBubble name={sender?.name ?? castId} title={sender?.title} scale={scale}>
            {line}
          </FloorBubble>
        ) : null}
        <FloorFigure id={castId} accent={sender?.accentColor ?? 'var(--accent)'} />
      </div>
    </div>
  );
}

/** The shared floor panel, pinned to the midpoint between the participants. */
function ScenePanel({ tiles, scale, children, testId }) {
  const mid = {
    x: (tiles[0].x + tiles[1].x) / 2,
    y: (tiles[0].y + tiles[1].y) / 2
  };
  return (
    <FloorPanel tile={mid} scale={scale} testId={testId}>
      {children}
    </FloorPanel>
  );
}

/** "They're at it again / coffee?" — the ask, before anything has started. */
function SceneInvite({ isBattle, scene, names, copy, tiles, scale, onAccept, onDecline }) {
  const line = isBattle
    ? formatLocale(copy.battle.inviteLine, {
        a: names[0] ?? '',
        b: names[1] ?? '',
        topic: scene.topic ?? ''
      })
    : formatLocale(copy.coffee.inviteLine, { name: names[0] ?? '' });

  return (
    <ScenePanel
      tiles={tiles}
      scale={scale}
      testId={`office-floor-${isBattle ? 'battle' : 'coffee'}-invite`}
    >
      <p className="office-floor-panel-line">{line}</p>
      <div className="office-floor-card-actions">
        <button
          type="button"
          className="office-floor-card-action office-floor-card-action--primary"
          onClick={onAccept}
        >
          {isBattle ? copy.battle.accept : copy.coffee.accept}
        </button>
        <button type="button" className="office-floor-card-action" onClick={onDecline}>
          {isBattle ? copy.battle.decline : copy.coffee.decline}
        </button>
      </div>
    </ScenePanel>
  );
}

/** Someone has to be wrong: the floor rules, then the winner gets the podium. */
function BattleVerdict({ scene, participants, votedFor, copy, tiles, scale, onVote, onDone }) {
  if (votedFor) {
    return (
      <ScenePanel tiles={tiles} scale={scale} testId="office-floor-battle-done">
        <div className="office-floor-card-actions">
          <button
            type="button"
            className="office-floor-card-action office-floor-card-action--primary"
            onClick={onDone}
          >
            {copy.battle.done}
          </button>
        </div>
      </ScenePanel>
    );
  }

  return (
    <ScenePanel tiles={tiles} scale={scale} testId="office-floor-battle-verdict">
      <p className="office-floor-panel-line">{copy.battle.settleLine}</p>
      <div className="office-floor-card-actions">
        {participants.map((castId) => (
          <button
            key={castId}
            type="button"
            className="office-floor-card-action"
            onClick={() => onVote?.(scene.id, castId)}
          >
            {formatLocale(copy.battle.sideLabel, {
              name: officeSenderInfo(castId)?.name ?? castId
            })}
          </button>
        ))}
        <button type="button" className="office-floor-card-action" onClick={onDone}>
          {copy.battle.walkAway}
        </button>
      </div>
    </ScenePanel>
  );
}

/**
 * @param {{
 *   kind: 'coffee' | 'battle',
 *   scene: any,
 *   scale?: number,
 *   narrateLine?: (line: any) => any,
 *   prefetchLine?: (line: any) => void,
 *   onAccept?: () => void,
 *   onDecline?: () => void,
 *   onVote?: (id: string, sideId: string) => void,
 *   onDone?: () => void
 * }} props
 */
export function FloorScene({
  kind,
  scene,
  scale = 1,
  narrateLine,
  prefetchLine,
  onAccept,
  onDecline,
  onVote,
  onDone
}) {
  const isBattle = kind === 'battle';
  const spec = SCENE_KINDS[kind] ?? SCENE_KINDS.coffee;
  const tiles = spec.tiles;
  const accepted = Boolean(scene?.accepted);
  const [linesDone, setLinesDone] = useState(false);
  const sceneId = scene?.id ?? null;

  useEffect(() => {
    setLinesDone(false);
  }, [sceneId]);

  const visibleLines = useScenePacing({
    lines: scene?.lines ?? [],
    active: accepted,
    narrateLine,
    prefetchLine,
    paceMs: spec.paceMs,
    silentDurationMs: spec.silentMs,
    sceneId,
    // A battle does not end itself: the floor has to rule on it.
    onDone: isBattle ? () => setLinesDone(true) : onDone
  });

  if (!scene) return null;

  const copy = officeChromeCopy();
  const participants = sceneParticipants(scene.lines);
  const votedFor = isBattle ? (scene.votedFor ?? null) : null;
  const currentLine = accepted && !votedFor ? (scene.lines?.[visibleLines - 1] ?? null) : null;
  const names = participants.map((id) => officeSenderInfo(id)?.name ?? id);

  return (
    <>
      {participants.map((castId, index) => {
        const verdict = votedFor === castId ? scene.verdicts?.[castId] : null;
        const speaking = currentLine?.speakerId === castId ? currentLine.text : null;
        return (
          <SceneActor
            key={castId}
            castId={castId}
            tile={tiles[index % tiles.length]}
            scale={scale}
            line={verdict ?? speaking}
          />
        );
      })}

      {!accepted ? (
        <SceneInvite
          isBattle={isBattle}
          scene={scene}
          names={names}
          copy={copy}
          tiles={tiles}
          scale={scale}
          onAccept={onAccept}
          onDecline={onDecline}
        />
      ) : null}

      {isBattle && accepted && (linesDone || votedFor) ? (
        <BattleVerdict
          scene={scene}
          participants={participants}
          votedFor={votedFor}
          copy={copy}
          tiles={tiles}
          scale={scale}
          onVote={onVote}
          onDone={onDone}
        />
      ) : null}
    </>
  );
}

export default FloorScene;
