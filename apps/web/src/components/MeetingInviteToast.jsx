import { useEffect, useState } from 'react';
import { officeChromeCopy, officeMeetingCopy, officeSenderInfo } from '../utils/officeCast.js';

const PROPOSE_GAG_MS = 2600;

/**
 * Calendar-invite toast for a WG meeting (docs/office-parody.md). Accept opens
 * the MeetingOverlay; Decline dismisses; "Propose new time" is a gag — the
 * organizer declines your proposal, then the invite dismisses itself.
 */
export default function MeetingInviteToast({ invite, onAccept, onDecline }) {
  const [proposedNewTime, setProposedNewTime] = useState(false);

  useEffect(() => {
    if (!proposedNewTime) return undefined;
    const timer = setTimeout(() => onDecline?.(), PROPOSE_GAG_MS);
    return () => clearTimeout(timer);
  }, [proposedNewTime, onDecline]);

  if (!invite) return null;
  const copy = officeChromeCopy();
  const organizer = officeSenderInfo(invite.colleagueId);

  return (
    <div className="office-meeting-invite" role="status" aria-live="polite">
      <p className="office-moment-kind office-moment-kind--meeting" aria-hidden="true">
        {copy.meetingInvite.kindLabel}
      </p>
      <div className="office-meeting-invite-head">
        <span aria-hidden="true">📅</span>
        <span className="office-meeting-invite-title">{invite.title}</span>
      </div>
      <div className="office-meeting-invite-meta">
        <span title={organizer.title ? `${organizer.name} · ${organizer.title}` : organizer.name}>
          {copy.meetingInvite.organizerLabel} {organizer.avatarEmoji} {organizer.name}
        </span>
      </div>
      <div className="office-meeting-invite-attendees">
        <span className="office-meeting-invite-attendees-label">
          {copy.meetingInvite.attendeesLabel}
        </span>
        {invite.attendees.map((id) => {
          const attendee = officeSenderInfo(id);
          return (
            <span
              key={id}
              className="office-meeting-invite-attendee"
              title={attendee.title ? `${attendee.name} · ${attendee.title}` : attendee.name}
            >
              <span aria-hidden="true">{attendee.avatarEmoji}</span> {attendee.name}
            </span>
          );
        })}
      </div>
      <p className="office-meeting-invite-body">{invite.body}</p>
      {proposedNewTime ? (
        <p className="office-meeting-invite-gag">{officeMeetingCopy().proposeNewTimeGag}</p>
      ) : (
        <div className="office-meeting-invite-actions">
          <button type="button" className="office-meeting-accept" onClick={onAccept}>
            {copy.meetingInvite.accept}
          </button>
          <button type="button" className="office-meeting-decline" onClick={onDecline}>
            {copy.meetingInvite.decline}
          </button>
          <button
            type="button"
            className="office-meeting-propose"
            onClick={() => setProposedNewTime(true)}
          >
            {copy.meetingInvite.proposeNewTime}
          </button>
        </div>
      )}
    </div>
  );
}
