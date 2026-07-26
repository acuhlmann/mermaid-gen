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
import FloorTalk from './officeFloor/FloorTalk.jsx';
import FloorTopBar from './officeFloor/FloorTopBar.jsx';
import { useFloorActivity } from './officeFloor/useFloorActivity.js';
import { useFloorAutoPan } from './officeFloor/useFloorAutoPan.js';
import { useFloorKeyboard } from './officeFloor/useFloorKeyboard.js';
import { useFloorWalker } from './officeFloor/useFloorWalker.js';
import { useStageScale } from '../hooks/useStageScale.js';
import { approachTileFor } from '../utils/officeFloorMovement.js';
import { YOU_SEAT_ID, peekTileFor } from '../utils/officeFloorPlan.js';
import { isOfficeColleagueId, officeChromeCopy, officeSenderInfo } from '../utils/officeCast.js';
import { awayFromDeskIds } from '../utils/officeSceneCast.js';
import { tierOf } from '../utils/castTiers.js';
import { resolveUserName, subscribe as subscribeUserName } from '../state/userIdentityStore.js';
import { getOfficeViewMode, subscribe as subscribeViewMode } from '../state/officeViewModeStore.js';
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
      canPeek: peekTileFor(selectedId) !== null,
      // Two independent gates, and they agree by accident rather than by
      // construction: the tier decides whether there is anything to say,
      // the room decides whether you can get close enough to say it.
      canTalk:
        tier === 'office' && isOfficeColleagueId(selectedId) && approachTileFor(selectedId) !== null
    };
  }, [selectedId, userName, copy]);
}

/**
 * A peek, as the person card and the speech bubble still want to see it. Since
 * slice 7 it is one flavour of *being somewhere* rather than its own state
 * machine: 'looking' is simply having arrived somewhere you went on purpose.
 */
/**
 * @param {{
 *   onMessage?: (colleagueId: string) => void,
 *   walkBy?: { id: string, colleagueId: string, body: string, actionPrompt?: string } | null,
 *   onAdoptPrompt?: (prompt: string, colleagueId: string) => void,
 *   onDismissWalkBy?: (id: string) => void,
 *   imHistory?: Array<{ colleagueId: string, body: string, outbound?: boolean }>,
 *   onTalkGreet?: (colleagueId: string) => Promise<void> | void,
 *   onTalkReply?: (colleagueId: string, body: string) => Promise<void> | void,
 *   onTalkingChange?: (colleagueId: string | null) => void,
 *   onGetCoffee?: () => Promise<boolean> | boolean,
 *   coffee?: any, battle?: any, sceneHandlers?: any,
 *   meeting?: any, meetingHandlers?: any
 * }} props
 */
function OfficeFloorView({
  onMessage,
  walkBy,
  onAdoptPrompt,
  onDismissWalkBy,
  imHistory = [],
  onTalkGreet,
  onTalkReply,
  onTalkingChange,
  onGetCoffee,
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
  const handleClosePerson = useCallback(() => setSelectedId(null), []);

  const activity = useFloorActivity({
    suspended: Boolean(meeting),
    imHistory,
    onTalkGreet,
    onTalkReply,
    onTalkingChange,
    onGetCoffee,
    onEngage: handleClosePerson
  });
  const { presence, peek, talk, conversation, prop, propUse, origin, goHome } = activity;

  useFloorKeyboard({ presence, origin, goHome, walkTo: activity.walkTo });
  useFloorAutoPan(viewportRef, presence, scale);

  const handleSelect = useCallback((id) => {
    setSelectedId((current) => (current === id ? null : id));
  }, []);

  return (
    <div className="office-floor" data-testid="office-floor">
      {/* The peek and talk cards each carry their own way back, so the bar's
          copy of it would be a second button with the same label. */}
      <FloorTopBar copy={copy} standing={activity.standingFree} onGoHome={goHome} />

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
          onWalkTo={meeting ? null : activity.walkTo}
          roamOrigin={origin}
          // Same reason as the roam surface: a meeting has you in a chair, and
          // the coffee machine is not yours to press from it.
          onUseProp={meeting ? null : activity.startUseProp}
          activePropKind={activity.activePropKind}
          vacantIds={awayFromDeskIds({
            coffee,
            battle,
            meeting,
            standing: presence,
            playerId: YOU_SEAT_ID
          })}
          speakingId={activity.speakingId}
        >
          <FloorScenes
            coffee={coffee}
            battle={battle}
            scale={scale}
            sceneHandlers={sceneHandlers}
          />
          {meeting ? <FloorMeeting meeting={meeting} copy={copy} scale={scale} /> : null}
          {peek ? <FloorPeek peek={peek} scale={scale} /> : null}
          {talk ? <FloorTalk talk={talk} line={activity.talkLine} scale={scale} /> : null}
          {/* One of you on the floor, whatever your reason for being up. */}
          {presence ? (
            <FloorPlayer
              from={presence.from}
              to={presence.to}
              walking
              walkKey={`roam:${presence.key}`}
              onArrive={activity.handleArrive}
              elementRef={activity.playerRef}
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
        talk={talk}
        conversation={conversation}
        prop={prop}
        propUse={propUse}
        person={person}
        onGoHome={goHome}
        onMessage={onMessage}
        onPeek={activity.startPeek}
        onTalk={activity.startTalk}
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
 *   onGetCoffee?: () => Promise<boolean> | boolean,
 *   coffee?: any, battle?: any, sceneHandlers?: any,
 *   meeting?: any, meetingHandlers?: any
 * }} props
 */
export default function OfficeFloor(props) {
  const mode = useSyncExternalStore(subscribeViewMode, getOfficeViewMode, getOfficeViewMode);
  if (mode !== 'floor') return null;
  return <OfficeFloorView {...props} />;
}
