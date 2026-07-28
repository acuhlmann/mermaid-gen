import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildChartAnalyzeUserContent,
  buildChartTransformUserContent,
  createChartLangChainAgent
} from '../src/agents/chartLangChainAgent.js';
import { createDiagramStateStore } from '../src/state/diagramStateStore.js';

const CHART_DSL = JSON.stringify({
  archislopVersion: 1,
  theme: 'whiteboard',
  spec: {
    title: 'Revenue',
    data: { values: [{ quarter: 'Q1', revenue: 100 }] },
    mark: 'bar',
    encoding: {
      x: { field: 'quarter', type: 'ordinal' },
      y: { field: 'revenue', type: 'quantitative' }
    }
  }
});

test('buildChartTransformUserContent includes advisor prompt', () => {
  const body = buildChartTransformUserContent({
    mode: 'gilfoyle',
    currentDsl: CHART_DSL,
    advisorPrompt: 'Facet by region'
  });
  assert.match(body, /Stakeholder suggestion/);
  assert.match(body, /Facet by region/);
});

test('buildChartAnalyzeUserContent includes advisor prompt', () => {
  const body = buildChartAnalyzeUserContent({
    kind: 'jared',
    currentDsl: CHART_DSL,
    focusScope: '',
    advisorPrompt: 'Check if Revenue hides seasonality'
  });
  assert.match(body, /Stakeholder suggestion/);
  assert.match(body, /seasonality/);
});

test('repair turns rebuild from the initial messages instead of accumulating', async () => {
  const stateStore = createDiagramStateStore();
  const messageLengths = [];
  const fakeAgent = {
    // No streamEvents + no emit → invokeAgentStream falls back to invoke().
    async invoke({ messages }) {
      messageLengths.push(messages.length);
      // Always prose-only (never applies a patch) so the repair loop runs to exhaustion.
      return { messages: [{ role: 'assistant', content: 'Let me think about this.' }] };
    }
  };

  const service = createChartLangChainAgent({
    stateStore,
    env: { OPENROUTER_API_KEY: 'test-key', CHART_REPAIR_MAX_ATTEMPTS: '2' },
    createChatModel: () => ({}),
    createAgentImpl: () => fakeAgent
  });

  await service.applyIntent({ prompt: 'bar chart of quarterly sales', modelProfile: 'fast' });

  // Intent builds exactly one user message. With the non-cumulative rebuild every turn
  // carries that one message plus at most one repair/patch-required instruction — the
  // count must never grow across attempts (the F1 regression it replaces would give 1,2,3…).
  assert.ok(messageLengths.length >= 2, 'expected at least one repair turn');
  for (const len of messageLengths) {
    assert.ok(len <= 2, `expected non-cumulative transcript, saw ${len} messages`);
  }
});
