import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ButtonIcon } from './AppIcons.jsx';
import { useUiCopy } from '../i18n/useUiLocale.js';
import { useAdvisorFloatAnchor } from '../hooks/useAdvisorFloatAnchor.js';
import { useNarrowLayout } from '../hooks/useAppLayoutMedia.js';
import { overlayLayerStyle, useOverlayLayer } from '../hooks/useOverlayLayer.js';

const DRAWER_EMOJI = '🗄️';
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
  let left = anchorRect.right - maxWidth;
  left = Math.max(SAFE_INSET_PX, Math.min(left, viewportWidth - minWidth - SAFE_INSET_PX));
  const width = Math.min(maxWidth, viewportWidth - left - SAFE_INSET_PX);

  return {
    position: 'fixed',
    left,
    width,
    minWidth: Math.min(minWidth, width),
    maxWidth: width,
    bottom: window.innerHeight - anchorRect.top + MENU_GAP_PX,
    boxSizing: 'border-box'
  };
}

/**
 * The desk tray: work-surface tools (Deliverable format, Facilities, Shredder)
 * collapse into one grouped office tray so the always-visible surface stays the
 * Work Order + Your Team. Team audio and huddle verbs live in the Your Team
 * roster menu. One pill opens a menu (mirrors DeskActionsDock's open / outside-click
 * pattern).
 *
 * Behavior-only props — App owns the handlers; copy comes from the locale bundle.
 */
export default function DeskDrawer({
  modes,
  currentMode,
  onPickMode,
  canFix = false,
  fixDisabled = false,
  onFix,
  onDemolish,
  busy = false,
  modeDisabled = false,
  /** First-run tour: keep the tray open while walking Deliverable format. */
  forceOpen = false
}) {
  const { controls } = useUiCopy();
  const actions = controls.actions;
  const drawer = controls.deskDrawer ?? {};
  const modeOptions = Array.isArray(modes) ? modes.filter((m) => m && m.id && m.label) : [];
  const narrowLayout = useNarrowLayout();

  const [open, setOpen] = useState(forceOpen);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const menuZIndex = useOverlayLayer('desk-drawer-menu', open);
  const anchorRect = useAdvisorFloatAnchor(triggerRef, open && narrowLayout);

  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (forceOpen) return;
      const target = event.target;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, forceOpen]);

  const runAndClose = (fn) => {
    if (!forceOpen) setOpen(false);
    void fn?.();
  };

  const buttonClass = ['overlay-button', 'compact-button', 'slop-action-button', 'is-desk-drawer']
    .filter(Boolean)
    .join(' ');

  const menuReady = open && (!narrowLayout || anchorRect);
  const menuStyle = overlayLayerStyle(
    menuZIndex,
    narrowLayout && anchorRect ? computePortaledMenuStyle(anchorRect) : undefined
  );

  const menu = menuReady ? (
    <div
      ref={menuRef}
      className={[
        'desk-actions-menu',
        'desk-drawer-menu',
        narrowLayout ? 'desk-drawer-menu--portaled' : ''
      ]
        .filter(Boolean)
        .join(' ')}
      style={menuStyle}
      role="menu"
      aria-label={drawer.menuAria ?? drawer.label ?? 'Desk tray'}
    >
      {modeOptions.length > 0
        ? modeOptions.map((mode) => {
            const isCurrent = mode.id === currentMode;
            const techLabel = mode.techLabel ?? mode.subtitle;
            return (
              <button
                key={mode.id}
                type="button"
                role="menuitem"
                className={`desk-actions-item desk-drawer-mode${isCurrent ? ' is-current' : ''}`}
                disabled={modeDisabled || isCurrent}
                aria-current={isCurrent ? 'true' : undefined}
                onClick={() => runAndClose(() => onPickMode?.(mode.id))}
              >
                <span className="desk-actions-item-stack">
                  <span className="desk-actions-item-label">{mode.label}</span>
                  {techLabel ? (
                    <span className="desk-actions-item-subtitle">{techLabel}</span>
                  ) : null}
                </span>
                {isCurrent ? (
                  <span className="desk-drawer-current-tag" aria-hidden="true">
                    {controls.radial?.currentMode ?? 'Current'}
                  </span>
                ) : null}
              </button>
            );
          })
        : null}
      {canFix ? (
        <button
          type="button"
          role="menuitem"
          className="desk-actions-item"
          disabled={busy || fixDisabled}
          title={actions.facilitiesTitle ?? actions.fixTitle}
          onClick={() => runAndClose(onFix)}
        >
          <span className="desk-actions-item-emoji" aria-hidden="true">
            🛠️
          </span>
          <span className="desk-actions-item-label">{actions.facilities ?? actions.fix}</span>
        </button>
      ) : null}
      <button
        type="button"
        role="menuitem"
        className="desk-actions-item is-demolish"
        disabled={busy}
        title={actions.clearTitle}
        onClick={() => runAndClose(onDemolish)}
      >
        <span className="desk-actions-item-emoji" aria-hidden="true">
          🗑️
        </span>
        <span className="desk-actions-item-label">{actions.demolish ?? actions.clear}</span>
      </button>
    </div>
  ) : null;

  const portaledMenu =
    narrowLayout && menu && anchorRect && typeof document !== 'undefined'
      ? createPortal(menu, document.body)
      : null;

  return (
    <div className="desk-drawer" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`${buttonClass}${open ? ' is-expanded' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={
          open ? (drawer.close ?? drawer.label ?? 'Desk tray') : (drawer.label ?? 'Desk tray')
        }
        title={drawer.title ?? drawer.label ?? 'Desk tray'}
        onClick={() => setOpen((v) => !v)}
      >
        <ButtonIcon>
          <span className="action-persona-icon is-desk-drawer" aria-hidden="true">
            {DRAWER_EMOJI}
          </span>
        </ButtonIcon>
        <span className="button-label">{drawer.label ?? 'Desk tray'}</span>
        <span className="slop-action-role">
          <span className="slop-action-role-emoji" aria-hidden="true">
            {DRAWER_EMOJI}
          </span>
          {drawer.roleTag ?? 'Work surface'}
        </span>
      </button>
      {narrowLayout ? portaledMenu : menu}
    </div>
  );
}
