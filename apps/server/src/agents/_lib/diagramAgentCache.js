import { normalizeModelProfile, resolveLlmBackend, resolveModelId } from '../llmProvider.js';
import {
  clampGoMadDepth,
  goMadTransformModelOptions,
  transformModeModelOptions
} from '../mermaidAnalysisPrompts.js';

/**
 * Per-agent caches for chat-model instances and built LangChain agents.
 * Both diagram agents used to maintain their own identical caches; this
 * module centralizes the keying scheme so adding a new agent type can't
 * accidentally drift on cache shape.
 *
 * The cache is per-service (i.e. per content type, per session-services
 * registration) — agents that need a stable variant share the same `Map`
 * but key under a different namespace.
 *
 * @param {{
 *   env: NodeJS.ProcessEnv,
 *   systemPrompt: string,
 *   tools: unknown[],
 *   chatModelFactory: (env: NodeJS.ProcessEnv, options: Record<string, unknown>) => unknown,
 *   createAgentImpl: (config: Record<string, unknown>) => unknown,
 *   middleware?: unknown[]
 * }} args
 */
export function createDiagramAgentCache({
  env,
  systemPrompt,
  tools,
  chatModelFactory,
  createAgentImpl,
  middleware
}) {
  const agentCache = new Map();
  const analysisModelCache = new Map();
  const agentExtras = middleware && middleware.length > 0 ? { middleware } : {};

  function chatModelFor(modelProfile, extraOptions = {}) {
    const backend = resolveLlmBackend(env, modelProfile);
    const modelId = resolveModelId(env, modelProfile, backend);
    return chatModelFactory(env, { model: modelId, backend, modelProfile, ...extraOptions });
  }

  function resolveModelLabel(modelProfile) {
    const p = normalizeModelProfile(modelProfile);
    const backend = resolveLlmBackend(env, p);
    if (!backend) return null;
    const modelId = resolveModelId(env, p, backend);
    return `${backend}:${modelId}`;
  }

  /** Default intent / Go agent — no transform sampling. */
  function getDefaultAgent(profile = 'fast') {
    const p = normalizeModelProfile(profile);
    const backend = resolveLlmBackend(env, p);
    const modelId = resolveModelId(env, p, backend);
    const key = `default:${backend}:${modelId}`;
    if (!agentCache.has(key)) {
      agentCache.set(
        key,
        createAgentImpl({
          model: chatModelFor(p),
          tools,
          systemPrompt,
          ...agentExtras
        })
      );
    }
    return agentCache.get(key);
  }

  /** Gilfoyle / Erlich / Go Mad / Align / Barker agent. */
  function getTransformAgent(mode, profile = 'fast', goMadDepth) {
    const p = normalizeModelProfile(profile);
    const backend = resolveLlmBackend(env, p);
    const modelId = resolveModelId(env, p, backend);
    const madDepth = mode === 'goMad' ? clampGoMadDepth(goMadDepth) : null;
    const key =
      mode === 'goMad'
        ? `transform:${mode}:${backend}:${modelId}:d${madDepth}`
        : `transform:${mode}:${backend}:${modelId}`;
    if (!agentCache.has(key)) {
      const tm = chatModelFor(p, transformModeModelOptions(mode, madDepth ?? 1));
      agentCache.set(
        key,
        createAgentImpl({
          model: tm,
          tools,
          systemPrompt,
          ...agentExtras
        })
      );
    }
    return agentCache.get(key);
  }

  /**
   * Build a custom agent (e.g. the infographic "stable intent" variant at
   * low temperature) using the shared cache. Key namespace is caller-chosen
   * so it can't collide with default / transform keys.
   */
  function getCustomAgent({ keyPrefix, profile = 'fast', modelOptions = {} }) {
    const p = normalizeModelProfile(profile);
    const backend = resolveLlmBackend(env, p);
    const modelId = resolveModelId(env, p, backend);
    const key = `${keyPrefix}:${backend}:${modelId}`;
    if (!agentCache.has(key)) {
      agentCache.set(
        key,
        createAgentImpl({
          model: chatModelFor(p, modelOptions),
          tools,
          systemPrompt,
          ...agentExtras
        })
      );
    }
    return agentCache.get(key);
  }

  /** Analysis chat model — no tools, reused across critique/explain runs. */
  function getAnalysisModel(backend, modelId, kind) {
    const key = `analysis:${backend}:${modelId}:${kind}`;
    if (!analysisModelCache.has(key)) {
      analysisModelCache.set(
        key,
        chatModelFactory(env, {
          model: modelId,
          backend,
          temperature: kind === 'jared' ? 0.52 : 0.42,
          maxTokens: 1800,
          maxOutputTokens: 1800
        })
      );
    }
    return analysisModelCache.get(key);
  }

  return {
    chatModelFor,
    resolveModelLabel,
    getDefaultAgent,
    getTransformAgent,
    getCustomAgent,
    getAnalysisModel,
    // Re-exposed for callers that need the raw helper without re-importing.
    goMadTransformModelOptions,
    transformModeModelOptions
  };
}
