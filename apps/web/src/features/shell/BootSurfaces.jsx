import FloorArrival from '../../components/officeFloor/FloorArrival.jsx';
import OfficeDirectory from '../../components/OfficeDirectory.jsx';
import { buildContentModeOptions } from '../../utils/renderModeAction.js';
import { SimpleStudioSlot } from './SimpleStudioSlot.jsx';

/**
 * What the studio canvas should show for this render. Auto stays a request
 * type; the picture itself follows the resolved slot.
 */
function resolveStudioView({
  shell,
  runtime,
  state,
  liveDraftSource,
  liveDraftContentType,
  streamingPreview,
  busy,
  activeRequest,
  status
}) {
  const draftMatches = Boolean(liveDraftSource) && liveDraftContentType === runtime.contentMode;
  const clearingHydrate = activeRequest === 'hydrate';
  return {
    contentType: runtime.contentMode === 'auto' ? 'mermaid' : runtime.contentMode,
    showCanvas: shell.hasCanvasContent || (busy && !clearingHydrate),
    showStartOver: shell.hasCanvasContent && !busy,
    diagramSource: draftMatches ? liveDraftSource : state.diagramSource,
    streamingPreview: streamingPreview || draftMatches,
    status: clearingHydrate ? '' : status
  };
}

function StudioBoot({
  shell,
  runtime,
  state,
  controls,
  locale,
  setLocale,
  busy,
  stoppable,
  onStop,
  hasInteractedRef,
  submitIntentWithPrompt,
  performClearDiagram,
  onManualEdit,
  onValidationChange,
  onFormSubmit,
  modelProfile,
  setModelProfile,
  ...viewInput
}) {
  const view = resolveStudioView({
    shell,
    runtime,
    state,
    busy,
    ...viewInput
  });

  function handleStudioSubmit(text) {
    hasInteractedRef.current = true;
    return submitIntentWithPrompt(text, { keepInsightsClosed: true });
  }

  function handleStartOver() {
    runtime.setContentMode('auto');
    void performClearDiagram();
  }

  return (
    <SimpleStudioSlot
      copy={controls.prompt.studio ?? {}}
      localeCopy={controls.introLocale}
      locale={locale}
      onSelectLocale={setLocale}
      busy={busy}
      status={view.status}
      stoppable={stoppable}
      stopLabel={controls.insights?.stopRequest ?? 'Stop request'}
      onStop={onStop}
      onSubmit={handleStudioSubmit}
      onEnterOffice={shell.enterOfficeLife}
      onStartOver={handleStartOver}
      showCanvas={view.showCanvas}
      showStartOver={view.showStartOver}
      revisionId={state.revisionId}
      diagramSource={view.diagramSource}
      contentType={view.contentType}
      rendererRefreshKey={runtime.rendererRefreshKey}
      streamingPreview={view.streamingPreview}
      onManualEdit={onManualEdit}
      onValidationChange={onValidationChange}
      onFormSubmit={onFormSubmit}
      diagramSurfaceRef={shell.diagramSurfaceRef}
      modes={buildContentModeOptions(controls).map((mode) => ({
        id: mode.id,
        label: mode.shortLabel || mode.label
      }))}
      contentMode={runtime.contentMode}
      onSelectContentMode={runtime.handleSelectContentMode}
      modelProfile={modelProfile}
      onSelectModelProfile={setModelProfile}
      brainCopy={{
        label: controls.settings?.brain,
        fast: controls.settings?.fastShort || controls.settings?.fast,
        quality: controls.settings?.qualityShort || controls.settings?.quality
      }}
    />
  );
}

function OfficeCeremony({
  shell,
  controls,
  onSkipToBuild,
  playChime,
  audioContextRef,
  hasInteractedRef,
  soundEnabled,
  sessionId
}) {
  const userRole = controls.prompt.entryIntro?.role ?? controls.prompt.exampleRole ?? 'Architect';
  if (shell.officeBootPending) {
    return (
      <FloorArrival
        onComplete={shell.handleOfficeBootComplete}
        onSkipToBuild={onSkipToBuild}
        getSessionId={() => sessionId}
        playChime={playChime}
        audioContextRef={audioContextRef}
        hasInteractedRef={hasInteractedRef}
        soundEnabled={soundEnabled}
      />
    );
  }
  return (
    <div className="office-directory-root-mount">
      <OfficeDirectory
        placement={shell.hasCanvasContent ? 'overlay' : 'entry'}
        showChip={false}
        onSkipToBuild={onSkipToBuild}
        onBootComplete={shell.handleOfficeBootComplete}
        getSessionId={() => sessionId}
        userRole={userRole}
      />
    </div>
  );
}

/**
 * Prompt studio, or the office ceremony, or the desk's directory replay.
 * The workspace itself stays in ArchiSlop; this only owns the surfaces that
 * replace it on a fresh visit.
 */
export function BootSurfaces(props) {
  return (
    <>
      <div className="office-view-desk-veil" aria-hidden="true" />
      {props.shell.studioActive ? <StudioBoot {...props} /> : <OfficeCeremony {...props} />}
    </>
  );
}
