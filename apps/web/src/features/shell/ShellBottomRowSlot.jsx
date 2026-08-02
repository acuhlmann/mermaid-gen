import { BottomRow } from '../../components/BottomRow.jsx';
import { AiCornerControlsInner } from '../../components/AiCornerControlsInner.jsx';
import { DeskBottomActionsSlot } from '../desk/DeskBottomActionsSlot.jsx';

/**
 * Bottom desk row: desk actions and optional AI corner controls.
 *
 * Run status used to sit above this row; it moved to the taskbar tray
 * (`DeskOsTaskbar`), which is both where an OS puts "what is happening right
 * now" and what pays for the taskbar's height — the row it vacated here is
 * taller than the bar that replaced it.
 */
export function ShellBottomRowSlot({
  narrowLayout,
  insightsOpen,
  hasCanvasContent,
  pendingHandshake,
  editorOpen,
  controls,
  settingsOpenSignal,
  onToggleEditor,
  externalAgentPresence,
  deskSlotRef,
  entryReveal,
  busy,
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
  onPair,
  onCallMeeting,
  onTalk,
  talkDisabled,
  talkDisabledReason,
  latestCritique,
  canFixFromCritique,
  handleFixFromCritique,
  onToggleThinking,
  entryTourActive,
  entryTourStep,
  entryTourProgress,
  entryPointers,
  entryTourCopy,
  onAdvanceEntryTour,
  onDismissEntryTour,
  liveStreamingEntry = null
}) {
  return (
    <BottomRow
      narrowLayout={narrowLayout}
      actions={
        <DeskBottomActionsSlot
          hasCanvasContent={hasCanvasContent}
          insightsOpen={insightsOpen}
          entryReveal={entryReveal}
          narrowLayout={narrowLayout}
          busy={busy}
          controls={controls}
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
          onPair={onPair}
          onCallMeeting={onCallMeeting}
          onTalk={onTalk}
          talkDisabled={talkDisabled}
          talkDisabledReason={talkDisabledReason}
          latestCritique={latestCritique}
          canFixFromCritique={canFixFromCritique}
          handleFixFromCritique={handleFixFromCritique}
          onToggleThinking={onToggleThinking}
          canToggleThinking
          liveStreamingEntry={liveStreamingEntry}
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
