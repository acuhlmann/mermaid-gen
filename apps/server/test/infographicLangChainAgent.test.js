import test from 'node:test';
import assert from 'node:assert/strict';
import { createInfographicLangChainAgent } from '../src/agents/infographicLangChainAgent.js';
import { createDiagramStateStore } from '../src/state/diagramStateStore.js';

function makeAgentStub({ onInvoke }) {
  return {
    async invoke(payload) {
      return onInvoke(payload);
    }
  };
}

test('applyIntent applies a valid infographic patch via the tool', async () => {
  const stateStore = createDiagramStateStore();
  const fakeAgent = makeAgentStub({
    async onInvoke() {
      await stateStore.applyDiagramSource({
        contentType: 'infographic',
        diagramSource:
          'infographic list-row-simple-horizontal-arrow\n  data\n    lists\n      - label A\n      - label B',
        reason: 'agent intent'
      });
      return { messages: [{ role: 'assistant', content: 'Patched.' }] };
    }
  });

  const service = createInfographicLangChainAgent({
    stateStore,
    env: { OPENROUTER_API_KEY: 'test-key' },
    chatModelFactory: () => ({}),
    createAgentImpl: () => fakeAgent
  });

  const result = await service.applyIntent({
    prompt: 'three rollout steps',
    modelProfile: 'fast'
  });

  assert.match(result.message, /Patched|updated/i);
  assert.equal(stateStore.getSlot('infographic').revisionId, 1);
  // Mermaid slot is untouched.
  assert.equal(stateStore.getSlot('mermaid').revisionId, 0);
});

test('applyIntent retries with rule-pack repair when the first turn produces no patch', async () => {
  const stateStore = createDiagramStateStore();
  let calls = 0;
  const fakeAgent = makeAgentStub({
    async onInvoke({ messages }) {
      calls += 1;
      if (calls === 1) {
        // First turn: agent returns prose only, no patch applied.
        return { messages: [{ role: 'assistant', content: 'I will think about this.' }] };
      }
      // Second turn (repair): apply a valid patch.
      assert.ok(
        messages.some((m) =>
          (m?.content || m?.kwargs?.content || '').toString().includes('apply_infographic_patch')
        ),
        'repair turn should include the patch-required instruction'
      );
      await stateStore.applyDiagramSource({
        contentType: 'infographic',
        diagramSource:
          'infographic list-row-simple-horizontal-arrow\n  data\n    lists\n      - label A',
        reason: 'agent repair'
      });
      return { messages: [{ role: 'assistant', content: 'Patched on retry.' }] };
    }
  });

  const service = createInfographicLangChainAgent({
    stateStore,
    env: { OPENROUTER_API_KEY: 'test-key' },
    chatModelFactory: () => ({}),
    createAgentImpl: () => fakeAgent
  });

  const result = await service.applyIntent({ prompt: 'hello', modelProfile: 'fast' });
  assert.equal(stateStore.getSlot('infographic').revisionId, 1);
  assert.match(result.message, /Patched on retry|updated/i);
});

test('applyTransformIntent routes through the dispatcher pattern (mode-specific agent reuse)', async () => {
  const stateStore = createDiagramStateStore();
  // Seed the infographic slot with a starter DSL via the apply path.
  await stateStore.applyDiagramSource({
    contentType: 'infographic',
    diagramSource:
      'infographic list-row-simple-horizontal-arrow\n  data\n    lists\n      - label Step 1',
    reason: 'seed'
  });

  let capturedMessages = null;
  const fakeAgent = makeAgentStub({
    async onInvoke({ messages }) {
      capturedMessages = messages;
      await stateStore.applyDiagramSource({
        contentType: 'infographic',
        diagramSource:
          'infographic list-row-simple-horizontal-arrow\n  data\n    lists\n      - label Step 1\n      - label Step 2',
        reason: 'innovate'
      });
      return { messages: [{ role: 'assistant', content: 'Innovated.' }] };
    }
  });

  const service = createInfographicLangChainAgent({
    stateStore,
    env: { OPENROUTER_API_KEY: 'test-key' },
    chatModelFactory: () => ({}),
    createAgentImpl: () => fakeAgent
  });

  await service.applyTransformIntent({ mode: 'innovate', modelProfile: 'fast' });
  assert.equal(stateStore.getSlot('infographic').revisionId, 2);
  const userMsg = capturedMessages?.find((m) => (m?.role || m?.kwargs?.role) === 'user');
  const text =
    typeof userMsg?.content === 'string'
      ? userMsg.content
      : (userMsg?.kwargs?.content ?? '').toString();
  assert.match(text, /Re-imagine|bolder/);
});
