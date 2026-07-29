import OfficeLayer from '../../components/OfficeLayer.jsx';
import { resolveUserName } from '../../state/userIdentityStore.js';
import {
  buildAdvisorIntentPrompt,
  buildOfficeBatchIntentPrompt
} from '../../utils/advisorActionContext.js';

/**
 * Office layer wiring from the app shell.
 */
export function OfficeLayerSlot({
  officeDistractionsPaused,
  officeCanvasGrace,
  advisor,
  stateRef,
  contentMode,
  activeSessionId,
  gamification,
  reportAdvisorUsage,
  submitIntentWithPrompt,
  setInsightsEntries,
  handleOfficeEvent,
  setXpInfoPanelOpen,
  setOutboxOpenSignal,
  setEditorOpen,
  setInviteDialogOpen,
  hasCanvasContent,
  editorOpen,
  setInsightsOpen,
  modelProfile,
  setModelProfile,
  callMeetingSignal,
  huddleSignal,
  diagramSource,
  insightsOpen,
  tryAgentSound,
  officeRunSignal,
  entryReveal,
  narrowLayout
}) {
  return (
    <OfficeLayer
      pause={officeDistractionsPaused}
      suppressDistractions={officeCanvasGrace}
      advisorBusy={Boolean(advisor.activePersona || advisor.thinkingPersona)}
      getDiagramSource={() => stateRef.current?.diagramSource ?? ''}
      getContentType={() => contentMode}
      getSessionId={() => activeSessionId}
      getSvgRoot={() => (typeof document !== 'undefined' ? document : null)}
      getUserTitle={() => gamification.levelTitle}
      getUserName={() => resolveUserName()}
      onUsage={reportAdvisorUsage}
      onAdoptPrompt={(text) => {
        void submitIntentWithPrompt(buildAdvisorIntentPrompt(text), {});
      }}
      onAdoptAllPrompts={(prompts) => {
        const prompt = buildOfficeBatchIntentPrompt(prompts);
        if (!prompt) return;
        void submitIntentWithPrompt(prompt, {});
      }}
      onMeetingMinutes={(entry) => setInsightsEntries((prev) => [...prev, entry])}
      onOfficeEvent={handleOfficeEvent}
      onCheckHrProgression={() => setXpInfoPanelOpen((open) => !open)}
      onOpenOutbox={() => setOutboxOpenSignal((n) => n + 1)}
      onToggleEditor={() => setEditorOpen((current) => !current)}
      onInviteAgent={() => setInviteDialogOpen(true)}
      canToggleEditor={hasCanvasContent || editorOpen}
      editorOpen={editorOpen}
      onToggleThinking={() => setInsightsOpen((v) => !v)}
      modelProfile={modelProfile}
      onSelectModelProfile={setModelProfile}
      callMeetingSignal={callMeetingSignal}
      huddleSignal={huddleSignal}
      canOpenOutbox={Boolean((diagramSource ?? '').trim())}
      canToggleThinking
      thinkingOpen={insightsOpen}
      playChime={tryAgentSound}
      runSignal={officeRunSignal}
      deskActionsAnchorReady={entryReveal.desk}
      deskMenuInitialOpen={false}
      deskActionsLayoutKey={narrowLayout ? 'mobile' : 'desktop'}
    />
  );
}
