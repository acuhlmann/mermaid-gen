import SlopNextPrompt from '../../components/SlopNextPrompt.jsx';
import StakeholdersMascot from '../../components/StakeholdersMascot.jsx';
import DeskDrawer from '../../components/DeskDrawer.jsx';
import DeskNotebookButton from '../../components/DeskNotebookButton.jsx';
import EntryDeskPointers from '../../components/EntryDeskPointers.jsx';
import { russShapeLabel } from '../../utils/renderModeAction.js';

function DeskPeopleCluster({ russStreak, controls, runTransform, runAnalyze, busy, onHuddle }) {
  return (
    <div className="desk-people-group">
      <StakeholdersMascot
        personas={[
          {
            variant: 'gilfoyle',
            onClick: () => runTransform('gilfoyle', { useDiagramFocus: true })
          },
          {
            variant: 'dinesh',
            onClick: () => runTransform('dinesh', { useDiagramFocus: true })
          },
          {
            variant: 'erlich',
            onClick: () => runTransform('erlich', { useDiagramFocus: true })
          },
          {
            variant: 'russ',
            label: russShapeLabel(russStreak, controls.actions),
            onClick: () => runTransform('russ', { useDiagramFocus: true })
          },
          { variant: 'jared', onClick: () => runAnalyze('jared', { useDiagramFocus: true }) },
          { variant: 'richard', onClick: () => runAnalyze('richard', { useDiagramFocus: true }) },
          {
            variant: 'barker',
            senior: true,
            onClick: () => runTransform('barker', { useDiagramFocus: true })
          }
        ]}
        busy={busy}
        onHuddle={onHuddle}
        canHuddle={!busy}
      />
    </div>
  );
}

function DeskChromeRow({
  deskSlotRef,
  showDeskSlot = true,
  showWorkOrder = true,
  showTeam = true,
  showNotebook = true,
  showDrawer = true,
  deskPrompt,
  busy,
  voiceSupported,
  voiceListening,
  narrowLayout,
  speechRecognitionCtor,
  PromptIcon,
  MicIcon,
  MicActiveIcon,
  ButtonIcon,
  copy,
  onPromptChange,
  onSubmit,
  onMicToggleClick,
  onMicPointerDown,
  onMicPointerUp,
  onMicLostPointerCapture,
  thinkingOpen,
  onToggleThinking,
  canToggleThinking = true,
  russStreak,
  controls,
  runTransform,
  runAnalyze,
  onHuddle,
  onCallMeeting,
  contentModeOptions,
  contentMode,
  onPickMode,
  latestCritique,
  canFixFromCritique,
  handleFixFromCritique,
  handleClearDiagram,
  loading,
  streamingPreview,
  deskDrawerTourOpen = false,
  tourHighlight = null,
  entryTourActive = false,
  entryTourStep = null,
  entryTourProgress = null,
  entryPointers = [],
  entryTourCopy = null,
  onAdvanceEntryTour,
  onDismissEntryTour
}) {
  const tourTip =
    entryTourActive && entryTourStep && entryTourStep !== 'welcome' ? entryTourStep : null;
  const tourPointerProps = {
    pointers: entryPointers,
    activeId: tourTip,
    eyebrow: entryTourCopy?.deskEyebrow,
    progress: entryTourProgress,
    onAdvance: onAdvanceEntryTour,
    onDismiss: onDismissEntryTour,
    nextLabel: entryTourCopy?.next,
    doneLabel: entryTourCopy?.done,
    skipLabel: entryTourCopy?.skip
  };

  return (
    <div
      className={`button-group desk-primary-group desk-chrome-layout${entryTourActive ? ' is-entry-tour-active' : ''}`}
    >
      {tourTip ? <EntryDeskPointers {...tourPointerProps} /> : null}
      {showDeskSlot ? (
        <div
          id="office-desk-bottom-slot"
          ref={deskSlotRef}
          className={`desk-chrome-tool desk-tour-piece desk-tour-piece--desk${tourHighlight === 'desk' ? ' is-tour-highlight' : ''}`}
        />
      ) : null}
      {showWorkOrder ? (
        <div
          className={`desk-work-order-group desk-tour-piece desk-tour-piece--work-order${tourHighlight === 'work-order' ? ' is-tour-highlight' : ''}`}
        >
          <SlopNextPrompt
            layout="desk"
            prompt={deskPrompt}
            busy={busy}
            voiceSupported={voiceSupported}
            voiceListening={voiceListening}
            narrowLayout={narrowLayout}
            speechRecognitionCtor={speechRecognitionCtor}
            PromptIcon={PromptIcon}
            MicIcon={MicIcon}
            MicActiveIcon={MicActiveIcon}
            ButtonIcon={ButtonIcon}
            copy={copy}
            onPromptChange={onPromptChange}
            onSubmit={onSubmit}
            onMicToggleClick={onMicToggleClick}
            onMicPointerDown={onMicPointerDown}
            onMicPointerUp={onMicPointerUp}
            onMicLostPointerCapture={onMicLostPointerCapture}
          />
          <span hidden data-testid="desk-prompt-change-wired">
            {typeof onPromptChange === 'function' ? 'yes' : 'no'}
          </span>
        </div>
      ) : null}
      {showTeam ? (
        <div
          className={`desk-chrome-tool desk-tour-piece desk-tour-piece--team${tourHighlight === 'team' ? ' is-tour-highlight' : ''}`}
        >
          <DeskPeopleCluster
            russStreak={russStreak}
            controls={controls}
            runTransform={runTransform}
            runAnalyze={runAnalyze}
            busy={busy}
            onHuddle={onHuddle}
            onCallMeeting={onCallMeeting}
          />
        </div>
      ) : null}
      {showDrawer ? (
        <div
          className={`desk-chrome-tool desk-tour-piece desk-tour-piece--drawer${tourHighlight === 'format' ? ' is-tour-highlight' : ''}`}
        >
          <DeskDrawer
            modes={contentModeOptions}
            currentMode={contentMode}
            onPickMode={onPickMode}
            canFix={Boolean(latestCritique?.text)}
            fixDisabled={!canFixFromCritique}
            onFix={() => handleFixFromCritique('all')}
            onDemolish={() => handleClearDiagram()}
            busy={busy}
            modeDisabled={loading || streamingPreview}
            forceOpen={deskDrawerTourOpen}
          />
        </div>
      ) : null}
      {/* Notebook last so it sits nearest the right-side Notebook / Thinking pane. */}
      {showNotebook ? (
        <div
          className={`desk-chrome-tool desk-tour-piece desk-tour-piece--notebook${tourHighlight === 'notebook' ? ' is-tour-highlight' : ''}`}
        >
          <DeskNotebookButton
            thinkingOpen={thinkingOpen}
            onToggleThinking={onToggleThinking}
            disabled={!canToggleThinking}
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * Bottom-row desk actions: Work order, team, notebook, and desk tray chrome.
 *
 * @param {object} props
 */
export function DeskBottomActionsSlot({
  hasCanvasContent,
  insightsOpen,
  entryReveal = null,
  narrowLayout,
  busy,
  loading,
  streamingPreview,
  controls,
  contentMode,
  contentModeOptions,
  deskSlotRef,
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
  canToggleThinking = true,
  entryTourActive = false,
  entryTourStep = null,
  entryTourProgress = null,
  entryPointers = [],
  entryTourCopy = null,
  onAdvanceEntryTour,
  onDismissEntryTour
}) {
  const reveal = entryReveal ?? {
    workOrder: true,
    desk: true,
    team: true,
    notebook: true,
    drawer: true
  };
  const layoutClass = narrowLayout ? 'prompt-actions--mobile' : 'prompt-actions--desktop';

  const chromeProps = {
    deskSlotRef,
    showDeskSlot: reveal.desk,
    showTeam: reveal.team,
    showNotebook: reveal.notebook,
    showDrawer: reveal.drawer,
    deskPrompt,
    busy,
    voiceSupported,
    voiceListening,
    narrowLayout,
    speechRecognitionCtor,
    PromptIcon,
    MicIcon,
    MicActiveIcon,
    ButtonIcon,
    copy: controls.prompt,
    onPromptChange: setDeskPrompt,
    onSubmit: handleDeskPromptSubmit,
    onMicToggleClick: handleMicToggleClick,
    onMicPointerDown: handleMicPointerDown,
    onMicPointerUp: handleMicPointerUp,
    onMicLostPointerCapture: () => stopVoiceInput(),
    thinkingOpen: insightsOpen,
    onToggleThinking,
    canToggleThinking,
    russStreak,
    controls,
    runTransform,
    runAnalyze,
    onHuddle,
    onCallMeeting,
    contentModeOptions,
    contentMode,
    onPickMode: handleSelectContentMode,
    latestCritique,
    canFixFromCritique,
    handleFixFromCritique,
    handleClearDiagram,
    loading,
    streamingPreview,
    deskDrawerTourOpen: entryTourActive && entryTourStep === 'format',
    tourHighlight: entryTourActive && entryTourStep !== 'welcome' ? entryTourStep : null,
    entryTourActive,
    entryTourStep,
    entryTourProgress,
    entryPointers,
    entryTourCopy,
    onAdvanceEntryTour,
    onDismissEntryTour
  };

  if (!hasCanvasContent && !insightsOpen) {
    return (
      <div
        className={`prompt-actions prompt-actions--entry-desk entry-desk-integrated${entryTourActive ? ' entry-desk-tour-reveal' : ''}${entryTourStep ? ` entry-desk-tour-reveal--${entryTourStep}` : ''} ${layoutClass}`}
        data-tour-step={entryTourStep ?? undefined}
      >
        <DeskChromeRow {...chromeProps} />
      </div>
    );
  }

  // Notebook-only chrome: active session with the pane open but no canvas yet
  // (streaming intent, analysis-only run, etc.) — keep the toggle reachable.
  if (!hasCanvasContent) {
    return (
      <div className={`prompt-actions prompt-actions--notebook-only ${layoutClass}`}>
        <DeskChromeRow
          {...chromeProps}
          showDeskSlot={false}
          showWorkOrder={false}
          showTeam={false}
          showDrawer={false}
          showNotebook
        />
      </div>
    );
  }

  return (
    <div className={`prompt-actions ${layoutClass}`}>
      <DeskChromeRow
        {...chromeProps}
        showDeskSlot={!insightsOpen}
        showTeam
        showNotebook
        showDrawer
      />
    </div>
  );
}
