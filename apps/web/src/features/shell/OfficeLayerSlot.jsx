import OfficeLayer from '../../components/OfficeLayer.jsx';
import { resolveUserName } from '../../state/userIdentityStore.js';
import { actionPersonaName } from '../../utils/appActionPersonas.js';
import {
  buildAdvisorIntentPrompt,
  buildOfficeBatchIntentPrompt
} from '../../utils/advisorActionContext.js';
import { officeSenderInfo } from '../../utils/officeCast.js';
import { VARIANT_PERSONAS } from '../../utils/slopitectCopy.js';

function variantFromColleague(colleagueId) {
  if (!colleagueId || !Object.prototype.hasOwnProperty.call(VARIANT_PERSONAS, colleagueId)) {
    return null;
  }
  return colleagueId;
}

function colleagueDisplayName(colleagueId) {
  if (!colleagueId) return undefined;
  if (Object.prototype.hasOwnProperty.call(VARIANT_PERSONAS, colleagueId)) {
    return actionPersonaName(colleagueId);
  }
  return officeSenderInfo(colleagueId)?.name;
}

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
  callMeetingSignal,
  huddleSignal,
  talkSignal = null,
  agentBusy = false,
  tryAgentSound,
  officeRunSignal,
  entryReveal
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
      onAdoptPrompt={(text, colleagueId) => {
        const delegateName = colleagueDisplayName(colleagueId);
        const variant = variantFromColleague(colleagueId);
        void submitIntentWithPrompt(buildAdvisorIntentPrompt(text), {
          titlePrompt: text,
          delegateName,
          ...(variant ? { variantOverride: variant } : {})
        });
      }}
      onAdoptAllPrompts={(prompts) => {
        const prompt = buildOfficeBatchIntentPrompt(prompts);
        if (!prompt) return;
        void submitIntentWithPrompt(prompt, {
          titlePrompt: prompts.length === 1 ? prompts[0] : undefined
        });
      }}
      onMeetingMinutes={(entry) => setInsightsEntries((prev) => [...prev, entry])}
      onOfficeEvent={handleOfficeEvent}
      callMeetingSignal={callMeetingSignal}
      huddleSignal={huddleSignal}
      talkSignal={talkSignal}
      agentBusy={agentBusy}
      playChime={tryAgentSound}
      runSignal={officeRunSignal}
      deskActionsAnchorReady={entryReveal.desk}
    />
  );
}
