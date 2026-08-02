import { ButtonIcon } from './AppIcons.jsx';
import { officeChromeCopy } from '../utils/officeCast.js';

function formatBadge(count) {
  if (!(count > 0)) return null;
  return count > 9 ? '9+' : String(count);
}

/**
 * Desk comms cluster (docs/office-parody.md § Desk verbs): the three ways the
 * office reaches you — mail, Slop Chat, meeting — as direct icons with
 * independent unread badges. Headphones / Focus and Approved vendors live in
 * the menu bar Admin menu (`DeskOsMenuBar`).
 *
 * `placement="taskbar"` puts them in the bottom bar beside Stand up, where the
 * rest of the office already is: the presence strip says what the room is doing
 * and these are how you answer it. Glyph-only there — a label per verb is 3
 * labels the bar cannot spend, and each icon keeps its `title` + `aria-label`.
 *
 * Pure props: OfficeLayer owns the store subscription and wires handlers from
 * useDeskActions, then portals this into the bar's anchor (`deskSlotStore`), so
 * the taskbar itself still holds no office state.
 */
export default function DeskActionsDock({
  onCheckInbox,
  onOpenSlopChat,
  onSummonSync,
  canSummonSync = true,
  blockedReason = null,
  unreadCount = 0,
  imUnreadCount = 0,
  placement = 'corner'
}) {
  const copy = officeChromeCopy().desk;
  const blockedTitle = blockedReason ? (copy.blocked?.[blockedReason] ?? null) : null;

  const verbs = [
    {
      id: 'inbox',
      label: copy.inboxShort ?? copy.inbox,
      ariaLabel: copy.inbox,
      title: copy.inbox,
      emoji: '📥',
      run: onCheckInbox,
      badge: formatBadge(unreadCount),
      disabled: false
    },
    {
      id: 'slopChat',
      label: copy.slopChatShort ?? copy.slopChat,
      ariaLabel: copy.slopChat,
      title: copy.slopChatTitle ?? copy.slopChat,
      emoji: '💬',
      run: onOpenSlopChat,
      badge: formatBadge(imUnreadCount),
      disabled: false
    },
    {
      id: 'meeting',
      label: copy.meetingShort ?? copy.meeting,
      ariaLabel: copy.meeting,
      title: canSummonSync
        ? (copy.meetingTitle ?? copy.meeting)
        : (copy.blocked?.meeting ?? copy.meeting),
      emoji: '📅',
      run: onSummonSync,
      badge: null,
      disabled: !canSummonSync
    }
  ];

  const placementClass = placement === 'corner' ? '' : ` desk-actions--${placement}`;

  return (
    <div
      className={`desk-actions desk-comms-cluster${placementClass}`}
      role="group"
      aria-label={copy.commsAria ?? copy.menuAria}
      data-testid="desk-comms-cluster"
    >
      {verbs.map((verb) => {
        const title = verb.disabled ? verb.title : (verb.title ?? blockedTitle ?? verb.ariaLabel);
        return (
          <button
            key={verb.id}
            type="button"
            className="overlay-button compact-button slop-action-button desk-actions-button desk-comms-button"
            data-testid={`desk-comms-${verb.id}`}
            aria-label={verb.ariaLabel}
            title={title}
            disabled={verb.disabled}
            onClick={() => {
              void verb.run?.();
            }}
          >
            <ButtonIcon>
              <span className="action-persona-icon desk-comms-emoji" aria-hidden="true">
                {verb.emoji}
                {verb.badge ? (
                  <span className="desk-actions-unread-badge" aria-hidden="true">
                    {verb.badge}
                  </span>
                ) : null}
              </span>
            </ButtonIcon>
            <span className="button-label">{verb.label}</span>
          </button>
        );
      })}
    </div>
  );
}
