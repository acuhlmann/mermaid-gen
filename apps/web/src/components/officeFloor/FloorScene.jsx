/**
 * Set pieces at their locations (docs/office-isometric-mode.md § 5 slice 4).
 *
 * The same `coffee` / `battle` state the desk-mode overlays render, staged
 * where it would actually happen: the coffee break at the machine, a holy war
 * across the aisle in full view of the floor. Participants leave their
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

import { useEffect, useState, useSyncExternalStore } from 'react';
import FloorBubble from './FloorBubble.jsx';
import FloorFigure from './FloorFigure.jsx';
import FloorPanel from './FloorPanel.jsx';
import { useScenePacing } from '../../hooks/useScenePacing.js';
import { useSpokenLineVoice } from '../../hooks/useSpokenLineVoice.js';
import {
  BATTLE_LINE_PACE_MS,
  BATTLE_SILENT_DURATION_MS,
  COFFEE_BREAK_DURATION_MS,
  COFFEE_LINE_PACE_MS
} from '../../hooks/officeScenePacingConstants.js';
import { officeChromeCopy, officeSenderInfo } from '../../utils/officeCast.js';
import { shouldShowSpokenText } from '../../utils/officeCaptions.js';
import { formatLocale } from '../../i18n/formatLocale.js';
import { sceneParticipants } from '../../utils/officeSceneCast.js';
import { floorActivityFor } from '../../utils/officeFloorActivity.js';
import { getOfficeSnapshot, subscribe } from '../../state/officeMomentStore.js';
import {
  BATTLE_TILES,
  COFFEE_TILES,
  bubbleAlignForTile,
  depthOf,
  projectIso
} from '../../utils/officeFloorPlan.js';

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

/**
 * One participant standing at their mark, optionally saying something.
 *
 * `speaking` is deliberately **not** `Boolean(line)`. Under narration the line
 * is spoken instead of drawn (`showSpokenText`), and whoever is talking is still
 * whoever is talking — reading the bubble back would hang the indicator off a
 * captions preference, which is the trap slice 8's Do-it nearly fell into
 * (§ 8). The depth lift stays on the bubble, because that is what has to clear
 * the signage.
 */
function SceneActor({
  castId,
  tile,
  line,
  scale,
  speaking = false,
  hold = null,
  expressionOverride = null
}) {
  const { left, top } = projectIso(tile.x, tile.y);
  const sender = officeSenderInfo(castId);
  const align = bubbleAlignForTile(tile);
  return (
    <div
      className={`office-floor-walker office-floor-scene-actor${speaking ? ' is-speaking' : ''}`}
      data-testid={`office-floor-scene-actor-${castId}`}
      style={{ left, top, zIndex: line ? SPEAKING_Z : depthOf(tile.x, tile.y) + 5 }}
    >
      <div className="office-floor-walker-anchor">
        {line ? (
          <FloorBubble
            name={sender?.name ?? castId}
            title={sender?.title}
            scale={scale}
            align={align}
          >
            {line}
          </FloorBubble>
        ) : null}
        <FloorFigure
          id={castId}
          accent={sender?.accentColor ?? 'var(--accent)'}
          activity={floorActivityFor(castId, { coffee: hold === 'coffee', moving: true })}
          expressionOverride={expressionOverride}
        />
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

/** "They're at it again / up for coffee?" — the ask, before anything has started. */
function SceneInvite({
  isBattle,
  scene,
  names,
  copy,
  tiles,
  scale,
  onAccept,
  onDecline,
  narrateLine,
  showAsker = true
}) {
  const snapshot = useSyncExternalStore(subscribe, getOfficeSnapshot, getOfficeSnapshot);
  const inviteLine = isBattle
    ? formatLocale(copy.battle.inviteLine, {
        a: names[0] ?? '',
        b: names[1] ?? '',
        topic: scene.topic ?? ''
      })
    : formatLocale(copy.coffee.inviteLine, { name: names[0] ?? '' });
  const speakerId = isBattle
    ? (Object.keys(scene.verdicts ?? {})[0] ?? '')
    : (scene.lines?.[0]?.speakerId ?? '');
  const { showSpokenText: showInviteText } = useSpokenLineVoice({
    captions: snapshot.captions,
    narration: snapshot.narration,
    narrateLine,
    speakerId,
    text: inviteLine,
    lineKey: scene?.id ?? null
  });

  return (
    <>
      {!isBattle && showAsker && scene.lines?.[0]?.speakerId ? (
        <SceneActor
          castId={scene.lines[0].speakerId}
          tile={tiles[0]}
          scale={scale}
          line={showInviteText ? inviteLine : null}
        />
      ) : null}
      <ScenePanel
        tiles={tiles}
        scale={scale}
        testId={`office-floor-${isBattle ? 'battle' : 'coffee'}-invite`}
      >
        {isBattle && showInviteText ? (
          <p className="office-floor-panel-line">{inviteLine}</p>
        ) : null}
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
    </>
  );
}

/** Someone has to be wrong: the floor rules, then the winner gets the podium. */
function BattleVerdict({
  scene,
  participants,
  votedFor,
  copy,
  tiles,
  scale,
  onVote,
  onDone,
  showSpokenText = true
}) {
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
      {showSpokenText ? <p className="office-floor-panel-line">{copy.battle.settleLine}</p> : null}
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
 *   onDone?: () => void,
 *   showSpokenText?: boolean
 * }} props
 */
export function FloorScene({
  kind,
  scene,
  scale = 1,
  /** When set, pacing is owned by `OfficeLayer` so view toggles do not restart. */
  visibleLines: visibleLinesProp,
  /** Spoken-state twin of `visibleLines` when pacing is lifted to OfficeLayer. */
  lineSpoken: lineSpokenProp,
  /** Battle only — all combat lines revealed (lifted from `OfficeLayer`). */
  linesDone: linesDoneProp,
  narrateLine,
  prefetchLine,
  onAccept,
  onDecline,
  onVote,
  onDone,
  showSpokenText: showSpokenTextProp,
  /*
   * Slice 17: who has actually walked over yet. Until somebody arrives at their
   * mark they are a commuter (`FloorCommuters`), and drawing them here as well
   * would be two of the same person — § 6 rule 5.
   *
   * `null` means "don't ask", which is the honest default for a component that
   * can be mounted on its own: a standalone `FloorScene` has no commute wiring
   * behind it and should still stage its whole cast.
   */
  settledIds = null
}) {
  const isBattle = kind === 'battle';
  const spec = SCENE_KINDS[kind] ?? SCENE_KINDS.coffee;
  const tiles = spec.tiles;
  const accepted = Boolean(scene?.accepted);
  /*
   * Slice 28. Two ways to be a performance and only one of them is yours: a
   * scene you accepted, and a scene you turned down that is happening anyway.
   * The invite is the exact complement — an offer only exists while the scene
   * is neither — so `performing` and `!performing` cover the three states
   * without a third branch, and a scene cannot draw its cast and ask you to
   * join it in the same frame.
   */
  const performing = accepted || Boolean(scene?.declined);
  const [internalLinesDone, setInternalLinesDone] = useState(false);
  const sceneId = scene?.id ?? null;

  useEffect(() => {
    setInternalLinesDone(false);
  }, [sceneId]);

  const paced = useScenePacing({
    lines: scene?.lines ?? [],
    active: visibleLinesProp === undefined && performing,
    narrateLine,
    prefetchLine,
    paceMs: spec.paceMs,
    silentDurationMs: spec.silentMs,
    sceneId,
    onDone:
      visibleLinesProp === undefined
        ? isBattle
          ? () => setInternalLinesDone(true)
          : onDone
        : undefined
  });
  const visibleLines = visibleLinesProp ?? paced.visibleLines;
  const lineSpoken = lineSpokenProp ?? paced.lineSpoken;
  const linesDone = linesDoneProp ?? internalLinesDone;
  const snapshot = useSyncExternalStore(subscribe, getOfficeSnapshot, getOfficeSnapshot);
  const showSpokenText =
    showSpokenTextProp ??
    shouldShowSpokenText({ captions: snapshot.captions, voiceActive: lineSpoken });

  if (!scene) return null;

  const copy = officeChromeCopy();
  const participants = sceneParticipants(scene.lines);
  const hasArrived = (castId) => !settledIds || settledIds.has(castId);
  const votedFor = isBattle ? (scene.votedFor ?? null) : null;
  const currentLine = performing && !votedFor ? (scene.lines?.[visibleLines - 1] ?? null) : null;
  const names = participants.map((id) => officeSenderInfo(id)?.name ?? id);

  return (
    <>
      {performing
        ? participants.map((castId, index) => {
            if (!hasArrived(castId)) return null;
            const verdict = votedFor === castId ? scene.verdicts?.[castId] : null;
            const speaking = currentLine?.speakerId === castId ? currentLine.text : null;
            const line = verdict ?? speaking;
            const shown = line && showSpokenText ? line : null;
            return (
              <SceneActor
                key={castId}
                castId={castId}
                tile={tiles[index % tiles.length]}
                scale={scale}
                expressionOverride={isBattle ? 'frown' : null}
                speaking={Boolean(speaking)}
                /* A coffee break is two people holding coffee. A holy war is
                   two people holding nothing, because their hands are busy. */
                hold={isBattle ? null : 'coffee'}
                line={shown}
              />
            );
          })
        : null}

      {!performing ? (
        <SceneInvite
          isBattle={isBattle}
          scene={scene}
          names={names}
          copy={copy}
          tiles={tiles}
          scale={scale}
          onAccept={onAccept}
          onDecline={onDecline}
          narrateLine={narrateLine}
          /* The coffee invite draws its asker at the machine; they are still
             walking there while the ask is on screen. The panel itself stays —
             the ask is the moment, not the person. */
          showAsker={hasArrived(scene.lines?.[0]?.speakerId ?? '')}
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
          showSpokenText={showSpokenText}
        />
      ) : null}
    </>
  );
}

export default FloorScene;
