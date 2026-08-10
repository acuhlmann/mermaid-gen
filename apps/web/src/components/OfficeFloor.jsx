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

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import FloorActors from './officeFloor/FloorActors.jsx';
import FloorCardSlot from './officeFloor/FloorCardSlot.jsx';
import FloorLiveRegion from './officeFloor/FloorLiveRegion.jsx';
import FloorStage from './officeFloor/FloorStage.jsx';
import FloorTopBar from './officeFloor/FloorTopBar.jsx';
import { floorAnnouncement } from './officeFloor/floorAnnouncement.js';
import {
  autoPanPresenceFor,
  cameraFocusFor,
  isPhysicalFloorMeeting
} from './officeFloor/floorCamera.js';
import { createOfficeFloorBridge } from './officeFloor/officeFloorBridge.js';
import { useFloorActivity } from './officeFloor/useFloorActivity.js';
import { useFloorCamera } from './officeFloor/useFloorCamera.js';
import { useFloorSpokenText } from './officeFloor/useFloorSpokenText.js';
import { useFloorAway } from './officeFloor/useFloorAway.js';
import { useFloorAutoPan } from './officeFloor/useFloorAutoPan.js';
import { useFloorCoffeeWalk } from './officeFloor/useFloorCoffeeWalk.js';
import { useFloorKeyboard } from './officeFloor/useFloorKeyboard.js';
import { useFloorWalker } from './officeFloor/useFloorWalker.js';
import { MEETING_USER_SPEAKER } from '../hooks/useMeetingPlayback.js';
import { useStageScale } from '../hooks/useStageScale.js';
import { reachTileFor, whereaboutsOf } from '../utils/officeFloorReach.js';
import { interruptSpeech } from '../utils/officeFloorInterrupt.js';
import { useFloorDwell } from './officeFloor/useFloorDwell.js';
import { useOfficeDayPhase } from './officeFloor/useOfficeDayPhase.js';
import {
  MEETING_PLAYER_TILE,
  YOU_SEAT_ID,
  floorSurfaceAt,
  floorZoneToneAt,
  peekTileFor,
  seatFor,
  stereoPanForTile
} from '../utils/officeFloorPlan.js';
import { setRoomToneZone } from '../utils/officeRoomTone.js';
import {
  MEETING_MODALITY_REMOTE,
  officeChromeCopy,
  officeSenderInfo
} from '../utils/officeCast.js';
import { deskWorkFor } from '../utils/officeDeskWork.js';
import { floorActivityFor } from '../utils/officeFloorActivity.js';
import { tierOf } from '../utils/castTiers.js';
import { resolveUserName, subscribe as subscribeUserName } from '../state/userIdentityStore.js';
import { getOfficeViewMode, subscribe as subscribeViewMode } from '../state/officeViewModeStore.js';
import { useFloorViewPhase } from './officeFloor/viewTransition.js';
import {
  getOfficeSnapshot,
  setOfficeCaptions,
  subscribe as subscribeOffice
} from '../state/officeMomentStore.js';
import { useUiCopy } from '../i18n/useUiLocale.js';
import { formatLocale } from '../i18n/formatLocale.js';

/**
 * Where they are, in a sentence — empty when they are sitting where the floor
 * plan says they sit, which is the answer almost every time.
 */
function awayNoteFor(away, copy) {
  if (!away) return '';
  if (!away.tile || !away.propKind) return copy.away.elsewhere;
  const prop = copy.props.items[away.propKind]?.name ?? away.propKind;
  return formatLocale(copy.away.atProp, { prop });
}

/**
 * Where you may stand to talk — everyone on the floor except leadership
 * (senior tier). Double-click activate and the person card both ask this so
 * the verb offered is the walk that runs.
 */
function talkTileFor(colleagueId, away) {
  if (!colleagueId || colleagueId === YOU_SEAT_ID) return null;
  const tier = tierOf(colleagueId);
  if (!tier || tier === 'senior') return null;
  return reachTileFor(colleagueId, away);
}

/**
 * The talk view with **where they are** attached, so the speech bubble lands over
 * their head rather than over the chair they left (§ 6 rule 20 generalized).
 *
 * A function rather than three lines inline because it is the same projection
 * `usePersonDetails` makes and the two must agree — and because the view
 * component has a complexity budget it came off § 8's list to earn.
 *
 * @param {{ colleagueId: string, phase: string } | null} talk
 * @param {{ wanderer: unknown, awayIds: string[] }} floorState
 */
function talkView(talk, floorState) {
  if (!talk) return null;
  const where = whereaboutsOf(talk.colleagueId, floorState);
  return where?.tile ? { ...talk, at: where.tile } : talk;
}

/**
 * Everything the person card needs about whoever is selected — including
 * whether Slop Chat™ is on offer, which only the office tier gets. `'you'` is
 * in no cast bank, so the player's row comes from the floor copy + name badge.
 *
 * The two walking verbs return their **mark**, not a boolean: since slice 12 the
 * answer depends on where the person is standing, and a verb that is offered on
 * one derivation and executed on another can aim at a chair its occupant has
 * left. `canPeek` / `canTalk` are that mark existing, and pressing the button
 * walks to the same tile that licensed it.
 */
function usePersonDetails(selectedId, copy, away) {
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
    // Pure geometry: there has to be somewhere to stand that is not inside
    // the furniture, behind glass, or in front of the screen you came to read
    // — and somebody to stand behind. You cannot look over an absent shoulder,
    // so a peek is the one verb being away takes off the card outright.
    const peekTile = away ? null : peekTileFor(selectedId);
    const talkTile = talkTileFor(selectedId, away);
    return {
      id: selectedId,
      name: sender?.name ?? selectedId,
      title: sender?.title ?? '',
      blurb: sender?.blurb ?? '',
      tier,
      // On the floor you talk in person — Slop Chat™ is the screen-side path.
      canMessage: false,
      peekTile,
      canPeek: peekTile !== null,
      talkTile,
      canTalk: talkTile !== null,
      awayNote: awayNoteFor(away, copy)
    };
  }, [selectedId, userName, copy, away]);
}

/**
 * What *you* are visibly doing — the one figure on this floor whose activity is
 * not a trait row (`officeFloorActivity.js`).
 *
 * Headphones is the Admin menu's posture reaching the room. `officeSnap`
 * already carries it because the floor subscribes to the same store the menu
 * writes, so this is renderer #2 rendering existing state rather than a second
 * copy of a preference (ADR-0011 rule 1). Read `headphones` here and **not**
 * `narration`/`soundscape`: the three are one macro's outputs, and a figure
 * drawn from them would take its headphones off the first time a per-scene CC
 * button touched one.
 *
 * The coffee is the set piece rather than the machine: `getCoffee` pours a
 * break and `useFloorCoffeeWalk` sends you to it, so `accepted` is the moment
 * you are holding a cup, whichever of the two paths poured it.
 */
function youActivityFor(remoteMeeting, headphones, coffee, presence, dayPhase) {
  return floorActivityFor(YOU_SEAT_ID, {
    onCall: remoteMeeting,
    headphones,
    coffee: Boolean(coffee?.accepted),
    moving: Boolean(presence && presence.phase !== 'standing'),
    dayPhase
  });
}

/**
 * A peek, as the person card and the speech bubble still want to see it. Since
 * slice 7 it is one flavour of *being somewhere* rather than its own state
 * machine: 'looking' is simply having arrived somewhere you went on purpose.
 */
/**
 * @param {{
 *   bridge: import('./officeFloor/officeFloorBridge.js').OfficeFloorBridge,
 *   viewPhase: 'stand-up' | 'sit-down'
 * }} props `viewPhase` lands on `data-view-phase` and drives the transition
 *   choreography in OfficeFloor.css — the room's camera rise and sink.
 */
function OfficeFloorView({ bridge, viewPhase }) {
  const {
    imHistory = [],
    walkBy,
    onMessage,
    onTalkGreet,
    onTalkReply,
    onDwellRemark,
    onTalkingChange,
    onGetCoffee,
    onPropCue,
    onFloorCue,
    onAdoptPrompt,
    onDismissWalkBy,
    coffee = null,
    battle = null,
    sceneHandlers = {},
    meeting = null,
    meetingHandlers = {},
    huddle = null,
    huddleHandlers = {},
    huddleRing = null,
    scenePacing = {},
    board = null
  } = bridge;
  // Subscribes this component to locale changes; the copy itself comes from the
  // office bundle below, exactly like the desk comms cluster.
  useUiCopy();
  const copy = officeChromeCopy().floor;
  const directory = officeChromeCopy().directory;
  const officeSnap = useSyncExternalStore(subscribeOffice, getOfficeSnapshot, getOfficeSnapshot);

  const viewportRef = useRef(null);
  const fitScale = useStageScale(viewportRef);
  const [selectedId, setSelectedId] = useState(null);
  const { walker, departing, handleDeparted } = useFloorWalker(walkBy);
  const handleClosePerson = useCallback(() => setSelectedId(null), []);

  const physicalMeeting = isPhysicalFloorMeeting(meeting);
  const remoteMeeting = Boolean(meeting && meeting.modality === MEETING_MODALITY_REMOTE);

  const activity = useFloorActivity({
    // Physical syncs claim the floor (you're in a chair in the glass room).
    // Remote headset syncs leave desks occupied — free roam stays available so
    // you can stand up and see everyone on the call.
    suspended: physicalMeeting,
    imHistory,
    onTalkGreet,
    onTalkReply,
    onTalkingChange,
    onGetCoffee,
    onPropCue,
    onFloorCue,
    onEngage: handleClosePerson
  });
  const { presence, peek, conversation, prop, propUse, origin, goHome, startTalk } = activity;

  /*
   * Slice 15: where you are, for the name-chip proximity reveal. In a
   * physical sync that is a chair in the glass room — the desk `origin`
   * falls back to is the one you left. Everywhere else it is the tile you
   * are on (or walking to), which `useFloorActivity.origin` already is.
   */
  const youTile = physicalMeeting ? MEETING_PLAYER_TILE : origin;

  /*
   * The directed camera (slice 14): frame whatever moment is on — meeting,
   * huddle, set piece, or your own walk-with-reason — and ease back to the
   * wide view when it clears. A pure projection of state already held here,
   * so it can never disagree with what the stage draws.
   */
  const focus = cameraFocusFor({ meeting, huddle, coffee, battle, presence });
  const scale = useFloorCamera(viewportRef, focus, fitScale);

  /*
   * Slice 20: what time the office thinks it is. One value, two consumers that
   * never disagree because there is only one — the figures read it through
   * `floorActivityFor`, and the light reads it off `data-day-phase` in CSS.
   */
  const dayPhase = useOfficeDayPhase();

  useFloorKeyboard({ presence, origin, goHome, walkTo: activity.walkTo });
  /* While the camera is framing a moment it owns the pan; auto-pan remains
     the phone-overflow fallback for the camera-free walks. */
  useFloorAutoPan(viewportRef, autoPanPresenceFor(focus, presence), scale);
  useFloorCoffeeWalk({
    coffee,
    walkTo: activity.walkTo,
    suspended: physicalMeeting
  });

  // Per-room colouring of the single bed (docs/audio-assets.md) — no new files.
  useEffect(() => {
    const you = seatFor(YOU_SEAT_ID);
    const tile = origin ?? (you ? { x: you.x, y: you.y } : null);
    setRoomToneZone(floorZoneToneAt(tile));
    return () => setRoomToneZone('neutral');
  }, [origin]);

  /*
   * One footstep per walk leg (`useWalkAnimation`'s `onLeg`). The walkers stay
   * dumb — they report the tile they are heading for and whether it is you —
   * and both derivations happen here, from the layout module, so a step and a
   * speech bubble can never disagree about which side of the room somebody is
   * standing on (`stereoPanForTile` is `bubbleAlignForTile`'s sibling).
   *
   * Your own steps are `near`: centred and louder, because you are the one
   * listening. Everybody else's are placed where they are.
   */
  const handleStep = useCallback(
    (tile, isYou = false) => {
      onFloorCue?.('step', {
        near: isYou,
        surface: floorSurfaceAt(tile),
        pan: isYou ? 0 : stereoPanForTile(tile)
      });
    },
    [onFloorCue]
  );

  /* Everybody who is out of their chair, for any reason (`useFloorAway`) —
     including, since slice 17, whoever is still walking to or back from a
     moment. Their desk stays empty for the whole trip. */
  const {
    awayIds,
    wanderer,
    handleWanderArrive,
    wandererRef,
    commuters,
    settledIds,
    handleCommuteArrive,
    floorState
  } = useFloorAway({
    coffee,
    battle,
    meeting,
    huddle,
    standing: presence,
    // Where you are or are heading. One rule for two cases: walking over to use
    // a prop, and free-roaming onto the mark it is used from.
    avoidTile: origin,
    // Whoever you have engaged stays put: nobody wanders off out of a
    // conversation you crossed the room for, or out from under an open card.
    holdId: activity.talk?.colleagueId ?? selectedId
  });

  const onCallIds = useMemo(() => {
    if (!remoteMeeting || !meeting) return [];
    return [YOU_SEAT_ID, ...(meeting.attendees ?? [])];
  }, [remoteMeeting, meeting]);

  const meetingSpeakingId = useMemo(() => {
    if (!meeting || meeting.state !== 'playing') return null;
    const last = meeting.transcript?.[meeting.transcript.length - 1];
    if (!last?.speakerId) return null;
    return last.speakerId === MEETING_USER_SPEAKER ? YOU_SEAT_ID : last.speakerId;
  }, [meeting]);

  const stageSpeakingId = meetingSpeakingId ?? activity.speakingId;

  const youActivity = useMemo(
    () => youActivityFor(remoteMeeting, officeSnap.headphones, coffee, presence, dayPhase),
    [remoteMeeting, officeSnap.headphones, coffee, presence, dayPhase]
  );

  /*
   * Where somebody is, when it is not their own chair (slice 12). One question,
   * two consumers that must agree: the card decides which verbs to offer from it
   * and the stage puts their speech bubble where their mouth is.
   */
  /*
   * Slice 18: what somebody says on the way back from an errand you walked
   * into — `null` for every trip nobody interrupted, which is nearly all of
   * them. Derived once here for the same reason `whereaboutsOf` is: two
   * consumers that must agree. The narrator speaks it and the stage draws it,
   * and a second `interruptSpeech` call would roll a different line out of the
   * same bank.
   */
  const wandererSaid = useMemo(() => interruptSpeech(wanderer, copy), [wanderer, copy]);

  /*
   * Slice 19: who you are stood next to, and the line they eventually break the
   * silence with.
   *
   * Gated on `standingFree`, which is the honest definition of loitering — a
   * card open, a conversation running or a prop in your hands is a *reason* to
   * be there, and each of those surfaces already speaks for itself.
   *
   * Derived here rather than fed back into `useFloorAway`'s `holdId`, and that
   * is a real limitation rather than an oversight: the target needs
   * `floorState`, which `useFloorAway` returns, and `holdId` is one of that
   * hook's arguments — so holding somebody because you are loitering next to
   * them is a cycle. The consequence is small and legible: a colleague who is
   * only passing through may finish their errand and leave before the five
   * seconds are up, which you watch happen. Everybody at a desk — which is
   * almost everybody, almost always — is not going anywhere.
   */
  const dwell = useFloorDwell({
    youTile,
    floorState,
    active: activity.standingFree,
    imHistory,
    suspended: physicalMeeting,
    onRemark: onDwellRemark
  });

  const person = usePersonDetails(selectedId, copy, whereaboutsOf(selectedId, floorState));
  const talk = talkView(activity.talk, floorState);
  const talkingColleagueId = talk?.phase === 'talking' ? talk.colleagueId : null;
  const peekColleagueId = peek?.phase === 'looking' ? peek.colleagueId : null;
  const peekLine = peekColleagueId ? (deskWorkFor(peekColleagueId)?.line ?? '') : '';
  const hasActiveSpeech =
    Boolean(talkingColleagueId && activity.talkLine) ||
    Boolean(peekColleagueId && peekLine) ||
    Boolean(walker?.body && !departing) ||
    Boolean(wandererSaid) ||
    Boolean(dwell.said) ||
    Boolean(coffee?.accepted || battle?.accepted) ||
    Boolean(huddle?.phase === 'speaking' || huddle?.phase === 'watching');

  const liftedSceneSpeech = Boolean(
    officeSnap.narration && sceneHandlers?.narrateLine && (coffee?.accepted || battle?.accepted)
  );
  const liftedLineSpoken = Boolean(
    (coffee?.accepted && scenePacing?.coffeeLineSpoken) ||
    (battle?.accepted && scenePacing?.battleLineSpoken)
  );

  const { showSpokenText, sceneHandlersWithVoice } = useFloorSpokenText({
    captions: officeSnap.captions,
    sceneHandlers,
    talkColleagueId: talkingColleagueId,
    talkLine: activity.talkLine,
    peekColleagueId,
    walkBy: walker,
    wandererSaid,
    dwellSaid: dwell.said,
    hasActiveSpeech,
    liftedSceneSpeech,
    liftedLineSpoken
  });

  const handleSelect = useCallback((id) => {
    setSelectedId((current) => (current === id ? null : id));
  }, []);

  // Point-and-click: double-click walks over and opens the floor chat when the
  // room will let you; otherwise it just opens the person card (brush-off /
  // peek-only). Same mark derivation as the card's Go and talk button.
  const handleActivate = useCallback(
    (id) => {
      if (id === YOU_SEAT_ID || physicalMeeting) {
        setSelectedId(id);
        return;
      }
      const mark = talkTileFor(id, whereaboutsOf(id, floorState));
      if (mark) {
        startTalk(id, mark);
        return;
      }
      setSelectedId(id);
    },
    [startTalk, floorState, physicalMeeting]
  );

  // The room in one sentence, for whoever is not looking at it. Derived from
  // the state already on this component, so it can never disagree with what the
  // stage is drawing — the two-renderer rule, applied to a third renderer.
  const said = floorAnnouncement({
    copy,
    meeting,
    huddle,
    talk,
    peek,
    prop,
    presence,
    walkBy: walker,
    walkerDeparting: departing
  });

  return (
    <div
      className="office-floor"
      data-testid="office-floor"
      data-view-phase={viewPhase}
      data-day-phase={dayPhase}
    >
      {/* Mounted before it has anything to say, which is the only shape a live
          region reliably announces in — see `FloorLiveRegion`. */}
      <FloorLiveRegion message={said.text} eventKey={said.key} />

      {/* The peek and talk cards each carry their own way back, so the bar's
          copy of it would be a second button with the same label. */}
      <FloorTopBar
        copy={copy}
        standing={activity.standingFree}
        onGoHome={goHome}
        captions={officeSnap.captions}
        captionsLabel={directory.transcriptLabel}
        captionsOnLabel={directory.transcriptOnLabel}
        captionsTitle={directory.transcriptTitle}
        onToggleCaptions={() => setOfficeCaptions(!officeSnap.captions)}
      />

      <div className="office-floor-viewport" ref={viewportRef}>
        <FloorStage
          scale={scale}
          copy={copy}
          selectedId={selectedId}
          onSelect={handleSelect}
          onActivate={physicalMeeting ? null : handleActivate}
          walker={walker}
          walkerDeparting={departing}
          walkerHideBody={!showSpokenText}
          onWalkerAdopt={onAdoptPrompt}
          onWalkerDismiss={onDismissWalkBy}
          onWalkerDeparted={handleDeparted}
          onStep={handleStep}
          // A physical glass-room sync has you in a chair; the floor is not
          // yours to wander until you leave it. Remote headset syncs keep desks
          // occupied and still let you walk the floor.
          onWalkTo={physicalMeeting ? null : activity.walkTo}
          roamOrigin={origin}
          // Same reason as the roam surface: a glass-room chair is not a place
          // you press the coffee machine from.
          onUseProp={physicalMeeting ? null : activity.startUseProp}
          activePropKind={activity.activePropKind}
          vacantIds={awayIds}
          onCallIds={onCallIds}
          speakingId={stageSpeakingId}
          headphones={officeSnap.headphones}
          youHolding={youActivity.hold}
          // Slice 15: where you are (or are heading) — seats within a tile
          // of it light their name chip. In a glass-room sync that is the
          // chair in the room, not the desk you left.
          youTile={youTile}
          // Slice 16: what you are working on, for your own monitor, the
          // whiteboard and the glass room's table.
          board={board}
          // Slice 20: the hour, for the chairs. No default — `seatActivity`
          // reads it for truthiness, so `= null` would buy a branch and no
          // behaviour (the lever § 8 records for this file's budget).
          dayPhase={dayPhase}
        >
          <FloorActors
            scale={scale}
            copy={copy}
            // Slice 20: the ambient wanderer is standing population too, so the
            // hour reaches them. Anybody a *moment* is drawing is deliberately
            // left out — see `floorActivityFor`'s rung 5.
            dayPhase={dayPhase}
            coffee={coffee}
            battle={battle}
            sceneHandlers={sceneHandlersWithVoice}
            scenePacing={scenePacing}
            meeting={meeting}
            huddle={huddle}
            huddleHandlers={huddleHandlers}
            huddleRing={huddleRing}
            wanderer={wanderer}
            wandererSaid={wandererSaid}
            // Slice 19: somebody looking up because you have not moved on.
            dwellSaid={showSpokenText ? dwell.said : null}
            dwellAt={dwell.at}
            onWandererArrive={handleWanderArrive}
            wandererRef={wandererRef}
            // Slice 17: the walk to a moment and the walk back from it.
            commuters={commuters}
            settledIds={settledIds}
            onCommuteArrive={handleCommuteArrive}
            // A figure on the stage is selectable whether it is in a chair or
            // stood at the printer, so the wanderer takes the stage's own three.
            selectedId={selectedId}
            speakingId={stageSpeakingId}
            onSelect={handleSelect}
            onActivate={physicalMeeting ? null : handleActivate}
            peek={peek}
            talk={talk}
            talkLine={activity.talkLine}
            presence={presence}
            onPresenceArrive={activity.handleArrive}
            onStep={handleStep}
            playerRef={activity.playerRef}
            youActivity={youActivity}
            youTile={youTile}
            showSpokenText={showSpokenText}
          />
        </FloorStage>
      </div>

      <FloorCardSlot
        copy={copy}
        meeting={meeting}
        meetingHandlers={meetingHandlers}
        huddle={huddle}
        huddleHandlers={huddleHandlers}
        huddleRing={huddleRing}
        peek={peek}
        talk={talk}
        conversation={conversation}
        prop={prop}
        propUse={propUse}
        person={person}
        // The words for what the whiteboard is showing — 62 px of panel can
        // carry the shape of your diagram, not its labels (slice 16).
        board={board}
        onGoHome={goHome}
        onMessage={onMessage}
        // The mark that licensed the verb is the mark you walk to — see
        // `usePersonDetails`. `id` is always the selected person; only their own
        // card can press these, and a missing mark is a no-op at the other end.
        onPeek={(id) => activity.startPeek(id, person?.peekTile)}
        onTalk={(id) => activity.startTalk(id, person?.talkTile)}
        // The same handler the walker's bubble gets — one adopt path for the
        // whole floor, so a pitch runs your pipeline identically wherever it
        // was offered (ADR-0012).
        onAdoptPrompt={onAdoptPrompt}
        onClosePerson={handleClosePerson}
      />
    </div>
  );
}

/**
 * Mount point. Renders nothing at all in desktop screen mode, so the floor
 * costs one store subscription while you are working. Office state arrives via
 * `bridge` from `OfficeLayer`, which owns the store subscription for both
 * renderers.
 *
 * The one exception to "nothing in desk mode" is the sit-down beat:
 * `useFloorViewPhase` keeps the view mounted for the exit camera move after
 * the store has already flipped back to the desk (docs/office-isometric-mode.md
 * § 1a), so leaving the room is a transition too, not a cut.
 *
 * @param {{
 *   bridge?: import('./officeFloor/officeFloorBridge.js').OfficeFloorBridge,
 *   imHistory?: Array<{ colleagueId: string, body: string, outbound?: boolean }>,
 *   walkBy?: { id: string, colleagueId: string, body: string, actionPrompt?: string } | null,
 *   onMessage?: (colleagueId: string) => void,
 *   onTalkGreet?: (colleagueId: string) => Promise<void> | void,
 *   onTalkReply?: (colleagueId: string, body: string) => Promise<void> | void,
 *   onTalkingChange?: (colleagueId: string | null) => void,
 *   onGetCoffee?: () => Promise<boolean> | boolean,
 *   onPropCue?: (propKind: string) => void,
 *   onAdoptPrompt?: (prompt: string, colleagueId: string) => void,
 *   onDismissWalkBy?: (id: string) => void,
 *   coffee?: unknown,
 *   battle?: unknown,
 *   sceneHandlers?: Record<string, unknown>,
 *   meeting?: unknown,
 *   meetingHandlers?: Record<string, unknown>
 * }} props Legacy flat props are still accepted for tests; `bridge` wins when both are set.
 */
export default function OfficeFloor({ bridge: bridgeProp, ...legacy }) {
  const mode = useSyncExternalStore(subscribeViewMode, getOfficeViewMode, getOfficeViewMode);
  const viewPhase = useFloorViewPhase(mode);
  if (viewPhase === 'closed') return null;
  const bridge = bridgeProp ?? createOfficeFloorBridge(legacy);
  return <OfficeFloorView bridge={bridge} viewPhase={viewPhase} />;
}
