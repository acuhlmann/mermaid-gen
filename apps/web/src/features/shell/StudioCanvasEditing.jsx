import DiagramFullscreenOverlay from '../../components/DiagramFullscreenOverlay.jsx';
import RadialActionMenu from '../../components/RadialActionMenu.jsx';
import { GraphEditChromeSlot } from './GraphEditChromeSlot.jsx';
import { studioRadialActions } from './studioCanvasEditProps.js';

/**
 * The edit chrome that sits on top of the studio canvas: the node radial menu
 * (filtered to `STUDIO_RADIAL_ACTION_IDS`) and the graph-edit naming panel,
 * connect hint and undo toast — the same pieces the desk mounts, minus the
 * office.
 */
export function StudioCanvasEditing({
  canvasEditing,
  diagramSurfaceRef,
  isFullscreen,
  busy,
  diagramSource,
  contentType,
  sessionId
}) {
  if (!canvasEditing) return null;
  const { graphEdit, radialMenuSession } = canvasEditing;
  return (
    <>
      <GraphEditChromeSlot
        diagramSurfaceRef={diagramSurfaceRef}
        hasCanvasContent
        contentType={contentType}
        diagramSource={diagramSource}
        isFullscreen={isFullscreen}
        connectHint={graphEdit?.connectHint ?? null}
        labelSession={graphEdit?.labelSession ?? null}
        labelCopy={canvasEditing.graphEditCopy}
        onLabelCommit={graphEdit?.handleLabelCommit}
        onLabelCancel={graphEdit?.cancelLabel}
        undoToast={graphEdit?.undoToast ?? null}
        undoLabel={canvasEditing.graphEditCopy?.undo}
        onUndo={graphEdit?.undoLast}
        onDismissUndo={graphEdit?.dismissUndoToast}
        toolbarAnchor={canvasEditing.toolbarAnchor}
      />
      <DiagramFullscreenOverlay isFullscreen={isFullscreen} host={diagramSurfaceRef?.current}>
        <RadialActionMenu
          key={radialMenuSession?.descriptor?.id ?? 'radial-closed'}
          descriptor={radialMenuSession?.descriptor ?? null}
          anchor={radialMenuSession?.anchor ?? null}
          actions={studioRadialActions(canvasEditing.radialActions)}
          busy={busy}
          diagramSource={diagramSource}
          contentType={contentType}
          sessionId={sessionId}
          onActionPick={canvasEditing.onRadialActionPick}
          onHoverHold={canvasEditing.cancelMenuClose}
          onHoverRelease={canvasEditing.scheduleMenuClose}
          onBackdropPointerDown={canvasEditing.dismissRadialMenu}
          onClose={canvasEditing.closeRadialMenu}
          onAdvisorUsage={canvasEditing.onAdvisorUsage}
        />
      </DiagramFullscreenOverlay>
    </>
  );
}
