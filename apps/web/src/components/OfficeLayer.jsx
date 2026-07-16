import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import CoffeeBreakOverlay from './CoffeeBreakOverlay.jsx';
import MeetingInviteToast from './MeetingInviteToast.jsx';
import MeetingOverlay from './MeetingOverlay.jsx';
import OfficeImPing from './OfficeImPing.jsx';
import OfficeInboxDock from './OfficeInboxDock.jsx';
import OfficeWalkBy from './OfficeWalkBy.jsx';
import { meetingMinutes, useMeetingPlayback } from '../hooks/useMeetingPlayback.js';
import { useOfficeAmbience } from '../hooks/useOfficeAmbience.js';
import {
  acceptOfficeCoffee,
  dismissOfficeCoffee,
  dismissOfficeImPing,
  dismissOfficeMeetingInvite,
  dismissOfficeWalkBy,
  getOfficeSnapshot,
  markAllOfficeEmailsRead,
  markOfficeEmailRead,
  pushOfficeEmail,
  setOfficeFocusTime,
  subscribe
} from '../state/officeMomentStore.js';
import { playImPing, playMailChime, playMeetingJoinBlip } from '../utils/agentChimes.js';
import { officeMinutesToInsightEntry } from '../utils/appInsightHelpers.js';
import {
  MEETING_FACILITATOR,
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

  // Office SFX: mail ding on new email, pop on new IM, blip when a meeting
  // starts playing. playChime is App's sound gate (soundEnabled + gesture).
  const prevUnreadRef = useRef(snapshot.unreadCount);
  const prevPingCountRef = useRef(snapshot.imPings.length);
  const prevMeetingStateRef = useRef(null);
  useEffect(() => {
    if (snapshot.unreadCount > prevUnreadRef.current) playChime?.(playMailChime);
    prevUnreadRef.current = snapshot.unreadCount;
  }, [snapshot.unreadCount, playChime]);
  useEffect(() => {
    if (snapshot.imPings.length > prevPingCountRef.current) playChime?.(playImPing);
    prevPingCountRef.current = snapshot.imPings.length;
  }, [snapshot.imPings.length, playChime]);
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
        onToggleFocusTime={setOfficeFocusTime}
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
