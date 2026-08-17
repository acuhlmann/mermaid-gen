import { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import GraphEditChrome from '../../components/GraphEditChrome.jsx';

/**
 * Portals graph-edit chrome into `.diagram-output` so connect hints, naming
 * panels, and undo toasts stay on the diagram — including in native fullscreen.
 */
export function GraphEditChromeSlot({
  diagramSurfaceRef,
  hasCanvasContent,
  contentType,
  diagramSource,
  isFullscreen = false,
  connectHint,
  labelSession,
  labelCopy,
  onLabelCommit,
  onLabelCancel,
  undoToast,
  undoLabel,
  onUndo,
  onDismissUndo,
  toolbarAnchor
}) {
  const [host, setHost] = useState(/** @type {HTMLElement | null} */ (null));

  useLayoutEffect(() => {
    const node = diagramSurfaceRef?.current ?? null;
    setHost(node);
    if (!node || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setHost(diagramSurfaceRef?.current ?? null));
    ro.observe(node);
    return () => ro.disconnect();
  }, [diagramSurfaceRef, hasCanvasContent, contentType, diagramSource]);

  const chrome = (
    <GraphEditChrome
      connectHint={connectHint}
      labelSession={labelSession}
      labelCopy={labelCopy}
      onLabelCommit={onLabelCommit}
      onLabelCancel={onLabelCancel}
      undoToast={undoToast}
      undoLabel={undoLabel}
      onUndo={onUndo}
      onDismissUndo={onDismissUndo}
      toolbarAnchor={toolbarAnchor}
      isFullscreen={isFullscreen}
    />
  );

  if (host) return createPortal(chrome, host);
  return chrome;
}
