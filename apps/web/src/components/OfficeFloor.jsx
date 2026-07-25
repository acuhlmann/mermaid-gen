/**
 * Isometric mode — renderer #2 of the office (ADR-0011,
 * docs/office-isometric-mode.md § 5 slice 1: the floor substrate).
 *
 * `OfficeLayer`'s chrome windows render office state as windows on your screen;
 * this renders the same office as a place, with the cast situated in it. Slice
 * 1 is the room and the people: walk-bys, set pieces, and meetings arrive in
 * later slices and must land here as *renderings of existing state*, never as
 * floor-only state.
 *
 * Layout lives in `officeFloorPlan.js`; the stage and the person card are
 * siblings under ./officeFloor. This file owns the view: scale, chrome, which
 * person is selected, and — since slice 7 — where you are standing.
 */

import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import FloorCardSlot from './officeFloor/FloorCardSlot.jsx';
import FloorMeeting from './officeFloor/FloorMeeting.jsx';
import FloorPeek from './officeFloor/FloorPeek.jsx';
import FloorPlayer from './officeFloor/FloorPlayer.jsx';
import FloorScenes from './officeFloor/FloorScenes.jsx';
import FloorStage from './officeFloor/FloorStage.jsx';
import FloorTopBar from './officeFloor/FloorTopBar.jsx';
import { useFloorAutoPan } from './officeFloor/useFloorAutoPan.js';
import { useFloorKeyboard } from './officeFloor/useFloorKeyboard.js';
import { useFloorPresence } from './officeFloor/useFloorPresence.js';
import { useFloorWalker } from './officeFloor/useFloorWalker.js';
import { useStageScale } from '../hooks/useStageScale.js';
import { YOU_SEAT_ID, peekTileFor, seatFor } from '../utils/officeFloorPlan.js';
import { isOfficeColleagueId, officeChromeCopy, officeSenderInfo } from '../utils/officeCast.js';
import { awayFromDeskIds } from '../utils/officeSceneCast.js';
import { tierOf } from '../utils/castTiers.js';
import { resolveUserName, subscribe as subscribeUserName } from '../state/userIdentityStore.js';
import {
  getOfficeViewMode,
  sitDown,
  subscribe as subscribeViewMode
} from '../state/officeViewModeStore.js';
import { useUiCopy } from '../i18n/useUiLocale.js';

/**
 * Everything the person card needs about whoever is selected — including
 * whether Slop Chat™ is on offer, which only the office tier gets. `'you'` is
 * in no cast bank, so the player's row comes from the floor copy + name badge.
 */
function usePersonDetails(selectedId, copy) {
  const userName = useSyncExternalStore(subscribeUserName, resolveUserName, resolveUserName);

  return useMemo(() => {
    if (!selectedId) return null;
    if (selectedId === YOU_SEAT_ID) {
      return {
        id: selectedId,
        name: userName,
        title: copy.youTitle,
        blurb: copy.youBlurb,
        tier: 'you',
        canMessage: false
      };
    }
    const sender = officeSenderInfo(selectedId);
    const tier = tierOf(selectedId);
    return {
      id: selectedId,
      name: sender?.name ?? selectedId,
      title: sender?.title ?? '',
      blurb: sender?.blurb ?? '',
      tier,
      canMessage: tier === 'office' && isOfficeColleagueId(selectedId),
      // Pure geometry: there has to be somewhere to stand that is not inside
      // the furniture, behind glass, or in front of the screen you came to read.
      canPeek: peekTileFor(selectedId) !== null
    };
  }, [selectedId, userName, copy]);
}

/**
 * A peek, as the person card and the speech bubble still want to see it. Since
 * slice 7 it is one flavour of *being somewhere* rather than its own state
 * machine: 'looking' is simply having arrived somewhere you went on purpose.
 */
function peekViewOf(presence) {
  if (presence?.intent?.kind !== 'peek') return null;
  return {
    colleagueId: presence.intent.colleagueId,
    phase: presence.phase === 'standing' ? 'looking' : 'walking'
  };
}

/**
 * @param {{
 *   onMessage?: (colleagueId: string) => void,
 *   walkBy?: { id: string, colleagueId: string, body: string, actionPrompt?: string } | null,
 *   onAdoptPrompt?: (prompt: string, colleagueId: string) => void,
 *   onDismissWalkBy?: (id: string) => void,
 *   coffee?: any, battle?: any, sceneHandlers?: any,
 *   meeting?: any, meetingHandlers?: any
 * }} props
 */
function OfficeFloorView({
  onMessage,
  walkBy,
  onAdoptPrompt,
  onDismissWalkBy,
  coffee = null,
  battle = null,
  sceneHandlers = {},
  meeting = null,
  meetingHandlers = {}
}) {
  // Subscribes this component to locale changes; the copy itself comes from the
  // office bundle below, exactly like DeskActionsDock.
  useUiCopy();
  const copy = officeChromeCopy().floor;

  const viewportRef = useRef(null);
  const scale = useStageScale(viewportRef);
  const [selectedId, setSelectedId] = useState(null);
  const person = usePersonDetails(selectedId, copy);
  const { walker, departing, handleDeparted } = useFloorWalker(walkBy);
  const { presence, playerRef, walkTo, peekAt, goHome, handleArrive } = useFloorPresence(
    Boolean(meeting)
  );

  const peek = peekViewOf(presence);
  // Where you are for the purposes of "can I get there from here". While a walk
  // is in flight that is where it is taking you: the next click queues from the
  // destination, not from the corridor.
  const origin = useMemo(() => {
    if (presence) return presence.to;
    const home = seatFor(YOU_SEAT_ID);
    return home ? { x: home.x, y: home.y } : null;
  }, [presence]);

  useFloorKeyboard({ presence, origin, goHome, walkTo });
  useFloorAutoPan(viewportRef, presence, scale);

  const handleSelect = useCallback((id) => {
    setSelectedId((current) => (current === id ? null : id));
  }, []);

  const handlePeek = useCallback(
    (id) => {
      const mark = peekTileFor(id);
      if (!mark) return;
      setSelectedId(null);
      peekAt(id, mark);
    },
    [peekAt]
  );

  const handleClosePerson = useCallback(() => setSelectedId(null), []);

  return (
    <div className="office-floor" data-testid="office-floor">
      <FloorTopBar copy={copy} standing={Boolean(presence) && !peek} onGoHome={goHome} />

      <div className="office-floor-viewport" ref={viewportRef}>
        <FloorStage
          scale={scale}
          copy={copy}
          selectedId={selectedId}
          onSelect={handleSelect}
          walker={walker}
          walkerDeparting={departing}
          onWalkerAdopt={onAdoptPrompt}
          onWalkerDismiss={onDismissWalkBy}
          onWalkerDeparted={handleDeparted}
          // A meeting has you in a chair in the glass room; the floor is not
          // yours to wander until you leave it.
          onWalkTo={meeting ? null : walkTo}
          roamOrigin={origin}
          vacantIds={awayFromDeskIds({
            coffee,
            battle,
            meeting,
            standing: presence,
            playerId: YOU_SEAT_ID
          })}
          // Whoever you are looking at holds the floor, the same glow the
          // arrival ceremony and the glass room use.
          speakingId={peek?.phase === 'looking' ? peek.colleagueId : null}
        >
          <FloorScenes
            coffee={coffee}
            battle={battle}
            scale={scale}
            sceneHandlers={sceneHandlers}
          />
          {meeting ? <FloorMeeting meeting={meeting} copy={copy} scale={scale} /> : null}
          {peek ? <FloorPeek peek={peek} scale={scale} /> : null}
          {/* One of you on the floor, whatever your reason for being up. */}
          {presence ? (
            <FloorPlayer
              from={presence.from}
              to={presence.to}
              walking
              walkKey={`roam:${presence.key}`}
              onArrive={handleArrive}
              elementRef={playerRef}
              testId={peek ? 'office-floor-peek-player' : 'office-floor-player'}
            />
          ) : null}
        </FloorStage>
      </div>

      <FloorCardSlot
        copy={copy}
        meeting={meeting}
        meetingHandlers={meetingHandlers}
        peek={peek}
        person={person}
        onGoHome={goHome}
        onMessage={onMessage}
        onPeek={handlePeek}
        onClosePerson={handleClosePerson}
      />
    </div>
  );
}

/**
 * Mount point. Renders nothing at all in desktop screen mode, so the floor
 * costs one store subscription while you are working. Office state arrives as
 * props: `OfficeLayer` owns the store subscription for both renderers.
 *
 * Everything below is forwarded to `OfficeFloorView` untouched.
 *
 * @param {{
 *   onMessage?: (colleagueId: string) => void,
 *   walkBy?: { id: string, colleagueId: string, body: string, actionPrompt?: string } | null,
 *   onAdoptPrompt?: (prompt: string, colleagueId: string) => void,
 *   onDismissWalkBy?: (id: string) => void,
 *   coffee?: any, battle?: any, sceneHandlers?: any,
 *   meeting?: any, meetingHandlers?: any
 * }} props
 */
export default function OfficeFloor(props) {
  const mode = useSyncExternalStore(subscribeViewMode, getOfficeViewMode, getOfficeViewMode);
  if (mode !== 'floor') return null;
  return <OfficeFloorView {...props} />;
}
