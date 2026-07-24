import DiagramCanvas from '../../components/DiagramCanvas.jsx';

/**
 * Main diagram canvas slot wired from the app shell.
 */
export function DiagramCanvasSlot({
  revisionId,
  diagramSource,
  contentType,
  rendererRefreshKey,
  onManualEdit,
  onValidationChange,
  streamingPreview,
  agentThinkingChrome,
  editorOpen,
  insightsMounted,
  insightsSlot,
  selectedNode,
  hoverDescriptor,
  onSelectedNodeChange,
  onHoverTargetChange,
  onPanGestureStart,
  onNodeToolbarAnchor,
  onEditorClose,
  changeHighlight,
  changeHighlightContentType,
  onDiagramSvgRendered,
  runFx,
  diagramSurfaceRef,
  isFullscreen,
  onFormSubmit
}) {
  return (
    <DiagramCanvas
      revisionId={revisionId}
      diagramSource={diagramSource}
      contentType={contentType}
      rendererRefreshKey={rendererRefreshKey}
      onManualEdit={onManualEdit}
      onValidationChange={onValidationChange}
      streamingPreview={streamingPreview}
      agentThinking={agentThinkingChrome}
      editorOpen={editorOpen}
      insightsOpen={insightsMounted && Boolean(insightsSlot)}
      insightsSlot={insightsSlot}
      ceremonySlot={null}
      selectedNode={selectedNode}
      hoverDescriptor={hoverDescriptor}
      onSelectedNodeChange={onSelectedNodeChange}
      onHoverTargetChange={onHoverTargetChange}
      onPanGestureStart={onPanGestureStart}
      onNodeToolbarAnchor={onNodeToolbarAnchor}
      onEditorClose={onEditorClose}
      changeHighlight={changeHighlight}
      changeHighlightContentType={changeHighlightContentType}
      onDiagramSvgRendered={onDiagramSvgRendered}
      runFx={runFx}
      diagramSurfaceRef={diagramSurfaceRef}
      isFullscreen={isFullscreen}
      onFormSubmit={onFormSubmit}
    />
  );
}
