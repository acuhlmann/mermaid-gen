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

import FloorCommuters from './FloorCommuters.jsx';
import FloorDeskSpeech from './FloorDeskSpeech.jsx';
import FloorHuddle from './FloorHuddle.jsx';
import FloorMeeting from './FloorMeeting.jsx';
import FloorPeek from './FloorPeek.jsx';
import FloorPlayer from './FloorPlayer.jsx';
import FloorScenes from './FloorScenes.jsx';
import FloorTalk from './FloorTalk.jsx';
import FloorWanderer from './FloorWanderer.jsx';
import { YOU_SEAT_ID, isWithinNameChipRange } from '../../utils/officeFloorPlan.js';

/**
 * @param {{
 *   scale: number,
 *   copy: Record<string, any>,
 *   coffee?: any,
 *   battle?: any,
 *   sceneHandlers?: any,
 *   scenePacing?: { coffeeVisibleLines?: number, battleVisibleLines?: number, battleLinesDone?: boolean },
 *   meeting?: any,
 *   huddle?: any,
 *   huddleHandlers?: any,
 *   huddleRing?: any,
 *   wanderer?: any,
 *   wandererSaid?: { text: string, reaction: string } | null,
 *   onWandererArrive?: () => void,
 *   wandererRef?: { current: HTMLElement | null },
 *   commuters?: import('../../utils/officeFloorCommute.js').Commute[],
 *   settledIds?: Set<string> | null,
 *   walkingIds?: Set<string> | null,
 *   onCommuteArrive?: (id: string) => void,
 *   selectedId?: string | null,
 *   speakingId?: string | null,
 *   onSelect?: (id: string) => void,
 *   onActivate?: ((id: string) => void) | null,
 *   peek?: { colleagueId: string, phase: string } | null,
 *   talk?: { colleagueId: string, phase: string, at?: { x: number, y: number } | null } | null,
 *   talkLine?: string,
 *   dwellSaid?: { speakerId: string, text: string } | null,
 *   dwellAt?: { x: number, y: number } | null,
 *   shopTalkSaid?: { speakerId: string, text: string } | null,
 *   shopTalkAt?: { x: number, y: number } | null,
 *   presence?: any,
 *   onPresenceArrive?: () => void,
 *   playerRef?: { current: HTMLElement | null },
 *   youActivity?: { pose?: string, hold?: string | null, headwear?: string | null } | null,
 *   youTile?: { x: number, y: number } | null,
 *   showSpokenText?: boolean
 * }} props `selectedId` / `speakingId` / `onSelect` are the stage's own names for
 *   the same three things, because since slice 12 a figure on the stage can be
 *   selected whether it is in a chair or stood at the printer, and it should not
 *   matter to the caller which one it is talking to. Otherwise destructured
 *   without defaults on purpose: every optional field here
 *   defaults it itself (`FloorScenes` already defaults all three of its own), so
 *   `= null` would buy nothing but a branch each — and thirteen of them is how
 *   this component was born over its complexity budget.
 *
 *   `youTile` is the one exception that takes an inline computation rather than
 *   a prop default: the settled wanderer's chip lights up within a tile of it
 *   (slice 15), and the wanderer is the one actor `FloorStage`'s seat loop does
 *   not cover, so the proximity has to be asked here about their standing tile.
 */
export function FloorActors({
  scale,
  copy,
  coffee,
  battle,
  sceneHandlers,
  scenePacing,
  meeting,
  huddle,
  huddleHandlers,
  huddleRing,
  wanderer,
  wandererSaid,
  // No default: `floorActivityFor` treats it as absent-or-not on its own.
  dayPhase,
  onWandererArrive,
  wandererRef,
  commuters,
  settledIds,
  walkingIds,
  onCommuteArrive,
  selectedId,
  speakingId,
  onSelect,
  onActivate,
  peek,
  talk,
  talkLine,
  dwellSaid,
  dwellAt,
  shopTalkSaid,
  shopTalkAt,
  presence,
  onPresenceArrive,
  onStep,
  playerRef,
  youActivity,
  youTile,
  showSpokenText = true
}) {
  return (
    <>
      <FloorScenes
        coffee={coffee}
        battle={battle}
        scale={scale}
        sceneHandlers={sceneHandlers}
        scenePacing={scenePacing}
        showSpokenText={showSpokenText}
        settledIds={settledIds}
      />

      {/* Slice 17: on their way to a moment, or on their way back from one.
          Placed with the other ambient traffic and for the same reason — a
          commuter is somebody crossing the room, and the *event* they are
          walking to or from is narrated by whichever surface owns it. */}
      {commuters?.length ? (
        <FloorCommuters commuters={commuters} onArrive={onCommuteArrive} onStep={onStep} />
      ) : null}

      {/* Somebody who has got up for a minute. Still deliberately absent from
          `floorAnnouncement`: ambient traffic is the one class of event on this
          floor with nothing to say, and a live region that reads out every trip
          to the printer is a live region people turn off — and then it is not
          there for the walk-by that mattered. Slice 12 made them *selectable*,
          which is not the same as newsworthy: what they are is on the button.

          Slice 18 does not reopen that either, and the distinction is the same
          one: `wandererSaid` is speech, and speech has always lived in the
          balloon rather than in the region (`floor.narration` is spatial only,
          or every line on this floor is read out twice). */}
      {wanderer ? (
        <FloorWanderer
          wanderer={wanderer}
          copy={copy}
          // Slice 20: ambient traffic is standing population, so the hour
          // applies. A commuter walking to a moment is not, and gets none.
          dayPhase={dayPhase}
          /* Slice 18: the one line an ambient trip is allowed, and only when
             you are the reason it ended early. Gated here rather than passed
             through as `hideBody` like its neighbours, because a wanderer's
             balloon carries no chrome — no Do-it, no dismiss — so there is
             nothing left to render once the voice has taken the body. */
          said={showSpokenText ? wandererSaid : null}
          scale={scale}
          onArrive={onWandererArrive}
          elementRef={wandererRef}
          selected={selectedId === wanderer.seatId}
          speaking={speakingId === wanderer.seatId}
          // Slice 15: a colleague stood near you shows their name even mid-
          // errand — `to` is where they settle, which is where the button is.
          nearby={isWithinNameChipRange(youTile, wanderer.to)}
          onSelect={onSelect}
          onActivate={onActivate}
          onStep={onStep}
        />
      ) : null}

      {meeting ? (
        <FloorMeeting
          meeting={meeting}
          copy={copy}
          scale={scale}
          showSpokenText={showSpokenText}
          walkingIds={walkingIds}
        />
      ) : null}
      {huddle ? (
        <FloorHuddle
          huddle={huddle}
          scale={scale}
          showSpokenText={showSpokenText}
          ringControls={huddleRing ?? undefined}
          settledIds={settledIds}
          onHardStop={huddleHandlers?.onHardStop}
          onAdoptPrompt={huddleHandlers?.onAdoptPrompt}
          onRequestSuggestion={huddleHandlers?.onRequestSuggestion}
          narrateLine={huddleHandlers?.narrateLine}
          prefetchLine={huddleHandlers?.prefetchLine}
          onCancelNarration={huddleHandlers?.onCancelNarration}
        />
      ) : null}
      {peek ? <FloorPeek peek={peek} scale={scale} hideBody={!showSpokenText} /> : null}
      {talk ? (
        <FloorTalk talk={talk} line={talkLine} scale={scale} hideBody={!showSpokenText} />
      ) : null}

      {/* Slice 19: somebody looking up because you have been stood there a
          while. A bare `FloorDeskSpeech` rather than a wrapper of its own,
          because unlike peek and talk this beat has no card and no verbs — you
          did not go there to do anything, which is the entire premise. `dwellAt`
          is `null` for the common case of somebody in their own chair, which is
          what earns them the over-seat lift (§ 6 rules 15 and 20).
          Already gated on captions by the caller: there is no chrome to keep. */}
      {dwellSaid ? (
        <FloorDeskSpeech
          castId={dwellSaid.speakerId}
          line={dwellSaid.text}
          tile={dwellAt}
          scale={scale}
          testId="office-floor-dwell-line"
        />
      ) : null}

      {/* Slice 22: half of a conversation between two other people. The same
          bare `FloorDeskSpeech` as dwell above, and deliberately *one* of them
          rather than a pair — `useFloorShopTalk` hands over whichever line is
          currently in the air, so the element that draws the wanderer's opener
          at the prop is the element that draws the reply over the chair a tile
          away. Two at once would be two balloons in one square of screen. */}
      {shopTalkSaid ? (
        <FloorDeskSpeech
          castId={shopTalkSaid.speakerId}
          line={shopTalkSaid.text}
          tile={shopTalkAt}
          scale={scale}
          testId="office-floor-shop-talk-line"
        />
      ) : null}

      {/* One of you on the floor, whatever your reason for being up. */}
      {presence ? (
        <FloorPlayer
          from={presence.from}
          to={presence.to}
          walking
          walkKey={`roam:${presence.key}`}
          onArrive={onPresenceArrive}
          onStep={onStep}
          elementRef={playerRef}
          activity={youActivity}
          /* You get the same indicator as everyone else — otherwise "who is
             talking" quietly means "who else is talking", and the one turn in
             a conversation that never lights up is your own. */
          speaking={speakingId === YOU_SEAT_ID}
          testId={peek ? 'office-floor-peek-player' : 'office-floor-player'}
        />
      ) : null}
    </>
  );
}

export default FloorActors;
