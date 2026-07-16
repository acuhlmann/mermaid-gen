import { useEffect, useState } from 'react';
import { officeMeetingCopy, officeSenderInfo } from '../utils/officeCast.js';

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
  const organizer = officeSenderInfo(invite.colleagueId);

  return (
    <div className="office-meeting-invite" role="status" aria-live="polite">
      <div className="office-meeting-invite-head">
        <span aria-hidden="true">📅</span>
        <span className="office-meeting-invite-title">{invite.title}</span>
      </div>
      <div className="office-meeting-invite-meta">
        Organizer: {organizer.avatarEmoji} {organizer.name} · Attendees:{' '}
        {invite.attendees.map((id) => officeSenderInfo(id).avatarEmoji).join(' ')}
      </div>
      <p className="office-meeting-invite-body">{invite.body}</p>
      {proposedNewTime ? (
        <p className="office-meeting-invite-gag">{officeMeetingCopy().proposeNewTimeGag}</p>
      ) : (
        <div className="office-meeting-invite-actions">
          <button type="button" className="office-meeting-accept" onClick={onAccept}>
            Accept
          </button>
          <button type="button" className="office-meeting-decline" onClick={onDecline}>
            Decline
          </button>
          <button
            type="button"
            className="office-meeting-propose"
            onClick={() => setProposedNewTime(true)}
          >
            Propose new time
          </button>
        </div>
      )}
    </div>
  );
}
