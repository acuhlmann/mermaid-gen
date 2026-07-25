import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ButtonIcon } from './AppIcons.jsx';
import { CONTROLS_EN } from '../i18n/locales/controls.en.js';
import {
  overlayFocusHandlers,
  overlayLayerStyle,
  useOverlayLayer
} from '../hooks/useOverlayLayer.js';
import { formatLocale } from '../i18n/formatLocale.js';
import {
  EXPORT_PREVIEW_URL_TTL_MS,
  buildExportPayload,
  canShareExportPayload,
  deliverExportPayload,
  exportFormatSharePreview,
  getPreferredShareFormatId,
  getShareFormatId,
  isExportUserAbortError,
  isFormatCopyable,
  isSharePermissionError,
  isShareUserGestureError,
  isWebShareAvailable,
  listExportFormats,
  startWebShare
} from '../utils/exportDiagram.js';

const DEFAULT_CONTROLS = CONTROLS_EN.settings;
const COPY_TOAST_TTL_MS = 2000;
const POPOVER_GAP_PX = 9;

/**
 * @param {DOMRect} anchorRect
 * @returns {import('react').CSSProperties}
 */
function computePortaledOutboxStyle(anchorRect) {
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
    alignItems: 'stretch',
    width: 'max-content',
    minWidth: 0,
    maxWidth,
    boxSizing: 'border-box'
  };
}

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
 * The Outbox: sending your finished deliverable out is a first-class office
 * action. The panel opens from the desk verb "Ship from the Outbox" via
 * `openSignal` (optional dedicated trigger kept for tests). Owns the whole
 * export subsystem (share pre-warm, per-format Save/Copy, Web Share). The panel
 * floats above the anchor when `popoverMode` (desktop) and stacks inline otherwise.
 */
export default function OutboxDock({
  controls = DEFAULT_CONTROLS,
  contentType = null,
  diagramSource = '',
  popoverMode = true,
  showTrigger = true,
  openSignal = 0
}) {
  const startExpanded = typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test';
  const [panelOpen, setPanelOpen] = useState(startExpanded);

  useEffect(() => {
    if (openSignal > 0) setPanelOpen(true);
  }, [openSignal]);
  const [exportOpen, setExportOpen] = useState(false);
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
  const rootRef = useRef(null);
  const [anchorRect, setAnchorRect] = useState(/** @type {DOMRect | null} */ (null));
  const panelClass = popoverMode
    ? 'outbox-panel bottom-row-popover bottom-row-popover--outbox outbox-panel--portaled'
    : 'outbox-panel';
  const outboxZIndex = useOverlayLayer('outbox-panel', panelOpen && popoverMode);

  useLayoutEffect(() => {
    if (!panelOpen || !popoverMode) {
      setAnchorRect(null);
      return undefined;
    }
    const measure = () => {
      const node = rootRef.current;
      if (!node) return;
      setAnchorRect(node.getBoundingClientRect());
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (rootRef.current) ro?.observe(rootRef.current);
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
  }, [panelOpen, popoverMode]);
  const hasSource = Boolean((diagramSource ?? '').trim());
  const exportFormats = useMemo(
    () => (hasSource ? listExportFormats(contentType, diagramSource) : []),
    [hasSource, contentType, diagramSource]
  );
  const preferredShareFormatId = useMemo(
    () => (hasSource ? getPreferredShareFormatId(contentType, diagramSource) : null),
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
    if (!hasSource || !preferredShareFormatId) {
      return undefined;
    }
    let cancelled = false;
    const promise = buildExportPayload({
      contentType,
      diagramSource,
      formatId: preferredShareFormatId
    })
      .then((payload) => {
        if (!cancelled) {
          exportPayloadCacheRef.current.set(preferredShareFormatId, { payload, promise });
          setExportReadyIds((prev) => new Set(prev).add(preferredShareFormatId));
        }
        return payload;
      })
      .catch(() => {
        if (!cancelled) {
          exportPayloadCacheRef.current.delete(preferredShareFormatId);
          setExportReadyIds((prev) => {
            const next = new Set(prev);
            next.delete(preferredShareFormatId);
            return next;
          });
        }
      });
    exportPayloadCacheRef.current.set(preferredShareFormatId, { promise });
    return () => {
      cancelled = true;
    };
  }, [hasSource, contentType, diagramSource, preferredShareFormatId]);

  useEffect(() => {
    if (!exportOpen || !hasSource || exportFormats.length === 0) {
      return undefined;
    }
    let cancelled = false;
    for (const format of exportFormats) {
      if (format.id === preferredShareFormatId) continue;
      if (exportPayloadCacheRef.current.get(format.id)?.payload) continue;
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
    };
  }, [exportOpen, hasSource, contentType, diagramSource, exportFormats, preferredShareFormatId]);

  function getCachedExportPayload(formatId) {
    return exportPayloadCacheRef.current.get(formatId)?.payload ?? null;
  }

  function getSharePayload(formatId) {
    return getCachedExportPayload(getShareFormatId(formatId, contentType));
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
    if (context === 'share' && isSharePermissionError(err)) {
      setExportError(
        controls.exportShareDenied ??
          'Share is blocked for this format on this device — use Save instead.'
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
    const shareFormatId = getShareFormatId(formatId, contentType);
    const payload = payloadOverride ?? getSharePayload(formatId);
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
        applyExportSuccess(payload, shareFormatId, method);
      })
      .catch((err) => {
        handleExportFailure(err, 'share');
      })
      .finally(() => {
        setExportBusyId(null);
      });
  }

  function handlePrimaryShare() {
    if (!preferredShareFormatId) return;
    handleShare(preferredShareFormatId);
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

  const primaryShareReady = preferredShareFormatId
    ? isExportPayloadReady(preferredShareFormatId)
    : false;
  const primarySharePayload = preferredShareFormatId
    ? (getSharePayload(preferredShareFormatId) ?? getCachedExportPayload(preferredShareFormatId))
    : null;
  const canPrimaryShare =
    shareAvailable &&
    Boolean(preferredShareFormatId) &&
    (primaryShareReady
      ? canShareExportPayload(
          primarySharePayload ?? exportFormatSharePreview(preferredShareFormatId, contentType)
        )
      : true);
  const primaryShareBusy = Boolean(exportBusyId) && exportBusyId === preferredShareFormatId;
  const outboxLabel = controls.outboxLabel ?? 'Outbox';

  const panelNode = (
    <div
      id="outbox-panel"
      className={`${panelClass}${panelOpen ? ' is-open' : ''}`}
      style={overlayLayerStyle(
        outboxZIndex,
        popoverMode && anchorRect ? computePortaledOutboxStyle(anchorRect) : undefined
      )}
      role="region"
      aria-label={controls.outboxRegion ?? outboxLabel}
      hidden={!panelOpen}
      {...overlayFocusHandlers('outbox-panel', panelOpen && popoverMode)}
    >
      {!showTrigger ? (
        <button
          type="button"
          className="outbox-panel-dismiss"
          onClick={() => setPanelOpen(false)}
          aria-label={controls.outboxHide ?? outboxLabel}
        >
          {controls.outboxHide ?? 'Hide Outbox'}
        </button>
      ) : null}
      <div className="settings-export" role="group" aria-label={controls.export}>
        {hasSource && canPrimaryShare ? (
          <button
            type="button"
            className="settings-export-share-primary"
            disabled={Boolean(exportBusyId) || !primaryShareReady}
            aria-busy={primaryShareBusy}
            onClick={handlePrimaryShare}
          >
            <span className="settings-export-share-primary-icon" aria-hidden="true">
              ↗
            </span>
            <span className="settings-export-share-primary-label">
              {primaryShareReady
                ? (controls.exportSharePrimary ?? controls.exportShare ?? 'Share')
                : (controls.exportSharePreparing ?? 'Preparing…')}
            </span>
          </button>
        ) : null}
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
              const canCopy = isFormatCopyable(format);
              return (
                <li key={format.id} className="settings-export-item">
                  <span className="settings-export-format-label">{label}</span>
                  <div
                    className="settings-export-row-actions"
                    role="group"
                    aria-label={formatLocale(controls.exportActionsFor ?? 'Actions for {label}', {
                      label
                    })}
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
  );

  const portaledPanel =
    popoverMode && panelOpen && typeof document !== 'undefined'
      ? createPortal(panelNode, document.body)
      : null;

  return (
    <div ref={rootRef} className={`outbox-dock${showTrigger ? '' : ' outbox-dock--headless'}`}>
      {showTrigger ? (
        <button
          type="button"
          className={`overlay-button outbox-toggle${panelOpen ? ' is-open' : ''}`}
          onClick={() => setPanelOpen((v) => !v)}
          aria-expanded={panelOpen}
          aria-controls="outbox-panel"
          aria-label={
            panelOpen ? (controls.outboxHide ?? outboxLabel) : (controls.outboxShow ?? outboxLabel)
          }
          title={controls.outboxTitle ?? outboxLabel}
        >
          <ButtonIcon>
            <span className="action-persona-icon is-outbox" aria-hidden="true">
              📤
            </span>
          </ButtonIcon>
          <span className="button-label">{outboxLabel}</span>
        </button>
      ) : null}
      {popoverMode ? portaledPanel : panelNode}
    </div>
  );
}
