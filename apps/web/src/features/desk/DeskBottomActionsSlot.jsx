import SlopNextPrompt from '../../components/SlopNextPrompt.jsx';
import StakeholdersMascot from '../../components/StakeholdersMascot.jsx';
import DeskDrawer from '../../components/DeskDrawer.jsx';
import DeskNotebookButton from '../../components/DeskNotebookButton.jsx';
import ConcentrationControl from '../../components/ConcentrationControl.jsx';
import EntryDeskPointers from '../../components/EntryDeskPointers.jsx';
import { goMadShapeLabel } from '../../utils/renderModeAction.js';

function DeskPeopleCluster({
  goMadStreak,
  controls,
  runTransform,
  runAnalyze,
  advisor,
  advisorBubbleProps,
  stakeholderIntroProps,
  advisorPause,
  diagramSource,
  busy,
  onCallMeeting
}) {
  return (
    <div className="desk-people-group">
      <StakeholdersMascot
        personas={[
          { variant: 'refine', onClick: () => runTransform('refine', { useDiagramFocus: true }) },
          {
            variant: 'innovate',
            onClick: () => runTransform('innovate', { useDiagramFocus: true })
          },
          {
            variant: 'goMad',
            label: goMadShapeLabel(goMadStreak, controls.actions),
            onClick: () => runTransform('goMad', { useDiagramFocus: true })
          },
          { variant: 'critique', onClick: () => runAnalyze('critique', { useDiagramFocus: true }) },
          { variant: 'explain', onClick: () => runAnalyze('explain', { useDiagramFocus: true }) },
          {
            variant: 'exec',
            senior: true,
            onClick: () => runTransform('exec', { useDiagramFocus: true })
          }
        ]}
        activeAdvisorVariant={advisor.activePersona}
        thinkingPersona={advisor.thinkingPersona}
        busy={busy}
        bubbleProps={advisorBubbleProps}
        onSelectVariant={(variant) => advisor.promptNext({ persona: variant })}
        castDisabled={busy || Boolean(advisor.thinkingPersona)}
        introProps={stakeholderIntroProps}
        isMuted={advisor.isMuted}
        onToggleMute={() => advisor.toggleMute()}
        onTalkToTeam={() => advisor.promptNext({})}
        onCallMeeting={onCallMeeting}
        canTalkToTeam={
          Boolean((diagramSource ?? '').trim()) && !advisor.thinkingPersona && !advisorPause
        }
        canCallMeeting={Boolean((diagramSource ?? '').trim())}
      />
    </div>
  );
}

function DeskChromeRow({
  deskSlotRef,
  showDeskSlot = true,
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
  modelProfile = 'fast',
  onSelectModelProfile,
  goMadStreak,
  controls,
  runTransform,
  runAnalyze,
  advisor,
  advisorBubbleProps,
  stakeholderIntroProps,
  advisorPause,
  diagramSource,
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

  return (
    <div
      className={`button-group desk-primary-group desk-chrome-layout${entryTourActive ? ' is-entry-tour-active' : ''}`}
    >
      {showDeskSlot ? (
        <div
          id="office-desk-bottom-slot"
          ref={deskSlotRef}
          className={`desk-chrome-tool desk-tour-piece desk-tour-piece--desk${tourHighlight === 'desk' ? ' is-tour-highlight' : ''}`}
        >
          {tourTip === 'desk' ? (
            <EntryDeskPointers
              pointers={entryPointers}
              activeId="desk"
              eyebrow={entryTourCopy?.deskEyebrow}
              progress={entryTourProgress}
              onAdvance={onAdvanceEntryTour}
              onDismiss={onDismissEntryTour}
              nextLabel={entryTourCopy?.next}
              doneLabel={entryTourCopy?.done}
              skipLabel={entryTourCopy?.skip}
            />
          ) : null}
        </div>
      ) : null}
      <div
        className={`desk-work-order-group desk-tour-piece desk-tour-piece--work-order${tourHighlight === 'work-order' ? ' is-tour-highlight' : ''}`}
      >
        {tourTip === 'work-order' ? (
          <EntryDeskPointers
            pointers={entryPointers}
            activeId="work-order"
            eyebrow={entryTourCopy?.deskEyebrow}
            progress={entryTourProgress}
            onAdvance={onAdvanceEntryTour}
            onDismiss={onDismissEntryTour}
            nextLabel={entryTourCopy?.next}
            doneLabel={entryTourCopy?.done}
            skipLabel={entryTourCopy?.skip}
          />
        ) : null}
        <div className="desk-work-order-concentration">
          <ConcentrationControl
            variant="footer"
            modelProfile={modelProfile}
            onSelectModelProfile={onSelectModelProfile}
            compact
          />
        </div>
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
      {showTeam ? (
        <div
          className={`desk-chrome-tool desk-tour-piece desk-tour-piece--team${tourHighlight === 'team' ? ' is-tour-highlight' : ''}`}
        >
          {tourTip === 'team' ? (
            <EntryDeskPointers
              pointers={entryPointers}
              activeId="team"
              eyebrow={entryTourCopy?.deskEyebrow}
              progress={entryTourProgress}
              onAdvance={onAdvanceEntryTour}
              onDismiss={onDismissEntryTour}
              nextLabel={entryTourCopy?.next}
              doneLabel={entryTourCopy?.done}
              skipLabel={entryTourCopy?.skip}
            />
          ) : null}
          <DeskPeopleCluster
            goMadStreak={goMadStreak}
            controls={controls}
            runTransform={runTransform}
            runAnalyze={runAnalyze}
            advisor={advisor}
            advisorBubbleProps={advisorBubbleProps}
            stakeholderIntroProps={stakeholderIntroProps}
            advisorPause={advisorPause}
            diagramSource={diagramSource}
            busy={busy}
            onCallMeeting={onCallMeeting}
          />
        </div>
      ) : null}
      {showNotebook ? (
        <div
          className={`desk-chrome-tool desk-tour-piece desk-tour-piece--notebook${tourHighlight === 'notebook' ? ' is-tour-highlight' : ''}`}
        >
          {tourTip === 'notebook' ? (
            <EntryDeskPointers
              pointers={entryPointers}
              activeId="notebook"
              eyebrow={entryTourCopy?.deskEyebrow}
              progress={entryTourProgress}
              onAdvance={onAdvanceEntryTour}
              onDismiss={onDismissEntryTour}
              nextLabel={entryTourCopy?.next}
              doneLabel={entryTourCopy?.done}
              skipLabel={entryTourCopy?.skip}
            />
          ) : null}
          <DeskNotebookButton
            thinkingOpen={thinkingOpen}
            onToggleThinking={onToggleThinking}
            disabled={!canToggleThinking}
            busy={busy}
          />
        </div>
      ) : null}
      {showDrawer ? (
        <div
          className={`desk-chrome-tool desk-tour-piece desk-tour-piece--drawer${tourHighlight === 'format' ? ' is-tour-highlight' : ''}`}
        >
          {tourTip === 'format' ? (
            <EntryDeskPointers
              pointers={entryPointers}
              activeId="format"
              eyebrow={entryTourCopy?.deskEyebrow}
              progress={entryTourProgress}
              onAdvance={onAdvanceEntryTour}
              onDismiss={onDismissEntryTour}
              nextLabel={entryTourCopy?.next}
              doneLabel={entryTourCopy?.done}
              skipLabel={entryTourCopy?.skip}
            />
          ) : null}
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
  advisor,
  advisorBubbleProps,
  stakeholderIntroProps,
  advisorPause,
  goMadStreak,
  diagramSource,
  onCallMeeting,
  handleSelectContentMode,
  latestCritique,
  canFixFromCritique,
  handleFixFromCritique,
  handleClearDiagram,
  onToggleThinking,
  canToggleThinking = true,
  modelProfile = 'fast',
  onSelectModelProfile,
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
    modelProfile,
    onSelectModelProfile,
    goMadStreak,
    controls,
    runTransform,
    runAnalyze,
    advisor,
    advisorBubbleProps,
    stakeholderIntroProps,
    advisorPause,
    diagramSource,
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

  if (!hasCanvasContent) return null;

  return (
    <div className={`prompt-actions ${layoutClass}`}>
      <DeskChromeRow {...chromeProps} showTeam showNotebook showDrawer />
    </div>
  );
}
