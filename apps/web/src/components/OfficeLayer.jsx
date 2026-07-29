import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
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
import OfficeImPing from './OfficeImPing.jsx';
import OfficeInboxDock from './OfficeInboxDock.jsx';
import OfficeMessenger from './OfficeMessenger.jsx';
import OfficeWalkBy from './OfficeWalkBy.jsx';
import { useDeskActions } from '../hooks/useDeskActions.js';
import { useHuddlePlayback } from '../hooks/useHuddlePlayback.js';
import { meetingMinutes, useMeetingPlayback } from '../hooks/useMeetingPlayback.js';
import { useOfficeAmbience } from '../hooks/useOfficeAmbience.js';
import { useOfficeRunReactions } from '../hooks/useOfficeRunReactions.js';
import { useOfficeWelcome } from '../hooks/useOfficeWelcome.js';
import {
  acceptOfficeBattle,
  acceptOfficeCoffee,
  dismissOfficeBattle,
  dismissOfficeCoffee,
  dismissOfficeImPing,
  clearOfficeImPings,
  dismissOfficeMeetingInvite,
  dismissOfficeWalkBy,
  getOfficeSnapshot,
  markAllOfficeEmailsRead,
  markOfficeEmailRead,
  markOfficeImsRead,
  pushOfficeEmail,
  pushOfficeImReply,
  setOfficeFocusTime,
  setOfficeHeadphones,
  subscribe,
  voteOfficeBattle
} from '../state/officeMomentStore.js';
import {
  playBattleBell,
  playCalendarDing,
  playFootsteps,
  playImPing,
  playMailChime,
  playMeetingJoinBlip,
  playVictoryDing,
  playYouveGotMail
} from '../utils/agentChimes.js';
import { CAST_TIERS } from '../utils/castTiers.js';
import { officeCueChime, playPropCues } from '../utils/officeCuePlayers.js';
import { officeMinutesToInsightEntry } from '../utils/appInsightHelpers.js';
import { fetchOfficeCloudAudio } from '../utils/officeSpeechClient.js';
import {
  MEETING_FACILITATOR,
  officeChromeCopy,
  officeDialogueLocale,
  officeMeetingCopy
} from '../utils/officeCast.js';
import {
  cancelOfficeNarration,
  OFFICE_NARRATION_GAP_MS,
  prefetchOfficeLine,
  speakOfficeLine
} from '../utils/officeNarration.js';
import { duckRoomTone, unduckRoomTone } from '../utils/officeRoomTone.js';
import { threadTranscriptFor } from '../utils/officeImThreads.js';
import { getDeskSlotElement, subscribeDeskSlotElement } from '../state/deskSlotStore.js';
import {
  getOfficeViewMode,
  sitDown,
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
export default function OfficeLayer({
  pause,
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
  onCheckHrProgression,
  onOpenOutbox,
  onToggleEditor,
  onInviteAgent,
  onToggleThinking,
  modelProfile = 'fast',
  onSelectModelProfile = null,
  canOpenOutbox = false,
  canToggleThinking = false,
  canToggleEditor = false,
  editorOpen = false,
  thinkingOpen = false,
  playChime,
  /** Bumped by App when an agent run completes, so a colleague can react to it. */
  runSignal = null,
  /** Bumped from Your Team menu to start a WG meeting. */
  callMeetingSignal = 0,
  /** Bumped from Your Team menu to pull the team into a face-to-face huddle. */
  huddleSignal = 0,
  /**
   * True while an agent run / notebook stream is in flight. Used to resume a
   * huddle that paused for a delegated Do-it once the work finishes.
   */
  agentBusy = false,
  /** When false, #office-desk-bottom-slot is not in the bottom row (empty intro). */
  deskActionsAnchorReady = false,
  /** Desktop vs mobile bottom row — slot remounts when this flips. */
  deskActionsLayoutKey = 'desktop',
  /** First-run empty state: reserved for callers that still want the menu open. */
  deskMenuInitialOpen = false
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
      playChime?.(() => {});
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
    onCancelNarration: cancelOfficeNarration
  });

  useOfficeAmbience({
    pause,
    advisorBusy,
    meetingActive: Boolean(meeting),
    getDiagramSource,
    getContentType,
    getSessionId,
    getSvgRoot,
    getUserTitle,
    getUserName,
    onUsage
  });

  // A colleague reacts to the diagram you just generated (IM, capped hard).
  useOfficeRunReactions({
    runSignal,
    pause,
    advisorBusy,
    meetingActive: Boolean(meeting),
    getDiagramSource,
    getContentType,
    getSessionId,
    getSvgRoot,
    getUserTitle,
    getUserName,
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
  const prevPingCountRef = useRef(snapshot.imPings.length);
  const prevMeetingStateRef = useRef(null);
  const prevWalkByIdRef = useRef(snapshot.walkBy?.id ?? null);
  const prevInviteIdRef = useRef(snapshot.meetingInvite?.id ?? null);
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
    if (snapshot.imPings.length > prevPingCountRef.current) playChime?.(playImPing);
    prevPingCountRef.current = snapshot.imPings.length;
  }, [snapshot.imPings.length, playChime]);
  useEffect(() => {
    const walkBy = snapshot.walkBy;
    const walkById = walkBy?.id ?? null;
    if (walkById && walkById !== prevWalkByIdRef.current) {
      playChime?.(playFootsteps);
      // Over-the-shoulder: the colleague actually says the line. Emails never
      // get this treatment — inbox stays read-only by design.
      if (snapshot.narration && walkBy?.body && !onFloor) {
        void narrateLine({ speakerId: walkBy.colleagueId, text: walkBy.body });
      }
    }
    prevWalkByIdRef.current = walkById;
  }, [snapshot.walkBy, snapshot.narration, onFloor, playChime, narrateLine]);
  useEffect(() => {
    const inviteId = snapshot.meetingInvite?.id ?? null;
    if (inviteId && inviteId !== prevInviteIdRef.current) playChime?.(playCalendarDing);
    prevInviteIdRef.current = inviteId;
  }, [snapshot.meetingInvite?.id, playChime]);
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
    }
    prevMeetingStateRef.current = meeting?.state ?? null;
  }, [meeting?.state, playChime]);

  const handlePropCue = useCallback(
    (propKind) => {
      playPropCues(propKind, playChime);
    },
    [playChime]
  );

  // A failed meeting fetch degrades in-fiction: the invite becomes a canned
  // cancellation email instead of an error toast.
  useEffect(() => {
    if (meeting?.state !== 'cancelled') return;
    const copy = officeMeetingCopy();
    pushOfficeEmail({
      colleagueId: MEETING_FACILITATOR,
      subject: copy.cancelledSubject,
      body: copy.cancelledBody
    });
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
    },
    [onOfficeEvent]
  );

  const [messengerOpen, setMessengerOpen] = useState(false);
  const [messengerBusy, setMessengerBusy] = useState(false);
  const handleOpenMessenger = useCallback(() => {
    clearOfficeImPings();
    setMessengerOpen(true);
  }, []);
  const handleCloseMessenger = useCallback(() => setMessengerOpen(false), []);

  const handleAdopt = useCallback(
    (prompt, colleagueId) => {
      dismissOfficeWalkBy();
      onAdoptPrompt?.(prompt, colleagueId);
    },
    [onAdoptPrompt]
  );

  const handleAdoptAll = useCallback(
    (prompts) => {
      dismissOfficeWalkBy();
      onAdoptAllPrompts?.(prompts);
    },
    [onAdoptAllPrompts]
  );

  const handleCoffeeDone = useCallback(() => {
    if (!getOfficeSnapshot().coffee?.accepted) return;
    dismissOfficeCoffee();
    onOfficeEvent?.('coffeeBreak');
  }, [onOfficeEvent]);

  // Settling a battle (voting) is the XP moment; walking away earns nothing
  // but judgment-free peace. Dismiss happens on "Back to work" either way.
  const handleBattleVote = useCallback(
    (colleagueId) => {
      if (getOfficeSnapshot().battle?.votedFor) return;
      voteOfficeBattle(colleagueId);
      onOfficeEvent?.('battleSettled');
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
    void startMeeting({ attendees: invite.attendees });
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
      setMeetingPicker({
        seedAttendees,
        topic: typeof options?.topic === 'string' ? options.topic : '',
        source: options?.source === 'email' || options?.source === 'chat' ? options.source : 'desk',
        forceFacilitator: options?.forceFacilitator === true
      });
    },
    [meeting]
  );

  const handleConfirmMeetingPicker = useCallback(
    ({ attendees, topic }) => {
      setMeetingPicker(null);
      setMessengerOpen(false);
      void startMeeting({
        attendees,
        ...(topic ? { topic } : {})
      });
    },
    [startMeeting]
  );

  const handleCancelMeetingPicker = useCallback(() => {
    setMeetingPicker(null);
  }, []);

  useEffect(() => {
    if (callMeetingSignal > 0) handleCallMeeting({ source: 'desk' });
  }, [callMeetingSignal, handleCallMeeting]);

  /**
   * Huddling is your own team crowding your screen, so the roster is the team
   * tier — no picker. Leadership are not peers; grabbing them is what "Call a
   * meeting" is for.
   */
  const handleStartHuddle = useCallback(() => {
    if (meeting || getOfficeSnapshot().huddle) return;
    // The huddle only has a desk renderer today, so standing on the floor would
    // start a scene nobody can see. Sit down first rather than silently no-op.
    if (getOfficeViewMode() === 'floor') sitDown();
    void startHuddle(CAST_TIERS.team);
  }, [meeting, startHuddle]);

  useEffect(() => {
    if (huddleSignal > 0) handleStartHuddle();
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

  const hasDiagramSource = Boolean((getDiagramSource?.() ?? '').trim());
  const canCallMeeting = hasDiagramSource && !meeting;

  // Bumping this counter opens the inbox popover from the desk menu without
  // lifting the dock's own open/close state.
  const [inboxOpenSignal, setInboxOpenSignal] = useState(0);
  const desk = useDeskActions({
    pause,
    meetingActive: Boolean(meeting),
    getDiagramSource,
    getContentType,
    getSessionId,
    getSvgRoot,
    getUserTitle,
    getUserName,
    onUsage,
    onOfficeEvent,
    onCheckInbox: () => setInboxOpenSignal((n) => n + 1)
  });

  // Slop Chat™ sending reuses the desk's "IM someone" verb, so a reply comes
  // back through the same LLM/canned ladder as any other IM — and therefore
  // lands in imHistory via pushOfficeImPing with no extra plumbing.
  const handleMessengerSend = useCallback(
    async (colleagueId, body) => {
      pushOfficeImReply({ colleagueId, body });
      onOfficeEvent?.('imReply');
      setMessengerBusy(true);
      try {
        const history = getOfficeSnapshot().imHistory;
        const threadTranscript = threadTranscriptFor(history, colleagueId);
        await desk.imSomeone(colleagueId, { userMessage: body, threadTranscript });
      } finally {
        setMessengerBusy(false);
      }
    },
    [desk, onOfficeEvent]
  );

  const handleMessageSomeone = useCallback(async () => {
    setMessengerOpen(true);
    await desk.imSomeone();
  }, [desk]);

  // Walking up to somebody on the isometric floor reuses the desk's IM verb —
  // renderer #2 gets no private dialogue path of its own (ADR-0011).
  const handleFloorMessage = useCallback(
    (colleagueId) => {
      clearOfficeImPings();
      setMessengerOpen(true);
      void desk.imSomeone(colleagueId);
    },
    [desk]
  );

  /*
   * Talking on the floor (slice 8) is the same verb again, minus the window:
   * the opener and every reply land in `imHistory` exactly as Slop Chat's do,
   * and the floor renders the newest line as a speech bubble instead. Nothing
   * here is floor-only state — walk away and the thread is still in the
   * messenger, because it was never anywhere else.
   */
  const [floorTalkingTo, setFloorTalkingTo] = useState(null);

  const handleTalkGreet = useCallback(
    async (colleagueId) => {
      await desk.imSomeone(colleagueId);
    },
    [desk]
  );

  const handleTalkReply = useCallback(
    async (colleagueId, body) => {
      pushOfficeImReply({ colleagueId, body });
      onOfficeEvent?.('imReply');
      const history = getOfficeSnapshot().imHistory;
      const threadTranscript = threadTranscriptFor(history, colleagueId);
      await desk.imSomeone(colleagueId, { userMessage: body, threadTranscript });
    },
    [desk, onOfficeEvent]
  );

  const handleQuickReply = useCallback(
    async (ping, reply) => {
      pushOfficeImReply({ colleagueId: ping.colleagueId, body: reply });
      dismissOfficeImPing(ping.id);
      onOfficeEvent?.('imReply');
      const history = getOfficeSnapshot().imHistory;
      const threadTranscript = threadTranscriptFor(history, ping.colleagueId);
      await desk.imSomeone(ping.colleagueId, { userMessage: reply, threadTranscript });
    },
    [desk, onOfficeEvent]
  );

  const deskDock = (
    <DeskActionsDock
      placement="bottom"
      unreadCount={snapshot.unreadCount}
      imUnreadCount={snapshot.imUnreadCount}
      onStandUp={standUp}
      onSitDown={sitDown}
      standing={onFloor}
      onCheckInbox={desk.checkInbox}
      onOpenSlopChat={handleOpenMessenger}
      onCheckHrProgression={onCheckHrProgression}
      onOpenOutbox={onOpenOutbox}
      onInviteAgent={onInviteAgent}
      blockedReason={desk.blockedReason}
      canOpenOutbox={canOpenOutbox}
      initialOpen={deskMenuInitialOpen}
      modelProfile={modelProfile}
      onSelectModelProfile={onSelectModelProfile}
      focusTime={snapshot.focusTime}
      headphones={snapshot.headphones}
      onToggleFocusTime={setOfficeFocusTime}
      onToggleHeadphones={setOfficeHeadphones}
    />
  );
  const deskSlot = useSyncExternalStore(
    subscribeDeskSlotElement,
    getDeskSlotElement,
    getDeskSlotElement
  );

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
        onAdoptPrompt: handleAdopt,
        onDismissWalkBy: dismissOfficeWalkBy,
        coffee: snapshot.coffee,
        battle: snapshot.battle,
        sceneHandlers: {
          narrateLine: snapshot.narration ? narrateLine : undefined,
          prefetchLine: snapshot.narration ? prefetchLine : undefined,
          onAcceptCoffee: acceptOfficeCoffee,
          onDeclineCoffee: dismissOfficeCoffee,
          onCoffeeDone: handleCoffeeDone,
          onAcceptBattle: acceptOfficeBattle,
          onDeclineBattle: dismissOfficeBattle,
          onVoteBattle: handleBattleVote,
          onBattleDone: handleBattleDone
        },
        meeting,
        meetingHandlers: {
          onInterject: interject,
          onLeave: handleMeetingDismiss
        }
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
      handleAdopt,
      narrateLine,
      prefetchLine,
      handleCoffeeDone,
      handleBattleVote,
      handleBattleDone,
      meeting,
      interject,
      handleMeetingDismiss
    ]
  );

  return (
    <div className="office-layer">
      {deskActionsAnchorReady && deskSlot ? createPortal(deskDock, deskSlot) : null}
      {/* Renderer #2 of the same office state (ADR-0011). Renders null at your
          desk; office windows below still float above it when you stand up. */}
      <OfficeFloor bridge={officeFloorBridge} />
      <OfficeInboxDock
        showTrigger={false}
        openSignal={inboxOpenSignal}
        emails={snapshot.emails}
        unreadCount={snapshot.unreadCount}
        focusTime={snapshot.focusTime}
        onMarkRead={handleMarkRead}
        onMarkAllRead={markAllOfficeEmailsRead}
        onAdoptPrompt={handleAdopt}
        onCallMeeting={handleCallMeeting}
        canCallMeeting={canCallMeeting}
      />
      {suppressDistractions ? null : (
        <>
          {/* One renderer per line. The messenger being open already suppressed
              the toast; standing in front of somebody has to do the same, or
              their answer arrives as a bubble *and* a toast and the narrator
              reads it out twice. */}
          <OfficeImPing
            pings={
              messengerOpen
                ? []
                : snapshot.imPings.filter((ping) => ping.colleagueId !== floorTalkingTo)
            }
            onDismiss={dismissOfficeImPing}
            onQuickReply={handleQuickReply}
          />
          <OfficeMessenger
            open={messengerOpen}
            messages={snapshot.imHistory}
            busy={messengerBusy}
            onClose={handleCloseMessenger}
            onMarkRead={markOfficeImsRead}
            onSend={handleMessengerSend}
            onMessageSomeone={handleMessageSomeone}
            onCallMeeting={handleCallMeeting}
            canCallMeeting={canCallMeeting}
          />
          {onFloor ? null : (
            <OfficeWalkBy
              walkBy={snapshot.walkBy}
              onDismiss={dismissOfficeWalkBy}
              onAdoptPrompt={handleAdopt}
            />
          )}
          {/* Set pieces render here or on the floor, never both — two paced
              performances of one scene would speak every line twice. */}
          {onFloor ? null : (
            <>
              <CoffeeBreakOverlay
                coffee={snapshot.coffee}
                onAccept={acceptOfficeCoffee}
                onDecline={dismissOfficeCoffee}
                onDone={handleCoffeeDone}
                narrateLine={snapshot.narration ? narrateLine : undefined}
                prefetchLine={snapshot.narration ? prefetchLine : undefined}
              />
              <OfficeBattleOverlay
                battle={snapshot.battle}
                onAccept={acceptOfficeBattle}
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
        seedAttendees={meetingPicker?.seedAttendees ?? []}
        topic={meetingPicker?.topic ?? ''}
        source={meetingPicker?.source ?? 'desk'}
        forceFacilitator={meetingPicker?.forceFacilitator === true}
        onConfirm={handleConfirmMeetingPicker}
        onCancel={handleCancelMeetingPicker}
      />
      {/* Huddles are a desk-screen fiction — the team crowding the edges of your
          monitor. The floor's version of that is them physically ringing your
          desk, which is a future slice (ADR-0011 rule 1); until it exists the
          verb sits you down rather than rendering nothing. */}
      {onFloor ? null : (
        <HuddleOverlay
          huddle={huddle}
          onHardStop={handleHardStop}
          onAdoptPrompt={handleHuddleAdopt}
          onRequestSuggestion={requestSpeakerSuggestion}
          narrateLine={snapshot.narration ? narrateLine : undefined}
          prefetchLine={snapshot.narration ? prefetchLine : undefined}
        />
      )}
      {/* The call window is renderer #1 of a meeting; the glass room above is
          renderer #2. Standing up hands the running meeting to the floor and
          sitting down hands it back — including the ended state, so the minutes
          card is always read on a screen. */}
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
