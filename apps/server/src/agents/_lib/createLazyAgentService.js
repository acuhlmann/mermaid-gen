import { isLlmConfigured, LlmNotConfiguredError } from '../llmProvider.js';
import { emitAnalyzeStreamArtifactsBeforeFinal } from '../agentStreamAnalyzeFinalize.js';
import { emitIntentTransformStreamResult } from './diagramAgentStreamResult.js';

/**
 * Build a lazy wrapper around a per-content-type diagram agent service.
 * Defers construction until first use (so a session never instantiates a
 * model when nobody calls the agent) and routes SSE streaming for all
 * three operations through one place.
 *
 * Both diagram agents (mermaid, infographic) previously open-coded the
 * same lazy-wrap + runAgentStream pattern, with the only deltas being:
 *   - which optional methods exist (`invoke` and `applyStyleIntent` are
 *     mermaid-only)
 *   - the phase labels in the SSE stream
 *   - which fields the per-type intent/transform calls accept beyond the
 *     common ones
 *
 * The config below makes those deltas explicit; everything else is
 * shared. Adding a third diagram type doesn't require re-implementing
 * the streaming protocol.
 *
 * @param {{
 *   contentType: 'mermaid' | 'infographic' | 'metaphor3d' | 'chart' | 'anything' | 'forms',
 *   stateStore: { getSlot: Function, setLastUserPrompt: Function, mirrorLastUserPromptToSibling: Function },
 *   env: NodeJS.ProcessEnv,
 *   buildService: () => Record<string, Function>,
 *   streamLabels: { analyze: string, intent: string, transform: string },
 *   intentExtraFields?: string[],
 *   transformExtraFields?: string[],
 *   analyzeExtraFields?: string[],
 *   supportsInvoke?: boolean,
 *   supportsStyleIntent?: boolean
 * }} config
 */
export function createLazyAgentService({
  contentType,
  stateStore,
  env,
  buildService,
  streamLabels,
  intentExtraFields = [],
  transformExtraFields = [],
  analyzeExtraFields = [],
  supportsInvoke = false,
  supportsStyleIntent = false
}) {
  let agentService;

  function getAgentService() {
    if (!isLlmConfigured(env)) {
      throw new LlmNotConfiguredError();
    }
    agentService ??= buildService();
    return agentService;
  }

  function pickExtras(payload, fields) {
    const extras = {};
    for (const field of fields) {
      if (payload[field] !== undefined) extras[field] = payload[field];
    }
    return extras;
  }

  const proxy = {
    async applyIntent(input) {
      return getAgentService().applyIntent(input);
    },
    async applyTransformIntent(input) {
      return getAgentService().applyTransformIntent(input);
    },
    async applyAnalyzeIntent(input) {
      return getAgentService().applyAnalyzeIntent(input);
    },
    async runAgentStream(operation, payload, emit) {
      const agent = getAgentService();
      const modelProfile = payload.modelProfile;

      if (typeof emit === 'function') {
        if (operation === 'analyze') {
          emit({ type: 'phase', id: 'analyze', label: streamLabels.analyze });
        } else if (operation === 'intent') {
          emit({ type: 'phase', id: 'intent', label: streamLabels.intent });
        } else {
          emit({ type: 'phase', id: 'transform', label: streamLabels.transform });
        }
      }

      if (operation === 'analyze') {
        const result = await agent.applyAnalyzeIntent({
          kind: payload.kind,
          focusNode: payload.focusNode,
          modelProfile,
          emit,
          ...pickExtras(payload, analyzeExtraFields)
        });
        emitAnalyzeStreamArtifactsBeforeFinal(emit, {
          kind: payload.kind,
          analyzeText: result.message,
          contentType: payload.contentType
        });
        emit({ type: 'final', revisionChanged: false, analyzeText: result.message });
        return result;
      }

      let agentResult;
      if (operation === 'intent') {
        agentResult = await agent.applyIntent({
          prompt: payload.prompt,
          settings: payload.settings ?? {},
          focusNode: payload.focusNode,
          modelProfile,
          emit,
          peerContext: payload.peerContext,
          abortSignal: payload.abortSignal,
          ...pickExtras(payload, intentExtraFields)
        });
      } else {
        agentResult = await agent.applyTransformIntent({
          mode: payload.mode,
          focusNode: payload.focusNode,
          modelProfile,
          emit,
          russDepth: payload.russDepth,
          abortSignal: payload.abortSignal,
          ...pickExtras(payload, transformExtraFields)
        });
      }

      emitIntentTransformStreamResult({
        emit,
        operation,
        revisionBefore: payload._revisionBefore,
        stateStore,
        agentResult,
        prompt: payload.prompt,
        contentType
      });

      return agentResult;
    }
  };

  // Optional methods — only wired through when the config opts in.
  // Both methods are mermaid-only today. Declaring them at config time
  // (rather than via runtime feature-detection on the built service)
  // keeps the lazy wrapper's interface visible from the call site.
  if (supportsInvoke) {
    proxy.invoke = async (input) => getAgentService().invoke(input);
  }
  if (supportsStyleIntent) {
    proxy.applyStyleIntent = async (input) => getAgentService().applyStyleIntent(input);
  }

  return proxy;
}
