import { ChatOpenRouter } from '@langchain/openrouter';
import { ChatOpenAI } from '@langchain/openai';
import { ChatVertexAI } from '@langchain/google-vertexai';

/** Default Vertex model ids when VERTEX_MODEL_FAST / VERTEX_MODEL_QUALITY are unset (override per region in console). */
export const DEFAULT_VERTEX_MODEL_FAST = 'gemini-2.0-flash-001';
export const DEFAULT_VERTEX_MODEL_QUALITY = 'gemini-1.5-pro-002';

/** Default DeepSeek API model ids (OpenAI-compatible https://api.deepseek.com). */
export const DEFAULT_DEEPSEEK_MODEL_FAST = 'deepseek-v4-flash';
export const DEFAULT_DEEPSEEK_MODEL_QUALITY = 'deepseek-v4-pro';
export const DEFAULT_DEEPSEEK_API_BASE = 'https://api.deepseek.com';

/** Default OpenRouter slugs when OPENROUTER_MODEL* are unset. */
export const DEFAULT_OPENROUTER_MODEL_FAST = 'google/gemini-2.5-flash-lite';
export const DEFAULT_OPENROUTER_MODEL_QUALITY = 'qwen/qwen3-235b-a22b';

/** @typedef {'vertex' | 'openrouter' | 'deepseek'} LlmBackend */

export class LlmNotConfiguredError extends Error {
  constructor() {
    super(
      'No LLM backend is configured. For local dev set DEEPSEEK_API_KEY or OPENROUTER_API_KEY in .env, or configure Vertex (VERTEX_PROJECT_ID / GOOGLE_CLOUD_PROJECT + VERTEX_LOCATION + IAM). On Cloud Run attach Secret Manager secret openrouter-api-key and/or enable Vertex with roles/aiplatform.user (see docs/deploy/gcp.md).'
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
    const quality = typeof env.VERTEX_MODEL_QUALITY === 'string' ? env.VERTEX_MODEL_QUALITY.trim() : '';
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
    const quality = typeof env.OPENROUTER_MODEL_QUALITY === 'string' ? env.OPENROUTER_MODEL_QUALITY.trim() : '';
    if (quality) return quality;
    if (shared) return shared;
    return DEFAULT_OPENROUTER_MODEL_QUALITY;
  }
  const fast = typeof env.OPENROUTER_MODEL_FAST === 'string' ? env.OPENROUTER_MODEL_FAST.trim() : '';
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
    const quality = typeof env.DEEPSEEK_MODEL_QUALITY === 'string' ? env.DEEPSEEK_MODEL_QUALITY.trim() : '';
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
export function resolveModelId(env = process.env, profile = 'fast', backend = resolveLlmBackend(env)) {
  if (backend === 'vertex') return resolveVertexModelId(env, profile);
  if (backend === 'deepseek') return resolveDeepSeekModelId(env, profile);
  return resolveOpenRouterModelId(env, profile);
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {LlmBackend | null}
 */
export function resolveLlmBackend(env = process.env) {
  const raw = typeof env.LLM_PROVIDER === 'string' ? env.LLM_PROVIDER.trim().toLowerCase() : '';
  const mode =
    raw === 'vertex' || raw === 'openrouter' || raw === 'deepseek' ? raw : 'auto';

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
  const fields = {
    ...rest,
    location,
    project
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
 * @param {NodeJS.ProcessEnv} env
 * @param {Record<string, unknown>} [overrides]
 */
export function createLlmChatModel(env = process.env, overrides = {}) {
  const backend = resolveLlmBackend(env);
  if (!backend) {
    throw new LlmNotConfiguredError();
  }
  return createChatModelForBackend(env, backend, overrides);
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
  const explicit = typeof env.OPENROUTER_MODEL_FAST === 'string' && env.OPENROUTER_MODEL_FAST.trim();
  return explicit || DEFAULT_OPENROUTER_MODEL_FAST;
}

/**
 * Resolve the model used by the syntax fixer. Independent of the intent/transform model so
 * repair runs on a small, fast model regardless of the request profile.
 *
 *   MERMAID_REPAIR_BACKEND=vertex|openrouter|deepseek  — pick the backend explicitly.
 *   MERMAID_REPAIR_MODEL=<slug-or-model-id>   — override the model id.
 *   (default: same backend as resolveLlmBackend(), fast profile)
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{ backend: LlmBackend, modelId: string } | null}
 */
export function resolveSyntaxFixerTarget(env = process.env) {
  const requested = typeof env.MERMAID_REPAIR_BACKEND === 'string'
    ? env.MERMAID_REPAIR_BACKEND.trim().toLowerCase()
    : '';
  const backend =
    requested === 'vertex' || requested === 'openrouter' || requested === 'deepseek'
      ? requested
      : resolveLlmBackend(env);
  if (!backend) return null;
  if (backend === 'vertex' && !isVertexEnvConfigured(env)) return null;
  if (backend === 'openrouter' && !env.OPENROUTER_API_KEY) return null;
  if (backend === 'deepseek' && !env.DEEPSEEK_API_KEY) return null;

  const explicit = typeof env.MERMAID_REPAIR_MODEL === 'string' ? env.MERMAID_REPAIR_MODEL.trim() : '';
  return { backend, modelId: explicit || resolveFastDefaultForBackend(env, backend) };
}

// Cache fixer chat models per (backend, modelId) so repeated repair turns don't reconstruct the
// SDK client (auth resolution, http agent) every time. Stateless, safe to reuse.
const syntaxFixerModelCache = new Map();

/**
 * Build a tool-less, low-temperature chat model suited for the syntax fixer single-shot call.
 * Returns null when no backend is configured.
 *
 * @param {NodeJS.ProcessEnv} [env]
 */
export function createSyntaxFixerModel(env = process.env) {
  const target = resolveSyntaxFixerTarget(env);
  if (!target) return null;
  const key = `${target.backend}:${target.modelId}`;
  const cached = syntaxFixerModelCache.get(key);
  if (cached) return cached;
  const overrides = { model: target.modelId, temperature: 0.1, maxOutputTokens: 1400 };
  const model = createChatModelForBackend(env, target.backend, overrides);
  syntaxFixerModelCache.set(key, model);
  return model;
}
