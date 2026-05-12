import { ChatOpenRouter } from '@langchain/openrouter';
import { ChatVertexAI } from '@langchain/google-vertexai';

/** Default Vertex model ids when VERTEX_MODEL_FAST / VERTEX_MODEL_QUALITY are unset (override per region in console). */
export const DEFAULT_VERTEX_MODEL_FAST = 'gemini-2.0-flash-001';
export const DEFAULT_VERTEX_MODEL_QUALITY = 'gemini-1.5-pro-002';

export class LlmNotConfiguredError extends Error {
  constructor() {
    super(
      'No LLM backend is configured. For local dev set OPENROUTER_API_KEY in .env, or configure Vertex (VERTEX_PROJECT_ID / GOOGLE_CLOUD_PROJECT + VERTEX_LOCATION + IAM). On Cloud Run attach Secret Manager secret openrouter-api-key and/or enable Vertex with roles/aiplatform.user (see docs/deploy/gcp.md).'
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
  const p = profile === 'quality' ? 'quality' : 'fast';
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
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {'vertex' | 'openrouter' | null}
 */
export function resolveLlmBackend(env = process.env) {
  const raw = typeof env.LLM_PROVIDER === 'string' ? env.LLM_PROVIDER.trim().toLowerCase() : '';
  const mode = raw === 'vertex' || raw === 'openrouter' ? raw : 'auto';

  if (mode === 'openrouter') {
    return env.OPENROUTER_API_KEY ? 'openrouter' : null;
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
    siteName: env.OPENROUTER_SITE_NAME || 'Mermaid Architect',
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
 * Unified factory: Vertex or OpenRouter from `resolveLlmBackend`.
 * @param {NodeJS.ProcessEnv} env
 * @param {Record<string, unknown>} [overrides]
 */
export function createLlmChatModel(env = process.env, overrides = {}) {
  const backend = resolveLlmBackend(env);
  if (!backend) {
    throw new LlmNotConfiguredError();
  }
  if (backend === 'vertex') {
    if (!isVertexEnvConfigured(env)) {
      throw new LlmNotConfiguredError();
    }
    return createVertexChatModel(env, overrides);
  }
  return createOpenRouterModel(env, overrides);
}
