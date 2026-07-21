import { useEffect, useRef, useState } from 'react';
import { ArchiSlopMarkIcon } from './AppIcons.jsx';
import { officeChromeCopy } from '../utils/officeCast.js';
import { useUiCopy } from '../i18n/useUiLocale.js';

/**
 * Your desk (docs/office-parody.md § Desk verbs): the things *you* can decide
 * to do in the office, as opposed to the things the office does to you. The
 * ArchiSlop helmet stamp opens a geography-grouped menu — Your seat (notebook
 * + concentration), Get up (wander / bother), Under the desk (workstation / HR).
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
  onToggleEditor,
  onInviteAgent,
  onToggleThinking,
  modelProfile = 'fast',
  onSelectModelProfile = null,
  blockedReason = null,
  canOpenOutbox = false,
  canToggleThinking = false,
  canToggleEditor = false,
  editorOpen = false,
  thinkingOpen = false,
  unreadCount = 0,
  imUnreadCount = 0,
  placement = 'corner'
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const copy = officeChromeCopy().desk;
  const { controls } = useUiCopy();
  const settingsCopy = controls.settings;

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const blockedTitle = blockedReason ? (copy.blocked?.[blockedReason] ?? null) : null;

  const seatVerbs = [
    {
      id: 'thinking',
      label: thinkingOpen ? copy.thinkingClose : copy.thinking,
      emoji: '📓',
      run: onToggleThinking,
      alwaysEnabled: true,
      disabled: !canToggleThinking,
      disabledTitle: copy.blocked?.noThinking,
      title: copy.thinkingTitle
    }
  ];

  const getUpVerbs = [
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
    { id: 'walk', label: copy.walk, emoji: '🚶', run: onWalkTheFloor },
    { id: 'coffee', label: copy.coffee, emoji: '☕', run: onGetCoffee }
  ];

  const underDeskVerbs = [
    {
      id: 'code',
      label: editorOpen ? copy.codeDrawerClose : copy.codeDrawer,
      emoji: '</>',
      run: onToggleEditor,
      alwaysEnabled: true,
      disabled: !canToggleEditor,
      disabledTitle: copy.blocked?.noCode,
      title: copy.codeDrawerTitle
    },
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
        <div className="desk-actions-menu" role="menu" aria-label={copy.menuAria}>
          <p className="desk-actions-heading">{copy.sectionSeat ?? 'Your seat'}</p>
          {seatVerbs.map(renderVerb)}
          <div
            className="desk-actions-concentration"
            role="group"
            aria-label={settingsCopy.brain}
            title={settingsCopy.concentrationTitle ?? settingsCopy.brain}
          >
            <span className="desk-actions-concentration-label">
              <span className="desk-actions-item-emoji" aria-hidden="true">
                🎚️
              </span>
              {settingsCopy.brain}
            </span>
            <div className="desk-actions-concentration-segment">
              <button
                type="button"
                className={`desk-actions-concentration-option${modelProfile === 'fast' ? ' is-selected' : ''}`}
                aria-pressed={modelProfile === 'fast'}
                onClick={() => onSelectModelProfile?.('fast')}
              >
                {settingsCopy.fast}
              </button>
              <button
                type="button"
                className={`desk-actions-concentration-option${modelProfile === 'quality' ? ' is-selected' : ''}`}
                aria-pressed={modelProfile === 'quality'}
                onClick={() => onSelectModelProfile?.('quality')}
              >
                {settingsCopy.quality}
              </button>
            </div>
          </div>
          <p className="desk-actions-heading">{copy.sectionGetUp ?? 'Get up'}</p>
          {getUpVerbs.map(renderVerb)}
          <p className="desk-actions-heading">{copy.sectionUnderDesk ?? 'Under the desk'}</p>
          {underDeskVerbs.map(renderVerb)}
        </div>
      ) : null}
    </div>
  );
}
