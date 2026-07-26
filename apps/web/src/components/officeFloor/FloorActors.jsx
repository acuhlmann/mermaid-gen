/**
 * Everybody who is on the stage rather than at a desk.
 *
 * `FloorStage` puts the *room* on the stage — the seats, the props, the walk-by
 * — and takes arbitrary `children` as extra actors. This is that list of extra
 * actors, which had grown to six conditionals inline in the view component and
 * pushed it past its complexity budget the moment slice 11 added a seventh.
 *
 * The ordering is not arbitrary and is worth preserving: scenes first (a set
 * piece is furniture-scale and everything else should paint over it), then
 * ambient traffic, then the surfaces you are personally involved in, then you.
 * Depth ordering does the real work inside the stage — these are all
 * `depthOf`-positioned — so this order only decides ties.
 *
 * Every entry is `x ? <X /> : null` and nothing else. If a branch here ever
 * needs to know about another branch, it belongs in `useFloorActivity` with the
 * rest of "what are you doing", not here.
 */

import FloorMeeting from './FloorMeeting.jsx';
import FloorPeek from './FloorPeek.jsx';
import FloorPlayer from './FloorPlayer.jsx';
import FloorScenes from './FloorScenes.jsx';
import FloorTalk from './FloorTalk.jsx';
import FloorWanderer from './FloorWanderer.jsx';

/**
 * @param {{
 *   scale: number,
 *   copy: Record<string, any>,
 *   coffee?: any,
 *   battle?: any,
 *   sceneHandlers?: any,
 *   meeting?: any,
 *   wanderer?: any,
 *   onWandererArrive?: () => void,
 *   wandererRef?: { current: HTMLElement | null },
 *   peek?: { colleagueId: string, phase: string } | null,
 *   talk?: { colleagueId: string, phase: string } | null,
 *   talkLine?: string,
 *   presence?: any,
 *   onPresenceArrive?: () => void,
 *   playerRef?: { current: HTMLElement | null }
 * }} props Destructured without defaults on purpose. Every optional field here
 *   is either truthiness-tested a line later or forwarded to a component that
 *   defaults it itself (`FloorScenes` already defaults all three of its own), so
 *   `= null` would buy nothing but a branch each — and thirteen of them is how
 *   this component was born over its complexity budget.
 */
export function FloorActors({
  scale,
  copy,
  coffee,
  battle,
  sceneHandlers,
  meeting,
  wanderer,
  onWandererArrive,
  wandererRef,
  peek,
  talk,
  talkLine,
  presence,
  onPresenceArrive,
  playerRef
}) {
  return (
    <>
      <FloorScenes coffee={coffee} battle={battle} scale={scale} sceneHandlers={sceneHandlers} />

      {/* Somebody who has got up for a minute. Deliberately absent from
          `floorAnnouncement`: ambient traffic is the one class of event on this
          floor with nothing to say, and a live region that reads out every trip
          to the printer is a live region people turn off — and then it is not
          there for the walk-by that mattered. */}
      {wanderer ? (
        <FloorWanderer wanderer={wanderer} onArrive={onWandererArrive} elementRef={wandererRef} />
      ) : null}

      {meeting ? <FloorMeeting meeting={meeting} copy={copy} scale={scale} /> : null}
      {peek ? <FloorPeek peek={peek} scale={scale} /> : null}
      {talk ? <FloorTalk talk={talk} line={talkLine} scale={scale} /> : null}

      {/* One of you on the floor, whatever your reason for being up. */}
      {presence ? (
        <FloorPlayer
          from={presence.from}
          to={presence.to}
          walking
          walkKey={`roam:${presence.key}`}
          onArrive={onPresenceArrive}
          elementRef={playerRef}
          testId={peek ? 'office-floor-peek-player' : 'office-floor-player'}
        />
      ) : null}
    </>
  );
}

export default FloorActors;
