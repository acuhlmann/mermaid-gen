import EntryDeskIntro from '../../components/EntryDeskIntro.jsx';
import EntryDeskPointers from '../../components/EntryDeskPointers.jsx';
import EntryRenderAs from '../../components/EntryRenderAs.jsx';
import SlopNextPrompt from '../../components/SlopNextPrompt.jsx';
import StakeholdersMascot from '../../components/StakeholdersMascot.jsx';
import DeskDrawer from '../../components/DeskDrawer.jsx';
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

function DeskWorkOrderPrompt({
  deskSlotRef,
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
  onMicLostPointerCapture
}) {
  return (
    <div className="button-group desk-primary-group">
      <div id="office-desk-bottom-slot" ref={deskSlotRef} className="bottom-office-desk-slot" />
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
    </div>
  );
}

/**
 * Bottom-row desk actions: empty-state entry desk, fallback topic form, and canvas chrome.
 *
 * @param {object} props
 */
export function DeskBottomActionsSlot({
  hasCanvasContent,
  insightsOpen,
  showEntryDeskIntro,
  showEntryDeskPointers,
  narrowLayout,
  busy,
  loading,
  streamingPreview,
  controls,
  userName,
  contentMode,
  contentModeOptions,
  deskSlotRef,
  deskPrompt,
  setDeskPrompt,
  prompt,
  setPrompt,
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
  startVoiceInput,
  dismissEntryDeskPointers,
  handleEntryRenderAsPick,
  runIntentChange,
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
  error,
  status
}) {
  if (!hasCanvasContent && !insightsOpen) {
    if (showEntryDeskIntro) {
      return (
        <div className="entry-desk-integrated">
          <EntryDeskIntro
            copy={controls.prompt.entryIntro}
            userName={userName}
            role={controls.prompt.entryIntro?.role ?? controls.prompt.exampleRole}
          />
          {showEntryDeskPointers ? (
            <EntryDeskPointers
              pointers={controls.prompt.entryPointers}
              onDismiss={dismissEntryDeskPointers}
            />
          ) : null}
          <div
            className={`prompt-actions prompt-actions--entry-desk${narrowLayout ? ' prompt-actions--mobile' : ' prompt-actions--desktop'}`}
          >
            <DeskWorkOrderPrompt
              deskSlotRef={deskSlotRef}
              deskPrompt={deskPrompt}
              busy={busy}
              voiceSupported={voiceSupported}
              voiceListening={voiceListening}
              narrowLayout={narrowLayout}
              speechRecognitionCtor={speechRecognitionCtor}
              PromptIcon={PromptIcon}
              MicIcon={MicIcon}
              MicActiveIcon={MicActiveIcon}
              ButtonIcon={ButtonIcon}
              copy={controls.prompt}
              onPromptChange={setDeskPrompt}
              onSubmit={handleDeskPromptSubmit}
              onMicToggleClick={handleMicToggleClick}
              onMicPointerDown={handleMicPointerDown}
              onMicPointerUp={handleMicPointerUp}
              onMicLostPointerCapture={() => stopVoiceInput()}
            />
          </div>
          <EntryRenderAs
            label={controls.prompt.renderAsLabel}
            hint={controls.prompt.renderAsHint}
            ariaLabel={controls.prompt.renderAsAria}
            modes={contentModeOptions}
            currentMode={contentMode}
            onPickMode={handleEntryRenderAsPick}
            pickPrefix={controls.modeReveal.pickPrefix}
            disabled={busy || loading || streamingPreview}
          />
        </div>
      );
    }

    return (
      <div className="entry-desk-fallback">
        <EntryRenderAs
          label={controls.prompt.renderAsLabel}
          hint={controls.prompt.renderAsHint}
          ariaLabel={controls.prompt.renderAsAria}
          modes={contentModeOptions}
          currentMode={contentMode}
          onPickMode={handleEntryRenderAsPick}
          pickPrefix={controls.modeReveal.pickPrefix}
          disabled={busy || loading || streamingPreview}
        />
        <form className="prompt-control" onSubmit={runIntentChange}>
          <label className="sr-only" htmlFor="diagram-change-prompt">
            {controls.prompt.yourTopic}
          </label>
          <input
            id="diagram-change-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={controls.prompt.topicPlaceholder || controls.prompt.yourTopic}
            disabled={busy}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={status ? 'app-status' : undefined}
          />
          <div className="prompt-actions-main">
            <button
              type="button"
              className={`overlay-button ${voiceListening ? 'is-listening' : ''}`}
              disabled={!voiceSupported || busy}
              {...(narrowLayout
                ? {
                    onPointerUp: (event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      handleMicToggleClick(event);
                    }
                  }
                : {
                    onPointerDown: handleMicPointerDown,
                    onPointerUp: handleMicPointerUp,
                    onPointerCancel: handleMicPointerUp,
                    onLostPointerCapture: () => stopVoiceInput(),
                    onKeyDown: (event) => {
                      if (event.repeat) return;
                      if (event.key === ' ' || event.key === 'Enter') {
                        event.preventDefault();
                        startVoiceInput();
                      }
                    },
                    onKeyUp: (event) => {
                      if (event.key === ' ' || event.key === 'Enter') {
                        event.preventDefault();
                        stopVoiceInput();
                      }
                    }
                  })}
              aria-label={
                narrowLayout
                  ? voiceListening
                    ? controls.prompt.tapToStop
                    : controls.prompt.tapToDictate
                  : controls.prompt.holdToSpeak
              }
              aria-pressed={narrowLayout ? voiceListening : undefined}
              title={
                voiceSupported
                  ? narrowLayout
                    ? voiceListening
                      ? controls.prompt.tapToStop
                      : controls.prompt.tapToDictatePrompt
                    : controls.prompt.holdToDictate
                  : speechRecognitionCtor
                    ? controls.prompt.voiceNeedsHttps
                    : controls.prompt.voiceUnsupported
              }
            >
              <ButtonIcon>{voiceListening ? <MicActiveIcon /> : <MicIcon />}</ButtonIcon>
              <span className="button-label">{controls.prompt.mic}</span>
            </button>
            <button
              type="submit"
              className="overlay-button primary-button"
              disabled={busy || !prompt.trim()}
            >
              <ButtonIcon>{'>'}</ButtonIcon>
              <span className="button-label">{controls.prompt.doIt}</span>
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (!hasCanvasContent) return null;

  const layoutClass = narrowLayout ? 'prompt-actions--mobile' : 'prompt-actions--desktop';

  return (
    <div className={`prompt-actions ${layoutClass}`}>
      <div className="button-group desk-primary-group">
        <div id="office-desk-bottom-slot" ref={deskSlotRef} className="bottom-office-desk-slot" />
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
          copy={controls.prompt}
          onPromptChange={setDeskPrompt}
          onSubmit={handleDeskPromptSubmit}
          onMicToggleClick={handleMicToggleClick}
          onMicPointerDown={handleMicPointerDown}
          onMicPointerUp={handleMicPointerUp}
          onMicLostPointerCapture={() => stopVoiceInput()}
        />
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
        <DeskDrawer
          modes={contentModeOptions}
          currentMode={contentMode}
          onPickMode={handleSelectContentMode}
          canFix={Boolean(latestCritique?.text)}
          fixDisabled={!canFixFromCritique}
          onFix={() => handleFixFromCritique('all')}
          onDemolish={() => handleClearDiagram()}
          busy={busy}
          modeDisabled={loading || streamingPreview}
        />
      </div>
    </div>
  );
}
