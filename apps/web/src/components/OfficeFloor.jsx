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
 * siblings under ./officeFloor. This file owns the view: scale, chrome, and
 * which person is selected.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import FloorMeeting, { FloorMeetingCard } from './officeFloor/FloorMeeting.jsx';
import FloorPersonCard from './officeFloor/FloorPersonCard.jsx';
import FloorScene from './officeFloor/FloorScene.jsx';
import FloorStage from './officeFloor/FloorStage.jsx';
import { useFloorWalker } from './officeFloor/useFloorWalker.js';
import { useStageScale } from '../hooks/useStageScale.js';
import { YOU_SEAT_ID } from '../utils/officeFloorPlan.js';
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
      canMessage: tier === 'office' && isOfficeColleagueId(selectedId)
    };
  }, [selectedId, userName, copy]);
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

  // Escape sits you back down — unless a surface above the floor (Slop Chat, a
  // meeting) already handled it.
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      sitDown();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleSelect = useCallback((id) => {
    setSelectedId((current) => (current === id ? null : id));
  }, []);

  return (
    <div className="office-floor" data-testid="office-floor">
      <header className="office-floor-bar">
        <div className="office-floor-bar-copy">
          <span className="office-floor-eyebrow">{copy.eyebrow}</span>
          <h2 className="office-floor-title">{copy.title}</h2>
          <p className="office-floor-subtitle">{copy.subtitle}</p>
        </div>
        <button
          type="button"
          className="office-floor-sit"
          onClick={() => sitDown()}
          title={copy.backTitle}
        >
          {copy.back}
        </button>
      </header>

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
          vacantIds={awayFromDeskIds({ coffee, battle, meeting, playerId: YOU_SEAT_ID })}
        >
          {coffee ? (
            <FloorScene
              kind="coffee"
              scene={coffee}
              scale={scale}
              narrateLine={sceneHandlers.narrateLine}
              prefetchLine={sceneHandlers.prefetchLine}
              onAccept={sceneHandlers.onAcceptCoffee}
              onDecline={sceneHandlers.onDeclineCoffee}
              onDone={sceneHandlers.onCoffeeDone}
            />
          ) : null}
          {battle ? (
            <FloorScene
              kind="battle"
              scene={battle}
              scale={scale}
              narrateLine={sceneHandlers.narrateLine}
              prefetchLine={sceneHandlers.prefetchLine}
              onAccept={sceneHandlers.onAcceptBattle}
              onDecline={sceneHandlers.onDeclineBattle}
              onVote={sceneHandlers.onVoteBattle}
              onDone={sceneHandlers.onBattleDone}
            />
          ) : null}
          {meeting ? <FloorMeeting meeting={meeting} copy={copy} scale={scale} /> : null}
        </FloorStage>
      </div>

      {/* One card slot, and a meeting outranks idle curiosity: you are in it. */}
      {meeting ? (
        <FloorMeetingCard
          meeting={meeting}
          copy={copy}
          onInterject={meetingHandlers.onInterject}
          onLeave={meetingHandlers.onLeave}
          onSitDown={() => sitDown()}
        />
      ) : person ? (
        <FloorPersonCard
          person={person}
          copy={copy}
          canMessage={person.canMessage}
          onMessage={onMessage}
          onSitDown={() => sitDown()}
          onClose={() => setSelectedId(null)}
        />
      ) : (
        <p className="office-floor-hint">{copy.hint}</p>
      )}
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
