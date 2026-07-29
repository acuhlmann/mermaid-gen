import { BottomRow } from '../../components/BottomRow.jsx';
import { AiCornerControlsInner } from '../../components/AiCornerControlsInner.jsx';
import { DeskBottomActionsSlot } from '../desk/DeskBottomActionsSlot.jsx';
import { isConcreteContentMode } from '../../utils/renderModeAction.js';

/**
 * Bottom desk row: status line, desk actions, and optional AI corner controls.
 */
export function ShellBottomRowSlot({
  narrowLayout,
  status,
  error,
  streamingAgentStoppable,
  insightsOpen,
  stopStreamingAgentLabel,
  onStopStreamingAgent,
  hasCanvasContent,
  pendingHandshake,
  editorOpen,
  contentMode,
  diagramSource,
  stateContentType,
  controls,
  settingsOpenSignal,
  onInviteAgent,
  onToggleEditor,
  externalAgentPresence,
  deskSlotRef,
  entryReveal,
  busy,
  loading,
  streamingPreview,
  contentModeOptions,
  deskPrompt,
  setDeskPrompt,
  voiceSupported,
  voiceListening,
  speechRecognitionCtor,
  PromptIcon,
  MicIcon,
  MicActiveIcon,
  ButtonIcon,
  handleDeskPromptSubmit,
  handleMicToggleClick,
  handleMicPointerDown,
  handleMicPointerUp,
  stopVoiceInput,
  runTransform,
  runAnalyze,
  russStreak,
  onHuddle,
  onCallMeeting,
  handleSelectContentMode,
  latestCritique,
  canFixFromCritique,
  handleFixFromCritique,
  handleClearDiagram,
  onToggleThinking,
  entryTourActive,
  entryTourStep,
  entryTourProgress,
  entryPointers,
  entryTourCopy,
  onAdvanceEntryTour,
  onDismissEntryTour
}) {
  return (
    <BottomRow
      narrowLayout={narrowLayout}
      statusRow={
        status ? (
          <div className="overlay-status-row">
            <p
              id="app-status"
              className={`overlay-status ${error ? 'is-error' : ''}`}
              role="status"
            >
              {status}
            </p>
            {streamingAgentStoppable && !insightsOpen ? (
              <button
                type="button"
                className="overlay-button compact-button overlay-status-stop"
                onClick={onStopStreamingAgent}
              >
                {stopStreamingAgentLabel}
              </button>
            ) : null}
          </div>
        ) : null
      }
      actions={
        <DeskBottomActionsSlot
          hasCanvasContent={hasCanvasContent}
          insightsOpen={insightsOpen}
          entryReveal={entryReveal}
          narrowLayout={narrowLayout}
          busy={busy}
          loading={loading}
          streamingPreview={streamingPreview}
          controls={controls}
          contentMode={contentMode}
          contentModeOptions={contentModeOptions}
          deskSlotRef={deskSlotRef}
          deskPrompt={deskPrompt}
          setDeskPrompt={setDeskPrompt}
          voiceSupported={voiceSupported}
          voiceListening={voiceListening}
          speechRecognitionCtor={speechRecognitionCtor}
          PromptIcon={PromptIcon}
          MicIcon={MicIcon}
          MicActiveIcon={MicActiveIcon}
          ButtonIcon={ButtonIcon}
          handleDeskPromptSubmit={handleDeskPromptSubmit}
          handleMicToggleClick={handleMicToggleClick}
          handleMicPointerDown={handleMicPointerDown}
          handleMicPointerUp={handleMicPointerUp}
          stopVoiceInput={stopVoiceInput}
          runTransform={runTransform}
          runAnalyze={runAnalyze}
          russStreak={russStreak}
          onHuddle={onHuddle}
          onCallMeeting={onCallMeeting}
          handleSelectContentMode={handleSelectContentMode}
          latestCritique={latestCritique}
          canFixFromCritique={canFixFromCritique}
          handleFixFromCritique={handleFixFromCritique}
          handleClearDiagram={handleClearDiagram}
          onToggleThinking={onToggleThinking}
          canToggleThinking
          entryTourActive={entryTourActive}
          entryTourStep={entryTourStep}
          entryTourProgress={entryTourProgress}
          entryPointers={entryPointers}
          entryTourCopy={entryTourCopy}
          onAdvanceEntryTour={onAdvanceEntryTour}
          onDismissEntryTour={onDismissEntryTour}
        />
      }
      aiControls={
        hasCanvasContent || pendingHandshake ? (
          <AiCornerControlsInner
            controls={controls.settings}
            pendingHandshake={pendingHandshake}
            externalAgentPresence={externalAgentPresence}
            onInviteAgent={onInviteAgent}
            popoverMode={!narrowLayout}
            showEditorToggle={hasCanvasContent || editorOpen}
            editorOpen={editorOpen}
            onToggleEditor={onToggleEditor}
            editorControls={controls.editor}
            settingsOpenSignal={settingsOpenSignal}
          />
        ) : null
      }
    />
  );
}
