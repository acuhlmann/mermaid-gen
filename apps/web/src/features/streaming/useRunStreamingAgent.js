import { useCallback } from 'react';
import { trackRunOutcome } from '../../state/uxSignalsClient.js';
import { streamDiagramAgent } from '../../state/diagramStore.js';
import {
  applyAgentStreamInsightEvent,
  closeOpenInsightPhases
} from '../../state/applyAgentStreamInsightEvent';
import { buildAgentStreamInsightContext } from '../../state/agentStreamInsightContext';
import { buildInsightRetryDescriptor } from '../../utils/insightRetryDescriptor.js';
import { resolveAgentStreamFailureStatus } from '../../utils/agentStreamFailureStatus.js';
import {
  playJaredPenStab,
  playJaredScribbleLoop,
  playJaredTokenTick,
  playDraftTick,
  playRichardPageFlipLoop,
  playRichardTokenTick,
  playFailureChime,
  playRussAirhornBlast,
  playRussKlaxonLoop,
  playRussStreamStart,
  playRussTokenTick,
  playErlichStreamStart,
  playErlichSynthLoop,
  playErlichTokenTick,
  playPhaseChangePluck,
  playGilfoylePolishLoop,
  playDineshInsistLoop,
  playDineshStreamStart,
  playDineshTokenTick,
  playGilfoyleStreamStart,
  playGilfoyleTokenTick,
  playStreamStartChime,
  playTokenTickChime,
  playToolEndChime,
  playToolStartChime
} from '../../utils/agentChimes.js';

/** The opening chime for each cast variant; anything else gets the generic one. */
const STREAM_START_CHIMES = new Map([
  ['russ', playRussStreamStart],
  ['erlich', playErlichStreamStart],
  ['gilfoyle', playGilfoyleStreamStart],
  ['dinesh', playDineshStreamStart]
]);

function isAbortError(err) {
  if (err?.name === 'AbortError') return true;
  return (
    typeof DOMException !== 'undefined' && err instanceof DOMException && err.name === 'AbortError'
  );
}

/**
 * Run a streaming agent request into the Thinking pane (intent/transform/analyze).
 *
 * @param {{
 *   activeSessionId: string;
 *   contentMode: string;
 *   modelProfile: string;
 *   uiLocale?: string;
 *   controls: object;
 *   streamAgentAbortRef: import('react').MutableRefObject<AbortController | null>;
 *   lastTokenSoundAtRef: import('react').MutableRefObject<number>;
 *   russTokenTickIndexRef: import('react').MutableRefObject<number>;
 *   lastDraftTickAtRef: import('react').MutableRefObject<number>;
 *   sessionTopicRef: import('react').MutableRefObject<string | null>;
 *   crossModeSyncRef: import('react').MutableRefObject<object>;
 *   pendingAutoDiagramHighlightRef: import('react').MutableRefObject<object | null>;
 *   pendingAutoDiagramHighlightTimeoutRef: import('react').MutableRefObject<ReturnType<typeof setTimeout> | null>;
 *   agentCostEstimatesRef: import('react').MutableRefObject<object>;
 *   autoCloseActiveEntryIdRef: import('react').MutableRefObject<string | null>;
 *   setInsightsOpen: (open: boolean) => void;
 *   setRussStreak: import('react').Dispatch<import('react').SetStateAction<number>>;
 *   setLiveDraftSource: (value: string) => void;
 *   setLiveDraftContentType: (value: string | null) => void;
 *   appendInsightEntry: Function;
 *   patchInsightEntry: Function;
 *   appendToInsight: Function;
 *   setInsightStatus: Function;
 *   appendTechnicalAction: Function;
 *   annotateTechnicalActionResult: Function;
 *   finalizeTechnicalActionResult: Function;
 *   enrichTechnicalActionDetail: Function;
 *   appendStreamDebugLog: Function;
 *   animateAcceptedSource: Function;
 *   applyResolvedContentMode: (contentType: string) => void;
 *   triggerCompletionDelight: Function;
 *   tryAgentSound: (playFn: (ctx: unknown) => void) => void;
 * }} deps
 */
export function useRunStreamingAgent({
  activeSessionId,
  contentMode,
  modelProfile,
  uiLocale,
  controls,
  streamAgentAbortRef,
  lastTokenSoundAtRef,
  russTokenTickIndexRef,
  lastDraftTickAtRef,
  sessionTopicRef,
  crossModeSyncRef,
  pendingAutoDiagramHighlightRef,
  pendingAutoDiagramHighlightTimeoutRef,
  agentCostEstimatesRef,
  autoCloseActiveEntryIdRef,
  setInsightsOpen,
  setRussStreak,
  setLiveDraftSource,
  setLiveDraftContentType,
  appendInsightEntry,
  patchInsightEntry,
  appendToInsight,
  setInsightStatus,
  appendTechnicalAction,
  annotateTechnicalActionResult,
  finalizeTechnicalActionResult,
  enrichTechnicalActionDetail,
  appendStreamDebugLog,
  animateAcceptedSource,
  applyResolvedContentMode,
  triggerCompletionDelight,
  tryAgentSound
}) {
  const runStreamingAgent = useCallback(
    async ({
      operation,
      payload,
      title,
      onFinal,
      variant = 'general',
      diagramUndoBaseline,
      topic,
      modeSwitchSync = false,
      modeSwitchPeerRevisionId = null,
      modeSwitchPeerMode = null
    }) => {
      setInsightsOpen(true);
      const runContentType = payload.contentType ?? contentMode;
      const runProfile = payload.modelProfile ?? modelProfile;
      const retryDescriptor = buildInsightRetryDescriptor({
        operation,
        payload,
        variant,
        topic,
        modelProfile: runProfile,
        modeSwitchSync,
        modeSwitchPeerRevisionId,
        modeSwitchPeerMode,
        focusNode: payload.focusNode
      });
      const sectionId = appendInsightEntry(title, variant, {
        diagramUndoBaseline,
        topic,
        retryDescriptor,
        contentType: runContentType,
        modelProfile: runProfile
      });
      if (diagramUndoBaseline) {
        autoCloseActiveEntryIdRef.current = sectionId;
      }
      tryAgentSound(STREAM_START_CHIMES.get(variant) ?? playStreamStartChime);
      lastTokenSoundAtRef.current = 0;
      russTokenTickIndexRef.current = 0;
      const streamAcc = { text: '', estimatedCostUsd: 0 };
      const runOutcome = trackRunOutcome({ contentType: runContentType, profile: runProfile });
      const abortCtrl = new AbortController();
      streamAgentAbortRef.current = abortCtrl;
      const streamCtx = buildAgentStreamInsightContext(
        sectionId,
        operation,
        variant,
        diagramUndoBaseline,
        {
          patchInsightEntry,
          appendToInsight,
          setInsightStatus,
          appendTechnicalAction,
          annotateTechnicalActionResult,
          finalizeTechnicalActionResult,
          enrichTechnicalActionDetail,
          lastTokenSoundAtRef,
          russTokenTickIndexRef,
          lastDraftTickAtRef,
          tryAgentSound,
          playRussTokenTick,
          playTokenTickChime,
          playToolStartChime,
          playToolEndChime,
          playDraftTick,
          playFailureChime,
          playPhaseChangePluck,
          playGilfoyleTokenTick,
          playDineshTokenTick,
          playErlichTokenTick,
          playJaredTokenTick,
          playRichardTokenTick,
          playGilfoylePolishLoop,
          playDineshInsistLoop,
          playErlichSynthLoop,
          playRussKlaxonLoop,
          playRussAirhornBlast,
          playJaredScribbleLoop,
          playJaredPenStab,
          playRichardPageFlipLoop,
          setLiveDraftSource,
          setLiveDraftContentType,
          setRussStreak,
          sessionTopicRef,
          crossModeSyncRef,
          modeSwitchSync,
          modeSwitchPeerRevisionId,
          modeSwitchPeerMode,
          animateAcceptedSource,
          pendingAutoDiagramHighlightRef,
          pendingAutoDiagramHighlightTimeoutRef,
          triggerCompletionDelight,
          onFinal,
          onContentTypeResolved: ({ contentType }) => {
            applyResolvedContentMode(contentType);
          },
          onRunOutcome: runOutcome.note,
          agentCostEstimates: agentCostEstimatesRef.current
        }
      );
      try {
        await streamDiagramAgent(
          { ...payload, ...(uiLocale != null ? { uiLocale } : {}) },
          (evt) => {
            appendStreamDebugLog(sectionId, evt);
            applyAgentStreamInsightEvent(streamAcc, streamCtx, evt);
          },
          { signal: abortCtrl.signal, sessionId: activeSessionId }
        );
      } catch (err) {
        if (isAbortError(err)) {
          runOutcome.note('cancelled');
          patchInsightEntry(sectionId, (entry) => ({
            ...entry,
            status: 'cancelled',
            statusText: controls.loading.stopped,
            completedAt: Date.now(),
            phases: closeOpenInsightPhases(entry.phases, Date.now())
          }));
        } else {
          appendToInsight(
            sectionId,
            `\n\n**${controls.insights?.errorPrefix ?? 'Error'}:** ${err.message}\n`
          );
          tryAgentSound(playFailureChime);
          const failure = resolveAgentStreamFailureStatus({
            operation,
            message: err.message,
            copy: controls.insights?.streamFailures
          });
          runOutcome.note('failed', failure.failureClass);
          patchInsightEntry(sectionId, (entry) => ({
            ...entry,
            status: 'failed',
            statusText: failure.statusText,
            failureClass: failure.failureClass,
            failureDetail: failure.detail,
            completedAt: Date.now(),
            phases: closeOpenInsightPhases(entry.phases, Date.now())
          }));
        }
      } finally {
        if (streamAgentAbortRef.current === abortCtrl) {
          streamAgentAbortRef.current = null;
        }
        runOutcome.finish();
      }
    },
    [
      activeSessionId,
      animateAcceptedSource,
      appendInsightEntry,
      appendStreamDebugLog,
      appendTechnicalAction,
      annotateTechnicalActionResult,
      appendToInsight,
      applyResolvedContentMode,
      autoCloseActiveEntryIdRef,
      contentMode,
      controls,
      enrichTechnicalActionDetail,
      finalizeTechnicalActionResult,
      russTokenTickIndexRef,
      lastDraftTickAtRef,
      lastTokenSoundAtRef,
      modelProfile,
      uiLocale,
      patchInsightEntry,
      agentCostEstimatesRef,
      crossModeSyncRef,
      pendingAutoDiagramHighlightRef,
      pendingAutoDiagramHighlightTimeoutRef,
      sessionTopicRef,
      setRussStreak,
      setInsightStatus,
      setInsightsOpen,
      setLiveDraftContentType,
      setLiveDraftSource,
      streamAgentAbortRef,
      triggerCompletionDelight,
      tryAgentSound
    ]
  );

  return { runStreamingAgent };
}
