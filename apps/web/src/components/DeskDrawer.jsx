import { useEffect, useRef, useState } from 'react';
import { ButtonIcon } from './AppIcons.jsx';
import { useUiCopy } from '../i18n/useUiLocale.js';

const DRAWER_EMOJI = '🗄️';

/**
 * The desk drawer: the secondary controls the app no longer keeps out on the
 * desk (Deliverable format, Fix, Demolish, Focus Time) collapse into one grouped
 * office drawer so the always-visible surface stays the Work Order + Your Team.
 * One pill opens a menu (mirrors DeskActionsDock's open / outside-click pattern);
 * the format section reuses the mode options, the desk section the loose verbs.
 *
 * Behavior-only props — App owns the handlers; copy comes from the locale bundle.
 */
export default function DeskDrawer({
  modes,
  currentMode,
  onPickMode,
  isMuted = false,
  onToggleMute,
  canFix = false,
  fixDisabled = false,
  onFix,
  onDemolish,
  busy = false,
  modeDisabled = false
}) {
  const { controls } = useUiCopy();
  const actions = controls.actions;
  const drawer = controls.deskDrawer ?? {};
  const modeOptions = Array.isArray(modes) ? modes.filter((m) => m && m.id && m.label) : [];

  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const runAndClose = (fn) => {
    setOpen(false);
    void fn?.();
  };

  const buttonClass = ['overlay-button', 'compact-button', 'slop-action-button', 'is-desk-drawer']
    .filter(Boolean)
    .join(' ');

  return (
    <div className="desk-drawer" ref={rootRef}>
      <button
        type="button"
        className={`${buttonClass}${open ? ' is-expanded' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={
          open ? (drawer.close ?? drawer.label ?? 'Desk drawer') : (drawer.label ?? 'Desk drawer')
        }
        title={drawer.title ?? drawer.label ?? 'Desk drawer'}
        onClick={() => setOpen((v) => !v)}
      >
        <ButtonIcon>
          <span className="action-persona-icon is-desk-drawer" aria-hidden="true">
            {DRAWER_EMOJI}
          </span>
        </ButtonIcon>
        <span className="button-label">{drawer.label ?? 'Desk drawer'}</span>
        <span className="slop-action-role">
          <span className="slop-action-role-emoji" aria-hidden="true">
            {DRAWER_EMOJI}
          </span>
          {drawer.roleTag ?? 'Supply Closet'}
        </span>
      </button>
      {open ? (
        <div
          className="desk-actions-menu desk-drawer-menu"
          role="menu"
          aria-label={drawer.menuAria ?? drawer.label ?? 'Desk drawer'}
        >
          {modeOptions.length > 0 ? (
            <>
              <p className="desk-actions-heading">
                {drawer.formatHeading ?? controls.contentModes?.renderMenu ?? 'Deliverable format'}
              </p>
              {modeOptions.map((mode) => {
                const isCurrent = mode.id === currentMode;
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
                    <span className="desk-actions-item-emoji" aria-hidden="true">
                      {mode.shortLabel ?? mode.label}
                    </span>
                    <span className="desk-actions-item-label">{mode.label}</span>
                    {isCurrent ? (
                      <span className="desk-drawer-current-tag" aria-hidden="true">
                        {controls.radial?.currentMode ?? 'Current'}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </>
          ) : null}
          <p className="desk-actions-heading">{drawer.deskHeading ?? 'Desk'}</p>
          <button
            type="button"
            role="menuitem"
            className="desk-actions-item"
            aria-pressed={isMuted}
            title={isMuted ? actions.unmuteTitle : actions.muteTitle}
            onClick={() => runAndClose(onToggleMute)}
          >
            <span className="desk-actions-item-emoji" aria-hidden="true">
              {isMuted ? '🔇' : '🔊'}
            </span>
            <span className="desk-actions-item-label">
              {isMuted ? actions.unmute : actions.mute}
            </span>
          </button>
          {canFix ? (
            <button
              type="button"
              role="menuitem"
              className="desk-actions-item"
              disabled={busy || fixDisabled}
              title={actions.fixTitle}
              onClick={() => runAndClose(onFix)}
            >
              <span className="desk-actions-item-emoji" aria-hidden="true">
                🛠️
              </span>
              <span className="desk-actions-item-label">{actions.fix}</span>
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
              🧨
            </span>
            <span className="desk-actions-item-label">{actions.demolish ?? actions.clear}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
