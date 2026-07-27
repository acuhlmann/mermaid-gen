import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArchiSlopMarkIcon } from './AppIcons.jsx';
import ConcentrationControl from './ConcentrationControl.jsx';
import DeskStandUpButton from './DeskStandUpButton.jsx';
import IntroLocaleToggle from './IntroLocaleToggle.jsx';
import { officeChromeCopy } from '../utils/officeCast.js';
import { useUiCopy } from '../i18n/useUiLocale.js';
import {
  overlayLayerStyle,
  overlayFocusHandlers,
  useOverlayLayer
} from '../hooks/useOverlayLayer.js';
import { FOCUS_Z_BASE } from '../state/overlayStack.js';

const MENU_GAP_PX = 7;
const SAFE_INSET_PX = 8;
const MAX_MENU_WIDTH_PX = 280;
const MIN_MENU_WIDTH_PX = 200;

/**
 * @param {DOMRect} anchorRect
 * @returns {import('react').CSSProperties}
 */
function computePortaledMenuStyle(anchorRect) {
  const viewportWidth = window.innerWidth;
  const maxWidth = Math.min(MAX_MENU_WIDTH_PX, viewportWidth - SAFE_INSET_PX * 2);
  const minWidth = Math.min(MIN_MENU_WIDTH_PX, maxWidth);
  let left = anchorRect.left;
  left = Math.max(SAFE_INSET_PX, Math.min(left, viewportWidth - minWidth - SAFE_INSET_PX));
  const width = Math.min(maxWidth, viewportWidth - left - SAFE_INSET_PX);

  return {
    position: 'fixed',
    top: 'auto',
    left,
    width,
    minWidth: Math.min(minWidth, width),
    maxWidth: width,
    bottom: Math.max(SAFE_INSET_PX, window.innerHeight - anchorRect.top + MENU_GAP_PX),
    boxSizing: 'border-box'
  };
}

/**
 * Your desk (docs/office-parody.md § Desk verbs): the things *you* can decide
 * to do in the office, as opposed to the things the office does to you. The
 * ArchiSlop helmet stamp opens a flat verb menu with concentration first, then
 * compact ambience toggles (Focus / Noise / Voice / CC), then language pack.
 * Stand up is a primary bottom-nav control beside the stamp — not buried in
 * the menu. Coffee lives on the isometric floor; walk-bys arrive on their own.
 *
 * Pure props: OfficeLayer owns the store subscription and wires the handlers
 * from useDeskActions. Verbs that cannot run right now stay visible but
 * disabled with an in-fiction reason, so the menu never silently no-ops.
 *
 * The menu portals to document.body so focus z-index can stack above floating
 * office windows (inbox, Slop Chat) that live outside .bottom-chrome.
 */
export default function DeskActionsDock({
  onStandUp,
  onSitDown,
  standing = false,
  onCheckInbox,
  onOpenSlopChat,
  onCheckHrProgression,
  onOpenOutbox,
  onInviteAgent,
  blockedReason = null,
  canOpenOutbox = false,
  unreadCount = 0,
  imUnreadCount = 0,
  placement = 'corner',
  initialOpen = false,
  modelProfile = 'fast',
  onSelectModelProfile = null,
  focusTime = false,
  soundscape = true,
  captions = false,
  narration = true,
  onToggleFocusTime = null,
  onToggleSoundscape = null,
  onToggleCaptions = null,
  onToggleNarration = null
}) {
  const [open, setOpen] = useState(initialOpen);
  const [anchorRect, setAnchorRect] = useState(/** @type {DOMRect | null} */ (null));
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const menuZIndex = useOverlayLayer('desk-actions-menu', open);
  const { locale, setLocale, controls } = useUiCopy();
  const chrome = officeChromeCopy();
  const copy = chrome.desk;
  const languagePack = controls.languagePack ?? {};

  useEffect(() => {
    if (initialOpen) setOpen(true);
  }, [initialOpen]);

  useLayoutEffect(() => {
    if (!open) {
      setAnchorRect(null);
      return undefined;
    }
    const measure = () => {
      const node = triggerRef.current;
      if (!node) return;
      setAnchorRect(node.getBoundingClientRect());
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (triggerRef.current) ro?.observe(triggerRef.current);
    window.addEventListener('resize', measure);
    const vv = window.visualViewport;
    vv?.addEventListener('resize', measure);
    vv?.addEventListener('scroll', measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
      vv?.removeEventListener('resize', measure);
      vv?.removeEventListener('scroll', measure);
    };
  }, [open]);

  // Defer dismiss binding so the opening click cannot immediately close the menu.
  useEffect(() => {
    if (!open) return undefined;
    let active = false;
    const activateTimer = window.setTimeout(() => {
      active = true;
    }, 0);
    const onPointerDown = (event) => {
      if (!active) return;
      const target = event.target;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.clearTimeout(activateTimer);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  const blockedTitle = blockedReason ? (copy.blocked?.[blockedReason] ?? null) : null;

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

  const ambienceToggles = [
    typeof onToggleFocusTime === 'function'
      ? {
          id: 'focus',
          checked: Boolean(focusTime),
          label: copy.focusTimeLabel,
          title: copy.focusTimeTitle,
          onChange: () => onToggleFocusTime(!focusTime)
        }
      : null,
    typeof onToggleSoundscape === 'function'
      ? {
          id: 'soundscape',
          checked: Boolean(soundscape),
          label: copy.soundscapeLabel,
          title: copy.soundscapeTitle,
          onChange: () => onToggleSoundscape(!soundscape)
        }
      : null,
    typeof onToggleNarration === 'function'
      ? {
          id: 'narration',
          checked: Boolean(narration),
          label: copy.narrationLabel,
          title: copy.narrationTitle,
          onChange: () => onToggleNarration(!narration)
        }
      : null,
    typeof onToggleCaptions === 'function'
      ? {
          id: 'captions',
          checked: Boolean(captions),
          label: copy.captionsLabel,
          title: copy.captionsTitle,
          onChange: () => onToggleCaptions(!captions)
        }
      : null
  ].filter(Boolean);

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

  const resolvedAnchor =
    anchorRect ?? (open && triggerRef.current ? triggerRef.current.getBoundingClientRect() : null);

  const menuStyle = resolvedAnchor
    ? overlayLayerStyle(menuZIndex ?? FOCUS_Z_BASE + 1, computePortaledMenuStyle(resolvedAnchor))
    : overlayLayerStyle(menuZIndex ?? FOCUS_Z_BASE + 1, {
        position: 'fixed',
        top: 'auto',
        left: SAFE_INSET_PX,
        bottom: SAFE_INSET_PX + 48,
        width: MIN_MENU_WIDTH_PX,
        boxSizing: 'border-box'
      });

  const portaledMenu =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            className="desk-actions-menu desk-actions-menu--portaled"
            style={menuStyle}
            role="menu"
            aria-label={copy.menuAria}
            data-testid="desk-actions-menu"
            {...overlayFocusHandlers('desk-actions-menu', open)}
          >
            {deskVerbs.map(renderVerb)}
            <div className="desk-actions-menu-footer" role="none">
              <ConcentrationControl
                variant="menu"
                modelProfile={modelProfile}
                onSelectModelProfile={onSelectModelProfile}
              />
              {ambienceToggles.length > 0 ? (
                <div
                  className="desk-ambience-pack"
                  role="group"
                  aria-label={copy.ambienceAria}
                  data-testid="desk-ambience-pack"
                >
                  {ambienceToggles.map((toggle) => (
                    <label
                      key={toggle.id}
                      className="office-focus-toggle desk-ambience-toggle"
                      title={toggle.title}
                    >
                      <input type="checkbox" checked={toggle.checked} onChange={toggle.onChange} />
                      <span>{toggle.label}</span>
                    </label>
                  ))}
                </div>
              ) : null}
              <div
                className="desk-language-pack"
                role="group"
                aria-label={languagePack.aria ?? languagePack.label}
                title={languagePack.title}
                data-testid="desk-language-pack"
              >
                <span className="desk-language-pack-label">
                  <span className="desk-language-pack-emoji" aria-hidden="true">
                    🌐
                  </span>
                  {languagePack.label ?? 'Language pack'}
                  <span className="desk-language-pack-tag" aria-hidden="true">
                    {languagePack.tag ?? 'IT TICKET'}
                  </span>
                </span>
                <IntroLocaleToggle
                  variant="inline"
                  locale={locale}
                  copy={controls.introLocale}
                  onSelectLocale={setLocale}
                />
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className={`desk-actions${placementClass}`} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`desk-actions-button${open ? ' is-open' : ''}`}
        aria-label={copy.buttonAria}
        aria-expanded={open}
        aria-haspopup="menu"
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
      {placement === 'bottom' ? (
        <DeskStandUpButton standing={standing} onStandUp={onStandUp} onSitDown={onSitDown} />
      ) : null}
      {portaledMenu}
    </div>
  );
}
