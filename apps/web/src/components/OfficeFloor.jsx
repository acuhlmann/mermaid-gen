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
import FloorActors from './officeFloor/FloorActors.jsx';
import FloorCardSlot from './officeFloor/FloorCardSlot.jsx';
import FloorLiveRegion from './officeFloor/FloorLiveRegion.jsx';
import FloorStage from './officeFloor/FloorStage.jsx';
import FloorTopBar from './officeFloor/FloorTopBar.jsx';
import { floorAnnouncement } from './officeFloor/floorAnnouncement.js';
import { createOfficeFloorBridge } from './officeFloor/officeFloorBridge.js';
import { useFloorActivity } from './officeFloor/useFloorActivity.js';
import { useFloorAway } from './officeFloor/useFloorAway.js';
import { useFloorAutoPan } from './officeFloor/useFloorAutoPan.js';
import { useFloorKeyboard } from './officeFloor/useFloorKeyboard.js';
import { useFloorWalker } from './officeFloor/useFloorWalker.js';
import { useStageScale } from '../hooks/useStageScale.js';
import { reachTileFor, whereaboutsOf } from '../utils/officeFloorReach.js';
import { YOU_SEAT_ID, peekTileFor } from '../utils/officeFloorPlan.js';
import { isOfficeColleagueId, officeChromeCopy, officeSenderInfo } from '../utils/officeCast.js';
import { shouldShowSpokenText } from '../utils/officeCaptions.js';
import { tierOf } from '../utils/castTiers.js';
import { resolveUserName, subscribe as subscribeUserName } from '../state/userIdentityStore.js';
import { getOfficeViewMode, subscribe as subscribeViewMode } from '../state/officeViewModeStore.js';
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
    // The tier decides whether there is anything to say; the room decides
    // whether you can get close enough to say it. Two independent gates, which
    // agree by accident rather than by construction.
    const social = tier === 'office' && isOfficeColleagueId(selectedId);
    // Pure geometry: there has to be somewhere to stand that is not inside
    // the furniture, behind glass, or in front of the screen you came to read
    // — and somebody to stand behind. You cannot look over an absent shoulder,
    // so a peek is the one verb being away takes off the card outright.
    const peekTile = away ? null : peekTileFor(selectedId);
    const talkTile = social ? reachTileFor(selectedId, away) : null;
    return {
      id: selectedId,
      name: sender?.name ?? selectedId,
      title: sender?.title ?? '',
      blurb: sender?.blurb ?? '',
      tier,
      // Slop Chat™ reaches them wherever they are: rule 2's labelled
      // conventional path outliving the diegetic one is the rule working.
      canMessage: social,
      peekTile,
      canPeek: peekTile !== null,
      talkTile,
      canTalk: talkTile !== null,
      awayNote: awayNoteFor(away, copy)
    };
  }, [selectedId, userName, copy, away]);
}

/**
 * A peek, as the person card and the speech bubble still want to see it. Since
 * slice 7 it is one flavour of *being somewhere* rather than its own state
 * machine: 'looking' is simply having arrived somewhere you went on purpose.
 */
/**
 * @param {{ bridge: import('./officeFloor/officeFloorBridge.js').OfficeFloorBridge }} props
 */
function OfficeFloorView({ bridge }) {
  const {
    imHistory = [],
    walkBy,
    onMessage,
    onTalkGreet,
    onTalkReply,
    onTalkingChange,
    onGetCoffee,
    onAdoptPrompt,
    onDismissWalkBy,
    coffee = null,
    battle = null,
    sceneHandlers = {},
    meeting = null,
    meetingHandlers = {}
  } = bridge;
  // Subscribes this component to locale changes; the copy itself comes from the
  // office bundle below, exactly like DeskActionsDock.
  useUiCopy();
  const copy = officeChromeCopy().floor;
  const directory = officeChromeCopy().directory;
  const officeSnap = useSyncExternalStore(subscribeOffice, getOfficeSnapshot, getOfficeSnapshot);
  const showSpokenText = shouldShowSpokenText({
    captions: officeSnap.captions,
    voiceActive: officeSnap.narration
  });

  const viewportRef = useRef(null);
  const scale = useStageScale(viewportRef);
  const [selectedId, setSelectedId] = useState(null);
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
  const { presence, peek, conversation, prop, propUse, origin, goHome } = activity;

  useFloorKeyboard({ presence, origin, goHome, walkTo: activity.walkTo });
  useFloorAutoPan(viewportRef, presence, scale);

  /* Everybody who is out of their chair, for either reason (`useFloorAway`). */
  const { awayIds, wanderer, handleWanderArrive, wandererRef, floorState } = useFloorAway({
    coffee,
    battle,
    meeting,
    standing: presence,
    // Where you are or are heading. One rule for two cases: walking over to use
    // a prop, and free-roaming onto the mark it is used from.
    avoidTile: origin,
    // Whoever you have engaged stays put: nobody wanders off out of a
    // conversation you crossed the room for, or out from under an open card.
    holdId: activity.talk?.colleagueId ?? selectedId
  });

  /*
   * Where somebody is, when it is not their own chair (slice 12). One question,
   * two consumers that must agree: the card decides which verbs to offer from it
   * and the stage puts their speech bubble where their mouth is.
   */
  const person = usePersonDetails(selectedId, copy, whereaboutsOf(selectedId, floorState));
  const talk = talkView(activity.talk, floorState);

  const handleSelect = useCallback((id) => {
    setSelectedId((current) => (current === id ? null : id));
  }, []);

  // The room in one sentence, for whoever is not looking at it. Derived from
  // the state already on this component, so it can never disagree with what the
  // stage is drawing — the two-renderer rule, applied to a third renderer.
  const said = floorAnnouncement({
    copy,
    meeting,
    talk,
    peek,
    prop,
    presence,
    walkBy: walker,
    walkerDeparting: departing
  });

  return (
    <div className="office-floor" data-testid="office-floor">
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
          walker={walker}
          walkerDeparting={departing}
          walkerHideBody={!showSpokenText}
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
          vacantIds={awayIds}
          speakingId={activity.speakingId}
        >
          <FloorActors
            scale={scale}
            copy={copy}
            coffee={coffee}
            battle={battle}
            sceneHandlers={sceneHandlers}
            meeting={meeting}
            wanderer={wanderer}
            onWandererArrive={handleWanderArrive}
            wandererRef={wandererRef}
            // A figure on the stage is selectable whether it is in a chair or
            // stood at the printer, so the wanderer takes the stage's own three.
            selectedId={selectedId}
            speakingId={activity.speakingId}
            onSelect={handleSelect}
            peek={peek}
            talk={talk}
            talkLine={activity.talkLine}
            presence={presence}
            onPresenceArrive={activity.handleArrive}
            playerRef={activity.playerRef}
            showSpokenText={showSpokenText}
          />
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
        // The mark that licensed the verb is the mark you walk to — see
        // `usePersonDetails`. `id` is always the selected person; only their own
        // card can press these, and a missing mark is a no-op at the other end.
        onPeek={(id) => activity.startPeek(id, person?.peekTile)}
        onTalk={(id) => activity.startTalk(id, person?.talkTile)}
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
 * @param {{
 *   bridge?: import('./officeFloor/officeFloorBridge.js').OfficeFloorBridge,
 *   imHistory?: Array<{ colleagueId: string, body: string, outbound?: boolean }>,
 *   walkBy?: { id: string, colleagueId: string, body: string, actionPrompt?: string } | null,
 *   onMessage?: (colleagueId: string) => void,
 *   onTalkGreet?: (colleagueId: string) => Promise<void> | void,
 *   onTalkReply?: (colleagueId: string, body: string) => Promise<void> | void,
 *   onTalkingChange?: (colleagueId: string | null) => void,
 *   onGetCoffee?: () => Promise<boolean> | boolean,
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
  if (mode !== 'floor') return null;
  const bridge = bridgeProp ?? createOfficeFloorBridge(legacy);
  return <OfficeFloorView bridge={bridge} />;
}
