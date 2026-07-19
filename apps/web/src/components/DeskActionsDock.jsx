import { useEffect, useRef, useState } from 'react';
import { ArchiSlopMarkIcon } from './AppIcons.jsx';
import { officeChromeCopy } from '../utils/officeCast.js';
import { requestOfficeDirectoryOpen } from '../state/officeDirectoryUiStore.js';

/**
 * Your desk (docs/office-parody.md § Desk verbs): the things *you* can decide
 * to do in the office, as opposed to the things the office does to you. The
 * ArchiSlop helmet stamp opens a short verb menu — Meet the Office, check HR
 * progression, get a coffee, walk the floor, message someone, check mail, call
 * a meeting, talk to your team.
 *
 * Pure props: OfficeLayer owns the store subscription and wires the handlers
 * from useDeskActions. Verbs that cannot run right now stay visible but
 * disabled with an in-fiction reason, so the menu never silently no-ops.
 */
export default function DeskActionsDock({
  onGetCoffee,
  onWalkTheFloor,
  onImSomeone,
  onCheckInbox,
  onOpenSlopChat,
  onCallMeeting,
  onTalkToTeam,
  onCheckHrProgression,
  onMeetOffice,
  blockedReason = null,
  canCallMeeting = true,
  canTalkToTeam = true,
  unreadCount = 0,
  imUnreadCount = 0,
  placement = 'corner'
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const copy = officeChromeCopy().desk;

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const blockedTitle = blockedReason ? (copy.blocked?.[blockedReason] ?? null) : null;

  const meetOffice = () => {
    if (onMeetOffice) onMeetOffice();
    else requestOfficeDirectoryOpen('roster');
  };

  const verbs = [
    {
      id: 'meetOffice',
      label: copy.meetOffice,
      emoji: '🏢',
      run: meetOffice,
      alwaysEnabled: true,
      title: copy.meetOfficeTitle
    },
    {
      id: 'hr',
      label: copy.hrProgress,
      emoji: '📈',
      run: onCheckHrProgression,
      alwaysEnabled: true,
      title: copy.hrProgressTitle
    },
    { id: 'coffee', label: copy.coffee, emoji: '☕', run: onGetCoffee },
    { id: 'walk', label: copy.walk, emoji: '🚶', run: onWalkTheFloor },
    { id: 'im', label: copy.im, emoji: '💬', run: () => onImSomeone?.() },
    {
      id: 'slopChat',
      label: copy.slopChat,
      emoji: '💬',
      run: onOpenSlopChat,
      alwaysEnabled: true,
      title: copy.slopChatTitle,
      badge: imUnreadCount > 0 ? (imUnreadCount > 9 ? '9+' : String(imUnreadCount)) : null
    },
    {
      id: 'inbox',
      label: copy.inbox,
      emoji: '📥',
      run: onCheckInbox,
      alwaysEnabled: true,
      badge: unreadCount > 0 ? (unreadCount > 9 ? '9+' : String(unreadCount)) : null
    },
    {
      id: 'meeting',
      label: copy.meeting,
      emoji: '📅',
      run: onCallMeeting,
      disabled: !canCallMeeting,
      disabledTitle: copy.blocked?.noAgenda
    },
    {
      id: 'team',
      label: copy.team,
      emoji: '👥',
      run: onTalkToTeam,
      disabled: !canTalkToTeam,
      disabledTitle: copy.blocked?.noTeam ?? copy.blocked?.noAgenda
    }
  ];

  const placementClass = placement === 'bottom' ? ' desk-actions--bottom' : '';

  return (
    <div className={`desk-actions${placementClass}`} ref={rootRef}>
      <button
        type="button"
        className={`desk-actions-button${open ? ' is-open' : ''}`}
        aria-label={copy.buttonAria}
        aria-expanded={open}
        title={copy.buttonTitle}
        data-testid="bottom-brand-mark"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="desk-actions-button-stamp is-brand" aria-hidden="true">
          <ArchiSlopMarkIcon />
        </span>
        <span className="desk-actions-button-label">{copy.buttonLabel}</span>
        {unreadCount > 0 ? (
          <span className="desk-actions-unread-badge" aria-hidden="true">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="desk-actions-menu" role="menu" aria-label={copy.menuAria}>
          <p className="desk-actions-heading">{copy.menuHeading}</p>
          {verbs.map((verb) => {
            const disabled = verb.disabled || (!verb.alwaysEnabled && Boolean(blockedReason));
            const title = verb.disabled
              ? verb.disabledTitle
              : disabled
                ? blockedTitle
                : (verb.title ?? verb.label);
            return (
              <button
                key={verb.id}
                type="button"
                role="menuitem"
                className="desk-actions-item"
                disabled={disabled}
                title={title ?? verb.label}
                onClick={() => {
                  setOpen(false);
                  void verb.run?.();
                }}
              >
                <span className="desk-actions-item-emoji" aria-hidden="true">
                  {verb.emoji}
                </span>
                <span className="desk-actions-item-label">{verb.label}</span>
                {verb.badge ? (
                  <span className="desk-actions-item-badge" aria-hidden="true">
                    {verb.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
