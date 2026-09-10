import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAnythingAnalyzeUserContent,
  buildAnythingTransformUserContent,
  createAnythingLangChainAgent
} from '../src/agents/anythingLangChainAgent.js';
import { createDiagramStateStore } from '../src/state/diagramStateStore.js';

const HTML = '<!doctype html><html><head></head><body><h1>Launch Plan</h1></body></html>';

test('buildAnythingTransformUserContent includes advisor prompt', () => {
  const body = buildAnythingTransformUserContent({
    mode: 'gilfoyle',
    currentHtml: HTML,
    advisorPrompt: 'Make Start button more obvious'
  });
  assert.match(body, /Stakeholder suggestion/);
  assert.match(body, /Start button/);
});

test('buildAnythingTransformUserContent prefers targeted edits for gilfoyle and barker', () => {
  for (const mode of ['gilfoyle', 'barker']) {
    const body = buildAnythingTransformUserContent({ mode, currentHtml: HTML });
    assert.match(body, /apply_anything_edit/, `${mode} should prefer apply_anything_edit`);
    assert.match(body, /Fall back to apply_anything_patch/);
  }
});

test('buildAnythingTransformUserContent keeps full rewrites for erlich and russ', () => {
  for (const mode of ['erlich', 'russ']) {
    const body = buildAnythingTransformUserContent({ mode, currentHtml: HTML });
    assert.match(body, /Call apply_anything_patch with the full HTML document\./);
    assert.doesNotMatch(body, /Prefer apply_anything_edit/);
  }
});

test('buildAnythingAnalyzeUserContent includes advisor prompt', () => {
  const body = buildAnythingAnalyzeUserContent({
    kind: 'jared',
    currentHtml: HTML,
    advisorPrompt: 'Check interaction discoverability'
  });
  assert.match(body, /Stakeholder suggestion/);
  assert.match(body, /discoverability/);
});

test('buildAgent requests output-token headroom so large documents do not truncate mid-tag', async () => {
  const stateStore = createDiagramStateStore();
  const chatModelCalls = [];
  const fakeAgent = {
    // No streamEvents + no emit → invokeAgentStream falls back to invoke().
    async invoke({ messages }) {
      // Prose-only (never applies a patch) so the repair loop runs at least once,
      // exercising buildAgent more than a single time.
      return { messages: [{ role: 'assistant', content: 'Let me think about this.' }] };
    }
  };

  const service = createAnythingLangChainAgent({
    stateStore,
    env: { OPENROUTER_API_KEY: 'test-key', ANYTHING_REPAIR_MAX_ATTEMPTS: '1' },
    createChatModel: (env, options) => {
      chatModelCalls.push(options);
      return {};
    },
    createAgentImpl: () => fakeAgent
  });

  await service.applyIntent({ prompt: 'explain how tides work', modelProfile: 'fast' });

  assert.ok(chatModelCalls.length > 0, 'expected createChatModel to be invoked');
  for (const call of chatModelCalls) {
    // A backend's default max output (often ~8K tokens) truncates ordinary Anything
    // documents mid-<script> well before ANYTHING_HTML_MAX_LENGTH — see the ledger note
    // in anythingLangChainAgent.js next to ANYTHING_AGENT_MAX_OUTPUT_TOKENS.
    assert.ok(
      Number(call.maxOutputTokens) >= 16000,
      `expected a large maxOutputTokens override, saw ${call.maxOutputTokens}`
    );
  }
});
