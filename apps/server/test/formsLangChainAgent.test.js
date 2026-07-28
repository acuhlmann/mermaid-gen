import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFormsSeedDoc } from '@archislop/shared';
import {
  buildFormsAnalyzeUserContent,
  buildFormsTransformUserContent,
  createFormsLangChainAgent
} from '../src/agents/formsLangChainAgent.js';
import { createDiagramStateStore } from '../src/state/diagramStateStore.js';

const FORMS_DOC = buildFormsSeedDoc();

test('buildFormsTransformUserContent includes mode instructions and advisor prompt', () => {
  const body = buildFormsTransformUserContent({
    mode: 'russ',
    currentDoc: FORMS_DOC,
    russDepth: 3,
    advisorPrompt: 'Add a witness signature block'
  });
  assert.match(body, /Escalate like Russ Hanneman/);
  assert.match(body, /depth 3/);
  assert.match(body, /witness signature/i);
  assert.match(body, /apply_forms_patch/);
});

test('buildFormsAnalyzeUserContent includes critique task and advisor prompt', () => {
  const body = buildFormsAnalyzeUserContent({
    kind: 'jared',
    currentDoc: FORMS_DOC,
    advisorPrompt: 'Is the hero stat readable?',
    lastUserPrompt: 'review this form'
  });
  assert.match(body, /critique/i);
  assert.match(body, /hero stat/i);
  assert.match(body, /Current forms document/);
});

test('forms repair turns rebuild from the initial messages instead of accumulating', async () => {
  const stateStore = createDiagramStateStore();
  const messageLengths = [];
  const fakeAgent = {
    async invoke({ messages }) {
      messageLengths.push(messages.length);
      return { messages: [{ role: 'assistant', content: 'Still thinking about bureaucracy.' }] };
    }
  };

  const service = createFormsLangChainAgent({
    stateStore,
    env: { OPENROUTER_API_KEY: 'test-key', FORMS_REPAIR_MAX_ATTEMPTS: '2' },
    createChatModel: () => ({}),
    createAgentImpl: () => fakeAgent
  });

  await service.applyIntent({ prompt: 'next intake form', modelProfile: 'fast' });

  assert.ok(messageLengths.length >= 2, 'expected at least one repair turn');
  for (const len of messageLengths) {
    assert.ok(len <= 2, `expected non-cumulative transcript, saw ${len} messages`);
  }
});
