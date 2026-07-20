import test from 'node:test';
import assert from 'node:assert/strict';
import { createMetaphorLangChainAgent } from '../src/agents/metaphorLangChainAgent.js';
import { createDiagramStateStore } from '../src/state/diagramStateStore.js';

const METAPHOR_DSL = JSON.stringify({
  metaphor: 'city',
  title: 'Platform as a city',
  nodes: [{ id: 'hub', label: 'API Gateway', role: 'hub' }]
});

test('metaphor repair turns rebuild from the initial messages instead of accumulating', async () => {
  const stateStore = createDiagramStateStore();
  const messageLengths = [];
  const fakeAgent = {
    async invoke({ messages }) {
      messageLengths.push(messages.length);
      return { messages: [{ role: 'assistant', content: 'Let me sketch a metaphor.' }] };
    }
  };

  const service = createMetaphorLangChainAgent({
    stateStore,
    env: { OPENROUTER_API_KEY: 'test-key', METAPHOR_REPAIR_MAX_ATTEMPTS: '2' },
    createChatModel: () => ({}),
    createAgentImpl: () => fakeAgent
  });

  await service.applyIntent({
    prompt: 'model our auth flow as a transit system',
    currentDsl: METAPHOR_DSL,
    modelProfile: 'fast'
  });

  assert.ok(messageLengths.length >= 2, 'expected at least one repair turn');
  for (const len of messageLengths) {
    assert.ok(len <= 2, `expected non-cumulative transcript, saw ${len} messages`);
  }
});
