import { useState } from 'react';
import AgentPresenceBar from './AgentPresenceBar.jsx';
import { ButtonIcon, BrainIcon } from './AppIcons.jsx';

/**
 * Right-cluster of the bottom row: emoji-style Settings (⚙️) and Thinking (🧠)
 * toggles. The Settings panel renders as a floating popover above the gear
 * when `popoverMode` is true (default, desktop) and inline as a flex sibling
 * when false (narrow viewports keep the existing stacked layout). A pending
 * handshake force-opens the panel inline regardless of mode so the user can't
 * accidentally dismiss it by clicking off-canvas.
 */
export function AiCornerControlsInner({
  contentMode,
  onSelectContentMode,
  modelProfile,
  onSelectModelProfile,
  modeSwitchDisabled,
  pendingHandshake,
  externalAgentPresence,
  onInviteAgent,
  agentThinkingChrome,
  insightsOpen,
  onToggleInsights,
  includeThinkingToggle = true,
  popoverMode = true
}) {
  const startExpanded = typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test';
  const [settingsOpen, setSettingsOpen] = useState(startExpanded);
  const effectiveOpen = settingsOpen || Boolean(pendingHandshake);
  // Force inline when a handshake forces the panel open — popovers are
  // designed to dismiss easily, which is exactly wrong for a sticky
  // attention-demanding event.
  const renderAsPopover = popoverMode && !pendingHandshake;
  const panelClass = renderAsPopover
    ? 'ai-corner-settings-panel bottom-row-popover bottom-row-popover--settings'
    : 'ai-corner-settings-panel';
  return (
    <>
      <div className="ai-corner-settings-anchor">
        <button
          type="button"
          className={`overlay-button ai-corner-settings-toggle${effectiveOpen ? ' is-open' : ''}${pendingHandshake ? ' has-pending' : ''}`}
          onClick={() => setSettingsOpen((v) => !v)}
          aria-expanded={effectiveOpen}
          aria-controls="ai-corner-settings-panel"
          aria-label={effectiveOpen ? 'Hide settings' : 'Show settings'}
          title={effectiveOpen ? 'Hide settings' : 'Settings · invite agent, mode, brain'}
        >
          <ButtonIcon>
            <span className="action-persona-icon is-settings" aria-hidden="true">⚙️</span>
          </ButtonIcon>
          <span className="button-label">Settings</span>
        </button>
        <div
          id="ai-corner-settings-panel"
          className={`${panelClass}${effectiveOpen ? ' is-open' : ''}`}
          role="region"
          aria-label="Session settings"
          hidden={!effectiveOpen}
        >
          <div className="model-profile-toggle agent-collab-toggle" role="group" aria-label="External agents">
            <span className="model-profile-label">Invite agent</span>
            <div className="agent-collab-segment">
              {pendingHandshake ? (
                <span className="agent-handshake-waiting" role="status">
                  Waiting for handshake: {pendingHandshake.proposedName ?? 'External agent'}
                </span>
              ) : null}
              <AgentPresenceBar presence={externalAgentPresence} onInvite={onInviteAgent} />
            </div>
          </div>
          <div className="model-profile-toggle" role="group" aria-label="Content mode">
            <span className="model-profile-label">Mode</span>
            <div className="model-profile-segment">
              <button
                type="button"
                className={`model-profile-option ${contentMode === 'mermaid' ? 'is-selected' : ''}`}
                aria-pressed={contentMode === 'mermaid'}
                disabled={modeSwitchDisabled}
                onClick={() => onSelectContentMode('mermaid')}
              >
                Diagram
              </button>
              <button
                type="button"
                className={`model-profile-option ${contentMode === 'infographic' ? 'is-selected' : ''}`}
                aria-pressed={contentMode === 'infographic'}
                disabled={modeSwitchDisabled}
                onClick={() => onSelectContentMode('infographic')}
              >
                Infographic
              </button>
              <button
                type="button"
                className={`model-profile-option ${contentMode === 'metaphor3d' ? 'is-selected' : ''}`}
                aria-pressed={contentMode === 'metaphor3d'}
                disabled={modeSwitchDisabled}
                onClick={() => onSelectContentMode('metaphor3d')}
              >
                3D
              </button>
              <button
                type="button"
                className={`model-profile-option ${contentMode === 'chart' ? 'is-selected' : ''}`}
                aria-pressed={contentMode === 'chart'}
                disabled={modeSwitchDisabled}
                onClick={() => onSelectContentMode('chart')}
              >
                Chart
              </button>
            </div>
          </div>
          <div className="model-profile-toggle" role="group" aria-label="AI brain">
            <span className="model-profile-label model-profile-label--brain">
              <span className="model-profile-label-icon" aria-hidden="true">
                <BrainIcon />
              </span>
              Brain
            </span>
            <div className="model-profile-segment">
              <button
                type="button"
                className={`model-profile-option ${modelProfile === 'fast' ? 'is-selected' : ''}`}
                aria-pressed={modelProfile === 'fast'}
                onClick={() => onSelectModelProfile('fast')}
              >
                Fast
              </button>
              <button
                type="button"
                className={`model-profile-option ${modelProfile === 'quality' ? 'is-selected' : ''}`}
                aria-pressed={modelProfile === 'quality'}
                onClick={() => onSelectModelProfile('quality')}
              >
                Quality
              </button>
            </div>
          </div>
        </div>
      </div>
      {includeThinkingToggle ? (
        <button
          type="button"
          className={`overlay-button thinking-toggle-button ${agentThinkingChrome ? 'is-agent-active' : ''}${insightsOpen ? ' is-open' : ''}`}
          onClick={onToggleInsights}
          aria-label={insightsOpen ? 'Hide Thinking' : 'Show Thinking'}
          title={insightsOpen ? 'Hide Thinking panel' : 'Show Thinking panel'}
        >
          <ButtonIcon>
            <span className="action-persona-icon is-thinking" aria-hidden="true">🧠</span>
          </ButtonIcon>
          <span className="button-label">Thinking</span>
        </button>
      ) : null}
    </>
  );
}
