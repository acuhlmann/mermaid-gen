import { useSyncExternalStore } from 'react';
import ClearConfirmDialog from '../../components/ClearConfirmDialog.jsx';
import DeskOsTaskbar from '../../components/DeskOsTaskbar.jsx';
import ErrorToast from '../../components/ErrorToast.jsx';
import HotkeyOverlay from '../../components/HotkeyOverlay.jsx';
import { ButtonIcon, PromptIcon, MicIcon, MicActiveIcon } from '../../components/AppIcons.jsx';
import { SpeechRecognitionCtor } from '../../utils/appConstants.js';
import {
  getOfficeSnapshot,
  setOfficeFocusTime,
  setOfficeHeadphones,
  subscribe as subscribeOffice
} from '../../state/officeMomentStore.js';
import { DiagramCanvasSlot } from '../canvas/DiagramCanvasSlot.jsx';
import { EmptyCanvasSlot } from '../desk/EmptyCanvasSlot.jsx';
import { ModeRevealSlot } from '../desk/ModeRevealSlot.jsx';
import { RadialMenuSlot } from '../prompt/RadialMenuSlot.jsx';
import { BrandChromeSlot } from './BrandChromeSlot.jsx';
import { OfficeLayerSlot } from './OfficeLayerSlot.jsx';
import { SessionCollaborationSlot } from '../session/SessionCollaborationSlot.jsx';
import { ShellBottomRowSlot } from './ShellBottomRowSlot.jsx';

/**
 * Post-boot workspace: canvas, desk overlays, shell chrome, and bottom row.
 */
export function AppWorkspaceSlot({
  state,
  contentMode,
  contentModeOptions,
  rendererRefreshKey,
  liveDraftSource,
  liveDraftContentType,
  streamingPreview,
  agentThinkingChrome,
  editorOpen,
  setEditorOpen,
  insightsMounted,
  insightsSlot,
  selectedNode,
  hoverDescriptor,
  onSelectedNodeChange,
  onHoverTargetChange,
  dismissRadialMenu,
  setToolbarAnchor,
  changeHighlightForCanvas,
  changeHighlightContentType,
  onDiagramSvgRendered,
  runFx,
  diagramSurfaceRef,
  isFullscreen,
  onFormSubmit,
  onManualEdit,
  onValidationChange,
  modeRevealActive,
  modeRevealCopy,
  onModeRevealPick,
  onDismissModeReveal,
  showEmptyCanvas,
  loading,
  promptCopy,
  userName,
  showEntryDeskIntro,
  entryIntroCopy,
  entryRole,
  entryTourCopy,
  onAdvanceEntryTour,
  onDismissEntryTour,
  toggleFullscreen,
  radialMenuSession,
  radialActions,
  busy,
  activeSessionId,
  slopPromptExpanded,
  slopPromptSource,
  slopNextPrompt,
  voiceSupported,
  voiceListening,
  narrowLayout,
  onSlopPromptClose,
  onSlopNextPromptChange,
  onSlopPromptSubmit,
  onMicToggleClick,
  onMicPointerDown,
  onMicPointerUp,
  stopVoiceInput,
  onRadialActionPick,
  setSelectedNode,
  closeRadialMenu,
  setBootSeq,
  tryAgentSound,
  runAnalyze,
  cancelMenuClose,
  scheduleMenuClose,
  onAdvisorUsage,
  ceremonyOverlays,
  officeDistractionsPaused,
  officeCanvasGrace,
  advisor,
  stateRef,
  gamification,
  submitIntentWithPrompt,
  setInsightsEntries,
  onOfficeEvent,
  setInviteDialogOpen,
  hasCanvasContent,
  modelProfile,
  setModelProfile,
  callMeetingSignal,
  huddleSignal,
  insightsOpen,
  agentBusy = false,
  officeRunSignal,
  entryReveal,
  hotkeyOverlayOpen,
  onCloseHotkeyOverlay,
  onOpenHotkeyOverlay,
  hotkeyCopy,
  slopitectTip,
  slopitectTipRef,
  onDismissSlopitectTip,
  xpInfoPanelOpen,
  onToggleXpInfoPanel,
  onCloseXpInfoPanel,
  xpBarFlashKey,
  liveVariant,
  shellControls,
  onBrandClick,
  costTrackingEnabled,
  fullscreenSupported,
  onToggleFullscreen,
  pendingHandshake,
  onApproveHandshake,
  onDenyHandshake,
  inviteDialogOpen,
  onInviteDialogClose,
  clearConfirmOpen,
  clearDialogCopy,
  onConfirmClear,
  onCancelClear,
  status,
  error,
  streamingAgentStoppable,
  stopStreamingAgentLabel,
  onStopStreamingAgent,
  pendingHandshakeForAi,
  settingsOpenSignal,
  externalAgentPresence,
  deskSlotRef,
  deskPrompt,
  setDeskPrompt,
  handleDeskPromptSubmit,
  runTransform,
  russStreak,
  onHuddle,
  onPair,
  onCallMeeting,
  onTalk,
  talkDisabled,
  talkDisabledReason,
  talkSignal,
  latestCritique,
  canFixFromCritique,
  handleFixFromCritique,
  handleSelectContentMode,
  handleClearDiagram,
  onToggleThinking,
  entryTourActive,
  entryTourStep,
  entryTourProgress,
  entryPointers
}) {
  const officeHeadphones = useSyncExternalStore(
    subscribeOffice,
    () => getOfficeSnapshot().headphones,
    () => getOfficeSnapshot().headphones
  );
  const officeFocusTime = useSyncExternalStore(
    subscribeOffice,
    () => getOfficeSnapshot().focusTime,
    () => getOfficeSnapshot().focusTime
  );

  /**
   * The menu bar's whole prop surface, bundled once. Deliverable is the
   * dismantled `DeskDrawer`, Mailroom is the export panel, Admin holds
   * once-a-session verbs plus Headphones / Focus and Approved vendors.
   */
  const menuBar = {
    modes: contentModeOptions,
    currentMode: contentMode,
    onPickMode: handleSelectContentMode,
    modeDisabled: loading || streamingPreview,
    onClearDiagram: handleClearDiagram,
    clearDisabled: busy,
    contentType: contentMode,
    diagramSource: state.diagramSource,
    onOpenContractor: () => setInviteDialogOpen(true),
    onOpenHrProgression: onToggleXpInfoPanel,
    onOpenHotkeys: onOpenHotkeyOverlay,
    headphones: officeHeadphones,
    focusTime: officeFocusTime,
    onToggleHeadphones: setOfficeHeadphones,
    onToggleFocusTime: setOfficeFocusTime,
    tourHighlight: entryTourActive && entryTourStep === 'format' ? 'deliverable' : null
  };

  return (
    <>
      <DiagramCanvasSlot
        revisionId={state.revisionId}
        diagramSource={
          liveDraftSource && liveDraftContentType === contentMode
            ? liveDraftSource
            : state.diagramSource
        }
        contentType={contentMode === 'auto' ? 'mermaid' : contentMode}
        rendererRefreshKey={rendererRefreshKey}
        onManualEdit={onManualEdit}
        onValidationChange={onValidationChange}
        streamingPreview={
          streamingPreview || (Boolean(liveDraftSource) && liveDraftContentType === contentMode)
        }
        agentThinkingChrome={agentThinkingChrome}
        editorOpen={editorOpen}
        insightsMounted={insightsMounted}
        insightsSlot={insightsSlot}
        selectedNode={selectedNode}
        hoverDescriptor={hoverDescriptor}
        onSelectedNodeChange={onSelectedNodeChange}
        onHoverTargetChange={onHoverTargetChange}
        onPanGestureStart={dismissRadialMenu}
        onNodeToolbarAnchor={setToolbarAnchor}
        onEditorClose={() => setEditorOpen(false)}
        changeHighlight={changeHighlightForCanvas}
        changeHighlightContentType={changeHighlightContentType}
        onDiagramSvgRendered={onDiagramSvgRendered}
        runFx={runFx}
        diagramSurfaceRef={diagramSurfaceRef}
        isFullscreen={isFullscreen}
        onFormSubmit={onFormSubmit}
      />

      <ModeRevealSlot
        active={modeRevealActive}
        copy={modeRevealCopy}
        modes={contentModeOptions.filter((m) => m.id !== 'auto')}
        currentMode={contentMode}
        onPickMode={onModeRevealPick}
        onDismiss={onDismissModeReveal}
      />

      <EmptyCanvasSlot
        active={showEmptyCanvas}
        busy={loading || streamingPreview}
        copy={promptCopy}
        userName={userName}
        showEntryDeskIntro={showEntryDeskIntro}
        entryIntroCopy={entryIntroCopy}
        entryRole={entryRole}
        entryTourCopy={entryTourCopy}
        onAdvanceEntryTour={onAdvanceEntryTour}
        onDismissEntryTour={onDismissEntryTour}
      />

      <RadialMenuSlot
        isFullscreen={isFullscreen}
        diagramSurfaceRef={diagramSurfaceRef}
        toggleFullscreen={toggleFullscreen}
        radialMenuSession={radialMenuSession}
        radialActions={radialActions}
        busy={busy}
        diagramSource={state.diagramSource}
        contentType={contentMode === 'auto' ? 'mermaid' : contentMode}
        sessionId={activeSessionId}
        slopPromptExpanded={slopPromptExpanded}
        slopPromptSource={slopPromptSource}
        slopNextPrompt={slopNextPrompt}
        voiceSupported={voiceSupported}
        voiceListening={voiceListening}
        narrowLayout={narrowLayout}
        speechRecognitionCtor={SpeechRecognitionCtor}
        PromptIcon={PromptIcon}
        MicIcon={MicIcon}
        MicActiveIcon={MicActiveIcon}
        ButtonIcon={ButtonIcon}
        promptCopy={promptCopy}
        onSlopPromptClose={onSlopPromptClose}
        onPromptChange={onSlopNextPromptChange}
        onSlopPromptSubmit={onSlopPromptSubmit}
        onMicToggleClick={onMicToggleClick}
        onMicPointerDown={onMicPointerDown}
        onMicPointerUp={onMicPointerUp}
        onMicLostPointerCapture={() => stopVoiceInput()}
        onActionPick={onRadialActionPick}
        setSelectedNode={setSelectedNode}
        closeRadialMenu={closeRadialMenu}
        setBootSeq={setBootSeq}
        tryAgentSound={tryAgentSound}
        runAnalyze={runAnalyze}
        cancelMenuClose={cancelMenuClose}
        scheduleMenuClose={scheduleMenuClose}
        dismissRadialMenu={dismissRadialMenu}
        onAdvisorUsage={onAdvisorUsage}
      />

      {ceremonyOverlays}
      <ErrorToast />
      <OfficeLayerSlot
        officeDistractionsPaused={officeDistractionsPaused}
        officeCanvasGrace={officeCanvasGrace}
        advisor={advisor}
        stateRef={stateRef}
        contentMode={contentMode}
        activeSessionId={activeSessionId}
        gamification={gamification}
        reportAdvisorUsage={onAdvisorUsage}
        submitIntentWithPrompt={submitIntentWithPrompt}
        setInsightsEntries={setInsightsEntries}
        handleOfficeEvent={onOfficeEvent}
        callMeetingSignal={callMeetingSignal}
        huddleSignal={huddleSignal}
        talkSignal={talkSignal}
        agentBusy={agentBusy}
        tryAgentSound={tryAgentSound}
        officeRunSignal={officeRunSignal}
        entryReveal={entryReveal}
      />
      <HotkeyOverlay open={hotkeyOverlayOpen} onClose={onCloseHotkeyOverlay} copy={hotkeyCopy} />

      <BrandChromeSlot
        narrowLayout={narrowLayout}
        slopitectTip={slopitectTip}
        slopitectTipRef={slopitectTipRef}
        onDismissSlopitectTip={onDismissSlopitectTip}
        controls={shellControls}
        onBrandClick={onBrandClick}
        menuBar={menuBar}
        fullscreenSupported={fullscreenSupported}
        hasCanvasContent={hasCanvasContent}
        editorOpen={editorOpen}
        isFullscreen={isFullscreen}
        streamingPreview={streamingPreview}
        onToggleFullscreen={onToggleFullscreen}
      />

      <SessionCollaborationSlot
        activeSessionId={activeSessionId}
        pendingHandshake={pendingHandshake}
        onApproveHandshake={onApproveHandshake}
        onDenyHandshake={onDenyHandshake}
        inviteDialogOpen={inviteDialogOpen}
        onInviteDialogClose={onInviteDialogClose}
      />

      <ClearConfirmDialog
        key={clearConfirmOpen ? 'clear-confirm-open' : 'clear-confirm-closed'}
        open={clearConfirmOpen}
        copy={clearDialogCopy}
        onConfirm={onConfirmClear}
        onCancel={onCancelClear}
      />

      <ShellBottomRowSlot
        narrowLayout={narrowLayout}
        insightsOpen={insightsOpen}
        hasCanvasContent={hasCanvasContent}
        pendingHandshake={pendingHandshakeForAi}
        editorOpen={editorOpen}
        controls={shellControls}
        settingsOpenSignal={settingsOpenSignal}
        onToggleEditor={() => setEditorOpen((current) => !current)}
        externalAgentPresence={externalAgentPresence}
        deskSlotRef={deskSlotRef}
        entryReveal={entryReveal}
        busy={busy}
        deskPrompt={deskPrompt}
        setDeskPrompt={setDeskPrompt}
        voiceSupported={voiceSupported}
        voiceListening={voiceListening}
        speechRecognitionCtor={SpeechRecognitionCtor}
        PromptIcon={PromptIcon}
        MicIcon={MicIcon}
        MicActiveIcon={MicActiveIcon}
        ButtonIcon={ButtonIcon}
        handleDeskPromptSubmit={handleDeskPromptSubmit}
        handleMicToggleClick={onMicToggleClick}
        handleMicPointerDown={onMicPointerDown}
        handleMicPointerUp={onMicPointerUp}
        stopVoiceInput={stopVoiceInput}
        runTransform={runTransform}
        runAnalyze={runAnalyze}
        russStreak={russStreak}
        onHuddle={onHuddle}
        onPair={onPair}
        onCallMeeting={onCallMeeting}
        onTalk={onTalk}
        talkDisabled={talkDisabled}
        talkDisabledReason={talkDisabledReason}
        latestCritique={latestCritique}
        canFixFromCritique={canFixFromCritique}
        handleFixFromCritique={handleFixFromCritique}
        onToggleThinking={onToggleThinking}
        entryTourActive={entryTourActive}
        entryTourStep={entryTourStep}
        entryTourProgress={entryTourProgress}
        entryPointers={entryPointers}
        entryTourCopy={entryTourCopy}
        onAdvanceEntryTour={onAdvanceEntryTour}
        onDismissEntryTour={onDismissEntryTour}
      />

      {/* Taskbar — the bottom half of the OS frame. Rendered here rather than
          inside `OfficeLayer` because Stand up reads `officeViewModeStore`
          directly (a global store, like the overlay stack its window list
          reads), so the bar needs no office props and can sit where the shell's
          run status and progression state already live. */}
      <DeskOsTaskbar
        status={status}
        error={Boolean(error)}
        stoppable={streamingAgentStoppable && !insightsOpen}
        stopLabel={stopStreamingAgentLabel}
        onStop={onStopStreamingAgent}
        gamification={gamification}
        xpBarFlashKey={xpBarFlashKey}
        liveVariant={liveVariant}
        xpInfoPanelOpen={xpInfoPanelOpen}
        onToggleXpInfoPanel={onToggleXpInfoPanel}
        onCloseXpInfoPanel={onCloseXpInfoPanel}
        costTrackingEnabled={costTrackingEnabled}
        modelProfile={modelProfile}
        onSelectModelProfile={setModelProfile}
      />
    </>
  );
}
