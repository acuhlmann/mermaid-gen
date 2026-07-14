import { useEffect, useRef, useState } from 'react';
import { ButtonIcon, RenderModeIcon } from './AppIcons.jsx';
import { useUiCopy } from '../i18n/useUiLocale.js';
import { formatLocale } from '../i18n/formatLocale.js';

const COLLAPSE_AFTER_MS = 6000;
const RENDER_MODE_EMOJI = '🔄';

/**
 * Bottom-row "Render as" dock: one icon opens a radial-style mode picker so
 * newcomers do not have to dig into Settings. Mirrors the circular menu's
 * render-mode tray (heading + mode rows) and StakeholdersMascot expand/collapse.
 */
export default function RenderAsMascot({ modes, currentMode, onPickMode, disabled = false }) {
  const { controls } = useUiCopy();
  const actions = controls.actions;
  const radial = controls.radial;
  const options = Array.isArray(modes) ? modes.filter((m) => m && m.id && m.label) : [];
  const currentOption = options.find((option) => option.id === currentMode) ?? null;

  const startExpanded = typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test';
  const [expanded, setExpanded] = useState(startExpanded);
  const wrapperRef = useRef(null);
  const collapseTimerRef = useRef(null);

  const armCollapseTimer = () => {
    if (collapseTimerRef.current != null) clearTimeout(collapseTimerRef.current);
    collapseTimerRef.current = setTimeout(() => setExpanded(false), COLLAPSE_AFTER_MS);
  };

  useEffect(() => {
    if (!expanded) {
      if (collapseTimerRef.current != null) {
        clearTimeout(collapseTimerRef.current);
        collapseTimerRef.current = null;
      }
      return undefined;
    }
    armCollapseTimer();
    const onDocPointer = (event) => {
      if (!wrapperRef.current?.contains(event.target)) {
        setExpanded(false);
      }
    };
    document.addEventListener('pointerdown', onDocPointer);
    return () => {
      document.removeEventListener('pointerdown', onDocPointer);
      if (collapseTimerRef.current != null) {
        clearTimeout(collapseTimerRef.current);
        collapseTimerRef.current = null;
      }
    };
  }, [expanded]);

  if (options.length === 0) return null;

  const mascotClass = [
    'overlay-button',
    'compact-button',
    'slop-action-button',
    'render-as-mascot',
    expanded ? 'is-expanded' : '',
    currentOption ? 'render-as-mascot--active' : ''
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={['render-as-mascot-wrap', expanded ? 'is-menu-expanded' : '']
        .filter(Boolean)
        .join(' ')}
      ref={wrapperRef}
    >
      {expanded ? (
        <div
          className="render-as-mascot-menu"
          role="dialog"
          aria-label={radial.renderAsHeading}
          onPointerEnter={armCollapseTimer}
          onPointerMove={armCollapseTimer}
        >
          <div className="radial-render-mode-head">
            <span className="radial-render-mode-eyebrow" aria-hidden="true">
              {RENDER_MODE_EMOJI}
            </span>
            <span className="radial-render-mode-heading">{radial.renderAsHeading}</span>
            <button
              type="button"
              className="radial-render-mode-close"
              onClick={() => setExpanded(false)}
              aria-label={radial.closeRenderPicker}
            >
              ×
            </button>
          </div>
          <div
            className="radial-render-mode-list"
            role="menu"
            aria-label={controls.contentModes.renderMenu}
          >
            {options.map((mode) => {
              const isCurrent = mode.id === currentMode;
              return (
                <button
                  key={mode.id}
                  type="button"
                  className={`radial-render-mode-row${isCurrent ? ' is-current' : ''}`}
                  disabled={disabled || isCurrent}
                  onClick={(event) => {
                    event.stopPropagation();
                    armCollapseTimer();
                    onPickMode?.(mode.id);
                    setExpanded(false);
                  }}
                  aria-label={
                    isCurrent
                      ? formatLocale(radial.currentModeIs, { mode: mode.label })
                      : formatLocale(radial.renderAs, { mode: mode.label })
                  }
                  title={
                    isCurrent
                      ? formatLocale(radial.currentModeActive, { mode: mode.label })
                      : formatLocale(radial.renderSelectionAs, { mode: mode.label })
                  }
                  data-mode-id={mode.id}
                >
                  <span className="radial-render-mode-row-icon" aria-hidden="true">
                    {mode.shortLabel}
                  </span>
                  <span className="radial-render-mode-row-text">
                    <span className="radial-render-mode-row-name">{mode.label}</span>
                    <span className="radial-render-mode-row-title">
                      {isCurrent ? radial.currentMode : mode.subtitle}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      <button
        type="button"
        className={mascotClass}
        aria-expanded={expanded}
        aria-haspopup="menu"
        disabled={disabled}
        aria-label={
          expanded
            ? radial.closeRenderPicker
            : formatLocale(controls.renderAsDock.openRenderAs, {
                mode: currentOption?.shortLabel ?? actions.renderMode
              })
        }
        title={
          expanded
            ? controls.renderAsDock.tapToHide
            : formatLocale(controls.renderAsDock.tapToOpen, {
                mode: currentOption?.shortLabel ?? actions.renderMode
              })
        }
        onClick={() => setExpanded((v) => !v)}
      >
        <ButtonIcon>
          <span className="action-persona-icon is-render-mode" aria-hidden="true">
            <RenderModeIcon />
          </span>
        </ButtonIcon>
        <span className="button-label">
          {expanded ? actions.renderMode : (currentOption?.shortLabel ?? actions.renderMode)}
        </span>
        <span className="slop-action-role render-as-mascot-role">
          <span className="slop-action-role-emoji" aria-hidden="true">
            {RENDER_MODE_EMOJI}
          </span>
          {expanded ? controls.renderAsDock.pickMode : actions.renderModePersona}
        </span>
      </button>
    </div>
  );
}
