import { useEffect, useId, useMemo, useRef, useState } from 'react';
import AgentPresenceBar from './AgentPresenceBar.jsx';
import { ButtonIcon, BrainIcon } from './AppIcons.jsx';
import { CONTROLS_EN } from '../i18n/locales/controls.en.js';
import { formatLocale } from '../i18n/formatLocale.js';
import {
  EXPORT_PREVIEW_URL_TTL_MS,
  buildExportPayload,
  canCopyExportPayload,
  canShareExportPayload,
  deliverExportPayload,
  isExportUserAbortError,
  isShareUserGestureError,
  isWebShareAvailable,
  listExportFormats,
  startWebShare
} from '../utils/exportDiagram.js';

const DEFAULT_CONTROLS = CONTROLS_EN.settings;
const COPY_TOAST_TTL_MS = 2000;

/**
 * Brief auto-dismiss feedback for copy/share; download keeps the fuller panel.
 * @param {import('../utils/exportDiagram.js').ExportDeliveryMethod} method
 * @returns {boolean}
 */
function isQuickToastMethod(method) {
  return method !== 'download';
}

/**
 * @typedef {import('../utils/exportDiagram.js').ExportDeliveryResult} ExportDeliveryResult
 */

/**
 * Right-cluster of the bottom row: emoji-style Settings (⚙️) and Thinking (🧠)
 * toggles. The Settings panel renders as a floating popover below the gear
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
  const [exportFeedback, setExportFeedback] = useState(
    /** @type {ExportDeliveryResult | null} */ (null)
  );
  const previewRevokeTimerRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));
  const previewUrlRef = useRef(/** @type {string | null} */ (null));
  const copyToastTimerRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));
  /** @type {import('react').MutableRefObject<Map<string, { payload?: import('../utils/exportDiagram.js').ExportPayload, promise?: Promise<import('../utils/exportDiagram.js').ExportPayload> }>>} */
  const exportPayloadCacheRef = useRef(new Map());
  const [exportReadyIds, setExportReadyIds] = useState(() => new Set());
  const exportListId = useId();
  const effectiveOpen = settingsOpen || Boolean(pendingHandshake);
  const renderAsPopover = popoverMode && !pendingHandshake;
  const panelClass = renderAsPopover
    ? 'ai-corner-settings-panel bottom-row-popover bottom-row-popover--settings'
    : 'ai-corner-settings-panel';
  const hasSource = Boolean((diagramSource ?? '').trim());
  const exportFormats = useMemo(
    () => (hasSource ? listExportFormats(contentType, diagramSource) : []),
    [hasSource, contentType, diagramSource]
  );
  const shareAvailable = isWebShareAvailable();

  function revokePreviewUrl() {
    if (previewRevokeTimerRef.current) {
      clearTimeout(previewRevokeTimerRef.current);
      previewRevokeTimerRef.current = null;
    }
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }

  function schedulePreviewRevoke(url) {
    revokePreviewUrl();
    previewUrlRef.current = url;
    previewRevokeTimerRef.current = setTimeout(() => {
      if (previewUrlRef.current === url) {
        URL.revokeObjectURL(url);
        previewUrlRef.current = null;
      }
      previewRevokeTimerRef.current = null;
      setExportFeedback((prev) =>
        prev?.previewUrl === url ? { ...prev, previewUrl: null } : prev
      );
    }, EXPORT_PREVIEW_URL_TTL_MS);
  }

  function clearCopyToastTimer() {
    if (copyToastTimerRef.current) {
      clearTimeout(copyToastTimerRef.current);
      copyToastTimerRef.current = null;
    }
  }

  function scheduleCopyToastDismiss() {
    clearCopyToastTimer();
    copyToastTimerRef.current = setTimeout(() => {
      dismissExportFeedback();
      copyToastTimerRef.current = null;
    }, COPY_TOAST_TTL_MS);
  }

  useEffect(
    () => () => {
      revokePreviewUrl();
      clearCopyToastTimer();
    },
    []
  );

  useEffect(() => {
    exportPayloadCacheRef.current.clear();
    setExportReadyIds(new Set());
    if (!exportOpen || !hasSource || exportFormats.length === 0) {
      return undefined;
    }
    let cancelled = false;
    for (const format of exportFormats) {
      const promise = buildExportPayload({
        contentType,
        diagramSource,
        formatId: format.id
      })
        .then((payload) => {
          if (!cancelled) {
            exportPayloadCacheRef.current.set(format.id, { payload, promise });
            setExportReadyIds((prev) => new Set(prev).add(format.id));
          }
          return payload;
        })
        .catch(() => {
          if (!cancelled) {
            exportPayloadCacheRef.current.delete(format.id);
            setExportReadyIds((prev) => {
              const next = new Set(prev);
              next.delete(format.id);
              return next;
            });
          }
        });
      exportPayloadCacheRef.current.set(format.id, { promise });
    }
    return () => {
      cancelled = true;
      exportPayloadCacheRef.current.clear();
    };
  }, [exportOpen, hasSource, contentType, diagramSource, exportFormats]);

  function getCachedExportPayload(formatId) {
    return exportPayloadCacheRef.current.get(formatId)?.payload ?? null;
  }

  function isExportPayloadReady(formatId) {
    return exportReadyIds.has(formatId);
  }

  /**
   * @param {import('../utils/exportDiagram.js').ExportPayload} payload
   * @param {string} formatId
   * @param {import('../utils/exportDiagram.js').ExportDeliveryMethod} method
   */
  function applyExportSuccess(payload, formatId, method) {
    revokePreviewUrl();
    setExportFeedback({
      method,
      filename: payload.filename,
      previewUrl: null,
      payload,
      formatId
    });
    if (isQuickToastMethod(method)) {
      scheduleCopyToastDismiss();
    }
  }

  /**
   * @param {unknown} err
   * @param {'share' | 'export'} context
   */
  function handleExportFailure(err, context) {
    if (isExportUserAbortError(err)) return;
    if (context === 'share' && isShareUserGestureError(err)) {
      setExportError(
        controls.exportShareGesture ??
          'Share expired — expand Export, wait a moment, then tap Share again.'
      );
      return;
    }
    setExportError(err instanceof Error ? err.message : (controls.exportFailed ?? 'Export failed'));
  }

  /**
   * @param {string} formatId
   * @param {'download' | 'copy' | 'share'} action
   */
  async function handleExport(formatId, action) {
    if (!hasSource || exportBusyId) return;
    setExportError(null);
    setExportBusyId(formatId);
    try {
      const cached = getCachedExportPayload(formatId);
      const payload =
        cached ?? (await buildExportPayload({ contentType, diagramSource, formatId }));
      if (!cached) {
        exportPayloadCacheRef.current.set(formatId, { payload });
        setExportReadyIds((prev) => new Set(prev).add(formatId));
      }
      const result = await deliverExportPayload(payload, action);
      revokePreviewUrl();
      if (result.previewUrl) {
        schedulePreviewRevoke(result.previewUrl);
      }
      setExportFeedback({ ...result, formatId });
      if (isQuickToastMethod(result.method)) {
        scheduleCopyToastDismiss();
      }
    } catch (err) {
      handleExportFailure(err, 'export');
    } finally {
      setExportBusyId(null);
    }
  }

  /**
   * Web Share must run in the same turn as the click — use a pre-warmed payload.
   * @param {string} formatId
   * @param {import('../utils/exportDiagram.js').ExportPayload} [payloadOverride]
   */
  function handleShare(formatId, payloadOverride) {
    if (!hasSource || exportBusyId) return;
    const payload = payloadOverride ?? getCachedExportPayload(formatId);
    if (!payload) {
      setExportError(
        controls.exportSharePreparing ??
          'Still preparing export — wait a moment, then tap Share again.'
      );
      return;
    }
    setExportError(null);
    setExportBusyId(formatId);
    let sharePromise;
    try {
      sharePromise = startWebShare(payload);
    } catch (err) {
      handleExportFailure(err, 'share');
      setExportBusyId(null);
      return;
    }
    void sharePromise
      .then((method) => {
        applyExportSuccess(payload, formatId, method);
      })
      .catch((err) => {
        handleExportFailure(err, 'share');
      })
      .finally(() => {
        setExportBusyId(null);
      });
  }

  function dismissExportFeedback() {
    clearCopyToastTimer();
    revokePreviewUrl();
    setExportFeedback(null);
  }

  function exportSuccessMessage(method) {
    switch (method) {
      case 'download':
        return controls.exportSaved ?? 'Saved to your device';
      case 'share-file':
      case 'share-text':
        return controls.exportShared ?? 'Shared';
      case 'clipboard-text':
        return controls.exportCopiedText ?? 'Copied to clipboard';
      case 'clipboard-image':
        return controls.exportCopiedImage ?? 'Copied image to clipboard';
      default:
        return controls.exportSaved ?? 'Saved to your device';
    }
  }

  const showDownloadHint =
    exportFeedback?.method === 'download' &&
    typeof window !== 'undefined' &&
    window.matchMedia?.('(pointer: coarse)')?.matches;

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
                {exportFormats.map((format) => {
                  const busy = exportBusyId === format.id;
                  const label = controls[format.labelKey] ?? format.id;
                  const payloadPreview = { delivery: format.delivery ?? 'text', mime: format.mime };
                  const delivery = format.delivery ?? 'text';
                  const canCopy =
                    delivery === 'text'
                      ? canCopyExportPayload({
                          delivery: 'text',
                          mime: format.mime,
                          body: 'x',
                          filename: 'preview',
                          ext: format.ext
                        })
                      : Boolean(
                          (typeof navigator !== 'undefined' &&
                            navigator.clipboard?.write &&
                            typeof ClipboardItem !== 'undefined') ||
                          shareAvailable
                        );
                  const canShare = shareAvailable;
                  return (
                    <li key={format.id} className="settings-export-item">
                      <span className="settings-export-format-label">{label}</span>
                      <div
                        className="settings-export-row-actions"
                        role="group"
                        aria-label={formatLocale(
                          controls.exportActionsFor ?? 'Actions for {label}',
                          {
                            label
                          }
                        )}
                      >
                        <button
                          type="button"
                          className="settings-export-action"
                          disabled={Boolean(exportBusyId)}
                          aria-busy={busy}
                          title={controls.exportSave ?? 'Save'}
                          onClick={() => handleExport(format.id, 'download')}
                        >
                          {busy ? (controls.exportWorking ?? '…') : (controls.exportSave ?? 'Save')}
                        </button>
                        {canCopy ? (
                          <button
                            type="button"
                            className="settings-export-action"
                            disabled={Boolean(exportBusyId)}
                            title={controls.exportCopy ?? 'Copy'}
                            onClick={() => handleExport(format.id, 'copy')}
                          >
                            {controls.exportCopy ?? 'Copy'}
                          </button>
                        ) : null}
                        {canShare ? (
                          <button
                            type="button"
                            className="settings-export-action"
                            disabled={Boolean(exportBusyId) || !isExportPayloadReady(format.id)}
                            title={
                              isExportPayloadReady(format.id)
                                ? (controls.exportShare ?? 'Share')
                                : (controls.exportSharePreparing ?? 'Preparing…')
                            }
                            onClick={() => handleShare(format.id)}
                          >
                            {isExportPayloadReady(format.id)
                              ? (controls.exportShare ?? 'Share')
                              : (controls.exportSharePreparing ?? '…')}
                          </button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {exportFeedback ? (
              isQuickToastMethod(exportFeedback.method) ? (
                <div className="settings-export-toast" role="status" aria-live="polite">
                  {exportSuccessMessage(exportFeedback.method)}
                </div>
              ) : (
                <div className="settings-export-feedback" role="status" aria-live="polite">
                  <p className="settings-export-feedback-title">
                    {exportSuccessMessage(exportFeedback.method)}
                  </p>
                  <p className="settings-export-feedback-filename">{exportFeedback.filename}</p>
                  {showDownloadHint ? (
                    <p className="settings-export-feedback-hint">
                      {controls.exportDownloadHint ??
                        'Check your notification shade or Files → Downloads.'}
                    </p>
                  ) : null}
                  <div className="settings-export-feedback-actions">
                    {exportFeedback.previewUrl ? (
                      <a
                        className="settings-export-feedback-link"
                        href={exportFeedback.previewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {controls.exportOpenPreview ?? 'Open preview'}
                      </a>
                    ) : null}
                    {canShareExportPayload(exportFeedback.payload) ? (
                      <button
                        type="button"
                        className="settings-export-feedback-button"
                        onClick={() => handleShare(exportFeedback.formatId, exportFeedback.payload)}
                      >
                        {controls.exportShareAgain ?? 'Share again'}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="settings-export-feedback-button is-muted"
                      onClick={dismissExportFeedback}
                    >
                      {controls.exportDismiss ?? 'Dismiss'}
                    </button>
                  </div>
                </div>
              )
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
