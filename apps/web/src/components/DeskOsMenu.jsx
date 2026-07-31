import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  overlayFocusHandlers,
  overlayLayerStyle,
  useOverlayLayer
} from '../hooks/useOverlayLayer.js';

const MENU_GAP_PX = 6;
const SAFE_INSET_PX = 8;
const MAX_MENU_WIDTH_PX = 300;
const MIN_MENU_WIDTH_PX = 210;

/**
 * Menu-bar dropdowns fall *downward* from the top strip — the mirror image of
 * the desk menus (`DeskActionsDock`, the old `DeskDrawer`), which rise from the
 * bottom chrome. Same clamping arithmetic, opposite axis.
 *
 * @param {DOMRect} anchorRect
 * @returns {import('react').CSSProperties}
 */
function computeDropdownStyle(anchorRect) {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const maxWidth = Math.min(MAX_MENU_WIDTH_PX, viewportWidth - SAFE_INSET_PX * 2);
  const minWidth = Math.min(MIN_MENU_WIDTH_PX, maxWidth);
  let left = anchorRect.left;
  left = Math.max(SAFE_INSET_PX, Math.min(left, viewportWidth - minWidth - SAFE_INSET_PX));
  const width = Math.min(maxWidth, viewportWidth - left - SAFE_INSET_PX);
  const top = anchorRect.bottom + MENU_GAP_PX;

  return {
    position: 'fixed',
    left,
    top,
    bottom: 'auto',
    width,
    minWidth: Math.min(minWidth, width),
    maxWidth: width,
    maxHeight: Math.max(120, viewportHeight - top - SAFE_INSET_PX),
    overflowY: 'auto',
    boxSizing: 'border-box'
  };
}

/**
 * One dropdown on the parody-OS menu bar (docs/office-isometric-mode.md §4).
 *
 * Open state is *owned by the bar*, not by the menu: a menu bar where two
 * menus can be open at once is not a menu bar. `open` / `onOpenChange` also buy
 * hover-to-switch — once one menu is open, pointing at a sibling moves to it,
 * which is the behaviour that makes a menu bar feel like one.
 *
 * `children` is a render prop taking `close` so items can dismiss the menu
 * without every caller threading its own callback.
 *
 * @param {{
 *   id: string,
 *   label: string,
 *   emoji?: string,
 *   title?: string,
 *   menuAria?: string,
 *   open?: boolean,
 *   disabled?: boolean,
 *   highlight?: boolean,
 *   onOpenChange: (open: boolean) => void,
 *   onHoverOpen?: () => void,
 *   children: (close: () => void) => import('react').ReactNode
 * }} props
 */
export default function DeskOsMenu({
  id,
  label,
  emoji,
  title,
  menuAria,
  open = false,
  disabled = false,
  highlight = false,
  onOpenChange,
  onHoverOpen,
  children
}) {
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [anchorRect, setAnchorRect] = useState(/** @type {DOMRect | null} */ (null));
  const overlayId = `desk-os-menu-${id}`;
  const menuZIndex = useOverlayLayer(overlayId, open);

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
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      onOpenChange(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(activateTimer);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onOpenChange]);

  const resolvedAnchor =
    anchorRect ?? (open && triggerRef.current ? triggerRef.current.getBoundingClientRect() : null);

  const menuStyle = overlayLayerStyle(
    menuZIndex,
    resolvedAnchor
      ? computeDropdownStyle(resolvedAnchor)
      : {
          position: 'fixed',
          left: SAFE_INSET_PX,
          top: SAFE_INSET_PX + 48,
          width: MIN_MENU_WIDTH_PX,
          boxSizing: 'border-box'
        }
  );

  const close = () => onOpenChange(false);

  const portaledMenu =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            className="desk-actions-menu desk-os-menu-dropdown"
            style={menuStyle}
            role="menu"
            aria-label={menuAria ?? label}
            data-testid={`desk-os-menu-${id}`}
            {...overlayFocusHandlers(overlayId, open)}
          >
            {children(close)}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`desk-os-menu-trigger${open ? ' is-open' : ''}${highlight ? ' is-tour-highlight' : ''}`}
        data-menu={id}
        data-testid={`desk-os-menu-trigger-${id}`}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        title={title ?? label}
        onClick={() => onOpenChange(!open)}
        // The bar decides whether a hover switches menus — it only does so
        // while some menu is already down, so a pointer crossing the strip on
        // its way to the canvas never pops anything open.
        onPointerEnter={() => {
          if (!open && !disabled) onHoverOpen?.();
        }}
      >
        {emoji ? (
          <span className="desk-os-menu-trigger-emoji" aria-hidden="true">
            {emoji}
          </span>
        ) : null}
        <span className="desk-os-menu-trigger-label">{label}</span>
      </button>
      {portaledMenu}
    </>
  );
}

/**
 * One row in a menu-bar dropdown. Reuses `.desk-actions-item` so the OS menus
 * and the desk menus stay one visual family instead of two lookalike systems.
 *
 * @param {{
 *   emoji?: string,
 *   label: string,
 *   subtitle?: string | null,
 *   title?: string | null,
 *   badge?: string | null,
 *   tag?: string | null,
 *   current?: boolean,
 *   pressed?: boolean,
 *   disabled?: boolean,
 *   danger?: boolean,
 *   testId?: string,
 *   onSelect: () => void
 * }} props
 */
export function DeskOsMenuItem({
  emoji,
  label,
  subtitle = null,
  title = null,
  badge = null,
  tag = null,
  current = false,
  pressed = undefined,
  disabled = false,
  danger = false,
  testId,
  onSelect
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`desk-actions-item${danger ? ' is-demolish' : ''}${current ? ' is-current' : ''}`}
      disabled={disabled}
      title={title ?? label}
      aria-current={current ? 'true' : undefined}
      aria-pressed={pressed}
      data-testid={testId}
      onClick={onSelect}
    >
      {emoji ? (
        <span className="desk-actions-item-emoji" aria-hidden="true">
          {emoji}
        </span>
      ) : null}
      {subtitle ? (
        <span className="desk-actions-item-stack">
          <span className="desk-actions-item-label">{label}</span>
          <span className="desk-actions-item-subtitle">{subtitle}</span>
        </span>
      ) : (
        <span className="desk-actions-item-label">{label}</span>
      )}
      {tag ? (
        <span className="desk-drawer-current-tag" aria-hidden="true">
          {tag}
        </span>
      ) : null}
      {badge ? (
        <span className="desk-actions-item-badge" aria-hidden="true">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

/**
 * Labelled group inside a dropdown — the separator that stops a File menu from
 * reading as one undifferentiated list.
 *
 * @param {{ label?: string | null, children: import('react').ReactNode }} props
 */
export function DeskOsMenuSection({ label = null, children }) {
  return (
    <div className="desk-os-menu-section" role="group" aria-label={label ?? undefined}>
      {label ? <span className="desk-os-menu-section-label">{label}</span> : null}
      {children}
    </div>
  );
}
