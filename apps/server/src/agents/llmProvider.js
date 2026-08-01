import { ChatOpenRouter } from '@langchain/openrouter';
import { ChatOpenAI } from '@langchain/openai';
import { ChatVertexAI } from '@langchain/google-vertexai';

/**
 * Default Vertex model ids when VERTEX_MODEL_FAST / VERTEX_MODEL_QUALITY are unset.
 * Target when GA on your project/region: Fast=gemini-3.5-flash, Quality=gemini-3.1-pro-preview.
 * Verified on mermaidgen/us-central1 (May 2026): 3.x returns NOT_FOUND; 2.5 tier is available.
 */
export const DEFAULT_VERTEX_MODEL_FAST = 'gemini-2.5-flash';
export const DEFAULT_VERTEX_MODEL_QUALITY = 'gemini-2.5-pro';
/**
 * Ultra-low-latency Vertex slug for decorative / salvage paths (office, advisor,
 * label explain, Auto classifier, syntax-fixer lite rung). Brain Fast stays on
 * {@link DEFAULT_VERTEX_MODEL_FAST} so canvas tool agents keep full Flash.
 */
export const DEFAULT_VERTEX_MODEL_LITE = 'gemini-2.5-flash-lite';

/** Default DeepSeek API model ids (OpenAI-compatible https://api.deepseek.com). */
export const DEFAULT_DEEPSEEK_MODEL_FAST = 'deepseek-v4-flash';
export const DEFAULT_DEEPSEEK_MODEL_QUALITY = 'deepseek-v4-pro';
export const DEFAULT_DEEPSEEK_API_BASE = 'https://api.deepseek.com';

/** Default OpenRouter slugs when OPENROUTER_MODEL* are unset. */
export const DEFAULT_OPENROUTER_MODEL_FAST = 'google/gemini-2.5-flash-lite';
export const DEFAULT_OPENROUTER_MODEL_FLASH = 'google/gemini-2.5-flash';
export const DEFAULT_OPENROUTER_MODEL_QUALITY = 'qwen/qwen3-235b-a22b';

/** @typedef {'vertex' | 'openrouter' | 'deepseek'} LlmBackend */

export class LlmNotConfiguredError extends Error {
  constructor() {
    super(
      'No LLM backend is configured. For local dev set DEEPSEEK_API_KEY or OPENROUTER_API_KEY in .env, or configure Vertex (VERTEX_PROJECT_ID / GOOGLE_CLOUD_PROJECT + VERTEX_LOCATION + IAM). On Cloud Run enable Vertex with roles/aiplatform.user and optionally attach Secret Manager secrets deepseek-api-key (Brain Quality) and/or openrouter-api-key (see docs/deploy/gcp.md).'
    );
    this.name = 'LlmNotConfiguredError';
    this.statusCode = 503;
  }
}

/** @param {unknown} v */
function envTruthy(v) {
  if (v == null) return false;
  const s = String(v).trim().toLowerCase();
  return s !== '' && s !== '0' && s !== 'false' && s !== 'no' && s !== 'off';
}

/** @param {unknown} profile */
export function normalizeModelProfile(profile) {
  return profile === 'quality' ? 'quality' : 'fast';
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string}
 */
export function resolveVertexProjectId(env = process.env) {
  const explicit = typeof env.VERTEX_PROJECT_ID === 'string' ? env.VERTEX_PROJECT_ID.trim() : '';
  if (explicit) return explicit;
  const gcp = typeof env.GOOGLE_CLOUD_PROJECT === 'string' ? env.GOOGLE_CLOUD_PROJECT.trim() : '';
  if (gcp) return gcp;
  const gc = typeof env.GCLOUD_PROJECT === 'string' ? env.GCLOUD_PROJECT.trim() : '';
  return gc;
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string}
 */
export function resolveVertexLocation(env = process.env) {
  const loc = typeof env.VERTEX_LOCATION === 'string' ? env.VERTEX_LOCATION.trim() : '';
  return loc || 'us-central1';
}

/**
 * True when project id and region are available so Vertex can be constructed.
 * @param {NodeJS.ProcessEnv} [env]
 */
export function isVertexEnvConfigured(env = process.env) {
  return Boolean(resolveVertexProjectId(env)) && Boolean(resolveVertexLocation(env));
}

/**
 * @param {'fast' | 'quality'} profile
 * @param {NodeJS.ProcessEnv} [env]
 */
export function resolveVertexModelId(env = process.env, profile = 'fast') {
  const p = normalizeModelProfile(profile);
  const shared = typeof env.VERTEX_MODEL === 'string' ? env.VERTEX_MODEL.trim() : '';
  if (p === 'quality') {
    const quality =
      typeof env.VERTEX_MODEL_QUALITY === 'string' ? env.VERTEX_MODEL_QUALITY.trim() : '';
    if (quality) return quality;
    if (shared) return shared;
    return DEFAULT_VERTEX_MODEL_QUALITY;
  }
  const fast = typeof env.VERTEX_MODEL_FAST === 'string' ? env.VERTEX_MODEL_FAST.trim() : '';
  if (fast) return fast;
  if (shared) return shared;
  return DEFAULT_VERTEX_MODEL_FAST;
}

/**
 * Resolves OpenRouter model slug for UI profile (never trusts raw client model ids).
 * @param {NodeJS.ProcessEnv} [env]
 * @param {'fast' | 'quality'} [profile]
 */
export function resolveOpenRouterModelId(env = process.env, profile = 'fast') {
  const p = normalizeModelProfile(profile);
  const shared = typeof env.OPENROUTER_MODEL === 'string' ? env.OPENROUTER_MODEL.trim() : '';
  if (p === 'quality') {
    const quality =
      typeof env.OPENROUTER_MODEL_QUALITY === 'string' ? env.OPENROUTER_MODEL_QUALITY.trim() : '';
    if (quality) return quality;
    if (shared) return shared;
    return DEFAULT_OPENROUTER_MODEL_QUALITY;
  }
  const fast =
    typeof env.OPENROUTER_MODEL_FAST === 'string' ? env.OPENROUTER_MODEL_FAST.trim() : '';
  if (fast) return fast;
  if (shared) return shared;
  return DEFAULT_OPENROUTER_MODEL_FAST;
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string}
 */
export function resolveDeepSeekApiBase(env = process.env) {
  const raw = typeof env.DEEPSEEK_API_BASE === 'string' ? env.DEEPSEEK_API_BASE.trim() : '';
  return (raw || DEFAULT_DEEPSEEK_API_BASE).replace(/\/+$/, '');
}

/**
 * DeepSeek V4 defaults to thinking mode. Tool-calling agents must disable it unless the
 * client preserves `reasoning_content` on every assistant turn (LangChain does not yet).
 * Set DEEPSEEK_THINKING=1 only for single-shot / non-tool calls.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{ thinking: { type: 'enabled' | 'disabled' } }}
 */
export function resolveDeepSeekThinkingKwargs(env = process.env) {
  return envTruthy(env.DEEPSEEK_THINKING)
    ? { thinking: { type: 'enabled' } }
    : { thinking: { type: 'disabled' } };
}

/**
 * Resolves DeepSeek model id for UI profile.
 * @param {NodeJS.ProcessEnv} [env]
 * @param {'fast' | 'quality'} [profile]
 */
export function resolveDeepSeekModelId(env = process.env, profile = 'fast') {
  const p = normalizeModelProfile(profile);
  const shared = typeof env.DEEPSEEK_MODEL === 'string' ? env.DEEPSEEK_MODEL.trim() : '';
  if (p === 'quality') {
    const quality =
      typeof env.DEEPSEEK_MODEL_QUALITY === 'string' ? env.DEEPSEEK_MODEL_QUALITY.trim() : '';
    if (quality) return quality;
    if (shared) return shared;
    return DEFAULT_DEEPSEEK_MODEL_QUALITY;
  }
  const fast = typeof env.DEEPSEEK_MODEL_FAST === 'string' ? env.DEEPSEEK_MODEL_FAST.trim() : '';
  if (fast) return fast;
  if (shared) return shared;
  return DEFAULT_DEEPSEEK_MODEL_FAST;
}

/**
 * Model id for the active backend and Brain profile.
 * @param {NodeJS.ProcessEnv} [env]
 * @param {'fast' | 'quality'} [profile]
 * @param {LlmBackend} [backend]
 */
export function resolveModelId(
  env = process.env,
  profile = 'fast',
  backend = resolveLlmBackend(env, profile)
) {
  if (backend === 'vertex') return resolveVertexModelId(env, profile);
  if (backend === 'deepseek') return resolveDeepSeekModelId(env, profile);
  return resolveOpenRouterModelId(env, profile);
}

/**
 * True when auto mode can split Brain profiles across Vertex (Fast) and DeepSeek (Quality).
 * @param {NodeJS.ProcessEnv} [env]
 */
export function isHybridVertexDeepseek(env = process.env) {
  return isVertexEnvConfigured(env) && Boolean(env.DEEPSEEK_API_KEY);
}

/**
 * Resolve LLM backend. Optional `profile` enables hybrid Brain routing in `auto` mode:
 * when Vertex and DeepSeek are both configured, Fast → Vertex (Gemini Flash) and
 * Quality → DeepSeek (V4 Pro). Callers without a profile get the Fast/primary backend.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @param {'fast' | 'quality'} [profile]
 * @returns {LlmBackend | null}
 */
export function resolveLlmBackend(env = process.env, profile) {
  const raw = typeof env.LLM_PROVIDER === 'string' ? env.LLM_PROVIDER.trim().toLowerCase() : '';
  const mode = raw === 'vertex' || raw === 'openrouter' || raw === 'deepseek' ? raw : 'auto';

  if (mode === 'openrouter') {
    return env.OPENROUTER_API_KEY ? 'openrouter' : null;
  }
  if (mode === 'deepseek') {
    return env.DEEPSEEK_API_KEY ? 'deepseek' : null;
  }
  if (mode === 'vertex') {
    return isVertexEnvConfigured(env) ? 'vertex' : null;
  }

  if (envTruthy(env.OPENROUTER_PREFERRED) && env.OPENROUTER_API_KEY) {
    return 'openrouter';
  }

  // Hybrid Brain: Fast = low-latency Gemini Flash on Vertex; Quality = DeepSeek V4 Pro.
  if (isHybridVertexDeepseek(env)) {
    const p = profile != null ? normalizeModelProfile(profile) : 'fast';
    return p === 'quality' ? 'deepseek' : 'vertex';
  }

  if (env.K_SERVICE && isVertexEnvConfigured(env)) {
    return 'vertex';
  }
  if (env.DEEPSEEK_API_KEY) {
    return 'deepseek';
  }
  if (env.OPENROUTER_API_KEY) {
    return 'openrouter';
  }
  if (isVertexEnvConfigured(env)) {
    return 'vertex';
  }
  return null;
}

/**
 * True when at least one backend can serve requests with the current env and LLM_PROVIDER rules.
 * @param {NodeJS.ProcessEnv} [env]
 */
export function isLlmConfigured(env = process.env) {
  return resolveLlmBackend(env) != null;
}

/**
 * OpenRouter chat model (no routing — caller must have a key).
 * @param {NodeJS.ProcessEnv} env
 * @param {Record<string, unknown>} [overrides]
 */
export function createOpenRouterModel(env, overrides = {}) {
  if (!env.OPENROUTER_API_KEY) {
    throw new LlmNotConfiguredError();
  }

  const { temperature, model: explicitModel, ...rest } = overrides;
  const fields = {
    apiKey: env.OPENROUTER_API_KEY,
    siteName: env.OPENROUTER_SITE_NAME || 'ArchiSlop',
    siteUrl: env.OPENROUTER_SITE_URL || 'http://localhost:5173',
    ...rest
  };
  if (explicitModel !== undefined) {
    fields.model = explicitModel;
  }
  if (fields.model == null || fields.model === '') {
    throw new LlmNotConfiguredError();
  }
  if (temperature !== undefined) {
    fields.temperature = temperature;
  }

  return new ChatOpenRouter(fields);
}

/**
 * DeepSeek chat model (OpenAI-compatible API).
 * @param {NodeJS.ProcessEnv} env
 * @param {Record<string, unknown>} [overrides]
 */
export function createDeepSeekChatModel(env, overrides = {}) {
  if (!env.DEEPSEEK_API_KEY) {
    throw new LlmNotConfiguredError();
  }

  const {
    temperature,
    model: explicitModel,
    maxTokens,
    maxOutputTokens,
    modelKwargs: overrideModelKwargs,
    ...rest
  } = overrides;
  const fields = {
    apiKey: env.DEEPSEEK_API_KEY,
    configuration: { baseURL: `${resolveDeepSeekApiBase(env)}/v1` },
    modelKwargs: {
      ...resolveDeepSeekThinkingKwargs(env),
      ...(overrideModelKwargs && typeof overrideModelKwargs === 'object' ? overrideModelKwargs : {})
    },
    ...rest
  };
  if (explicitModel !== undefined) {
    fields.model = explicitModel;
  }
  if (fields.model == null || fields.model === '') {
    throw new LlmNotConfiguredError();
  }
  if (temperature !== undefined) {
    fields.temperature = temperature;
  }
  const cap = maxOutputTokens ?? maxTokens;
  if (cap !== undefined) {
    fields.maxTokens = cap;
  }
  return new ChatOpenAI(fields);
}

/**
 * Vertex AI chat model (ADC / metadata credentials on Cloud Run).
 * @param {NodeJS.ProcessEnv} env
 * @param {Record<string, unknown>} [overrides]
 */
export function createVertexChatModel(env, overrides = {}) {
  const project = resolveVertexProjectId(env);
  if (!project) {
    throw new LlmNotConfiguredError();
  }
  const location = resolveVertexLocation(env);
  const { temperature, model: explicitModel, maxTokens, maxOutputTokens, ...rest } = overrides;
  const restAuthOptions =
    rest.authOptions && typeof rest.authOptions === 'object' ? rest.authOptions : {};
  const fields = {
    ...rest,
    location,
    // LangChain builds Vertex URLs via GoogleAuth.getProjectId(), which does not read VERTEX_PROJECT_ID.
    authOptions: { ...restAuthOptions, projectId: project },
    // LangChain Gemini uses a single systemInstruction at index 0. Diagram agents stack
    // several system-role context messages (mutation mode, syntax pack, current source).
    convertSystemMessageToHumanContent: true
  };
  if (explicitModel !== undefined) {
    fields.model = explicitModel;
  }
  if (fields.model == null || fields.model === '') {
    throw new LlmNotConfiguredError();
  }
  if (temperature !== undefined) {
    fields.temperature = temperature;
  }
  const cap = maxOutputTokens ?? maxTokens;
  if (cap !== undefined) {
    fields.maxOutputTokens = cap;
  }
  return new ChatVertexAI(fields);
}

/**
 * @param {NodeJS.ProcessEnv} env
 * @param {LlmBackend} backend
 * @param {Record<string, unknown>} [overrides]
 */
export function createChatModelForBackend(env, backend, overrides = {}) {
  if (backend === 'vertex') {
    if (!isVertexEnvConfigured(env)) {
      throw new LlmNotConfiguredError();
    }
    return createVertexChatModel(env, overrides);
  }
  if (backend === 'deepseek') {
    return createDeepSeekChatModel(env, overrides);
  }
  return createOpenRouterModel(env, overrides);
}

/**
 * Unified factory: Vertex, DeepSeek, or OpenRouter from `resolveLlmBackend`.
 * Pass `backend` and/or `modelProfile` in overrides when the Brain tier should
 * pick a different provider (hybrid Fast=Vertex / Quality=DeepSeek).
 * @param {NodeJS.ProcessEnv} env
 * @param {Record<string, unknown>} [overrides]
 */
export function createLlmChatModel(env = process.env, overrides = {}) {
  const { backend: explicitBackend, modelProfile, ...rest } = overrides;
  const backend =
    (typeof explicitBackend === 'string' && explicitBackend) ||
    resolveLlmBackend(env, /** @type {'fast' | 'quality' | undefined} */ (modelProfile));
  if (!backend) {
    throw new LlmNotConfiguredError();
  }
  return createChatModelForBackend(env, /** @type {LlmBackend} */ (backend), rest);
}

/**
 * @param {NodeJS.ProcessEnv} env
 * @param {LlmBackend} backend
 */
function resolveFastDefaultForBackend(env, backend) {
  if (backend === 'vertex') {
    const explicit = typeof env.VERTEX_MODEL_FAST === 'string' && env.VERTEX_MODEL_FAST.trim();
    return explicit || DEFAULT_VERTEX_MODEL_FAST;
  }
  if (backend === 'deepseek') {
    const explicit = typeof env.DEEPSEEK_MODEL_FAST === 'string' && env.DEEPSEEK_MODEL_FAST.trim();
    return explicit || DEFAULT_DEEPSEEK_MODEL_FAST;
  }
  const explicit =
    typeof env.OPENROUTER_MODEL_FAST === 'string' && env.OPENROUTER_MODEL_FAST.trim();
  return explicit || DEFAULT_OPENROUTER_MODEL_FAST;
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {boolean}
 */
export function isSyntaxFixerEscalationEnabled(env = process.env) {
  const raw = env.SYNTAX_FIXER_ESCALATION;
  if (raw == null || raw === '') return true;
  const s = String(raw).trim().toLowerCase();
  return s !== '0' && s !== 'false' && s !== 'no' && s !== 'off';
}

/**
 * @param {NodeJS.ProcessEnv} env
 * @param {LlmBackend} backend
 */
function backendUsable(env, backend) {
  if (backend === 'vertex') return isVertexEnvConfigured(env);
  if (backend === 'openrouter') return Boolean(env.OPENROUTER_API_KEY);
  if (backend === 'deepseek') return Boolean(env.DEEPSEEK_API_KEY);
  return false;
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {LlmBackend | null}
 */
function resolvePinnedRepairBackend(env = process.env) {
  const requested =
    typeof env.MERMAID_REPAIR_BACKEND === 'string'
      ? env.MERMAID_REPAIR_BACKEND.trim().toLowerCase()
      : '';
  if (requested === 'vertex' || requested === 'openrouter' || requested === 'deepseek') {
    return backendUsable(env, requested) ? requested : null;
  }
  return null;
}

/**
 * Vertex lite slug (fixer rung 1 + default decorative Fast).
 * Precedence: `VERTEX_MODEL_LITE` → {@link DEFAULT_VERTEX_MODEL_LITE}.
 * @param {NodeJS.ProcessEnv} [env]
 */
export function resolveVertexLiteModelId(env = process.env) {
  const lite = typeof env.VERTEX_MODEL_LITE === 'string' ? env.VERTEX_MODEL_LITE.trim() : '';
  return lite || DEFAULT_VERTEX_MODEL_LITE;
}

/**
 * Model id for latency-first decorative surfaces (office cast, advisor chips,
 * label explainer, Auto content-type classifier, explain dumb-down). Independent
 * of Brain Fast so canvas Go can stay on full Flash while desk talk uses lite.
 *
 * Vertex precedence: `VERTEX_MODEL_OFFICE` → `VERTEX_MODEL_LITE` → default lite.
 * DeepSeek / OpenRouter: Fast (OpenRouter Fast is already flash-lite).
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @param {LlmBackend | null} [backend]
 */
export function resolveDecorativeModelId(env = process.env, backend = resolveLlmBackend(env)) {
  if (backend === 'vertex') {
    const office =
      typeof env.VERTEX_MODEL_OFFICE === 'string' ? env.VERTEX_MODEL_OFFICE.trim() : '';
    return office || resolveVertexLiteModelId(env);
  }
  if (backend === 'deepseek') {
    return resolveDeepSeekModelId(env, 'fast') || DEFAULT_DEEPSEEK_MODEL_FAST;
  }
  if (backend === 'openrouter') {
    const lite =
      typeof env.OPENROUTER_MODEL_LITE === 'string' ? env.OPENROUTER_MODEL_LITE.trim() : '';
    return lite || resolveOpenRouterModelId(env, 'fast') || DEFAULT_OPENROUTER_MODEL_FAST;
  }
  return DEFAULT_VERTEX_MODEL_LITE;
}

function resolveModelIdForFixerTier(env, backend, tier) {
  if (backend === 'vertex') {
    if (tier === 'lite') return resolveVertexLiteModelId(env);
    if (tier === 'quality') return resolveVertexModelId(env, 'quality');
    return resolveVertexModelId(env, 'fast');
  }
  if (backend === 'deepseek') {
    if (tier === 'quality') return resolveDeepSeekModelId(env, 'quality');
    // DeepSeek has no separate lite slug — flash/lite share the fast id.
    return resolveDeepSeekModelId(env, 'fast');
  }
  // openrouter
  if (tier === 'lite') {
    const lite =
      typeof env.OPENROUTER_MODEL_LITE === 'string' ? env.OPENROUTER_MODEL_LITE.trim() : '';
    return lite || DEFAULT_OPENROUTER_MODEL_FAST;
  }
  if (tier === 'quality') return resolveOpenRouterModelId(env, 'quality');
  const flash =
    typeof env.OPENROUTER_MODEL_FLASH === 'string' ? env.OPENROUTER_MODEL_FLASH.trim() : '';
  return flash || DEFAULT_OPENROUTER_MODEL_FLASH;
}

/**
 * Latency-first syntax-fixer ladder, independent of Brain Fast/Quality.
 *
 * Default order when credentials allow:
 *   1. flash-lite (super-fast salvage)
 *   2. flash
 *   3. DeepSeek Pro (or Vertex/OpenRouter quality when DeepSeek is absent)
 *
 * Env:
 *   SYNTAX_FIXER_ESCALATION=0 — collapse to a single fast-tier target
 *   MERMAID_REPAIR_BACKEND / MERMAID_REPAIR_MODEL — pin first rung (still escalates unless disabled)
 *   VERTEX_MODEL_LITE / OPENROUTER_MODEL_LITE / OPENROUTER_MODEL_FLASH — tier overrides
 *   VERTEX_MODEL_OFFICE — optional decorative Fast override (office/advisor/…); else lite
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {Array<{ backend: LlmBackend, modelId: string, tier: 'lite' | 'flash' | 'quality' }>}
 */
export function resolveSyntaxFixerEscalationLadder(env = process.env) {
  /** @type {Array<{ backend: LlmBackend, modelId: string, tier: 'lite' | 'flash' | 'quality' }>} */
  const rungs = [];
  const seen = new Set();

  /**
   * @param {LlmBackend | null | undefined} backend
   * @param {string} modelId
   * @param {'lite' | 'flash' | 'quality'} tier
   */
  const push = (backend, modelId, tier) => {
    if (!backend || !modelId || !backendUsable(env, backend)) return;
    const key = `${backend}:${modelId}`;
    if (seen.has(key)) return;
    seen.add(key);
    rungs.push({ backend, modelId, tier });
  };

  const pinnedBackend = resolvePinnedRepairBackend(env);
  const explicitModel =
    typeof env.MERMAID_REPAIR_MODEL === 'string' ? env.MERMAID_REPAIR_MODEL.trim() : '';

  if (explicitModel) {
    const backend =
      pinnedBackend ||
      resolveLlmBackend(env) ||
      (backendUsable(env, 'vertex')
        ? 'vertex'
        : backendUsable(env, 'deepseek')
          ? 'deepseek'
          : backendUsable(env, 'openrouter')
            ? 'openrouter'
            : null);
    if (backend) push(backend, explicitModel, 'flash');
  }

  if (!isSyntaxFixerEscalationEnabled(env)) {
    if (rungs.length > 0) return rungs;
    const backend = pinnedBackend || resolveLlmBackend(env);
    if (!backend) return [];
    push(backend, resolveFastDefaultForBackend(env, backend), 'flash');
    return rungs;
  }

  // Prefer Vertex lite→flash when Vertex is configured; otherwise OpenRouter; else DeepSeek flash.
  const latencyBackend =
    pinnedBackend ||
    (backendUsable(env, 'vertex')
      ? 'vertex'
      : backendUsable(env, 'openrouter')
        ? 'openrouter'
        : backendUsable(env, 'deepseek')
          ? 'deepseek'
          : null);

  if (latencyBackend) {
    push(latencyBackend, resolveModelIdForFixerTier(env, latencyBackend, 'lite'), 'lite');
    push(latencyBackend, resolveModelIdForFixerTier(env, latencyBackend, 'flash'), 'flash');
  }

  // Quality rung: DeepSeek Pro when available (even if latency rungs were Vertex/OpenRouter).
  if (backendUsable(env, 'deepseek') && (!pinnedBackend || pinnedBackend === 'deepseek')) {
    push('deepseek', resolveModelIdForFixerTier(env, 'deepseek', 'quality'), 'quality');
  } else if (latencyBackend) {
    push(latencyBackend, resolveModelIdForFixerTier(env, latencyBackend, 'quality'), 'quality');
  }

  return rungs;
}

/**
 * Resolve the first syntax-fixer target (lite when escalation is on). Independent of Brain.
 *
 *   MERMAID_REPAIR_BACKEND=vertex|openrouter|deepseek  — pick the backend explicitly.
 *   MERMAID_REPAIR_MODEL=<slug-or-model-id>   — override the model id for the first rung.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{ backend: LlmBackend, modelId: string, tier?: string } | null}
 */
export function resolveSyntaxFixerTarget(env = process.env) {
  const ladder = resolveSyntaxFixerEscalationLadder(env);
  return ladder[0] ?? null;
}

// Cache fixer chat models per (backend, modelId) so repeated repair turns don't reconstruct the
// SDK client (auth resolution, http agent) every time. Stateless, safe to reuse.
const syntaxFixerModelCache = new Map();

/**
 * Build a tool-less, low-temperature chat model for one fixer ladder rung.
 * Returns null when the target is missing or the backend cannot be constructed.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @param {{ backend: LlmBackend, modelId: string }} target
 * @param {{ maxOutputTokens?: number }} [options]
 */
export function createSyntaxFixerModelForTarget(env = process.env, target, options = {}) {
  if (!target?.backend || !target?.modelId || !backendUsable(env, target.backend)) return null;
  const maxOutputTokens =
    Number.isFinite(options.maxOutputTokens) && options.maxOutputTokens > 0
      ? Math.floor(options.maxOutputTokens)
      : 1400;
  const key = `${target.backend}:${target.modelId}:out${maxOutputTokens}`;
  const cached = syntaxFixerModelCache.get(key);
  if (cached) return cached;
  const overrides = { model: target.modelId, temperature: 0.1, maxOutputTokens };
  const model = createChatModelForBackend(env, target.backend, overrides);
  syntaxFixerModelCache.set(key, model);
  return model;
}

/**
 * Build a tool-less, low-temperature chat model suited for the syntax fixer single-shot call.
 * Returns the first ladder rung (lite when escalation is enabled).
 *
 * @param {NodeJS.ProcessEnv} [env]
 */
export function createSyntaxFixerModel(env = process.env) {
  const target = resolveSyntaxFixerTarget(env);
  if (!target) return null;
  return createSyntaxFixerModelForTarget(env, target);
}
