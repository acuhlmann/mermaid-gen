import { useCallback } from 'react';
import { streamDiagramAgent } from '../../state/diagramStore.js';
import {
  applyAgentStreamInsightEvent,
  closeOpenInsightPhases
} from '../../state/applyAgentStreamInsightEvent';
import { buildAgentStreamInsightContext } from '../../state/agentStreamInsightContext';
import { buildInsightRetryDescriptor } from '../../utils/insightRetryDescriptor.js';
import { resolveAgentStreamFailureStatus } from '../../utils/agentStreamFailureStatus.js';
import {
  playCritiquePenStab,
  playCritiqueScribbleLoop,
  playCritiqueTokenTick,
  playDraftTick,
  playExplainPageFlipLoop,
  playExplainTokenTick,
  playFailureChime,
  playGoMadAirhornBlast,
  playGoMadKlaxonLoop,
  playGoMadStreamStart,
  playGoMadTokenTick,
  playInnovateStreamStart,
  playInnovateSynthLoop,
  playInnovateTokenTick,
  playPhaseChangePluck,
  playRefinePolishLoop,
  playRefineStreamStart,
  playRefineTokenTick,
  playStreamStartChime,
  playTokenTickChime,
  playToolEndChime,
  playToolStartChime
} from '../../utils/agentChimes.js';

/**
 * Run a streaming agent request into the Thinking pane (intent/transform/analyze).
 *
 * @param {{
 *   activeSessionId: string;
 *   contentMode: string;
 *   modelProfile: string;
 *   controls: object;
 *   streamAgentAbortRef: import('react').MutableRefObject<AbortController | null>;
 *   lastTokenSoundAtRef: import('react').MutableRefObject<number>;
 *   goMadTokenTickIndexRef: import('react').MutableRefObject<number>;
 *   lastDraftTickAtRef: import('react').MutableRefObject<number>;
 *   sessionTopicRef: import('react').MutableRefObject<string | null>;
 *   crossModeSyncRef: import('react').MutableRefObject<object>;
 *   pendingAutoDiagramHighlightRef: import('react').MutableRefObject<object | null>;
 *   pendingAutoDiagramHighlightTimeoutRef: import('react').MutableRefObject<ReturnType<typeof setTimeout> | null>;
 *   agentCostEstimatesRef: import('react').MutableRefObject<object>;
 *   autoCloseActiveEntryIdRef: import('react').MutableRefObject<string | null>;
 *   setInsightsOpen: (open: boolean) => void;
 *   setGoMadStreak: import('react').Dispatch<import('react').SetStateAction<number>>;
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
  controls,
  streamAgentAbortRef,
  lastTokenSoundAtRef,
  goMadTokenTickIndexRef,
  lastDraftTickAtRef,
  sessionTopicRef,
  crossModeSyncRef,
  pendingAutoDiagramHighlightRef,
  pendingAutoDiagramHighlightTimeoutRef,
  agentCostEstimatesRef,
  autoCloseActiveEntryIdRef,
  setInsightsOpen,
  setGoMadStreak,
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
      const retryDescriptor = buildInsightRetryDescriptor({
        operation,
        payload,
        variant,
        topic,
        modelProfile: payload.modelProfile ?? modelProfile,
        modeSwitchSync,
        modeSwitchPeerRevisionId,
        modeSwitchPeerMode,
        focusNode: payload.focusNode
      });
      const sectionId = appendInsightEntry(title, variant, {
        diagramUndoBaseline,
        topic,
        retryDescriptor,
        contentType: payload.contentType ?? contentMode,
        modelProfile: payload.modelProfile ?? modelProfile
      });
      if (diagramUndoBaseline) {
        autoCloseActiveEntryIdRef.current = sectionId;
      }
      if (variant === 'goMad') tryAgentSound(playGoMadStreamStart);
      else if (variant === 'innovate') tryAgentSound(playInnovateStreamStart);
      else if (variant === 'refine') tryAgentSound(playRefineStreamStart);
      else tryAgentSound(playStreamStartChime);
      lastTokenSoundAtRef.current = 0;
      goMadTokenTickIndexRef.current = 0;
      const streamAcc = { text: '', estimatedCostUsd: 0 };
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
          goMadTokenTickIndexRef,
          lastDraftTickAtRef,
          tryAgentSound,
          playGoMadTokenTick,
          playTokenTickChime,
          playToolStartChime,
          playToolEndChime,
          playDraftTick,
          playFailureChime,
          playPhaseChangePluck,
          playRefineTokenTick,
          playInnovateTokenTick,
          playCritiqueTokenTick,
          playExplainTokenTick,
          playRefinePolishLoop,
          playInnovateSynthLoop,
          playGoMadKlaxonLoop,
          playGoMadAirhornBlast,
          playCritiqueScribbleLoop,
          playCritiquePenStab,
          playExplainPageFlipLoop,
          setLiveDraftSource,
          setLiveDraftContentType,
          setGoMadStreak,
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
          agentCostEstimates: agentCostEstimatesRef.current
        }
      );
      try {
        await streamDiagramAgent(
          payload,
          (evt) => {
            appendStreamDebugLog(sectionId, evt);
            applyAgentStreamInsightEvent(streamAcc, streamCtx, evt);
          },
          { signal: abortCtrl.signal, sessionId: activeSessionId }
        );
      } catch (err) {
        const aborted =
          err?.name === 'AbortError' ||
          (typeof DOMException !== 'undefined' &&
            err instanceof DOMException &&
            err.name === 'AbortError');
        if (aborted) {
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
      goMadTokenTickIndexRef,
      lastDraftTickAtRef,
      lastTokenSoundAtRef,
      modelProfile,
      patchInsightEntry,
      agentCostEstimatesRef,
      crossModeSyncRef,
      pendingAutoDiagramHighlightRef,
      pendingAutoDiagramHighlightTimeoutRef,
      sessionTopicRef,
      setGoMadStreak,
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
