import DiagramCanvasMailbox from '../../components/DiagramCanvasMailbox.jsx';

/**
 * Wires the canvas mailbox trigger from the app shell.
 */
export function DiagramCanvasMailboxSlot({ diagramSurfaceRef, isFullscreen }) {
  return (
    <DiagramCanvasMailbox
      visible
      host={diagramSurfaceRef?.current ?? null}
      isFullscreen={isFullscreen}
    />
  );
}
