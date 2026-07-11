import { useState } from 'react';
import AgentPresenceBar from './AgentPresenceBar.jsx';
import { ButtonIcon, BrainIcon } from './AppIcons.jsx';
import { CONTROLS_EN } from '../i18n/locales/controls.en.js';
import { buildContentModeOptions } from '../utils/renderModeAction.js';

const DEFAULT_CONTROLS = CONTROLS_EN.settings;
const DEFAULT_MODE_OPTIONS = buildContentModeOptions(CONTROLS_EN);

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
  contentModeOptions = DEFAULT_MODE_OPTIONS,
  controls = DEFAULT_CONTROLS,
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
          aria-label={effectiveOpen ? controls.hide : controls.show}
          title={controls.title}
        >
          <ButtonIcon>
            <span className="action-persona-icon is-settings" aria-hidden="true">
              ⚙️
            </span>
          </ButtonIcon>
          <span className="button-label">{controls.label}</span>
        </button>
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
          <div className="model-profile-toggle" role="group" aria-label={controls.brain}>
            <span className="model-profile-label model-profile-label--brain">
              <span className="model-profile-label-icon" aria-hidden="true">
                <BrainIcon />
              </span>
              {controls.brain}
            </span>
            <div className="model-profile-segment">
              <button
                type="button"
                className={`model-profile-option ${modelProfile === 'fast' ? 'is-selected' : ''}`}
                aria-pressed={modelProfile === 'fast'}
                onClick={() => onSelectModelProfile('fast')}
              >
                {controls.fast}
              </button>
              <button
                type="button"
                className={`model-profile-option ${modelProfile === 'quality' ? 'is-selected' : ''}`}
                aria-pressed={modelProfile === 'quality'}
                onClick={() => onSelectModelProfile('quality')}
              >
                {controls.quality}
              </button>
            </div>
          </div>
          <div className="model-profile-toggle" role="group" aria-label={controls.mode}>
            <span className="model-profile-label">{controls.mode}</span>
            <div className="model-profile-segment">
              {contentModeOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`model-profile-option ${contentMode === option.id ? 'is-selected' : ''}`}
                  aria-pressed={contentMode === option.id}
                  disabled={modeSwitchDisabled}
                  onClick={() => onSelectContentMode(option.id)}
                >
                  {option.shortLabel}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      {includeThinkingToggle ? (
        <button
          type="button"
          className={`overlay-button thinking-toggle-button ${agentThinkingChrome ? 'is-agent-active' : ''}${insightsOpen ? ' is-open' : ''}`}
          onClick={onToggleInsights}
          aria-label={insightsOpen ? `Hide ${controls.thinking}` : `Show ${controls.thinking}`}
          title={
            insightsOpen ? `Hide ${controls.thinking} panel` : `Show ${controls.thinking} panel`
          }
        >
          <ButtonIcon>
            <span className="action-persona-icon is-thinking" aria-hidden="true">
              🧠
            </span>
          </ButtonIcon>
          <span className="button-label">{controls.thinking}</span>
        </button>
      ) : null}
    </>
  );
}
