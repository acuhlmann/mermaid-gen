import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore
} from 'react';
import { createPortal } from 'react-dom';
import CallMeetingPicker from './CallMeetingPicker.jsx';
import CoffeeBreakOverlay from './CoffeeBreakOverlay.jsx';
import DeskActionsDock from './DeskActionsDock.jsx';
import HuddleOverlay from './HuddleOverlay.jsx';
import MeetingInviteToast from './MeetingInviteToast.jsx';
import MeetingOverlay from './MeetingOverlay.jsx';
import OfficeBattleOverlay from './OfficeBattleOverlay.jsx';
import OfficeFloor from './OfficeFloor.jsx';
import { createOfficeFloorBridge } from './officeFloor/officeFloorBridge.js';
import OfficeDeskArrival from './OfficeDeskArrival.jsx';
import OfficeDeskSpeech from './OfficeDeskSpeech.jsx';
import OfficeInboxDock from './OfficeInboxDock.jsx';
import OfficeMessenger from './OfficeMessenger.jsx';
import OfficeTrainingWindow from './OfficeTrainingWindow.jsx';
import OfficeWalkBy from './OfficeWalkBy.jsx';
import { TRAINING_MODULE_TOTAL } from '@archislop/shared';
import { useDeskActions } from '../hooks/useDeskActions.js';
import { useOfficeTraining } from '../hooks/useOfficeTraining.js';
import { useHuddlePlayback } from '../hooks/useHuddlePlayback.js';
import { useOfficeLayerPerformances } from '../hooks/useOfficeLayerPerformances.js';
import { meetingMinutes, useMeetingPlayback } from '../hooks/useMeetingPlayback.js';
import { useOfficeAmbience } from '../hooks/useOfficeAmbience.js';
import { useOfficeRunReactions } from '../hooks/useOfficeRunReactions.js';
import { useOfficeWelcome } from '../hooks/useOfficeWelcome.js';
import {
  acceptOfficeBattle,
  acceptOfficeCoffee,
  dismissOfficeBattle,
  dismissOfficeCoffee,
  dismissDeskArrival,
  clearDeskArrivals,
  dismissOfficeMeetingInvite,
  dismissOfficeWalkBy,
  getOfficeSnapshot,
  markAllOfficeEmailsRead,
  markOfficeEmailRead,
  markOfficeImsRead,
  pushOfficeEmail,
  pushOfficeImPing,
  pushOfficeImReply,
  subscribe,
  voteOfficeBattle
} from '../state/officeMomentStore.js';
import { subscribeFloatingWindowReset } from '../state/floatingWindowControl.js';
import {
  getFocusedOverlayId,
  getOpenOverlays,
  subscribe as subscribeOverlayStack
} from '../state/overlayStack.js';
import {
  playBattleBell,
  playCalendarDing,
  playFootsteps,
  playImPing,
  playInboxZero,
  playMailChime,
  playMeetingJoinBlip,
  playPropJam,
  playSendTick,
  playTalkMurmur,
  playVictoryDing,
  playWindowClose,
  playWindowFocus,
  playWindowOpen,
  playYouveGotMail
} from '../utils/agentChimes.js';
import { fireOfficeConfetti } from '../utils/appConfetti.js';
import { CAST_TIERS } from '../utils/castTiers.js';
import { officeCueChime, playPropCues } from '../utils/officeCuePlayers.js';
import { officeMinutesToInsightEntry } from '../utils/appInsightHelpers.js';
import { fetchOfficeCloudAudio } from '../utils/officeSpeechClient.js';
import {
  MEETING_FACILITATOR,
  MEETING_MODALITY_PHYSICAL,
  normalizeMeetingModality,
  normalizeMeetingRoster,
  officeChromeCopy,
  officeDialogueLocale,
  officeMeetingCopy
} from '../utils/officeCast.js';
import { formatLocale } from '../i18n/formatLocale.js';
import {
  cancelOfficeNarration,
  OFFICE_NARRATION_GAP_MS,
  prefetchOfficeLine,
  speakOfficeLine
} from '../utils/officeNarration.js';
import { duckRoomTone, unduckRoomTone } from '../utils/officeRoomTone.js';
import { threadTranscriptFor } from '../utils/officeImThreads.js';
import { officeStatusOf } from '../utils/officePresence.js';
import { officeSpeakerSting } from '../utils/officeSpeakerStings.js';
import { getDeskSlotElement, subscribeDeskSlotElement } from '../state/deskSlotStore.js';
import {
  closeDeskCommsPanel,
  getDeskCommsUi,
  openDeskCommsPanel,
  serializeAnchorRect,
  subscribeDeskCommsUi,
  toggleDeskCommsPanel
} from '../state/deskCommsUiStore.js';
import {
  getOfficeMessengerUi,
  subscribeOfficeMessengerUi
} from '../state/officeMessengerUiStore.js';
import {
  getOfficeViewMode,
  standUp,
  subscribe as subscribeOfficeViewMode
} from '../state/officeViewModeStore.js';

/**
 * The Office Update™ (docs/office-parody.md) — single mount point for all
 * office-parody chrome: the ambience director, inbox dock, IM pings,
 * walk-bys, coffee breaks, meeting invites, and the WG meeting room.
 * Self-contained fixed-position chrome, mounted as a sibling of ErrorToast;
 * App only supplies context getters and the adopt/minutes/gamification sinks.
 */
/**
 * Module Linda assigns after a failed phishing test (§10.2 → §10.1). Same
 * number as the canned overdue-training email, so the two entry points lead to
 * the same module rather than implying a course you have been quietly failing
 * in parallel.
 */
const PHISHING_ASSIGNED_MODULE = 3;

export default function OfficeLayer({
  pause,
  /** Brain Fast / Deep work — quality-lane office calls honor this on the wire. */
  modelProfile = 'fast',
  /** When true, hide transient office surfaces (IM, walk-bys, etc.) while the
   *  canvas intro is still landing — pause still gates the ambience director. */
  suppressDistractions = false,
  advisorBusy,
  getDiagramSource,
  getContentType,
  getSessionId,
  getSvgRoot,
  getUserTitle,
  getUserName,
  onUsage,
  onAdoptPrompt,
  onAdoptAllPrompts,
  onMeetingMinutes,
  onOfficeEvent,
  playChime,
  /** Bumped by App when an agent run completes, so a colleague can react to it. */
  runSignal = null,
  /** Bumped from Your Team menu to start a WG meeting. */
  callMeetingSignal = 0,
  /** Bumped from Your Team menu to pull the team into a face-to-face huddle. */
  huddleSignal = null,
  /**
   * Lane 2's outbound line: `{ seq, colleagueId, text }`, or null. `colleagueId`
   * null means "said out loud" — `talkOutLoud` picks whoever is apt.
   */
  talkSignal = null,
  /**
   * True while an agent run / notebook stream is in flight. Used to resume a
   * huddle that paused for a delegated Do-it once the work finishes.
   */
  agentBusy = false,
  /** When false, #office-desk-bottom-slot is not in the bottom row (empty intro). */
  deskActionsAnchorReady = false
}) {
  const snapshot = useSyncExternalStore(subscribe, getOfficeSnapshot, getOfficeSnapshot);
  // Which renderer is on screen (ADR-0011). Surfaces that exist in both worlds
  // — the walk-by is the first — render here *or* on the floor, never twice.
  const viewMode = useSyncExternalStore(
    subscribeOfficeViewMode,
    getOfficeViewMode,
    getOfficeViewMode
  );
  const onFloor = viewMode === 'floor';

  // Cloud TTS ladder via POST /api/office/speak; null → Web Speech fallback.
  const fetchCloudAudio = useCallback(
    ({ speakerId, text, lang }) =>
      fetchOfficeCloudAudio({ speakerId, text, lang, sessionId: getSessionId?.() ?? '' }),
    [getSessionId]
  );

  // Overheard spoken surfaces only: walk-bys, meetings, battles, coffee.
  // Emails / IMs stay silent (realistic office — you read those yourself).
  // Gated through playChime so the global sound toggle / first-gesture
  // policy still applies on mobile and desktop.
  const narrateLine = useCallback(
    (line) => {
      if (!getOfficeSnapshot().narration) return Promise.resolve({ spoken: false });
      const text = typeof line?.text === 'string' ? line.text : '';
      const speakerId = typeof line?.speakerId === 'string' ? line.speakerId : '';
      if (!text || !speakerId) return Promise.resolve({ spoken: false });
      const lang = officeDialogueLocale();
      // Narration is independent of SFX chimes — the narration toggle controls
      // speech, not the global soundscape mute. Still prime the audio context
      // when the sound gate is open so cloud TTS can play on mobile.
      //
      // That priming call is also where the speaker sting goes: it already
      // fires once, through the sound gate, immediately before the voice. Most
      // of the cast has no sting and keeps the silent no-op.
      playChime?.(officeSpeakerSting(speakerId) ?? (() => {}));
      // Pull the room-tone bed down so a colleague talking over it stays
      // intelligible; it comes back up when the line finishes either way.
      duckRoomTone();
      return speakOfficeLine({
        speakerId,
        text,
        lang,
        fetchCloudAudio
      }).finally(unduckRoomTone);
    },
    [playChime, fetchCloudAudio]
  );

  const prefetchLine = useCallback(
    (line) => {
      if (!getOfficeSnapshot().narration) return;
      const text = typeof line?.text === 'string' ? line.text : '';
      const speakerId = typeof line?.speakerId === 'string' ? line.speakerId : '';
      if (!text || !speakerId) return;
      prefetchOfficeLine({
        speakerId,
        text,
        lang: officeDialogueLocale(),
        fetchCloudAudio
      });
    },
    [fetchCloudAudio]
  );

  const narrateBeat = useCallback(
    (beat) => narrateLine({ speakerId: beat?.speakerId, text: beat?.text }),
    [narrateLine]
  );

  const prefetchBeat = useCallback(
    (beat) => prefetchLine({ speakerId: beat?.speakerId, text: beat?.text }),
    [prefetchLine]
  );

  const { meeting, startMeeting, interject, closeMeeting } = useMeetingPlayback({
    getSessionId,
    getContentType,
    getDiagramSource,
    getSvgRoot,
    onUsage,
    getModelProfile: () => modelProfile,
    narrateBeat: snapshot.narration ? narrateBeat : undefined,
    prefetchBeat: snapshot.narration ? prefetchBeat : undefined,
    narrationGapMs: OFFICE_NARRATION_GAP_MS,
    onCancelNarration: cancelOfficeNarration
  });

  const {
    huddle,
    startHuddle,
    endHuddle,
    requestSpeakerSuggestion,
    pauseForWatching,
    resumeSpeaking
  } = useHuddlePlayback({
    getSessionId,
    getContentType,
    getDiagramSource,
    getSvgRoot,
    onUsage,
    getModelProfile: () => modelProfile,
    onCancelNarration: cancelOfficeNarration
  });

  useOfficeAmbience({
    pause,
    advisorBusy,
    agentBusy,
    meetingActive: Boolean(meeting || huddle),
    floorActive: onFloor,
    getDiagramSource,
    getContentType,
    getSessionId,
    getSvgRoot,
    getUserTitle,
    getUserName,
    getModelProfile: () => modelProfile,
    onUsage
  });

  // A colleague reacts to the diagram you just generated (IM, capped hard).
  useOfficeRunReactions({
    runSignal,
    pause,
    advisorBusy,
    agentBusy,
    meetingActive: Boolean(meeting || huddle),
    floorActive: onFloor,
    getDiagramSource,
    getContentType,
    getSessionId,
    getSvgRoot,
    getUserTitle,
    getUserName,
    getModelProfile: () => modelProfile,
    onUsage
  });

  // First-run onboarding: Linda's welcome email + Chad's IM, once ever.
  // Paused while Meet the Office is open so it doesn't compete with the tour.
  useOfficeWelcome({ getUserTitle, getUserName, pause });

  // Kill in-flight speech when the user mutes narration or books Focus Time.
  useEffect(() => {
    if (!snapshot.narration || snapshot.focusTime) cancelOfficeNarration();
  }, [snapshot.narration, snapshot.focusTime]);

  // Office SFX: mail ding on new email ("You've got mail!" for the session's
  // first), pop on new IM, footsteps when a colleague walks up, calendar ding
  // on a meeting invite, the espresso machine when a coffee break is accepted,
  // the boxing bell when a cubicle battle opens (victory sting on the verdict),
  // chair squeak when you stand up / sit down, blip when a meeting starts
  // playing. playChime is App's sound gate (soundEnabled + gesture). Sampled
  // cues prefer the baked assets (docs/audio-assets.md).
  const prevUnreadRef = useRef(snapshot.unreadCount);
  const prevArrivalCountRef = useRef(snapshot.deskArrivals.length);
  const prevMeetingStateRef = useRef(null);
  const prevWalkByIdRef = useRef(snapshot.walkBy?.id ?? null);
  const prevInviteIdRef = useRef(snapshot.meetingInvite?.id ?? null);
  const prevCoffeeIdRef = useRef(null);
  const prevBattleIdRef = useRef(null);
  const prevCoffeeStoodForRef = useRef(
    snapshot.coffee?.accepted ? (snapshot.coffee?.id ?? null) : null
  );
  const prevBattleStoodForRef = useRef(
    snapshot.battle?.accepted ? (snapshot.battle?.id ?? null) : null
  );
  const prevCoffeeAcceptedRef = useRef(Boolean(snapshot.coffee?.accepted));
  const prevBattleAcceptedRef = useRef(Boolean(snapshot.battle?.accepted));
  const prevBattleVotedRef = useRef(snapshot.battle?.votedFor ?? null);
  const prevOnFloorRef = useRef(onFloor);
  const mailAnnouncedRef = useRef(false);
  useEffect(() => {
    if (snapshot.unreadCount > prevUnreadRef.current) {
      if (mailAnnouncedRef.current) {
        playChime?.(playMailChime);
      } else {
        mailAnnouncedRef.current = true;
        const inbox = officeChromeCopy().inbox;
        playChime?.((ref) =>
          playYouveGotMail(ref, { text: inbox.mailAnnounce, lang: inbox.mailAnnounceLang })
        );
      }
    }
    prevUnreadRef.current = snapshot.unreadCount;
  }, [snapshot.unreadCount, playChime]);
  useEffect(() => {
    const prev = prevArrivalCountRef.current;
    const next = snapshot.deskArrivals.length;
    if (next > prev) {
      const latest = snapshot.deskArrivals[next - 1];
      if (latest?.kind === 'im') playChime?.(playImPing);
    }
    prevArrivalCountRef.current = next;
  }, [snapshot.deskArrivals, playChime]);
  useEffect(() => {
    const walkBy = snapshot.walkBy;
    const walkById = walkBy?.id ?? null;
    if (walkById && walkById !== prevWalkByIdRef.current) {
      playChime?.(playFootsteps);
      // Speech lives in `OfficeWalkBy` via `useSpokenLineVoice` so a failed TTS
      // result can fall the line back to on-screen text. Floor walk-bys are
      // spoken by `useFloorSpokenText` instead.
    }
    prevWalkByIdRef.current = walkById;
  }, [snapshot.walkBy, playChime]);
  useEffect(() => {
    const inviteId = snapshot.meetingInvite?.id ?? null;
    if (inviteId && inviteId !== prevInviteIdRef.current) playChime?.(playCalendarDing);
    prevInviteIdRef.current = inviteId;
  }, [snapshot.meetingInvite?.id, playChime]);
  // Coffee / battle invites stay at your desk (shoulder ask over the canvas).
  // Standing up is the "yes, let's go" beat — same as real life.
  useLayoutEffect(() => {
    const coffee = snapshot.coffee;
    const accepted = Boolean(coffee?.accepted);
    const coffeeId = coffee?.id ?? null;
    if (accepted && coffeeId && coffeeId !== prevCoffeeStoodForRef.current) {
      prevCoffeeStoodForRef.current = coffeeId;
      if (getOfficeViewMode() !== 'floor') standUp();
    }
    if (!coffeeId) prevCoffeeStoodForRef.current = null;
  }, [snapshot.coffee]);

  useLayoutEffect(() => {
    const battle = snapshot.battle;
    const accepted = Boolean(battle?.accepted);
    const battleId = battle?.id ?? null;
    if (accepted && battleId && battleId !== prevBattleStoodForRef.current) {
      prevBattleStoodForRef.current = battleId;
      if (getOfficeViewMode() !== 'floor') standUp();
    }
    if (!battleId) prevBattleStoodForRef.current = null;
  }, [snapshot.battle]);

  useEffect(() => {
    const coffee = snapshot.coffee;
    const coffeeId = coffee?.id ?? null;
    if (coffeeId && coffeeId !== prevCoffeeIdRef.current && !coffee?.accepted) {
      playChime?.(playFootsteps);
      // Invite speech lives in FloorScene / CoffeeBreakOverlay via
      // `useSpokenLineVoice` so a desk-mode ask still speaks before you stand.
    }
    prevCoffeeIdRef.current = coffeeId;
  }, [snapshot.coffee, playChime]);
  useEffect(() => {
    const battle = snapshot.battle;
    const battleId = battle?.id ?? null;
    if (battleId && battleId !== prevBattleIdRef.current && !battle?.accepted) {
      playChime?.(playFootsteps);
    }
    prevBattleIdRef.current = battleId;
  }, [snapshot.battle, playChime]);
  useEffect(() => {
    const accepted = Boolean(snapshot.coffee?.accepted);
    if (accepted && !prevCoffeeAcceptedRef.current) {
      playChime?.(officeCueChime('espresso', { near: true }));
    }
    prevCoffeeAcceptedRef.current = accepted;
  }, [snapshot.coffee?.accepted, playChime]);
  useEffect(() => {
    const accepted = Boolean(snapshot.battle?.accepted);
    if (accepted && !prevBattleAcceptedRef.current) playChime?.(playBattleBell);
    prevBattleAcceptedRef.current = accepted;
  }, [snapshot.battle?.accepted, playChime]);
  useEffect(() => {
    const votedFor = snapshot.battle?.votedFor ?? null;
    if (votedFor && votedFor !== prevBattleVotedRef.current) playChime?.(playVictoryDing);
    prevBattleVotedRef.current = votedFor;
  }, [snapshot.battle?.votedFor, playChime]);
  useEffect(() => {
    if (onFloor !== prevOnFloorRef.current) {
      playChime?.(officeCueChime('chair', { near: true }));
    }
    prevOnFloorRef.current = onFloor;
  }, [onFloor, playChime]);
  useEffect(() => {
    if (meeting?.state === 'playing' && prevMeetingStateRef.current !== 'playing') {
      playChime?.(playMeetingJoinBlip);
      /*
       * §10.4 — an all-hands sounded exactly like a two-person headset sync.
       * The audience row draws faces for "the company is watching" and the
       * room made no more noise for forty people than for two.
       *
       * Gated on the same `audience.length` the confetti is, and after the
       * join blip rather than instead of it: you still joined a call, there
       * are simply a great many people already in it.
       */
      if (meeting?.audience?.length > 0) {
        playChime?.(officeCueChime('crowdSettle'));
      }
    }
    prevMeetingStateRef.current = meeting?.state ?? null;
  }, [meeting?.state, meeting?.audience, playChime]);

  /**
   * §10.4 — the all-hands ends in confetti for an outcome that does not exist.
   * Gated on the meeting having had an audience: confetti after an ordinary
   * two-person headset sync is not a joke, just noise.
   */
  const prevMeetingCompletedRef = useRef(false);
  useEffect(() => {
    const completed = Boolean(meeting?.completed);
    if (completed && !prevMeetingCompletedRef.current && meeting?.audience?.length > 0) {
      void fireOfficeConfetti();
      playChime?.(playVictoryDing);
      // The comment above says "confetti for an outcome that does not exist".
      // Applause is that sentence out loud, and the half of the joke that was
      // missing: scattered, polite, from people who cannot leave yet.
      playChime?.(officeCueChime('applause'));
    }
    prevMeetingCompletedRef.current = completed;
  }, [meeting?.completed, meeting?.audience, playChime]);

  /*
   * Desk-OS chrome. One subscriber rather than a call at each of the four sites
   * that open or raise a window: `overlayStack` is a module-level store, every
   * path through it ends in a notify, and diffing the snapshot here means a new
   * surface gets its sound for free instead of being remembered about.
   *
   * The initial ids are read before subscribing so mounting into a session that
   * already has windows open does not fire a burst of blips.
   *
   * At most one sound per notification, open winning over close winning over
   * focus: opening a window also focuses it, and two blips for one click reads
   * as a glitch rather than as detail.
   */
  useEffect(() => {
    let prevIds = new Set(getOpenOverlays().map((o) => o.id));
    let prevFocused = getFocusedOverlayId();
    return subscribeOverlayStack(() => {
      const ids = new Set(getOpenOverlays().map((o) => o.id));
      const focused = getFocusedOverlayId();
      let opened = false;
      let closed = false;
      for (const id of ids) if (!prevIds.has(id)) opened = true;
      for (const id of prevIds) if (!ids.has(id)) closed = true;
      if (opened) playChime?.(playWindowOpen);
      else if (closed) playChime?.(playWindowClose);
      else if (focused && focused !== prevFocused) playChime?.(playWindowFocus);
      prevIds = ids;
      prevFocused = focused;
    });
  }, [playChime]);

  /*
   * "Tidy up" — every window snapping back to its corner. Sampled paper rather
   * than a new asset: the sound of a desk being straightened is already in the
   * bank, and a sweep is the one window gesture with a physical referent.
   * Single-window resets get it too; it is the same gesture at a smaller scale.
   */
  useEffect(
    () => subscribeFloatingWindowReset(() => playChime?.(officeCueChime('paper'))),
    [playChime]
  );

  const handlePropCue = useCallback(
    (propKind) => {
      playPropCues(propKind, playChime);
    },
    [playChime]
  );

  /*
   * Floor events that are not a prop (`onFloorCue`). The floor says what
   * happened; the mapping to a sound lives here with the other event cues.
   *
   * `step` is the one that fires in bulk — once per walk leg, for you and for
   * anybody else crossing the room — so it takes an explicit `pan` from the
   * caller: a colleague's footsteps have to come from where the colleague is,
   * and the random placement the ambient cues use would put them anywhere.
   */
  const handleFloorCue = useCallback(
    (cue, options = {}) => {
      if (cue === 'jam') {
        playChime?.(playPropJam);
        return;
      }
      if (cue === 'door') {
        playChime?.(officeCueChime('door', { near: true }));
        return;
      }
      if (cue === 'step') {
        const sampled = options.surface === 'hard' ? 'footstepHard' : 'footstepCarpet';
        playChime?.(officeCueChime(sampled, { near: options.near, pan: options.pan }));
      }
    },
    [playChime]
  );

  // A failed meeting fetch degrades in-fiction: the invite becomes a canned
  // cancellation email instead of an error toast. Cap how often Pam cries wolf —
  // the gag lands once; a sticky failure (LLM outage) should not flood the inbox.
  const lastCancelledMeetingEmailAtRef = useRef(0);
  useEffect(() => {
    if (meeting?.state !== 'cancelled') return;
    const copy = officeMeetingCopy();
    const now = Date.now();
    const cooldownMs = 15 * 60 * 1000;
    if (now - lastCancelledMeetingEmailAtRef.current >= cooldownMs) {
      lastCancelledMeetingEmailAtRef.current = now;
      pushOfficeEmail({
        colleagueId: MEETING_FACILITATOR,
        subject: copy.cancelledSubject,
        body: copy.cancelledBody
      });
    }
    closeMeeting();
  }, [meeting?.state, closeMeeting]);

  const handleMarkRead = useCallback(
    (emailId) => {
      const current = getOfficeSnapshot();
      const email = current.emails.find((e) => e.id === emailId);
      if (!email || email.read) return;
      const inboxZero = current.unreadCount === 1 && current.emails.length >= 2;
      markOfficeEmailRead(emailId);
      onOfficeEvent?.('emailRead', { inboxZero });
      // The moment was already detected for the XP beat and simply never made a
      // sound. Clearing the last unread is rare enough to earn a real sting.
      if (inboxZero) playChime?.(playInboxZero);
    },
    [onOfficeEvent, playChime]
  );

  /**
   * Linda's compliance training (docs/office-parody.md §10.1). Completion is
   * where the set piece pays out: XP and the achievement through the normal
   * office-event funnel, plus a certificate email whose own last line makes the
   * next module overdue.
   */
  const handleTrainingComplete = useCallback(
    ({ moduleNumber }) => {
      onOfficeEvent?.('trainingCompleted', { moduleNumber });
      const copy = officeChromeCopy().training;
      pushOfficeEmail({
        colleagueId: 'hr',
        subject: copy.certificateSubject,
        body: formatLocale(copy.certificateBody, {
          module: moduleNumber,
          total: TRAINING_MODULE_TOTAL,
          next: moduleNumber + 1
        })
      });
    },
    [onOfficeEvent]
  );

  const { training, openTraining, closeTraining, submitTraining } = useOfficeTraining({
    getSessionId,
    getContentType,
    getDiagramSource,
    getSvgRoot,
    getUserName,
    getModelProfile: () => modelProfile,
    onUsage,
    onComplete: handleTrainingComplete
  });

  const handleStartTraining = useCallback(
    (moduleNumber) => openTraining({ moduleNumber }),
    [openTraining]
  );

  /**
   * Sasha's phishing test (§10.2). The chain is the payoff — falling for it is
   * what enrols you in Linda's module. Both halves are ordinary office surfaces
   * (an IM and an email), so nothing here produces slot content or starts a run.
   *
   * `handledPhishingRef` makes each bait email a one-shot: the achievement is
   * idempotent, but a second click would post a second enrolment email, and an
   * inbox filling with identical assignments is a bug rather than a joke.
   */
  const handledPhishingRef = useRef(new Set());

  const handlePhishingClick = useCallback(
    (emailId) => {
      if (handledPhishingRef.current.has(emailId)) return;
      handledPhishingRef.current.add(emailId);
      onOfficeEvent?.('phishingClicked');
      const copy = officeChromeCopy();
      pushOfficeImPing({ colleagueId: 'ciso', body: copy.phishing.caught });
      pushOfficeEmail({
        colleagueId: 'hr',
        training: PHISHING_ASSIGNED_MODULE,
        subject: formatLocale(copy.training.assignedSubject, {
          module: PHISHING_ASSIGNED_MODULE
        }),
        body: formatLocale(copy.training.assignedBody, {
          module: PHISHING_ASSIGNED_MODULE,
          total: TRAINING_MODULE_TOTAL
        })
      });
    },
    [onOfficeEvent]
  );

  const handlePhishingReport = useCallback(
    (emailId) => {
      if (handledPhishingRef.current.has(emailId)) return;
      handledPhishingRef.current.add(emailId);
      onOfficeEvent?.('phishingReported');
      pushOfficeImPing({ colleagueId: 'ciso', body: officeChromeCopy().phishing.approved });
    },
    [onOfficeEvent]
  );

  const [messengerBusy, setMessengerBusy] = useState(false);
  const [messengerTargetId, setMessengerTargetId] = useState(null);

  const commsUi = useSyncExternalStore(subscribeDeskCommsUi, getDeskCommsUi, getDeskCommsUi);
  const messengerOpen = commsUi.activePanel === 'slopChat';
  const inboxOpen = commsUi.activePanel === 'inbox';
  const taskbarAnchor = commsUi.anchorRect;

  const handleToggleInbox = useCallback((anchorRect) => {
    toggleDeskCommsPanel('inbox', serializeAnchorRect(anchorRect));
  }, []);
  const handleToggleMessenger = useCallback((anchorRect) => {
    toggleDeskCommsPanel('slopChat', serializeAnchorRect(anchorRect));
  }, []);
  const handleOpenMessenger = useCallback(() => {
    clearDeskArrivals();
    openDeskCommsPanel('slopChat');
  }, []);
  const handleOpenImMessage = useCallback((colleagueId, pingId) => {
    if (pingId) dismissDeskArrival(pingId);
    setMessengerTargetId(colleagueId);
    openDeskCommsPanel('slopChat');
  }, []);
  const handleCloseMessenger = useCallback(() => {
    closeDeskCommsPanel();
    setMessengerTargetId(null);
  }, []);
  const handleCloseInbox = useCallback(() => {
    closeDeskCommsPanel();
  }, []);

  // Presence strip (and any future desk chrome outside this tree) asks for
  // Slop Chat via a tiny UI store — same nonce pattern as Meet the Office.
  const messengerUi = useSyncExternalStore(
    subscribeOfficeMessengerUi,
    getOfficeMessengerUi,
    getOfficeMessengerUi
  );
  const handledMessengerNonce = useRef(0);
  useEffect(() => {
    if (messengerUi.openNonce <= handledMessengerNonce.current) return;
    handledMessengerNonce.current = messengerUi.openNonce;
    if (messengerUi.colleagueId) {
      handleOpenImMessage(messengerUi.colleagueId);
    } else {
      handleOpenMessenger();
    }
  }, [messengerUi.openNonce, messengerUi.colleagueId, handleOpenImMessage, handleOpenMessenger]);

  const handleAdopt = useCallback(
    (prompt, colleagueId) => {
      cancelOfficeNarration();
      dismissOfficeWalkBy();
      onAdoptPrompt?.(prompt, colleagueId);
    },
    [onAdoptPrompt]
  );

  const handleAdoptAll = useCallback(
    (prompts) => {
      cancelOfficeNarration();
      dismissOfficeWalkBy();
      onAdoptAllPrompts?.(prompts);
    },
    [onAdoptAllPrompts]
  );

  const handleDismissWalkBy = useCallback((id) => {
    cancelOfficeNarration();
    dismissOfficeWalkBy(id);
  }, []);

  const handleDeclineCoffee = useCallback(() => {
    cancelOfficeNarration();
    dismissOfficeCoffee();
  }, []);

  const handleCoffeeDone = useCallback(() => {
    if (!getOfficeSnapshot().coffee?.accepted) return;
    cancelOfficeNarration();
    dismissOfficeCoffee();
    onOfficeEvent?.('coffeeBreak');
  }, [onOfficeEvent]);

  const handleAcceptCoffee = useCallback(() => {
    acceptOfficeCoffee();
  }, []);

  const handleAcceptBattle = useCallback(() => {
    acceptOfficeBattle();
  }, []);

  // Settling a battle (voting) is the XP moment; walking away earns nothing
  // but judgment-free peace. Dismiss happens on "Back to work" either way.
  const handleBattleVote = useCallback(
    (colleagueId) => {
      if (getOfficeSnapshot().battle?.votedFor) return;
      voteOfficeBattle(colleagueId);
      // Who you sided with rides along so the office log can remember who won;
      // `applyOfficeEvent` reads only `kind`, so the extra key costs nothing.
      onOfficeEvent?.('battleSettled', { colleagueId });
    },
    [onOfficeEvent]
  );

  const handleBattleDone = useCallback(() => {
    cancelOfficeNarration();
    dismissOfficeBattle();
  }, []);

  const [meetingPicker, setMeetingPicker] = useState(null);

  const handleAcceptInvite = useCallback(() => {
    const invite = getOfficeSnapshot().meetingInvite;
    if (!invite) return;
    dismissOfficeMeetingInvite();
    setMeetingPicker(null);
    // Calendar invites are diegetic "get to the glass room" moments. An
    // all-hands additionally carries an audience — everyone present who will
    // not speak (§10.4).
    void startMeeting({
      attendees: invite.attendees,
      ...(invite.audience?.length ? { audience: invite.audience } : {}),
      modality: MEETING_MODALITY_PHYSICAL
    });
    if (getOfficeViewMode() !== 'floor') standUp();
  }, [startMeeting]);

  const handleCallMeeting = useCallback(
    (options) => {
      if (meeting) return;
      dismissOfficeMeetingInvite();
      const seedAttendees = Array.isArray(options?.seedAttendees)
        ? options.seedAttendees
        : Array.isArray(options?.attendees)
          ? options.attendees
          : [];
      const source =
        options?.source === 'email' || options?.source === 'chat' ? options.source : 'desk';
      const topic = typeof options?.topic === 'string' ? options.topic : '';
      const contextSource =
        options?.contextSource === 'email' || options?.contextSource === 'chat'
          ? options.contextSource
          : undefined;
      const contextDetail = typeof options?.contextDetail === 'string' ? options.contextDetail : '';
      const modality = normalizeMeetingModality(options?.modality, { source });
      const directStart =
        options?.directStart !== false &&
        (source === 'email' || source === 'chat') &&
        seedAttendees.length > 0;

      if (directStart) {
        closeDeskCommsPanel();
        const attendees = normalizeMeetingRoster(seedAttendees, { forceFacilitator: false });
        void startMeeting({
          attendees,
          modality,
          ...(topic ? { topic } : {}),
          ...(contextSource ? { contextSource } : {}),
          ...(contextDetail ? { contextDetail } : {})
        });
        if (modality === MEETING_MODALITY_PHYSICAL && getOfficeViewMode() !== 'floor') {
          standUp();
        }
        return;
      }

      setMeetingPicker({
        seedAttendees,
        topic,
        source,
        contextSource,
        contextDetail,
        forceFacilitator: options?.forceFacilitator === true,
        defaultModality: modality
      });
      closeDeskCommsPanel();
    },
    [meeting, startMeeting]
  );

  const handleConfirmMeetingPicker = useCallback(
    ({ attendees, topic, modality, contextSource, contextDetail }) => {
      setMeetingPicker(null);
      closeDeskCommsPanel();
      const resolved = normalizeMeetingModality(modality, {
        source: meetingPicker?.source ?? 'desk'
      });
      void startMeeting({
        attendees,
        modality: resolved,
        ...(topic ? { topic } : {}),
        ...(contextSource ? { contextSource } : {}),
        ...(contextDetail ? { contextDetail } : {})
      });
      if (resolved === MEETING_MODALITY_PHYSICAL && getOfficeViewMode() !== 'floor') {
        standUp();
      }
    },
    [startMeeting, meetingPicker?.source]
  );

  const handleCancelMeetingPicker = useCallback(() => {
    setMeetingPicker(null);
    closeDeskCommsPanel();
  }, []);

  const handleToggleMeeting = useCallback(
    (anchorRect) => {
      if (meeting) return;
      dismissOfficeMeetingInvite();
      toggleDeskCommsPanel('meeting', serializeAnchorRect(anchorRect));
    },
    [meeting]
  );

  // Desk meeting toggle opens the people picker; email/chat paths set it directly.
  useEffect(() => {
    if (commsUi.activePanel !== 'meeting' || meeting || meetingPicker) return;
    setMeetingPicker({
      seedAttendees: [],
      topic: '',
      source: 'desk'
    });
  }, [commsUi.activePanel, meeting, meetingPicker]);

  useEffect(() => {
    if (commsUi.activePanel === 'meeting' || meetingPicker?.source !== 'desk') return;
    setMeetingPicker(null);
  }, [commsUi.activePanel, meetingPicker?.source]);

  // Signal bumps are one-shot — track the last handled counter so a meeting
  // ending (which recreates handleCallMeeting) cannot re-open the picker.
  const callMeetingHandledRef = useRef(0);
  useEffect(() => {
    if (callMeetingSignal <= 0 || callMeetingSignal === callMeetingHandledRef.current) {
      return;
    }
    callMeetingHandledRef.current = callMeetingSignal;
    openDeskCommsPanel('meeting');
  }, [callMeetingSignal]);

  /**
   * Mobbing is your own team crowding your screen, so the roster is the team
   * tier — no picker. Leadership are not peers; grabbing them is what "Have a
   * meeting" is for. Pairing names one of them and seats only them.
   *
   * @param {{ mode?: 'mob' | 'pair', colleagueId?: string | null }} [act]
   */
  const handleStartHuddle = useCallback(
    (act = {}) => {
      if (meeting || getOfficeSnapshot().huddle) return;
      const pairing = act.mode === 'pair';
      // A pair of nobody is not a pair — bail rather than silently mobbing.
      if (pairing && !act.colleagueId) return;
      /*
       * Seating the huddle. It fires here rather than off the `gathering` phase
       * because this is the moment of the *click*: the ring is drawn and the
       * script does not exist yet, so the sound is also the feedback that the
       * gesture registered. A mob is several chairs dragged over; a pair is one
       * person pulling theirs up, which is the existing single `chair`.
       */
      playChime?.(officeCueChime(pairing ? 'chair' : 'chairsGather'));
      // Floor renderer #2 rings the desk in place — no forced sit-down.
      void startHuddle(pairing ? [act.colleagueId] : CAST_TIERS.team, {
        mode: pairing ? 'pair' : 'mob'
      });
    },
    [meeting, playChime, startHuddle]
  );

  const huddleHandledRef = useRef(0);
  useEffect(() => {
    const seq = huddleSignal?.seq ?? 0;
    if (seq <= 0 || seq === huddleHandledRef.current) return;
    huddleHandledRef.current = seq;
    handleStartHuddle({
      mode: huddleSignal.mode ?? 'mob',
      colleagueId: huddleSignal.colleagueId ?? null
    });
  }, [huddleSignal, handleStartHuddle]);

  // Hard stop, Escape, or the last remark landing — all end the same way. Only
  // a huddle that actually got as far as speaking (or watched a Do-it) is worth XP.
  const handleHardStop = useCallback(() => {
    const phase = getOfficeSnapshot().huddle?.phase;
    if (phase === 'speaking' || phase === 'watching') onOfficeEvent?.('huddled');
    endHuddle();
  }, [endHuddle, onOfficeEvent]);

  /**
   * Delegate a pinned / spoken suggestion: keep the ring seated, open the
   * notebook via onAdoptPrompt, and resume turn-taking when agentBusy clears.
   */
  const huddleWatchRef = useRef(/** @type {null | 'awaiting-busy' | 'busy'} */ (null));
  const handleHuddleAdopt = useCallback(
    (prompt, colleagueId) => {
      pauseForWatching();
      huddleWatchRef.current = 'awaiting-busy';
      onAdoptPrompt?.(prompt, colleagueId);
    },
    [pauseForWatching, onAdoptPrompt]
  );

  useEffect(() => {
    if (!huddleWatchRef.current) return;
    if (huddle?.phase !== 'watching') {
      huddleWatchRef.current = null;
      return;
    }
    if (huddleWatchRef.current === 'awaiting-busy') {
      if (agentBusy) huddleWatchRef.current = 'busy';
      return;
    }
    if (huddleWatchRef.current === 'busy' && !agentBusy) {
      huddleWatchRef.current = null;
      resumeSpeaking();
    }
  }, [agentBusy, huddle?.phase, resumeSpeaking]);

  // If the notebook never starts (failed adopt), don't leave the ring frozen.
  useEffect(() => {
    if (huddle?.phase !== 'watching' || huddleWatchRef.current !== 'awaiting-busy') {
      return undefined;
    }
    const timer = setTimeout(() => {
      if (huddleWatchRef.current === 'awaiting-busy' && !agentBusy) {
        huddleWatchRef.current = null;
        resumeSpeaking();
      }
    }, 2500);
    return () => clearTimeout(timer);
  }, [huddle?.phase, agentBusy, resumeSpeaking]);

  const huddleHandlersForPerformances = useMemo(
    () => ({
      onHardStop: handleHardStop,
      onAdoptPrompt: handleHuddleAdopt,
      onRequestSuggestion: requestSpeakerSuggestion,
      narrateLine: snapshot.narration ? narrateLine : undefined,
      prefetchLine: snapshot.narration ? prefetchLine : undefined,
      onCancelNarration: cancelOfficeNarration
    }),
    [
      handleHardStop,
      handleHuddleAdopt,
      requestSpeakerSuggestion,
      snapshot.narration,
      narrateLine,
      prefetchLine
    ]
  );

  const {
    coffeeVisibleLines,
    coffeeLineSpoken,
    battleVisibleLines,
    battleLineSpoken,
    battleLinesDone,
    huddleRing
  } = useOfficeLayerPerformances({
    coffee: snapshot.coffee,
    battle: snapshot.battle,
    huddle,
    narrateLine: snapshot.narration ? narrateLine : undefined,
    prefetchLine: snapshot.narration ? prefetchLine : undefined,
    onCoffeeDone: handleCoffeeDone,
    huddleHandlers: huddleHandlersForPerformances
  });

  const scenePacing = useMemo(
    () => ({
      coffeeVisibleLines,
      coffeeLineSpoken,
      battleVisibleLines,
      battleLineSpoken,
      battleLinesDone
    }),
    [coffeeVisibleLines, coffeeLineSpoken, battleVisibleLines, battleLineSpoken, battleLinesDone]
  );

  const handleMeetingDismiss = useCallback(() => {
    const current = meeting;
    if (!current) {
      closeMeeting();
      return;
    }
    if (current.state === 'ended' && current.completed) {
      onMeetingMinutes?.(
        officeMinutesToInsightEntry({
          title: current.title,
          minutes: meetingMinutes(current),
          completed: true
        })
      );
      onOfficeEvent?.('meetingSurvived');
    } else {
      onOfficeEvent?.('meetingLeftEarly');
    }
    closeMeeting();
  }, [meeting, onMeetingMinutes, onOfficeEvent, closeMeeting]);

  const canCallMeeting = !meeting;

  const [composeBusy, setComposeBusy] = useState(false);
  const desk = useDeskActions({
    pause,
    meetingActive: Boolean(meeting),
    getDiagramSource,
    getContentType,
    getSessionId,
    getSvgRoot,
    getUserTitle,
    getUserName,
    getModelProfile: () => modelProfile,
    onUsage,
    onOfficeEvent,
    onCheckInbox: handleToggleInbox,
    onCallMeeting: () => handleToggleMeeting()
  });

  /*
   * The talk channel (slice 3). Everything below the signal is `imSomeone`'s
   * existing ladder — the only new machinery is a separate budget and a
   * channel tag, because a conversation on the ambient cap falls back to canned
   * after three sentences. ADR-0010: nothing here produces slot content.
   */
  const [talkPendingFor, setTalkPendingFor] = useState(/** @type {string | null} */ (null));
  const [talkPending, setTalkPending] = useState(false);
  const talkHandledRef = useRef(0);
  useEffect(() => {
    const seq = talkSignal?.seq ?? 0;
    if (seq <= 0 || seq === talkHandledRef.current) return;
    talkHandledRef.current = seq;
    const text = typeof talkSignal?.text === 'string' ? talkSignal.text : '';
    if (!text.trim()) return;
    setTalkPendingFor(talkSignal.colleagueId ?? null);
    setTalkPending(true);
    playChime?.(playSendTick);
    void desk
      .talkOutLoud(talkSignal.colleagueId ?? null, { userMessage: text })
      .finally(() => setTalkPending(false));
  }, [talkSignal, desk, playChime]);

  /*
   * The desk renderer of the talk channel reads the same `imHistory` the floor
   * reads; `channel: 'talk'` is what keeps physical speech out of Slop Chat.
   * Only the newest inbound line is spoken — an office is not a transcript.
   */
  const latestTalkLine = useMemo(() => {
    for (let i = snapshot.imHistory.length - 1; i >= 0; i -= 1) {
      const msg = snapshot.imHistory[i];
      if (msg?.channel !== 'talk') continue;
      return msg.outbound ? null : msg;
    }
    return null;
  }, [snapshot.imHistory]);

  /*
   * The talk channel was the one inbound surface with no cue at all.
   * `pushOfficeImPing` skips `pushDeskArrival` for `channel: 'talk'` — rightly,
   * since announcing a reply to something you just said is absurd — but
   * `playImPing` hangs off that arrival, so skipping the toast also skipped the
   * sound, in both renderers.
   *
   * The cue is conditional on the line not being *voiced*, because a murmur
   * under a colleague actually speaking is just noise. **Both** renderers
   * narrate a talk line now — the floor through `useFloorSpokenText`, the desk
   * through `OfficeDeskSpeech`'s `useSpokenLineVoice` — so the condition is
   * `narration` alone. It was `onFloor && narration` while the desk only
   * rendered the remark as text; folding voice-first into desk talk made the
   * `onFloor` half wrong, and wrong in the direction that doubles up.
   *
   * Residual case left deliberately: if TTS is on but fails, the bubble appears
   * with no cue. Reporting that back would mean threading `spoken` up through
   * two renderers for one edge, and the bubble is already the fallback that
   * failure mode is designed around.
   */
  const prevTalkLineIdRef = useRef(latestTalkLine?.id ?? null);
  useEffect(() => {
    const talkId = latestTalkLine?.id ?? null;
    if (talkId && talkId !== prevTalkLineIdRef.current) {
      if (!snapshot.narration) playChime?.(playTalkMurmur);
    }
    prevTalkLineIdRef.current = talkId;
  }, [latestTalkLine?.id, snapshot.narration, playChime]);

  // Slop Chat™ sending reuses the desk's "IM someone" verb, so a reply comes
  // back through the same LLM/canned ladder as any other IM — and therefore
  // lands in imHistory via pushOfficeImPing with no extra plumbing.
  const handleMessengerSend = useCallback(
    async (colleagueId, body) => {
      pushOfficeImReply({ colleagueId, body });
      onOfficeEvent?.('imReply', { colleagueId });
      playChime?.(playSendTick);
      setMessengerBusy(true);
      try {
        const history = getOfficeSnapshot().imHistory;
        const threadTranscript = threadTranscriptFor(history, colleagueId);
        await desk.imSomeone(colleagueId, { userMessage: body, threadTranscript });
      } finally {
        setMessengerBusy(false);
      }
    },
    [desk, onOfficeEvent, playChime]
  );

  const handleMessageSomeone = useCallback(() => {
    setMessengerOpen(true);
  }, []);

  const handleStartThread = useCallback(() => {
    setMessengerOpen(true);
  }, []);

  const handleComposeEmail = useCallback(
    async (colleagueId, { subject, body }) => {
      setComposeBusy(true);
      try {
        return await desk.emailSomeone(colleagueId, { subject, body });
      } finally {
        setComposeBusy(false);
      }
    },
    [desk]
  );

  // Walking up to somebody on the isometric floor reuses the desk's IM verb —
  // renderer #2 gets no private dialogue path of its own (ADR-0011).
  const handleFloorMessage = useCallback((colleagueId) => {
    clearDeskArrivals();
    setMessengerTargetId(colleagueId);
    setMessengerOpen(true);
  }, []);

  /*
   * Talking on the floor (slice 8) is the same verb again, minus the window:
   * the opener and every reply land in `imHistory` exactly as Slop Chat's do,
   * and the floor renders the newest line as a speech bubble instead. Nothing
   * here is floor-only state — walk away and the thread is still in the
   * messenger, because it was never anywhere else.
   */
  const [floorTalkingTo, setFloorTalkingTo] = useState(null);

  const handleTalkGreet = useCallback(async () => {
    // User speaks first — no auto-opener when walking up to someone.
  }, []);

  const handleTalkReply = useCallback(
    async (colleagueId, body) => {
      pushOfficeImReply({ colleagueId, body });
      onOfficeEvent?.('imReply', { colleagueId });
      const history = getOfficeSnapshot().imHistory;
      const threadTranscript = threadTranscriptFor(history, colleagueId);
      await desk.imSomeone(colleagueId, { userMessage: body, threadTranscript });
    },
    [desk, onOfficeEvent]
  );

  const deskDock = (
    <DeskActionsDock
      placement="taskbar"
      unreadCount={snapshot.unreadCount}
      imUnreadCount={snapshot.imUnreadCount}
      activePanel={commsUi.activePanel}
      onCheckInbox={handleToggleInbox}
      onOpenSlopChat={handleToggleMessenger}
      onSummonSync={handleToggleMeeting}
      canSummonSync={canCallMeeting}
      blockedReason={desk.blockedReason}
    />
  );
  const deskSlot = useSyncExternalStore(
    subscribeDeskSlotElement,
    getDeskSlotElement,
    getDeskSlotElement
  );

  // One taskbar app at a time — tap outside the cluster or its popover to dismiss.
  useEffect(() => {
    if (!commsUi.activePanel) return undefined;
    const onPointerDown = (event) => {
      const target = event.target;
      if (target.closest('.desk-comms-cluster, .floating-window, [data-floating-window]')) return;
      closeDeskCommsPanel();
      if (meetingPicker?.source === 'desk') setMeetingPicker(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [commsUi.activePanel, meetingPicker?.source]);

  const officeFloorBridge = useMemo(
    () =>
      createOfficeFloorBridge({
        imHistory: snapshot.imHistory,
        walkBy: snapshot.walkBy,
        onMessage: handleFloorMessage,
        onTalkGreet: handleTalkGreet,
        onTalkReply: handleTalkReply,
        onTalkingChange: setFloorTalkingTo,
        onGetCoffee: desk.getCoffee,
        onPropCue: handlePropCue,
        onFloorCue: handleFloorCue,
        onAdoptPrompt: handleAdopt,
        onDismissWalkBy: handleDismissWalkBy,
        coffee: snapshot.coffee,
        battle: snapshot.battle,
        sceneHandlers: {
          narrateLine: snapshot.narration ? narrateLine : undefined,
          prefetchLine: snapshot.narration ? prefetchLine : undefined,
          onAcceptCoffee: handleAcceptCoffee,
          onDeclineCoffee: handleDeclineCoffee,
          onCoffeeDone: handleCoffeeDone,
          onAcceptBattle: handleAcceptBattle,
          onDeclineBattle: handleBattleDone,
          onVoteBattle: handleBattleVote,
          onBattleDone: handleBattleDone
        },
        meeting,
        meetingHandlers: {
          onInterject: interject,
          onLeave: handleMeetingDismiss
        },
        huddle,
        huddleHandlers: huddleHandlersForPerformances,
        huddleRing,
        scenePacing
      }),
    [
      snapshot.imHistory,
      snapshot.walkBy,
      snapshot.coffee,
      snapshot.battle,
      snapshot.narration,
      handleFloorMessage,
      handleTalkGreet,
      handleTalkReply,
      desk.getCoffee,
      handlePropCue,
      handleFloorCue,
      handleAdopt,
      handleDismissWalkBy,
      handleDeclineCoffee,
      handleAcceptCoffee,
      handleAcceptBattle,
      narrateLine,
      prefetchLine,
      handleCoffeeDone,
      handleBattleVote,
      handleBattleDone,
      meeting,
      huddle,
      huddleHandlersForPerformances,
      huddleRing,
      scenePacing,
      handleHardStop,
      handleHuddleAdopt,
      requestSpeakerSuggestion,
      cancelOfficeNarration,
      interject,
      handleMeetingDismiss
    ]
  );

  return (
    <div className="office-layer">
      {deskActionsAnchorReady && deskSlot ? createPortal(deskDock, deskSlot) : null}
      {/* The screen-world OS skin (§4) — taskbar, window list and menu bar —
          lives in the shell tree now (`DeskOsTaskbar` / `DeskOsMenuBar`): it
          reads the office view mode and overlay stack straight off their
          stores, so it never needed to be inside the office renderer. */}
      {/* Renderer #2 of the same office state (ADR-0011). Renders null at your
          desk; office windows below still float above it when you stand up. */}
      <OfficeFloor bridge={officeFloorBridge} />
      <OfficeInboxDock
        showTrigger={false}
        open={inboxOpen}
        onClose={handleCloseInbox}
        taskbarAnchor={taskbarAnchor}
        emails={snapshot.emails}
        unreadCount={snapshot.unreadCount}
        focusTime={snapshot.focusTime}
        onMarkRead={handleMarkRead}
        onMarkAllRead={markAllOfficeEmailsRead}
        onAdoptPrompt={handleAdopt}
        onCallMeeting={handleCallMeeting}
        onComposeEmail={handleComposeEmail}
        onStartTraining={handleStartTraining}
        onPhishingClick={handlePhishingClick}
        onPhishingReport={handlePhishingReport}
        composeBusy={composeBusy}
        canCallMeeting={canCallMeeting}
      />
      {/* Linda's compliance training (§10.1). Window-local: the module never
          reaches a diagram slot, and closing the window discards it. */}
      <OfficeTrainingWindow training={training} onClose={closeTraining} onSubmit={submitTraining} />
      {suppressDistractions ? null : (
        <>
          {/* Brief desk-side arrivals for mail and IM; unread badges live on the comms icons. */}
          <OfficeDeskArrival
            arrivals={
              messengerOpen
                ? snapshot.deskArrivals.filter((a) => a.kind !== 'im')
                : snapshot.deskArrivals.filter(
                    (a) => a.kind !== 'im' || a.colleagueId !== floorTalkingTo
                  )
            }
            onDismiss={dismissDeskArrival}
            onOpenEmail={(arrival) => {
              dismissDeskArrival(arrival.id);
              openDeskCommsPanel('inbox');
            }}
            onOpenIm={(arrival) => handleOpenImMessage(arrival.colleagueId, arrival.id)}
          />
          {/* Somebody answering you at your desk. Hidden while you are standing
              (the floor speaks it over their head instead) or while Slop Chat is
              open on that thread — one line, one place (ADR-0011). */}
          {onFloor || messengerOpen ? null : (
            <OfficeDeskSpeech
              line={latestTalkLine}
              pending={talkPending}
              pendingColleagueId={talkPendingFor}
              captions={snapshot.captions}
              narration={snapshot.narration}
              narrateLine={snapshot.narration ? narrateLine : undefined}
              onAdoptPrompt={handleAdopt}
            />
          )}
          <OfficeMessenger
            open={messengerOpen}
            taskbarAnchor={taskbarAnchor}
            messages={snapshot.imHistory}
            // Derived here rather than inside the window so the messenger stays
            // a renderer of office state instead of a second reader of the
            // store (ADR-0011 rule 1).
            statusOf={(id) => officeStatusOf(snapshot, id)}
            busy={messengerBusy}
            initialColleagueId={messengerTargetId}
            onClose={handleCloseMessenger}
            onMarkRead={markOfficeImsRead}
            onSend={handleMessengerSend}
            onMessageSomeone={handleMessageSomeone}
            onStartThread={handleStartThread}
            onCallMeeting={handleCallMeeting}
            onAdoptPrompt={handleAdopt}
            canCallMeeting={canCallMeeting}
          />
          {onFloor ? null : (
            <OfficeWalkBy
              walkBy={snapshot.walkBy}
              onDismiss={handleDismissWalkBy}
              onAdoptPrompt={handleAdopt}
              narrateLine={snapshot.narration ? narrateLine : undefined}
            />
          )}
          {/* Set pieces render here or on the floor, never both — two paced
              performances of one scene would speak every line twice. */}
          {onFloor ? null : (
            <>
              <CoffeeBreakOverlay
                coffee={snapshot.coffee}
                visibleLines={coffeeVisibleLines}
                lineSpoken={coffeeLineSpoken}
                onAccept={handleAcceptCoffee}
                onDecline={handleDeclineCoffee}
                onDone={handleCoffeeDone}
                narrateLine={snapshot.narration ? narrateLine : undefined}
                prefetchLine={snapshot.narration ? prefetchLine : undefined}
              />
              <OfficeBattleOverlay
                battle={snapshot.battle}
                visibleLines={battleVisibleLines}
                lineSpoken={battleLineSpoken}
                linesDone={battleLinesDone}
                onAccept={handleAcceptBattle}
                onVote={handleBattleVote}
                onDone={handleBattleDone}
                narrateLine={snapshot.narration ? narrateLine : undefined}
                prefetchLine={snapshot.narration ? prefetchLine : undefined}
              />
            </>
          )}
          {!meeting && snapshot.meetingInvite ? (
            <MeetingInviteToast
              invite={snapshot.meetingInvite}
              onAccept={handleAcceptInvite}
              onDecline={dismissOfficeMeetingInvite}
            />
          ) : null}
        </>
      )}
      <CallMeetingPicker
        open={Boolean(meetingPicker)}
        taskbarAnchor={meetingPicker?.source === 'desk' ? taskbarAnchor : null}
        seedAttendees={meetingPicker?.seedAttendees ?? []}
        topic={meetingPicker?.topic ?? ''}
        source={meetingPicker?.source ?? 'desk'}
        contextSource={meetingPicker?.contextSource}
        contextDetail={meetingPicker?.contextDetail ?? ''}
        forceFacilitator={meetingPicker?.forceFacilitator === true}
        defaultModality={meetingPicker?.defaultModality}
        onConfirm={handleConfirmMeetingPicker}
        onCancel={handleCancelMeetingPicker}
      />
      {/* Huddles: desk crowds the monitor edges; floor rings your desk
          (ADR-0011 — mount one renderer at a time). */}
      {onFloor ? null : (
        <HuddleOverlay
          huddle={huddle}
          ringControls={huddleRing}
          onHardStop={handleHardStop}
          onAdoptPrompt={handleHuddleAdopt}
          onRequestSuggestion={requestSpeakerSuggestion}
          narrateLine={snapshot.narration ? narrateLine : undefined}
          prefetchLine={snapshot.narration ? prefetchLine : undefined}
          onCancelNarration={cancelOfficeNarration}
        />
      )}
      {/* The call window is renderer #1 of a meeting; the glass room is
          renderer #2. Physical syncs stand you into the room and hand chrome to
          the floor. Remote headset calls keep this window at the desk — standing
          up mid-call paints headsets on the floor (and a side card) without
          forcing the view change when the call starts. */}
      {onFloor ? null : (
        <MeetingOverlay
          meeting={meeting}
          captions={snapshot.captions}
          narration={snapshot.narration}
          onInterject={interject}
          onLeave={handleMeetingDismiss}
          onClose={handleMeetingDismiss}
          onAdoptPrompt={handleAdopt}
          onAdoptAllPrompts={handleAdoptAll}
        />
      )}
    </div>
  );
}
