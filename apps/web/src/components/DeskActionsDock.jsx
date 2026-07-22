import { useEffect, useRef, useState } from 'react';
import { ArchiSlopMarkIcon } from './AppIcons.jsx';
import { officeChromeCopy } from '../utils/officeCast.js';
import { overlayLayerStyle, useOverlayLayer } from '../hooks/useOverlayLayer.js';

/**
 * Your desk (docs/office-parody.md § Desk verbs): the things *you* can decide
 * to do in the office, as opposed to the things the office does to you. The
 * ArchiSlop helmet stamp opens a flat verb menu. Rush job / Deep work and the
 * notebook live on the bottom chrome row; the code drawer lives on the Thinking
 * pane header.
 *
 * Pure props: OfficeLayer owns the store subscription and wires the handlers
 * from useDeskActions. Verbs that cannot run right now stay visible but
 * disabled with an in-fiction reason, so the menu never silently no-ops.
 */
export default function DeskActionsDock({
  onGetCoffee,
  onWalkTheFloor,
  onCheckInbox,
  onOpenSlopChat,
  onCheckHrProgression,
  onOpenOutbox,
  onInviteAgent,
  blockedReason = null,
  ambientBlockedReason = null,
  canOpenOutbox = false,
  unreadCount = 0,
  imUnreadCount = 0,
  placement = 'corner',
  initialOpen = false
}) {
  const [open, setOpen] = useState(initialOpen);
  const rootRef = useRef(null);
  const menuZIndex = useOverlayLayer('desk-actions-menu', open);
  const copy = officeChromeCopy().desk;

  useEffect(() => {
    if (initialOpen) setOpen(true);
  }, [initialOpen]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const blockedTitle = blockedReason ? (copy.blocked?.[blockedReason] ?? null) : null;
  const ambientBlockedTitle = ambientBlockedReason
    ? (copy.blocked?.[ambientBlockedReason] ?? null)
    : null;

  const deskVerbs = [
    {
      id: 'inbox',
      label: copy.inbox,
      emoji: '📥',
      run: onCheckInbox,
      alwaysEnabled: true,
      badge: unreadCount > 0 ? (unreadCount > 9 ? '9+' : String(unreadCount)) : null
    },
    {
      id: 'outbox',
      label: copy.outbox,
      emoji: '📤',
      run: onOpenOutbox,
      alwaysEnabled: true,
      disabled: !canOpenOutbox,
      disabledTitle: copy.blocked?.noOutbox,
      title: copy.outboxTitle
    },
    {
      id: 'slopChat',
      label: copy.slopChat,
      emoji: '💬',
      run: onOpenSlopChat,
      alwaysEnabled: true,
      title: copy.slopChatTitle,
      badge: imUnreadCount > 0 ? (imUnreadCount > 9 ? '9+' : String(imUnreadCount)) : null
    },
    { id: 'walk', label: copy.walk, emoji: '🚶', run: onWalkTheFloor, ambient: true },
    { id: 'coffee', label: copy.coffee, emoji: '☕', run: onGetCoffee, ambient: true },
    {
      id: 'contractor',
      label: copy.onboardContractor,
      emoji: '🤝',
      run: onInviteAgent,
      alwaysEnabled: true,
      title: copy.onboardContractorTitle
    },
    {
      id: 'hr',
      label: copy.hrProgress,
      emoji: '📈',
      run: onCheckHrProgression,
      alwaysEnabled: true,
      title: copy.hrProgressTitle
    }
  ];

  const placementClass = placement === 'bottom' ? ' desk-actions--bottom' : '';

  const renderVerb = (verb) => {
    const verbBlockedReason = verb.ambient ? ambientBlockedReason : blockedReason;
    const verbBlockedTitle = verb.ambient ? ambientBlockedTitle : blockedTitle;
    const disabled = verb.disabled || (!verb.alwaysEnabled && Boolean(verbBlockedReason));
    const title = verb.disabled
      ? verb.disabledTitle
      : disabled
        ? verbBlockedTitle
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
  };

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
        <div
          className="desk-actions-menu"
          style={overlayLayerStyle(menuZIndex)}
          role="menu"
          aria-label={copy.menuAria}
        >
          {deskVerbs.map(renderVerb)}
        </div>
      ) : null}
    </div>
  );
}
