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

test('applyIntent applies DSL embedded in assistant prose when the model skips tools', async () => {
  const stateStore = createDiagramStateStore();
  const dsl =
    'infographic list-row-simple-horizontal-arrow\n  data\n    lists\n      - label A\n      - label B';
  let calls = 0;
  const fakeAgent = makeAgentStub({
    async onInvoke() {
      calls += 1;
      return { messages: [{ role: 'assistant', content: `Sure — here you go.\n\n${dsl}` }] };
    }
  });

  const service = createInfographicLangChainAgent({
    stateStore,
    env: { OPENROUTER_API_KEY: 'test-key' },
    chatModelFactory: () => ({}),
    createAgentImpl: () => fakeAgent
  });

  const result = await service.applyIntent({
    prompt: 'two items',
    modelProfile: 'fast'
  });

  assert.equal(calls, 1, 'prose recovery should succeed without a second agent invoke');
  assert.equal(stateStore.getSlot('infographic').revisionId, 1);
  assert.equal(result.metadata?.validator, 'prose-dsl-recovery');
});

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

test('applyIntent surfaces tool failure error in the repair instruction even when tool messages omit tool_call_id', async () => {
  const stateStore = createDiagramStateStore();
  const seenRepairMessages = [];
  let calls = 0;
  const fakeAgent = makeAgentStub({
    async onInvoke({ messages }) {
      calls += 1;
      if (calls === 1) {
        // Simulate a stream-captured tool result that lacks `tool_call_id` but carries the
        // standard JSON-stringified `{accepted:false, error}` shape in content. This mirrors
        // what we see in real LangChain v1 stream events where messages come back without
        // the snake_cased identifier exposed at the top level.
        return {
          messages: [
            {
              role: 'assistant',
              content: '',
              tool_calls: [
                {
                  name: 'apply_infographic_patch',
                  args: {
                    diagramSource: 'infographic mystery-template\n  data\n    foo bar',
                    reason: 'attempt one'
                  }
                }
              ]
            },
            {
              role: 'tool',
              content: JSON.stringify({ accepted: false, error: 'Unknown template "mystery-template".' })
            }
          ]
        };
      }
      seenRepairMessages.push(messages);
      // Repair turn: apply a valid patch so the loop terminates successfully.
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

  const result = await service.applyIntent({ prompt: 'thing', modelProfile: 'fast' });
  assert.equal(stateStore.getSlot('infographic').revisionId, 1);
  assert.match(result.message, /Patched on retry|updated/i);
  assert.equal(seenRepairMessages.length, 1, 'one repair turn should have happened');
  const repairText = seenRepairMessages[0]
    .map((m) => (typeof m?.content === 'string' ? m.content : (m?.kwargs?.content ?? '')))
    .join('\n');
  assert.match(
    repairText,
    /mystery-template/,
    'repair instruction should reference the rejected template from the tool failure'
  );
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

test('repair instruction includes the original user request', async () => {
  const stateStore = createDiagramStateStore();
  const seenRepair = [];
  let calls = 0;
  const fakeAgent = makeAgentStub({
    async onInvoke({ messages }) {
      calls += 1;
      if (calls === 1) {
        return {
          messages: [
            {
              role: 'assistant',
              content: '',
              tool_calls: [
                {
                  name: 'apply_infographic_patch',
                  args: { diagramSource: 'infographic mystery-template\n  data', reason: 'first try' }
                }
              ]
            },
            {
              role: 'tool',
              content: JSON.stringify({ accepted: false, error: 'Unknown template "mystery-template".' })
            }
          ]
        };
      }
      seenRepair.push(messages);
      await stateStore.applyDiagramSource({
        contentType: 'infographic',
        diagramSource:
          'infographic list-row-simple-horizontal-arrow\n  data\n    lists\n      - label A',
        reason: 'agent repair'
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

  await service.applyIntent({ prompt: 'Show me the release pipeline', modelProfile: 'fast' });

  assert.equal(seenRepair.length, 1, 'one repair turn should have run');
  const repairText = seenRepair[0]
    .map((m) => (typeof m?.content === 'string' ? m.content : (m?.kwargs?.content ?? '')))
    .join('\n');
  assert.match(repairText, /Show me the release pipeline/);
  assert.match(repairText, /ORIGINAL USER REQUEST/);
});

test('stable agent fallback runs the next attempt with the fallback agent when first turn is prose-only', async () => {
  const stateStore = createDiagramStateStore();
  const invocationLog = [];
  let calls = 0;
  // The "hot" agent — always returns prose, never calls a tool.
  const hotAgent = {
    async invoke({ messages }) {
      calls += 1;
      invocationLog.push({ agent: 'hot', call: calls, messages });
      return { messages: [{ role: 'assistant', content: 'I shall ponder.' }] };
    }
  };
  // The "stable" agent — calls the tool on its first invocation.
  const stableAgent = {
    async invoke({ messages }) {
      calls += 1;
      invocationLog.push({ agent: 'stable', call: calls, messages });
      await stateStore.applyDiagramSource({
        contentType: 'infographic',
        diagramSource:
          'infographic list-row-simple-horizontal-arrow\n  data\n    lists\n      - label A',
        reason: 'stable agent fallback'
      });
      return { messages: [{ role: 'assistant', content: 'Patched by stable.' }] };
    }
  };
  // Return hot on first createAgentImpl call (default agent), stable on second (transform's stableAgent slot).
  let agentIdx = 0;
  const createAgentImpl = () => {
    agentIdx += 1;
    return agentIdx === 1 ? hotAgent : stableAgent;
  };

  const service = createInfographicLangChainAgent({
    stateStore,
    env: { OPENROUTER_API_KEY: 'test-key' },
    chatModelFactory: () => ({}),
    createAgentImpl
  });

  // Seed a starter so transform has something to operate on.
  await stateStore.applyDiagramSource({
    contentType: 'infographic',
    diagramSource:
      'infographic list-row-simple-horizontal-arrow\n  data\n    lists\n      - label seed',
    reason: 'seed'
  });

  await service.applyTransformIntent({ mode: 'goMad', modelProfile: 'fast', goMadDepth: 5 });

  // Hot agent must have fired at least once before the stable fallback was used.
  const hotCalls = invocationLog.filter((e) => e.agent === 'hot');
  const stableCalls = invocationLog.filter((e) => e.agent === 'stable');
  assert.ok(hotCalls.length >= 1, 'hot agent should run first');
  assert.ok(stableCalls.length >= 1, 'stable agent should run as fallback');
  // Final state must reflect the stable agent's patch.
  assert.match(stateStore.getSlot('infographic').diagramSource, /label A/);
});

test('INFOGRAPHIC_REPAIR_MAX_ATTEMPTS=0 caps the retry loop', async () => {
  const stateStore = createDiagramStateStore();
  let calls = 0;
  const fakeAgent = makeAgentStub({
    async onInvoke() {
      calls += 1;
      return { messages: [{ role: 'assistant', content: 'No tool call here.' }] };
    }
  });

  const service = createInfographicLangChainAgent({
    stateStore,
    env: { OPENROUTER_API_KEY: 'test-key', INFOGRAPHIC_REPAIR_MAX_ATTEMPTS: '0' },
    chatModelFactory: () => ({}),
    createAgentImpl: () => fakeAgent
  });

  await service.applyIntent({ prompt: 'irrelevant', modelProfile: 'fast' });
  assert.equal(calls, 1, 'with max attempts 0, only one turn should run');
  assert.equal(stateStore.getSlot('infographic').revisionId, 0);
});
