import { useState } from 'react';
import SlopNextPrompt from '../../components/SlopNextPrompt.jsx';
import StakeholdersMascot from '../../components/StakeholdersMascot.jsx';
import DeskNotebookButton from '../../components/DeskNotebookButton.jsx';
import DeskTalkComposer from '../../components/DeskTalkComposer.jsx';
import EntryDeskPointers from '../../components/EntryDeskPointers.jsx';
import { officeChromeCopy } from '../../utils/officeCast.js';
import { russShapeLabel } from '../../utils/renderModeAction.js';

/**
 * The roster sits between the two composer lanes because it answers both of
 * them: the action chip **delegates** (lane 1's channel — the only one that
 * spends pipeline compute), the name/face **addresses** (lane 2's channel).
 *
 * Fix rides on Jared's row as a second chip. It acts on the critique he just
 * wrote, and until now it lived in three places, none of them next to him.
 *
 * Pair rides on every row for the same reason Fix rides on Jared's: it is an
 * act aimed at *that person*, so it belongs where their face is. Mob stays up
 * top in the team-actions block, because it is aimed at nobody in particular.
 * Both start the same slice; only mob ends by itself.
 */
function DeskPeopleCluster({
  russStreak,
  controls,
  runTransform,
  runAnalyze,
  busy,
  onHuddle,
  onPair,
  onAddress,
  canFixFromCritique,
  hasCritique,
  onFixFromCritique
}) {
  const actions = controls.actions ?? {};
  const deskCopy = officeChromeCopy().desk;
  const pairAction = (variant) =>
    typeof onPair === 'function'
      ? {
          id: 'pair',
          emoji: '🪑',
          label: deskCopy.pairAction ?? 'Pair',
          title: deskCopy.pairActionTitle ?? deskCopy.pairAction,
          onClick: () => onPair(variant)
        }
      : null;
  const withPair = (variant, extras = []) => {
    const pair = pairAction(variant);
    const all = [...extras, ...(pair ? [pair] : [])];
    return all.length > 0 ? all : undefined;
  };
  return (
    <div className="desk-people-group">
      <StakeholdersMascot
        personas={[
          {
            variant: 'gilfoyle',
            onClick: () => runTransform('gilfoyle', { useDiagramFocus: true }),
            extraActions: withPair('gilfoyle')
          },
          {
            variant: 'dinesh',
            onClick: () => runTransform('dinesh', { useDiagramFocus: true }),
            extraActions: withPair('dinesh')
          },
          {
            variant: 'erlich',
            onClick: () => runTransform('erlich', { useDiagramFocus: true }),
            extraActions: withPair('erlich')
          },
          {
            variant: 'russ',
            label: russShapeLabel(russStreak, actions),
            onClick: () => runTransform('russ', { useDiagramFocus: true }),
            extraActions: withPair('russ')
          },
          {
            variant: 'jared',
            onClick: () => runAnalyze('jared', { useDiagramFocus: true }),
            // Only offered once Jared has actually written something to fix;
            // disabled until the actionable bullets parse and the agent is idle.
            extraActions: withPair(
              'jared',
              hasCritique
                ? [
                    {
                      id: 'fix',
                      emoji: '🛠️',
                      label: actions.facilities ?? actions.fix ?? 'Fix',
                      title: actions.facilitiesTitle ?? actions.fixTitle,
                      disabled: !canFixFromCritique,
                      onClick: () => onFixFromCritique?.('all')
                    }
                  ]
                : []
            )
          },
          {
            variant: 'richard',
            onClick: () => runAnalyze('richard', { useDiagramFocus: true }),
            extraActions: withPair('richard')
          },
          {
            variant: 'barker',
            senior: true,
            onClick: () => runTransform('barker', { useDiagramFocus: true }),
            extraActions: withPair('barker')
          }
        ]}
        busy={busy}
        onHuddle={onHuddle}
        canHuddle={!busy}
        onAddress={onAddress}
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
  liveStreamingEntry = null,
  russStreak,
  controls,
  runTransform,
  runAnalyze,
  onHuddle,
  onPair,
  onCallMeeting,
  showTalk = true,
  talkTarget = null,
  onAddressTeammate,
  onClearTalkTarget,
  onTalk,
  talkDisabled = false,
  talkDisabledReason = null,
  canFixFromCritique = false,
  hasCritique = false,
  onFixFromCritique,
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
            onPair={onPair}
            onCallMeeting={onCallMeeting}
            onAddress={onAddressTeammate}
            canFixFromCritique={canFixFromCritique}
            hasCritique={hasCritique}
            onFixFromCritique={onFixFromCritique}
          />
        </div>
      ) : null}
      {/* Lane 2. Two composers side by side, not a toggle: the work order goes
          to the canvas, this goes to the room. Conflating them would make every
          throwaway remark cost a pipeline run. */}
      {showTalk ? (
        <div className="desk-talk-group desk-tour-piece desk-tour-piece--talk">
          <DeskTalkComposer
            target={talkTarget}
            onClearTarget={onClearTalkTarget}
            onSubmit={onTalk}
            disabled={talkDisabled}
            disabledReason={talkDisabledReason}
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
            liveEntry={liveStreamingEntry}
            busy={busy}
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * Bottom-row desk actions: Work order, team, and notebook.
 *
 * Deliverable format, Shredder and Facilities left this row with the Desk tray
 * in slice 2 — format and Shredder are menu-bar items now (`DeskOsMenuBar`),
 * and Fix rejoins the team beside Jared, whose critique it acts on.
 *
 * @param {object} props
 */
export function DeskBottomActionsSlot({
  hasCanvasContent,
  insightsOpen,
  entryReveal = null,
  narrowLayout,
  busy,
  controls,
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
  onPair,
  onCallMeeting,
  onTalk,
  talkDisabled = false,
  talkDisabledReason = null,
  latestCritique = null,
  canFixFromCritique = false,
  handleFixFromCritique,
  onToggleThinking,
  canToggleThinking = true,
  liveStreamingEntry = null,
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
    notebook: true
  };
  const layoutClass = narrowLayout ? 'prompt-actions--mobile' : 'prompt-actions--desktop';

  /**
   * Who lane 2 is addressing. Local on purpose: this is composer state, not
   * office state — the floor's equivalent is walking up to somebody, which it
   * already tracks itself. Nothing here needs a second renderer (ADR-0011 r1).
   */
  const [talkTarget, setTalkTarget] = useState(/** @type {string | null} */ (null));

  const chromeProps = {
    deskSlotRef,
    showDeskSlot: reveal.desk,
    showTeam: reveal.team,
    showNotebook: reveal.notebook,
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
    liveStreamingEntry,
    russStreak,
    controls,
    runTransform,
    runAnalyze,
    onHuddle,
    onPair,
    onCallMeeting,
    showTalk: typeof onTalk === 'function',
    talkTarget,
    onAddressTeammate: typeof onTalk === 'function' ? (variant) => setTalkTarget(variant) : null,
    onClearTalkTarget: () => setTalkTarget(null),
    onTalk: (colleagueId, text) => onTalk?.(colleagueId, text),
    talkDisabled,
    talkDisabledReason,
    canFixFromCritique,
    hasCritique: Boolean(latestCritique?.text),
    onFixFromCritique: handleFixFromCritique,
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
  // (streaming intent, analysis-only run, etc.) — keep desk + notebook reachable.
  if (!hasCanvasContent) {
    return (
      <div className={`prompt-actions prompt-actions--notebook-only ${layoutClass}`}>
        <DeskChromeRow {...chromeProps} showWorkOrder={false} showTeam={false} showNotebook />
      </div>
    );
  }

  return (
    <div className={`prompt-actions ${layoutClass}`}>
      <DeskChromeRow {...chromeProps} showTeam showNotebook />
    </div>
  );
}
