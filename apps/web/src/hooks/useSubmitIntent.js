import { useCallback } from 'react';
import { isContentMode } from '../utils/renderModeAction.js';
import { playSubmitThunk } from '../utils/agentChimes.js';
import { goIntentInsightTitle } from '../utils/goIntentInsightTitle.js';
import { topicFromDescriptor } from '../utils/appInsightHelpers.js';
import { resolveAdvisorFocusNode } from '../utils/advisorActionContext.js';
import { formatFormAnswer } from '../utils/formatFormAnswer.js';

/**
 * Intent submission flow: Go / topic starters / desk & radial prompts / forms gauntlet.
 *
 * @param {{
 *   applyLocaleFromText: (text: string) => void;
 *   closeRadialMenuRef: import('react').MutableRefObject<(() => void) | null>;
 *   closeSlopPrompt: () => void;
 *   contentMode: string;
 *   controls: object;
 *   hasInteractedRef: import('react').MutableRefObject<boolean>;
 *   loadingRef: import('react').MutableRefObject<boolean>;
 *   modelProfile: string;
 *   prompt: string;
 *   radialMenuSession: object | null;
 *   runStreamingAgent: (args: object) => Promise<void>;
 *   selectedNode: object | null;
 *   setActiveRequest: (value: string | null) => void;
 *   setDeskPrompt: (value: string) => void;
 *   setError: (value: string) => void;
 *   setRussStreak: (value: number | ((prev: number) => number)) => void;
 *   setInsightsOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
 *   setLatestCritique: (value: object | null) => void;
 *   setLoading: (value: boolean) => void;
 *   setPrompt: (value: string) => void;
 *   setSelectedNode: (value: object | null) => void;
 *   slopPromptSource: string | null;
 *   streamingPreviewRef: import('react').MutableRefObject<boolean>;
 *   syncDiagramOrThrow: () => Promise<object>;
 *   tryAgentSound: (playFn: (ctx: unknown) => void) => void;
 * }} deps
 */
export function useSubmitIntent({
  applyLocaleFromText,
  closeRadialMenuRef,
  closeSlopPrompt,
  contentMode,
  controls,
  hasInteractedRef,
  loadingRef,
  modelProfile,
  prompt,
  radialMenuSession,
  runStreamingAgent,
  selectedNode,
  setActiveRequest,
  setDeskPrompt,
  setError,
  setRussStreak,
  setInsightsOpen,
  setLatestCritique,
  setLoading,
  setPrompt,
  setSelectedNode,
  slopPromptSource,
  streamingPreviewRef,
  syncDiagramOrThrow,
  tryAgentSound
}) {
  const submitIntentWithPrompt = useCallback(
    async (nextPrompt, options = {}) => {
      const trimmed = (nextPrompt ?? '').trim();
      if (!trimmed) return;
      applyLocaleFromText(trimmed);
      if (!options.skipLoadingGuard && (loadingRef.current || streamingPreviewRef.current)) {
        return;
      }

      setInsightsOpen(true);
      tryAgentSound(playSubmitThunk);
      setRussStreak(0);
      const focusNode = resolveAdvisorFocusNode({
        advisorFocusDescriptor: options.advisorFocusDescriptor,
        focusTarget: options.focusTarget,
        selectedNode
      });
      const titleSelection =
        options.focusTarget ??
        (options.advisorFocusDescriptor?.id ? options.advisorFocusDescriptor : null) ??
        selectedNode;
      const requestContentType = isContentMode(options.contentTypeOverride)
        ? options.contentTypeOverride
        : contentMode;
      setLoading(true);
      setActiveRequest('intent');
      setError('');

      try {
        // Mode-switch auto-rerun passes `stateOverride` so we don't need to wait for React's
        // setState flush. Without it, syncDiagramOrThrow would read stale `stateRef.current`
        // (the OLD mode's slot) and submit the wrong revisionId.
        const syncedState = options.stateOverride
          ? options.stateOverride
          : await syncDiagramOrThrow();
        await runStreamingAgent({
          operation: 'intent',
          payload: {
            operation: 'intent',
            prompt: trimmed,
            revisionId: syncedState.revisionId,
            diagramSource: syncedState.diagramSource,
            contentType: requestContentType,
            settings: {},
            focusNode,
            modelProfile,
            ...(options.peerContext ? { peerContext: options.peerContext } : {}),
            ...(options.transformPersona ? { transformPersona: options.transformPersona } : {})
          },
          title: goIntentInsightTitle(trimmed, titleSelection, controls.insights?.goIntent),
          variant: options.variantOverride ?? 'intent',
          diagramUndoBaseline: { ...syncedState },
          topic: topicFromDescriptor(titleSelection),
          modeSwitchSync: Boolean(options.modeSwitchSync),
          modeSwitchPeerRevisionId:
            options.modeSwitchPeerRevisionId != null ? options.modeSwitchPeerRevisionId : null,
          modeSwitchPeerMode: options.modeSwitchPeerMode ?? null
        });
        // Retain the prompt so the user can see and refine the current topic. Mode-switch
        // carry-over relies on this too — the textarea is the visible source of truth for
        // "the topic this session is currently about."
      } catch (err) {
        setError(err.message);
      } finally {
        setLatestCritique(null);
        setLoading(false);
        setActiveRequest(null);
      }
    },
    [
      applyLocaleFromText,
      contentMode,
      controls.insights?.goIntent,
      loadingRef,
      modelProfile,
      runStreamingAgent,
      selectedNode,
      setActiveRequest,
      setError,
      setRussStreak,
      setInsightsOpen,
      setLatestCritique,
      setLoading,
      streamingPreviewRef,
      syncDiagramOrThrow,
      tryAgentSound
    ]
  );

  const runIntentChange = useCallback(
    async (event) => {
      event.preventDefault();
      hasInteractedRef.current = true;
      await submitIntentWithPrompt(prompt.trim());
    },
    [hasInteractedRef, prompt, submitIntentWithPrompt]
  );

  const handleFormSubmit = useCallback(
    async ({ formTitle, formCode, buttonLabel, answers } = {}) => {
      if (loadingRef.current || streamingPreviewRef.current) return;
      hasInteractedRef.current = true;
      const codeStr = formCode ? ` (${formCode})` : '';
      const summarized = Array.isArray(answers)
        ? answers
            .map(({ label, value }) => `${label}: ${formatFormAnswer(value)}`)
            .filter(Boolean)
            .join('; ')
        : '';
      const nextPrompt = [
        `The user completed the form "${formTitle}"${codeStr} and clicked "${buttonLabel || 'Submit'}".`,
        summarized
          ? `Their answers were — ${summarized}.`
          : 'They submitted it with no fields filled in.',
        'Now issue the NEXT form in the endless corporate gauntlet: acknowledge these answers with bureaucratic non-sequiturs, invent a fresh reason more information is needed, bump the form code, and add new tedium. Never declare the process complete — there is always another form.'
      ].join(' ');
      await submitIntentWithPrompt(nextPrompt, {
        contentTypeOverride: 'forms',
        variantOverride: 'intent'
      });
    },
    [hasInteractedRef, loadingRef, streamingPreviewRef, submitIntentWithPrompt]
  );

  const handleStarterPick = useCallback(
    async (text) => {
      const trimmed = (text ?? '').trim();
      if (!trimmed) return;
      setPrompt(trimmed);
      hasInteractedRef.current = true;
      await submitIntentWithPrompt(trimmed);
    },
    [hasInteractedRef, setPrompt, submitIntentWithPrompt]
  );

  const handleSlopPromptSubmit = useCallback(
    async (text) => {
      const trimmed = (text ?? '').trim();
      if (!trimmed) return;
      const radialDescriptor =
        slopPromptSource === 'radial' ? (radialMenuSession?.descriptor ?? null) : null;
      closeSlopPrompt();
      setInsightsOpen(true);
      if (radialDescriptor) {
        closeRadialMenuRef.current?.();
      }
      hasInteractedRef.current = true;
      if (radialDescriptor) {
        setSelectedNode(radialDescriptor);
      }
      await submitIntentWithPrompt(trimmed, {
        focusTarget: radialDescriptor ?? undefined
      });
    },
    [
      closeRadialMenuRef,
      closeSlopPrompt,
      hasInteractedRef,
      radialMenuSession?.descriptor,
      setInsightsOpen,
      setSelectedNode,
      slopPromptSource,
      submitIntentWithPrompt
    ]
  );

  const handleDeskPromptSubmit = useCallback(
    async (text) => {
      const trimmed = (text ?? '').trim();
      if (!trimmed) return;
      hasInteractedRef.current = true;
      setInsightsOpen(true);
      setDeskPrompt('');
      await submitIntentWithPrompt(trimmed);
    },
    [hasInteractedRef, setDeskPrompt, setInsightsOpen, submitIntentWithPrompt]
  );

  return {
    submitIntentWithPrompt,
    runIntentChange,
    handleFormSubmit,
    handleStarterPick,
    handleSlopPromptSubmit,
    handleDeskPromptSubmit
  };
}
