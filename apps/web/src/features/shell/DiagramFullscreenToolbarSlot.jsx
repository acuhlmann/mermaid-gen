import { useLayoutEffect, useState } from 'react';
import DiagramFullscreenToolbar from '../../components/DiagramFullscreenToolbar.jsx';

/**
 * Wires the portaled fullscreen toolbar (mailroom + exit) from the app shell.
 */
export function DiagramFullscreenToolbarSlot({
  isFullscreen,
  diagramSurfaceRef,
  hasCanvasContent,
  contentType,
  diagramSource,
  onExit
}) {
  const [host, setHost] = useState(/** @type {HTMLElement | null} */ (null));

  useLayoutEffect(() => {
    if (!isFullscreen) {
      setHost(null);
      return undefined;
    }
    const node = diagramSurfaceRef?.current ?? null;
    setHost(node);
    const ro =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => setHost(node)) : null;
    if (node) ro?.observe(node);
    return () => ro?.disconnect();
  }, [isFullscreen, diagramSurfaceRef, hasCanvasContent, contentType, diagramSource]);

  return (
    <DiagramFullscreenToolbar
      isFullscreen={isFullscreen}
      host={host}
      hasSource={hasCanvasContent}
      contentType={contentType}
      diagramSource={diagramSource}
      onExit={onExit}
    />
  );
}
