import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import CoffeeBreakOverlay from './CoffeeBreakOverlay.jsx';
import DeskActionsDock from './DeskActionsDock.jsx';
import MeetingInviteToast from './MeetingInviteToast.jsx';
import MeetingOverlay from './MeetingOverlay.jsx';
import OfficeBattleOverlay from './OfficeBattleOverlay.jsx';
import OfficeImPing from './OfficeImPing.jsx';
import OfficeInboxDock from './OfficeInboxDock.jsx';
import OfficeMessenger from './OfficeMessenger.jsx';
import OfficeWalkBy from './OfficeWalkBy.jsx';
import { useDeskActions } from '../hooks/useDeskActions.js';
import { meetingMinutes, useMeetingPlayback } from '../hooks/useMeetingPlayback.js';
import { useOfficeAmbience } from '../hooks/useOfficeAmbience.js';
import { useOfficeSoundscape } from '../hooks/useOfficeSoundscape.js';
import { useOfficeWelcome } from '../hooks/useOfficeWelcome.js';
import {
  acceptOfficeBattle,
  acceptOfficeCoffee,
  dismissOfficeBattle,
  dismissOfficeCoffee,
  dismissOfficeImPing,
  dismissOfficeMeetingInvite,
  dismissOfficeWalkBy,
  getOfficeSnapshot,
  markAllOfficeEmailsRead,
  markOfficeEmailRead,
  markOfficeImsRead,
  pushOfficeEmail,
  pushOfficeImReply,
  setOfficeFocusTime,
  setOfficeNarration,
  setOfficeSoundscape,
  subscribe,
  voteOfficeBattle
} from '../state/officeMomentStore.js';
import {
  playBattleBell,
  playCalendarDing,
  playEspressoMachine,
  playFootsteps,
  playImPing,
  playMailChime,
  playMeetingJoinBlip,
  playVictoryDing,
  playYouveGotMail
} from '../utils/agentChimes.js';
import { officeMinutesToInsightEntry } from '../utils/appInsightHelpers.js';
import { API_BASE_URL, SESSION_HEADER } from '../state/diagramSession.js';
import {
  MEETING_FACILITATOR,
  officeChromeCopy,
  officeDialogueLocale,
  officeMeetingCopy,
  pickMeetingAttendees
} from '../utils/officeCast.js';
import {
  cancelOfficeNarration,
  OFFICE_NARRATION_GAP_MS,
  speakOfficeLine
} from '../utils/officeNarration.js';

/**
 * The Office Update™ (docs/office-parody.md) — single mount point for all
 * office-parody chrome: the ambience director, inbox dock, IM pings,
 * walk-bys, coffee breaks, meeting invites, and the WG meeting room.
 * Self-contained fixed-position chrome, mounted as a sibling of ErrorToast;
 * App only supplies context getters and the adopt/minutes/gamification sinks.
 */
export default function OfficeLayer({
  pause,
  advisorBusy,
  getDiagramSource,
  getContentType,
  getSessionId,
  getSvgRoot,
  getUserTitle,
  onUsage,
  onAdoptPrompt,
  onMeetingMinutes,
  onOfficeEvent,
  onTalkToTeam,
  onCheckHrProgression,
  playChime
}) {
  const snapshot = useSyncExternalStore(subscribe, getOfficeSnapshot, getOfficeSnapshot);

  // Cloud WaveNet via POST /api/office/speak; null → Web Speech fallback.
  const fetchCloudAudio = useCallback(
    async ({ speakerId, text, lang }) => {
      try {
        const headers = { 'content-type': 'application/json' };
        const sessionId = getSessionId?.() ?? '';
        if (sessionId) headers[SESSION_HEADER] = sessionId;
        const response = await fetch(`${API_BASE_URL}/api/office/speak`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ speakerId, text, lang })
        });
        if (!response.ok) return null;
        const body = await response.json();
        return body?.audio ?? null;
      } catch {
        return null;
      }
    },
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
      return new Promise((resolve) => {
        let invoked = false;
        playChime?.(() => {
          invoked = true;
          void speakOfficeLine({
            speakerId,
            text,
            lang,
            fetchCloudAudio
          }).then(resolve);
        });
        queueMicrotask(() => {
          if (!invoked) resolve({ spoken: false });
        });
      });
    },
    [playChime, fetchCloudAudio]
  );

  const narrateBeat = useCallback(
    (beat) => narrateLine({ speakerId: beat?.speakerId, text: beat?.text }),
    [narrateLine]
  );

  const { meeting, startMeeting, interject, leaveMeeting, closeMeeting } = useMeetingPlayback({
    getSessionId,
    getContentType,
    getDiagramSource,
    getSvgRoot,
    onUsage,
    narrateBeat: snapshot.narration ? narrateBeat : undefined,
    narrationGapMs: OFFICE_NARRATION_GAP_MS,
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
    onUsage
  });

  // Room tone (keyboard clatter, mouse clicks, paper shuffles, chair squeaks,
  // the printer, the desk phone, the watercooler, the espresso machine, the
  // vending machine, the elevator) — its own sparse cadence, muted by Focus
  // Time and the dock's Soundscape toggle.
  useOfficeSoundscape({ playChime });

  // First-run onboarding: Linda's welcome email + Chad's IM, once ever.
  useOfficeWelcome({ getUserTitle });

  // Kill in-flight speech when the user mutes narration or books Focus Time.
  useEffect(() => {
    if (!snapshot.narration || snapshot.focusTime) cancelOfficeNarration();
  }, [snapshot.narration, snapshot.focusTime]);

  // Office SFX: mail ding on new email ("You've got mail!" for the session's
  // first), pop on new IM, footsteps when a colleague walks up, calendar ding
  // on a meeting invite, the espresso machine when a coffee break is accepted,
  // the boxing bell when a cubicle battle opens (victory sting on the verdict),
  // blip when a meeting starts playing. playChime is App's sound gate
  // (soundEnabled + gesture).
  const prevUnreadRef = useRef(snapshot.unreadCount);
  const prevPingCountRef = useRef(snapshot.imPings.length);
  const prevMeetingStateRef = useRef(null);
  const prevWalkByIdRef = useRef(snapshot.walkBy?.id ?? null);
  const prevInviteIdRef = useRef(snapshot.meetingInvite?.id ?? null);
  const prevCoffeeAcceptedRef = useRef(Boolean(snapshot.coffee?.accepted));
  const prevBattleAcceptedRef = useRef(Boolean(snapshot.battle?.accepted));
  const prevBattleVotedRef = useRef(snapshot.battle?.votedFor ?? null);
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
      if (snapshot.narration && walkBy?.body) {
        void narrateLine({ speakerId: walkBy.colleagueId, text: walkBy.body });
      }
    } else if (!walkById && prevWalkByIdRef.current) {
      cancelOfficeNarration();
    }
    prevWalkByIdRef.current = walkById;
  }, [snapshot.walkBy, snapshot.narration, playChime, narrateLine]);
  useEffect(() => {
    const inviteId = snapshot.meetingInvite?.id ?? null;
    if (inviteId && inviteId !== prevInviteIdRef.current) playChime?.(playCalendarDing);
    prevInviteIdRef.current = inviteId;
  }, [snapshot.meetingInvite?.id, playChime]);
  useEffect(() => {
    const accepted = Boolean(snapshot.coffee?.accepted);
    if (accepted && !prevCoffeeAcceptedRef.current) playChime?.(playEspressoMachine);
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
    if (meeting?.state === 'playing' && prevMeetingStateRef.current !== 'playing') {
      playChime?.(playMeetingJoinBlip);
    }
    prevMeetingStateRef.current = meeting?.state ?? null;
  }, [meeting?.state, playChime]);

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

  const handleQuickReply = useCallback(
    (ping, reply) => {
      // Record the user's side too, so the toast reply is still there in the
      // messenger scrollback after the toast itself expires.
      pushOfficeImReply({ colleagueId: ping.colleagueId, body: reply });
      dismissOfficeImPing(ping.id);
      onOfficeEvent?.('imReply');
    },
    [onOfficeEvent]
  );

  const [messengerOpen, setMessengerOpen] = useState(false);
  const [messengerBusy, setMessengerBusy] = useState(false);
  const handleOpenMessenger = useCallback(() => setMessengerOpen(true), []);
  const handleCloseMessenger = useCallback(() => setMessengerOpen(false), []);

  const handleAdopt = useCallback(
    (prompt, colleagueId) => {
      dismissOfficeWalkBy();
      onAdoptPrompt?.(prompt, colleagueId);
    },
    [onAdoptPrompt]
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

  const handleAcceptInvite = useCallback(() => {
    const invite = getOfficeSnapshot().meetingInvite;
    if (!invite) return;
    dismissOfficeMeetingInvite();
    void startMeeting({ attendees: invite.attendees });
  }, [startMeeting]);

  const handleCallMeeting = useCallback(() => {
    if (meeting) return;
    dismissOfficeMeetingInvite();
    void startMeeting({ attendees: pickMeetingAttendees() });
  }, [meeting, startMeeting]);

  const handleMeetingClose = useCallback(() => {
    const current = meeting;
    if (current && current.state === 'ended') {
      onMeetingMinutes?.(
        officeMinutesToInsightEntry({
          title: current.title,
          minutes: meetingMinutes(current),
          completed: current.completed
        })
      );
      onOfficeEvent?.(current.completed ? 'meetingSurvived' : 'meetingLeftEarly');
    }
    closeMeeting();
  }, [meeting, onMeetingMinutes, onOfficeEvent, closeMeeting]);

  const canCallMeeting = Boolean((getDiagramSource?.() ?? '').trim()) && !meeting;

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
    onUsage,
    onOfficeEvent,
    onCallMeeting: handleCallMeeting,
    onCheckInbox: () => setInboxOpenSignal((n) => n + 1),
    onTalkToTeam
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
        await desk.imSomeone(colleagueId);
      } finally {
        setMessengerBusy(false);
      }
    },
    [desk, onOfficeEvent]
  );

  const deskDock = (
    <DeskActionsDock
      placement="bottom"
      unreadCount={snapshot.unreadCount}
      onGetCoffee={desk.getCoffee}
      onWalkTheFloor={desk.walkTheFloor}
      onImSomeone={desk.imSomeone}
      onCheckInbox={desk.checkInbox}
      onCallMeeting={desk.callMeeting}
      onTalkToTeam={desk.talkToTeam}
      onCheckHrProgression={onCheckHrProgression}
      blockedReason={desk.blockedReason}
      canCallMeeting={canCallMeeting}
    />
  );
  const [deskSlot, setDeskSlot] = useState(null);
  useEffect(() => {
    setDeskSlot(document.getElementById('office-desk-bottom-slot'));
  }, []);

  return (
    <div className="office-layer">
      {deskSlot ? createPortal(deskDock, deskSlot) : null}
      <OfficeInboxDock
        showTrigger={false}
        openSignal={inboxOpenSignal}
        emails={snapshot.emails}
        unreadCount={snapshot.unreadCount}
        focusTime={snapshot.focusTime}
        soundscape={snapshot.soundscape}
        narration={snapshot.narration}
        onToggleFocusTime={setOfficeFocusTime}
        onToggleSoundscape={setOfficeSoundscape}
        onToggleNarration={setOfficeNarration}
        onMarkRead={handleMarkRead}
        onMarkAllRead={markAllOfficeEmailsRead}
        onAdoptPrompt={handleAdopt}
        onCallMeeting={handleCallMeeting}
        canCallMeeting={canCallMeeting}
      />
      <OfficeImPing
        pings={snapshot.imPings}
        unreadCount={snapshot.imUnreadCount}
        historyCount={snapshot.imHistory.length}
        onDismiss={dismissOfficeImPing}
        onQuickReply={handleQuickReply}
        onOpenHistory={handleOpenMessenger}
      />
      <OfficeMessenger
        open={messengerOpen}
        messages={snapshot.imHistory}
        busy={messengerBusy}
        onClose={handleCloseMessenger}
        onMarkRead={markOfficeImsRead}
        onSend={handleMessengerSend}
      />
      <OfficeWalkBy
        walkBy={snapshot.walkBy}
        onDismiss={dismissOfficeWalkBy}
        onAdoptPrompt={handleAdopt}
      />
      <CoffeeBreakOverlay
        coffee={snapshot.coffee}
        onAccept={acceptOfficeCoffee}
        onDecline={dismissOfficeCoffee}
        onDone={handleCoffeeDone}
        narrateLine={snapshot.narration ? narrateLine : undefined}
      />
      <OfficeBattleOverlay
        battle={snapshot.battle}
        onAccept={acceptOfficeBattle}
        onVote={handleBattleVote}
        onDone={handleBattleDone}
        narrateLine={snapshot.narration ? narrateLine : undefined}
      />
      {!meeting && snapshot.meetingInvite ? (
        <MeetingInviteToast
          invite={snapshot.meetingInvite}
          onAccept={handleAcceptInvite}
          onDecline={dismissOfficeMeetingInvite}
        />
      ) : null}
      <MeetingOverlay
        meeting={meeting}
        onInterject={interject}
        onLeave={leaveMeeting}
        onClose={handleMeetingClose}
        onAdoptPrompt={handleAdopt}
      />
    </div>
  );
}
