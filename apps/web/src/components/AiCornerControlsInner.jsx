import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import AgentPresenceBar from './AgentPresenceBar.jsx';
import OutboxDock from './OutboxDock.jsx';
import { CONTROLS_EN } from '../i18n/locales/controls.en.js';
import {
  overlayFocusHandlers,
  overlayLayerStyle,
  useOverlayLayer
} from '../hooks/useOverlayLayer.js';

const DEFAULT_CONTROLS = CONTROLS_EN.settings;
const POPOVER_GAP_PX = 9;

/**
 * @param {DOMRect} anchorRect
 * @returns {import('react').CSSProperties}
 */
function computePortaledSettingsStyle(anchorRect) {
  const viewportWidth = window.innerWidth;
  const maxWidth = Math.min(352, viewportWidth - 32);
  const right = Math.max(8, viewportWidth - anchorRect.right);

  return {
    position: 'fixed',
    right,
    left: 'auto',
    bottom: window.innerHeight - anchorRect.top + POPOVER_GAP_PX,
    top: 'auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '0.42rem',
    width: 'max-content',
    minWidth: 0,
    maxWidth,
    boxSizing: 'border-box'
  };
}

/**
 * Right-cluster of the bottom row: Outbox + Settings panels live here as
 * headless chrome opened from desk verbs (and force-opened for a pending
 * handshake). Concentration lives on the Work Order footer and Thinking header;
 * the notebook icon toggles Thinking from the bottom chrome. The Settings panel renders as a floating
 * popover when `popoverMode` is true (desktop) and inline when false. A pending
 * handshake force-opens the panel inline regardless of mode so the user can't
 * accidentally dismiss it.
 */
export function AiCornerControlsInner({
  controls = DEFAULT_CONTROLS,
  pendingHandshake,
  externalAgentPresence,
  onInviteAgent,
  popoverMode = true,
  contentType = null,
  diagramSource = '',
  editorOpen = false,
  onToggleEditor,
  editorControls = null,
  showEditorToggle = false,
  settingsOpenSignal = 0,
  outboxOpenSignal = 0
}) {
  const startExpanded = typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test';
  const [settingsOpen, setSettingsOpen] = useState(startExpanded);
  const anchorRef = useRef(null);
  const [anchorRect, setAnchorRect] = useState(/** @type {DOMRect | null} */ (null));
  const effectiveOpen = settingsOpen || Boolean(pendingHandshake);
  const renderAsPopover = popoverMode && !pendingHandshake;
  const settingsZIndex = useOverlayLayer('ai-corner-settings', effectiveOpen && renderAsPopover);
  const panelClass = renderAsPopover
    ? 'ai-corner-settings-panel bottom-row-popover bottom-row-popover--settings ai-corner-settings-panel--portaled'
    : 'ai-corner-settings-panel';

  useEffect(() => {
    if (settingsOpenSignal > 0) setSettingsOpen(true);
  }, [settingsOpenSignal]);

  useLayoutEffect(() => {
    if (!effectiveOpen || !renderAsPopover) {
      setAnchorRect(null);
      return undefined;
    }
    const measure = () => {
      const node = anchorRef.current;
      if (!node) return;
      setAnchorRect(node.getBoundingClientRect());
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (anchorRef.current) ro?.observe(anchorRef.current);
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
  }, [effectiveOpen, renderAsPopover]);

  const panelNode = (
    <div
      id="ai-corner-settings-panel"
      className={`${panelClass}${effectiveOpen ? ' is-open' : ''}`}
      style={overlayLayerStyle(
        settingsZIndex,
        renderAsPopover && anchorRect ? computePortaledSettingsStyle(anchorRect) : undefined
      )}
      role="region"
      aria-label={controls.region}
      hidden={!effectiveOpen}
      {...overlayFocusHandlers('ai-corner-settings', effectiveOpen && renderAsPopover)}
    >
      <div
        className="model-profile-toggle agent-collab-toggle"
        role="group"
        aria-label={controls.externalAgents}
      >
        <div className="agent-collab-segment">
          {pendingHandshake ? (
            <span className="agent-handshake-waiting" role="status">
              {controls.waitingHandshake}{' '}
              {pendingHandshake.proposedName ?? controls.externalAgentFallback}
            </span>
          ) : null}
          <AgentPresenceBar presence={externalAgentPresence} onInvite={onInviteAgent} />
        </div>
      </div>
      {showEditorToggle && editorControls ? (
        <div className="settings-editor-toggle" role="group" aria-label={editorControls.code}>
          <button
            type="button"
            className={`settings-editor-button${editorOpen ? ' is-open' : ''}`}
            aria-pressed={editorOpen}
            onClick={onToggleEditor}
          >
            <span className="settings-editor-button-icon" aria-hidden="true">
              {'</>'}
            </span>
            <span className="settings-editor-button-label">
              {editorOpen ? editorControls.close : editorControls.code}
            </span>
          </button>
        </div>
      ) : null}
      {effectiveOpen && !pendingHandshake ? (
        <button
          type="button"
          className="ai-corner-settings-dismiss"
          onClick={() => setSettingsOpen(false)}
          aria-label={controls.hide}
        >
          {controls.hide}
        </button>
      ) : null}
    </div>
  );

  const portaledPanel =
    renderAsPopover && effectiveOpen && typeof document !== 'undefined'
      ? createPortal(panelNode, document.body)
      : null;

  return (
    <>
      {(diagramSource ?? '').trim() ? (
        <OutboxDock
          controls={controls}
          contentType={contentType}
          diagramSource={diagramSource}
          popoverMode={popoverMode}
          showTrigger={false}
          openSignal={outboxOpenSignal}
        />
      ) : null}
      <div
        ref={anchorRef}
        className="ai-corner-settings-anchor ai-corner-settings-anchor--headless"
      >
        {renderAsPopover ? portaledPanel : panelNode}
      </div>
    </>
  );
}
