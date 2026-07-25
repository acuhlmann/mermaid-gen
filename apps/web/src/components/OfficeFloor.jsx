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
import FloorPeek, { FloorPeekCard } from './officeFloor/FloorPeek.jsx';
import FloorPersonCard from './officeFloor/FloorPersonCard.jsx';
import FloorScene from './officeFloor/FloorScene.jsx';
import FloorStage from './officeFloor/FloorStage.jsx';
import { useFloorWalker } from './officeFloor/useFloorWalker.js';
import { prefersReducedMotion } from './officeFloor/useWalkAnimation.js';
import { useStageScale } from '../hooks/useStageScale.js';
import { YOU_SEAT_ID, peekTileFor, projectIso, seatFor } from '../utils/officeFloorPlan.js';
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
 * Walking over to somebody's desk and back: 'walking' → 'looking' → 'returning'.
 *
 * View state, deliberately — a peek writes nothing to any store, produces no
 * artifact, and dies when you sit down (ADR-0010, and `FloorPeek`'s header).
 * The arrive handler is phase-driven rather than closure-driven because
 * `useWalkAnimation` keeps the callback it was mounted with.
 */
function usePeek(suspended) {
  const [peek, setPeek] = useState(null);

  // A meeting takes the room, and you with it — two of you on the floor at once
  // would give the game away.
  useEffect(() => {
    if (suspended) setPeek(null);
  }, [suspended]);

  const startPeek = useCallback((colleagueId) => {
    setPeek({ colleagueId, phase: 'walking' });
  }, []);

  const endPeek = useCallback(() => {
    setPeek((current) => (current ? { ...current, phase: 'returning' } : current));
  }, []);

  const handleArrive = useCallback(() => {
    setPeek((current) => {
      if (current?.phase === 'walking') return { ...current, phase: 'looking' };
      if (current?.phase === 'returning') return null;
      return current;
    });
  }, []);

  return { peek: suspended ? null : peek, startPeek, endPeek, handleArrive };
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
  const { peek, startPeek, endPeek, handleArrive } = usePeek(Boolean(meeting));

  // Escape sits you back down — unless a surface above the floor (Slop Chat, a
  // meeting) already handled it. Mid-peek it walks you home first: you are
  // standing at somebody else's desk, and your chair is over there.
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (peek) {
        endPeek();
        return;
      }
      sitDown();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [peek, endPeek]);

  const handleSelect = useCallback((id) => {
    setSelectedId((current) => (current === id ? null : id));
  }, []);

  const handlePeek = useCallback(
    (id) => {
      setSelectedId(null);
      startPeek(id);
    },
    [startPeek]
  );

  // Binding rule 3: on a narrow screen the room is wider than the viewport and
  // pans, so a walk can finish off-screen — you tap "their screen" and nothing
  // appears to happen. Bring wherever you are walking to into view.
  const walkingTo = peek ? (peek.phase === 'returning' ? YOU_SEAT_ID : peek.colleagueId) : null;
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !walkingTo || typeof viewport.scrollTo !== 'function') return;
    // Nothing to pan when the whole room already fits — which is the desktop
    // case, and the reason this is a mobile affordance rather than a camera.
    if (
      viewport.scrollWidth <= viewport.clientWidth &&
      viewport.scrollHeight <= viewport.clientHeight
    ) {
      return;
    }
    const mark = walkingTo === YOU_SEAT_ID ? seatFor(YOU_SEAT_ID) : peekTileFor(walkingTo);
    if (!mark) return;
    const stage = viewport.querySelector('.office-floor-stage');
    const { left, top } = projectIso(mark.x, mark.y);
    viewport.scrollTo({
      left: (stage?.offsetLeft ?? 0) + left * scale - viewport.clientWidth / 2,
      top: (stage?.offsetTop ?? 0) + top * scale - viewport.clientHeight / 2,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth'
    });
  }, [walkingTo, scale]);

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
          vacantIds={awayFromDeskIds({ coffee, battle, meeting, peek, playerId: YOU_SEAT_ID })}
          // Whoever you are looking at holds the floor, the same glow the
          // arrival ceremony and the glass room use.
          speakingId={peek?.phase === 'looking' ? peek.colleagueId : null}
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
          {peek ? <FloorPeek peek={peek} scale={scale} onArrive={handleArrive} /> : null}
        </FloorStage>
      </div>

      {/* One card slot, in order of how much of your body is committed: a
          meeting has you in a chair, a peek has you on your feet at somebody
          else's desk, a person card is idle curiosity. */}
      {meeting ? (
        <FloorMeetingCard
          meeting={meeting}
          copy={copy}
          onInterject={meetingHandlers.onInterject}
          onLeave={meetingHandlers.onLeave}
          onSitDown={() => sitDown()}
        />
      ) : peek ? (
        <FloorPeekCard peek={peek} copy={copy} onBack={endPeek} />
      ) : person ? (
        <FloorPersonCard
          person={person}
          copy={copy}
          canMessage={person.canMessage}
          canPeek={person.canPeek}
          onMessage={onMessage}
          onPeek={handlePeek}
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
