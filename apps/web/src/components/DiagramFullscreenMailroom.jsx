import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import OutboxDock from './OutboxDock.jsx';
import { useUiCopy } from '../i18n/useUiLocale.js';

/**
 * Mailroom export affordance while the canvas is in native fullscreen.
 *
 * Native fullscreen paints only the fullscreen element's subtree, so the menu
 * bar's Mailroom menu vanishes with the rest of the shell chrome. This portals a
 * compact trigger and the embedded export panel into `.diagram-output`, beside
 * the exit button that `DiagramFullscreenOverlay` already provides.
 *
 * @param {{
 *   isFullscreen: boolean,
 *   host: HTMLElement | null,
 *   hasSource: boolean,
 *   contentType: string | null,
 *   diagramSource: string
 * }} props
 */
export default function DiagramFullscreenMailroom({
  isFullscreen,
  host,
  hasSource,
  contentType = null,
  diagramSource = ''
}) {
  const { controls } = useUiCopy();
  const settings = controls.settings ?? {};
  const [panelOpen, setPanelOpen] = useState(false);
  const outboxLabel = settings.outboxLabel ?? 'Mailroom';

  useEffect(() => {
    if (!isFullscreen) setPanelOpen(false);
  }, [isFullscreen]);

  if (!isFullscreen || !host || !hasSource) return null;

  return createPortal(
    <>
      <button
        type="button"
        className={`diagram-fullscreen-mailroom-btn${panelOpen ? ' is-open' : ''}`}
        title={settings.outboxTitle ?? outboxLabel}
        aria-label={
          panelOpen ? (settings.outboxHide ?? outboxLabel) : (settings.outboxShow ?? outboxLabel)
        }
        aria-expanded={panelOpen}
        aria-controls="diagram-fullscreen-mailroom-panel"
        onPointerDown={(event) => event.stopPropagation()}
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
          onPointerDown={(event) => event.stopPropagation()}
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
    </>,
    host
  );
}
