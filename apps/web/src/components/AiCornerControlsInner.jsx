import { useEffect, useState } from 'react';
import AgentPresenceBar from './AgentPresenceBar.jsx';
import OutboxDock from './OutboxDock.jsx';
import { CONTROLS_EN } from '../i18n/locales/controls.en.js';

const DEFAULT_CONTROLS = CONTROLS_EN.settings;

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
  const effectiveOpen = settingsOpen || Boolean(pendingHandshake);
  const renderAsPopover = popoverMode && !pendingHandshake;
  const panelClass = renderAsPopover
    ? 'ai-corner-settings-panel bottom-row-popover bottom-row-popover--settings'
    : 'ai-corner-settings-panel';

  useEffect(() => {
    if (settingsOpenSignal > 0) setSettingsOpen(true);
  }, [settingsOpenSignal]);

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
      <div className="ai-corner-settings-anchor ai-corner-settings-anchor--headless">
        <div
          id="ai-corner-settings-panel"
          className={`${panelClass}${effectiveOpen ? ' is-open' : ''}`}
          role="region"
          aria-label={controls.region}
          hidden={!effectiveOpen}
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
      </div>
    </>
  );
}
