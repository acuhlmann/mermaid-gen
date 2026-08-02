import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_DEEPSEEK_MODEL_FAST,
  DEFAULT_DEEPSEEK_MODEL_QUALITY,
  DEFAULT_OPENROUTER_MODEL_FAST,
  DEFAULT_OPENROUTER_MODEL_QUALITY,
  DEFAULT_VERTEX_MODEL_FAST,
  DEFAULT_VERTEX_MODEL_QUALITY,
  isLlmConfigured,
  isVertexEnvConfigured,
  createDeepSeekChatModel,
  createVertexChatModel,
  resolveDeepSeekModelId,
  resolveDeepSeekThinkingKwargs,
  resolveLlmBackend,
  resolveModelId,
  resolveOpenRouterModelId,
  resolveVertexLocation,
  resolveVertexModelId,
  resolveVertexProjectId,
  DEFAULT_VERTEX_MODEL_LITE,
  DEFAULT_OPENROUTER_MODEL_FLASH,
  resolveDecorativeBackend,
  resolveDecorativeModelId,
  resolveDecorativeModelLabel,
  resolveLlmModelLabel,
  resolveVertexLiteModelId,
  resolveSyntaxFixerEscalationLadder,
  resolveSyntaxFixerTarget
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
  assert.equal(
    resolveVertexModelId({ GOOGLE_CLOUD_PROJECT: 'p' }, 'fast'),
    DEFAULT_VERTEX_MODEL_FAST
  );
  assert.equal(
    resolveVertexModelId({ GOOGLE_CLOUD_PROJECT: 'p' }, 'quality'),
    DEFAULT_VERTEX_MODEL_QUALITY
  );
});

test('resolveLlmBackend openrouter mode requires API key', () => {
  assert.equal(resolveLlmBackend({ LLM_PROVIDER: 'openrouter' }), null);
  assert.equal(
    resolveLlmBackend({ LLM_PROVIDER: 'openrouter', OPENROUTER_API_KEY: 'k' }),
    'openrouter'
  );
});

test('resolveLlmBackend deepseek mode requires API key', () => {
  assert.equal(resolveLlmBackend({ LLM_PROVIDER: 'deepseek' }), null);
  assert.equal(resolveLlmBackend({ LLM_PROVIDER: 'deepseek', DEEPSEEK_API_KEY: 'k' }), 'deepseek');
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

test('resolveLlmBackend auto uses DeepSeek locally when key present and not on Cloud Run', () => {
  assert.equal(resolveLlmBackend({ DEEPSEEK_API_KEY: 'k' }), 'deepseek');
});

test('resolveLlmBackend auto prefers DeepSeek over OpenRouter locally when both keys are set', () => {
  assert.equal(resolveLlmBackend({ DEEPSEEK_API_KEY: 'd', OPENROUTER_API_KEY: 'o' }), 'deepseek');
});

test('resolveLlmBackend auto uses OpenRouter locally when only OpenRouter key is set', () => {
  assert.equal(resolveLlmBackend({ OPENROUTER_API_KEY: 'k' }), 'openrouter');
});

test('resolveLlmBackend auto uses Vertex when only Vertex is configured', () => {
  assert.equal(resolveLlmBackend({ GOOGLE_CLOUD_PROJECT: 'p' }), 'vertex');
});

test('resolveLlmBackend uses DeepSeek for both Brain profiles when key + Vertex are set', () => {
  const env = {
    K_SERVICE: 'svc',
    GOOGLE_CLOUD_PROJECT: 'proj',
    DEEPSEEK_API_KEY: 'k'
  };
  assert.equal(resolveLlmBackend(env), 'deepseek');
  assert.equal(resolveLlmBackend(env, 'fast'), 'deepseek');
  assert.equal(resolveLlmBackend(env, 'quality'), 'deepseek');
  assert.equal(resolveModelId(env, 'fast'), DEFAULT_DEEPSEEK_MODEL_FAST);
  assert.equal(resolveModelId(env, 'quality'), DEFAULT_DEEPSEEK_MODEL_QUALITY);
});

test('resolveDecorativeBackend prefers Vertex lite when Brain is DeepSeek', () => {
  const env = { GOOGLE_CLOUD_PROJECT: 'p', DEEPSEEK_API_KEY: 'k' };
  assert.equal(resolveLlmBackend(env, 'fast'), 'deepseek');
  assert.equal(resolveDecorativeBackend(env), 'vertex');
  assert.equal(resolveDecorativeModelId(env), DEFAULT_VERTEX_MODEL_LITE);
  assert.equal(resolveDecorativeModelLabel(env), `vertex:${DEFAULT_VERTEX_MODEL_LITE}`);
  assert.equal(resolveLlmModelLabel(env, 'fast'), `deepseek:${DEFAULT_DEEPSEEK_MODEL_FAST}`);
  assert.equal(resolveLlmModelLabel(env, 'quality'), `deepseek:${DEFAULT_DEEPSEEK_MODEL_QUALITY}`);
});

test('resolveLlmBackend DeepSeek+Vertex also applies locally', () => {
  const env = { GOOGLE_CLOUD_PROJECT: 'p', DEEPSEEK_API_KEY: 'k' };
  assert.equal(resolveLlmBackend(env, 'fast'), 'deepseek');
  assert.equal(resolveLlmBackend(env, 'quality'), 'deepseek');
});

test('resolveLlmBackend hybrid is skipped when OPENROUTER_PREFERRED pins OpenRouter', () => {
  const env = {
    GOOGLE_CLOUD_PROJECT: 'p',
    DEEPSEEK_API_KEY: 'd',
    OPENROUTER_API_KEY: 'o',
    OPENROUTER_PREFERRED: '1'
  };
  assert.equal(resolveLlmBackend(env, 'fast'), 'openrouter');
  assert.equal(resolveLlmBackend(env, 'quality'), 'openrouter');
});

test('resolveLlmBackend pinned LLM_PROVIDER ignores DeepSeek key for Brain', () => {
  const env = {
    LLM_PROVIDER: 'vertex',
    GOOGLE_CLOUD_PROJECT: 'p',
    DEEPSEEK_API_KEY: 'k'
  };
  assert.equal(resolveLlmBackend(env, 'quality'), 'vertex');
  assert.equal(resolveDecorativeBackend(env), 'vertex');
});

test('resolveDeepSeekModelId mirrors tier env keys', () => {
  const base = { DEEPSEEK_API_KEY: 'k', DEEPSEEK_MODEL: 'shared' };
  assert.equal(resolveDeepSeekModelId(base, 'fast'), 'shared');
  assert.equal(resolveDeepSeekModelId(base, 'quality'), 'shared');
  assert.equal(resolveDeepSeekModelId({ ...base, DEEPSEEK_MODEL_FAST: 'flash' }, 'fast'), 'flash');
  assert.equal(
    resolveDeepSeekModelId({ ...base, DEEPSEEK_MODEL_QUALITY: 'pro' }, 'quality'),
    'pro'
  );
  assert.equal(
    resolveDeepSeekModelId({ DEEPSEEK_API_KEY: 'k' }, 'fast'),
    DEFAULT_DEEPSEEK_MODEL_FAST
  );
  assert.equal(
    resolveDeepSeekModelId({ DEEPSEEK_API_KEY: 'k' }, 'quality'),
    DEFAULT_DEEPSEEK_MODEL_QUALITY
  );
});

test('resolveModelId dispatches by backend', () => {
  const env = {
    DEEPSEEK_API_KEY: 'd',
    OPENROUTER_API_KEY: 'o',
    GOOGLE_CLOUD_PROJECT: 'p',
    DEEPSEEK_MODEL_FAST: 'ds-fast',
    OPENROUTER_MODEL_FAST: 'or-fast',
    VERTEX_MODEL_FAST: 'vx-fast'
  };
  assert.equal(resolveModelId(env, 'fast', 'deepseek'), 'ds-fast');
  assert.equal(resolveModelId(env, 'fast', 'openrouter'), 'or-fast');
  assert.equal(resolveModelId(env, 'fast', 'vertex'), 'vx-fast');
});

test('resolveOpenRouterModelId uses defaults when tier env is unset', () => {
  assert.equal(
    resolveOpenRouterModelId({ OPENROUTER_API_KEY: 'k' }, 'fast'),
    DEFAULT_OPENROUTER_MODEL_FAST
  );
  assert.equal(
    resolveOpenRouterModelId({ OPENROUTER_API_KEY: 'k' }, 'quality'),
    DEFAULT_OPENROUTER_MODEL_QUALITY
  );
});

test('resolveDeepSeekThinkingKwargs disables thinking by default', () => {
  assert.deepEqual(resolveDeepSeekThinkingKwargs({}), { thinking: { type: 'disabled' } });
  assert.deepEqual(resolveDeepSeekThinkingKwargs({ DEEPSEEK_THINKING: '1' }), {
    thinking: { type: 'enabled' }
  });
});

test('createDeepSeekChatModel passes thinking disabled for tool-agent compatibility', () => {
  const model = createDeepSeekChatModel({ DEEPSEEK_API_KEY: 'k' }, { model: 'deepseek-v4-flash' });
  assert.deepEqual(model.modelKwargs, { thinking: { type: 'disabled' } });
});

test('createVertexChatModel converts stacked system messages for Gemini compatibility', () => {
  const model = createVertexChatModel(
    { GOOGLE_CLOUD_PROJECT: 'p' },
    { model: 'gemini-2.5-flash-lite' }
  );
  assert.equal(model.convertSystemMessageToHumanContent, true);
});

test('createVertexChatModel passes VERTEX_PROJECT_ID to GoogleAuth via authOptions', async () => {
  const model = createVertexChatModel(
    { VERTEX_PROJECT_ID: 'mermaidgen' },
    { model: 'gemini-2.5-flash-lite' }
  );
  assert.equal(await model.connection.client.getProjectId(), 'mermaidgen');
});

test('isLlmConfigured reflects any usable backend', () => {
  assert.equal(isLlmConfigured({}), false);
  assert.equal(isLlmConfigured({ DEEPSEEK_API_KEY: 'k' }), true);
  assert.equal(isLlmConfigured({ OPENROUTER_API_KEY: 'k' }), true);
  assert.equal(isLlmConfigured({ GOOGLE_CLOUD_PROJECT: 'p' }), true);
});

test('resolveVertexLiteModelId and resolveDecorativeModelId prefer lite over Brain Fast', () => {
  assert.equal(resolveVertexLiteModelId({}), DEFAULT_VERTEX_MODEL_LITE);
  assert.equal(resolveVertexLiteModelId({ VERTEX_MODEL_LITE: 'lite-x' }), 'lite-x');
  assert.equal(resolveDecorativeModelId({}, 'vertex'), DEFAULT_VERTEX_MODEL_LITE);
  assert.equal(
    resolveDecorativeModelId({ VERTEX_MODEL_FAST: DEFAULT_VERTEX_MODEL_FAST }, 'vertex'),
    DEFAULT_VERTEX_MODEL_LITE
  );
  assert.equal(
    resolveDecorativeModelId(
      { VERTEX_MODEL_OFFICE: 'office-x', VERTEX_MODEL_LITE: 'lite-x' },
      'vertex'
    ),
    'office-x'
  );
  assert.equal(resolveDecorativeModelId({}, 'deepseek'), DEFAULT_DEEPSEEK_MODEL_FAST);
  assert.equal(resolveDecorativeModelId({}, 'openrouter'), DEFAULT_OPENROUTER_MODEL_FAST);
});

test('resolveSyntaxFixerEscalationLadder climbs lite→flash→DeepSeek on hybrid Vertex+DeepSeek', () => {
  const ladder = resolveSyntaxFixerEscalationLadder({
    GOOGLE_CLOUD_PROJECT: 'p',
    DEEPSEEK_API_KEY: 'k'
  });
  assert.deepEqual(
    ladder.map((r) => `${r.tier}:${r.backend}:${r.modelId}`),
    [
      `lite:vertex:${DEFAULT_VERTEX_MODEL_LITE}`,
      `flash:vertex:${DEFAULT_VERTEX_MODEL_FAST}`,
      `quality:deepseek:${DEFAULT_DEEPSEEK_MODEL_QUALITY}`
    ]
  );
});

test('resolveSyntaxFixerEscalationLadder uses OpenRouter lite→flash→quality when only OR is set', () => {
  const ladder = resolveSyntaxFixerEscalationLadder({ OPENROUTER_API_KEY: 'k' });
  assert.equal(ladder[0].tier, 'lite');
  assert.equal(ladder[0].backend, 'openrouter');
  assert.equal(ladder[0].modelId, DEFAULT_OPENROUTER_MODEL_FAST);
  assert.equal(ladder[1].tier, 'flash');
  assert.equal(ladder[1].modelId, DEFAULT_OPENROUTER_MODEL_FLASH);
  assert.equal(ladder[2].tier, 'quality');
  assert.equal(ladder[2].modelId, DEFAULT_OPENROUTER_MODEL_QUALITY);
});

test('resolveSyntaxFixerEscalationLadder DeepSeek-only collapses lite/flash to one flash id then Pro', () => {
  const ladder = resolveSyntaxFixerEscalationLadder({ DEEPSEEK_API_KEY: 'k' });
  assert.deepEqual(
    ladder.map((r) => `${r.tier}:${r.modelId}`),
    [`lite:${DEFAULT_DEEPSEEK_MODEL_FAST}`, `quality:${DEFAULT_DEEPSEEK_MODEL_QUALITY}`]
  );
});

test('resolveSyntaxFixerEscalationLadder can be disabled to a single rung', () => {
  const ladder = resolveSyntaxFixerEscalationLadder({
    GOOGLE_CLOUD_PROJECT: 'p',
    DEEPSEEK_API_KEY: 'k',
    SYNTAX_FIXER_ESCALATION: '0'
  });
  assert.equal(ladder.length, 1);
  assert.equal(ladder[0].backend, 'vertex');
  assert.equal(ladder[0].modelId, DEFAULT_VERTEX_MODEL_FAST);
});

test('resolveSyntaxFixerTarget returns the first ladder rung', () => {
  const target = resolveSyntaxFixerTarget({
    GOOGLE_CLOUD_PROJECT: 'p',
    DEEPSEEK_API_KEY: 'k'
  });
  assert.equal(target?.tier, 'lite');
  assert.equal(target?.modelId, DEFAULT_VERTEX_MODEL_LITE);
});
