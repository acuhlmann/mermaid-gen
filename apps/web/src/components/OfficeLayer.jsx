import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import CoffeeBreakOverlay from './CoffeeBreakOverlay.jsx';
import MeetingInviteToast from './MeetingInviteToast.jsx';
import MeetingOverlay from './MeetingOverlay.jsx';
import OfficeBattleOverlay from './OfficeBattleOverlay.jsx';
import OfficeImPing from './OfficeImPing.jsx';
import OfficeInboxDock from './OfficeInboxDock.jsx';
import OfficeWalkBy from './OfficeWalkBy.jsx';
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
  pushOfficeEmail,
  setOfficeFocusTime,
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
import {
  MEETING_FACILITATOR,
  officeChromeCopy,
  officeMeetingCopy,
  pickMeetingAttendees
} from '../utils/officeCast.js';

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
  playChime
}) {
  const snapshot = useSyncExternalStore(subscribe, getOfficeSnapshot, getOfficeSnapshot);
  const { meeting, startMeeting, interject, leaveMeeting, closeMeeting } = useMeetingPlayback({
    getSessionId,
    getContentType,
    getDiagramSource,
    getSvgRoot,
    onUsage
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
    const walkById = snapshot.walkBy?.id ?? null;
    if (walkById && walkById !== prevWalkByIdRef.current) playChime?.(playFootsteps);
    prevWalkByIdRef.current = walkById;
  }, [snapshot.walkBy?.id, playChime]);
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
    (ping) => {
      dismissOfficeImPing(ping.id);
      onOfficeEvent?.('imReply');
    },
    [onOfficeEvent]
  );

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

  return (
    <div className="office-layer">
      <OfficeInboxDock
        emails={snapshot.emails}
        unreadCount={snapshot.unreadCount}
        focusTime={snapshot.focusTime}
        soundscape={snapshot.soundscape}
        onToggleFocusTime={setOfficeFocusTime}
        onToggleSoundscape={setOfficeSoundscape}
        onMarkRead={handleMarkRead}
        onMarkAllRead={markAllOfficeEmailsRead}
        onAdoptPrompt={handleAdopt}
        onCallMeeting={handleCallMeeting}
        canCallMeeting={canCallMeeting}
      />
      <OfficeImPing
        pings={snapshot.imPings}
        onDismiss={dismissOfficeImPing}
        onQuickReply={handleQuickReply}
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
      />
      <OfficeBattleOverlay
        battle={snapshot.battle}
        onAccept={acceptOfficeBattle}
        onVote={handleBattleVote}
        onDone={dismissOfficeBattle}
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
