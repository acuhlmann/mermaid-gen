import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import OutboxDock from './OutboxDock.jsx';
import { useUiCopy } from '../i18n/useUiLocale.js';

function FullscreenCloseIcon() {
  return (
    <svg
      className="diagram-fullscreen-close-icon"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 6l12 12M18 6 6 18"
      />
    </svg>
  );
}

/**
 * Top-right fullscreen chrome: mailroom export + exit, portaled into
 * `.diagram-output` as one flex cluster so the controls cannot drift apart or
 * collide with metaphor3d title cards on the left.
 */
export default function DiagramFullscreenToolbar({
  isFullscreen,
  host,
  hasSource,
  contentType = null,
  diagramSource = '',
  onExit
}) {
  const { controls } = useUiCopy();
  const settings = controls.settings ?? {};
  const [panelOpen, setPanelOpen] = useState(false);
  const outboxLabel = settings.outboxLabel ?? 'Mailroom';

  useEffect(() => {
    if (!isFullscreen) setPanelOpen(false);
  }, [isFullscreen]);

  if (!isFullscreen || !host) return null;

  return createPortal(
    <div className="diagram-fullscreen-toolbar" onPointerDown={(event) => event.stopPropagation()}>
      {hasSource ? (
        <div className="diagram-fullscreen-mailroom-anchor">
          <button
            type="button"
            className={`diagram-fullscreen-mailroom-btn${panelOpen ? ' is-open' : ''}`}
            title={settings.outboxTitle ?? outboxLabel}
            aria-label={
              panelOpen
                ? (settings.outboxHide ?? outboxLabel)
                : (settings.outboxShow ?? outboxLabel)
            }
            aria-expanded={panelOpen}
            aria-controls="diagram-fullscreen-mailroom-panel"
            onClick={() => setPanelOpen((open) => !open)}
          >
            <span className="diagram-fullscreen-mailroom-icon" aria-hidden="true">
              📤
            </span>
          </button>
          {panelOpen ? (
            <div
              id="diagram-fullscreen-mailroom-panel"
              className="diagram-fullscreen-mailroom-panel"
              role="dialog"
              aria-label={settings.outboxRegion ?? outboxLabel}
            >
              <div className="diagram-fullscreen-mailroom-panel-inner desk-os-mailroom">
                <div className="desk-os-mailroom-header" aria-hidden="true">
                  <span className="desk-os-mailroom-stamp">📮</span>
                  <span className="desk-os-mailroom-counter">
                    {settings.outboxCounter ?? 'Window 3 · Outgoing'}
                  </span>
                </div>
                <OutboxDock
                  embedded
                  controls={settings}
                  contentType={contentType}
                  diagramSource={diagramSource}
                  popoverMode={false}
                  showTrigger={false}
                />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      <button
        type="button"
        className="diagram-fullscreen-close"
        title={controls.fullscreen.exit}
        aria-label={controls.fullscreen.exit}
        onClick={() => onExit?.()}
      >
        <FullscreenCloseIcon />
      </button>
    </div>,
    host
  );
}
