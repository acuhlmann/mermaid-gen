import { useId, useState } from 'react';
import AgentPresenceBar from './AgentPresenceBar.jsx';
import { ButtonIcon, BrainIcon } from './AppIcons.jsx';
import { CONTROLS_EN } from '../i18n/locales/controls.en.js';
import { formatLocale } from '../i18n/formatLocale.js';
import { exportDiagram, listExportFormats } from '../utils/exportDiagram.js';

const DEFAULT_CONTROLS = CONTROLS_EN.settings;

/**
 * Right-cluster of the bottom row: emoji-style Settings (⚙️) and Thinking (🧠)
 * toggles. The Settings panel renders as a floating popover above the gear
 * when `popoverMode` is true (default, desktop) and inline as a flex sibling
 * when false (narrow viewports keep the existing stacked layout). A pending
 * handshake force-opens the panel inline regardless of mode so the user can't
 * accidentally dismiss it by clicking off-canvas.
 */
export function AiCornerControlsInner({
  controls = DEFAULT_CONTROLS,
  insightsCopy = CONTROLS_EN.insights,
  modelProfile,
  onSelectModelProfile,
  pendingHandshake,
  externalAgentPresence,
  onInviteAgent,
  agentThinkingChrome,
  insightsOpen,
  onToggleInsights,
  includeThinkingToggle = true,
  popoverMode = true,
  contentType = null,
  diagramSource = ''
}) {
  const startExpanded = typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test';
  const [settingsOpen, setSettingsOpen] = useState(startExpanded);
  const [exportOpen, setExportOpen] = useState(startExpanded);
  const [exportBusyId, setExportBusyId] = useState(null);
  const [exportError, setExportError] = useState(null);
  const exportListId = useId();
  const effectiveOpen = settingsOpen || Boolean(pendingHandshake);
  const renderAsPopover = popoverMode && !pendingHandshake;
  const panelClass = renderAsPopover
    ? 'ai-corner-settings-panel bottom-row-popover bottom-row-popover--settings'
    : 'ai-corner-settings-panel';
  const hasSource = Boolean((diagramSource ?? '').trim());
  const exportFormats = hasSource ? listExportFormats(contentType, diagramSource) : [];

  async function handleExport(formatId) {
    if (!hasSource || exportBusyId) return;
    setExportError(null);
    setExportBusyId(formatId);
    try {
      await exportDiagram({ contentType, diagramSource, formatId });
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : (controls.exportFailed ?? 'Export failed')
      );
    } finally {
      setExportBusyId(null);
    }
  }

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
          <div className="settings-export" role="group" aria-label={controls.export}>
            <button
              type="button"
              className={`settings-export-toggle${exportOpen ? ' is-open' : ''}`}
              aria-expanded={exportOpen}
              aria-controls={exportListId}
              disabled={!hasSource || exportFormats.length === 0}
              onClick={() => setExportOpen((v) => !v)}
            >
              <span className="settings-export-toggle-label">{controls.export}</span>
              <span className="settings-export-chevron" aria-hidden="true">
                {exportOpen ? '▴' : '▾'}
              </span>
            </button>
            {!hasSource ? <p className="settings-export-empty">{controls.exportEmpty}</p> : null}
            {hasSource && exportOpen ? (
              <ul id={exportListId} className="settings-export-list" role="list">
                {exportFormats.map((format) => (
                  <li key={format.id}>
                    <button
                      type="button"
                      className="settings-export-option"
                      disabled={Boolean(exportBusyId)}
                      aria-busy={exportBusyId === format.id}
                      onClick={() => handleExport(format.id)}
                    >
                      {exportBusyId === format.id
                        ? (controls.exportWorking ?? 'Exporting…')
                        : (controls[format.labelKey] ?? format.id)}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {exportError ? (
              <p className="settings-export-error" role="alert">
                {exportError}
              </p>
            ) : null}
          </div>
        </div>
      </div>
      {includeThinkingToggle ? (
        <button
          type="button"
          className={`overlay-button thinking-toggle-button ${agentThinkingChrome ? 'is-agent-active' : ''}${insightsOpen ? ' is-open' : ''}`}
          onClick={onToggleInsights}
          aria-label={
            insightsOpen
              ? formatLocale(insightsCopy.hideThinking ?? 'Hide {thinking}', {
                  thinking: controls.thinking
                })
              : formatLocale(insightsCopy.showThinking ?? 'Show {thinking}', {
                  thinking: controls.thinking
                })
          }
          title={
            insightsOpen
              ? formatLocale(insightsCopy.hideThinkingPanel ?? 'Hide {thinking} panel', {
                  thinking: controls.thinking
                })
              : formatLocale(insightsCopy.showThinkingPanel ?? 'Show {thinking} panel', {
                  thinking: controls.thinking
                })
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
