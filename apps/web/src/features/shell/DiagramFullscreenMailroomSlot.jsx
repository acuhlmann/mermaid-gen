import DiagramFullscreenMailroom from '../../components/DiagramFullscreenMailroom.jsx';

/**
 * Wires the fullscreen mailroom export panel from the app shell.
 */
export function DiagramFullscreenMailroomSlot({
  isFullscreen,
  diagramSurfaceRef,
  hasCanvasContent,
  contentType,
  diagramSource
}) {
  return (
    <DiagramFullscreenMailroom
      isFullscreen={isFullscreen}
      host={diagramSurfaceRef?.current ?? null}
      hasSource={hasCanvasContent}
      contentType={contentType}
      diagramSource={diagramSource}
    />
  );
}
