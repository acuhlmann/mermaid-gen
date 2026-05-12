import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_VERTEX_MODEL_FAST,
  DEFAULT_VERTEX_MODEL_QUALITY,
  isLlmConfigured,
  isVertexEnvConfigured,
  resolveLlmBackend,
  resolveVertexLocation,
  resolveVertexModelId,
  resolveVertexProjectId
} from '../src/agents/llmProvider.js';

test('resolveVertexProjectId prefers explicit VERTEX_PROJECT_ID', () => {
  assert.equal(
    resolveVertexProjectId({
      VERTEX_PROJECT_ID: ' explicit ',
      GOOGLE_CLOUD_PROJECT: 'gcp',
      GCLOUD_PROJECT: 'gc'
    }),
    'explicit'
  );
});

test('resolveVertexProjectId falls back to GOOGLE_CLOUD_PROJECT then GCLOUD_PROJECT', () => {
  assert.equal(resolveVertexProjectId({ GOOGLE_CLOUD_PROJECT: 'gcp' }), 'gcp');
  assert.equal(resolveVertexProjectId({ GCLOUD_PROJECT: 'gc' }), 'gc');
});

test('resolveVertexLocation defaults to us-central1', () => {
  assert.equal(resolveVertexLocation({}), 'us-central1');
  assert.equal(resolveVertexLocation({ VERTEX_LOCATION: 'europe-west1' }), 'europe-west1');
});

test('isVertexEnvConfigured requires project and location', () => {
  assert.equal(isVertexEnvConfigured({}), false);
  assert.equal(isVertexEnvConfigured({ GOOGLE_CLOUD_PROJECT: 'p' }), true);
  assert.equal(isVertexEnvConfigured({ VERTEX_PROJECT_ID: 'p', VERTEX_LOCATION: '' }), true);
});

test('resolveVertexModelId mirrors OpenRouter-style tier env keys', () => {
  const base = { GOOGLE_CLOUD_PROJECT: 'p', VERTEX_MODEL: 'shared' };
  assert.equal(resolveVertexModelId(base, 'fast'), 'shared');
  assert.equal(resolveVertexModelId(base, 'quality'), 'shared');
  assert.equal(resolveVertexModelId({ ...base, VERTEX_MODEL_FAST: 'f' }, 'fast'), 'f');
  assert.equal(resolveVertexModelId({ ...base, VERTEX_MODEL_QUALITY: 'q' }, 'quality'), 'q');
  assert.equal(resolveVertexModelId({ GOOGLE_CLOUD_PROJECT: 'p' }, 'fast'), DEFAULT_VERTEX_MODEL_FAST);
  assert.equal(resolveVertexModelId({ GOOGLE_CLOUD_PROJECT: 'p' }, 'quality'), DEFAULT_VERTEX_MODEL_QUALITY);
});

test('resolveLlmBackend openrouter mode requires API key', () => {
  assert.equal(resolveLlmBackend({ LLM_PROVIDER: 'openrouter' }), null);
  assert.equal(resolveLlmBackend({ LLM_PROVIDER: 'openrouter', OPENROUTER_API_KEY: 'k' }), 'openrouter');
});

test('resolveLlmBackend vertex mode requires project', () => {
  assert.equal(resolveLlmBackend({ LLM_PROVIDER: 'vertex' }), null);
  assert.equal(resolveLlmBackend({ LLM_PROVIDER: 'vertex', GOOGLE_CLOUD_PROJECT: 'p' }), 'vertex');
});

test('resolveLlmBackend auto prefers Vertex on Cloud Run when Vertex is configured', () => {
  const env = {
    K_SERVICE: 'svc',
    GOOGLE_CLOUD_PROJECT: 'proj',
    OPENROUTER_API_KEY: 'k'
  };
  assert.equal(resolveLlmBackend(env), 'vertex');
});

test('resolveLlmBackend auto uses OpenRouter when OPENROUTER_PREFERRED is set', () => {
  const env = {
    K_SERVICE: 'svc',
    GOOGLE_CLOUD_PROJECT: 'proj',
    OPENROUTER_API_KEY: 'k',
    OPENROUTER_PREFERRED: '1'
  };
  assert.equal(resolveLlmBackend(env), 'openrouter');
});

test('resolveLlmBackend auto uses OpenRouter locally when key present and not on Cloud Run', () => {
  assert.equal(resolveLlmBackend({ OPENROUTER_API_KEY: 'k' }), 'openrouter');
});

test('resolveLlmBackend auto uses Vertex when only Vertex is configured', () => {
  assert.equal(resolveLlmBackend({ GOOGLE_CLOUD_PROJECT: 'p' }), 'vertex');
});

test('isLlmConfigured reflects any usable backend', () => {
  assert.equal(isLlmConfigured({}), false);
  assert.equal(isLlmConfigured({ OPENROUTER_API_KEY: 'k' }), true);
  assert.equal(isLlmConfigured({ GOOGLE_CLOUD_PROJECT: 'p' }), true);
});
