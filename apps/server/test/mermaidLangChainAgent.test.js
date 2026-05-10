import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SURPRISE_SCALE_TEMPERATURES,
  buildSyntaxRepairInstruction,
  createMermaidLangChainAgent,
  shouldAttemptSyntaxRepair,
  surpriseScaleToTemperature,
  surpriseTierGuidance,
  toLangChainMessages
} from '../src/agents/mermaidLangChainAgent.js';
import { createDiagramStateStore } from '../src/state/diagramStateStore.js';

test('agent message conversion drops assistant replies that expose internal tool names', () => {
  const messages = toLangChainMessages([
    {
      role: 'assistant',
      content: 'Please call get_diagram_state before I can help.'
    },
    {
      role: 'user',
      content: 'simplify it'
    }
  ]);

  assert.deepEqual(messages, [
    {
      role: 'user',
      content: 'simplify it'
    }
  ]);
});

test('surprise scale maps to monotonic temperatures', () => {
  assert.equal(surpriseScaleToTemperature(1), SURPRISE_SCALE_TEMPERATURES[1]);
  assert.ok(surpriseScaleToTemperature(5) > surpriseScaleToTemperature(1));
});

test('surprise tier guidance covers scales 1–5', () => {
  assert.match(surpriseTierGuidance(1), /Subtle/);
  assert.match(surpriseTierGuidance(5), /Wild/);
});

test('applyCoAuthorIntent uses distinct ChatOpenRouter temperature per surprise scale', async () => {
  const temperatures = [];

  const fakeAgent = {
    async invoke() {
      return {
        messages: [{ role: 'assistant', content: 'Done.' }]
      };
    }
  };

  const stateStore = createDiagramStateStore();
  const service = createMermaidLangChainAgent({
    stateStore,
    model: {},
    env: { OPENROUTER_API_KEY: 'test-key' },
    createCoAuthorChatModel: (temperature) => {
      temperatures.push(temperature);
      return {};
    },
    createAgentImpl: () => fakeAgent
  });

  await service.applyCoAuthorIntent({
    prompt: 'extend diagram',
    settings: { surpriseScale: 5 }
  });

  assert.equal(temperatures.some((t) => t === SURPRISE_SCALE_TEMPERATURES[5]), true);
});

test('shouldAttemptSyntaxRepair detects syntax-like validation errors', () => {
  assert.equal(shouldAttemptSyntaxRepair('Proposed source is not valid Mermaid syntax.'), true);
  assert.equal(shouldAttemptSyntaxRepair('MCP validation failed'), true);
  assert.equal(shouldAttemptSyntaxRepair('Rate limit hit on unrelated endpoint'), false);
});

test('buildSyntaxRepairInstruction includes validator feedback', () => {
  const instruction = buildSyntaxRepairInstruction({
    messages: [{ role: 'user', content: 'Add a gateway node.' }],
    errorMessage: 'Mermaid parser rejected source: Unexpected token'
  });

  assert.equal(instruction.role, 'user');
  assert.match(instruction.content, /Validator error:/);
  assert.match(instruction.content, /Unexpected token/);
  assert.match(instruction.content, /Add a gateway node/);
});

test('agent invoke performs bounded repair retry after syntax failure', async () => {
  const stateStore = createDiagramStateStore();
  const originalAttempts = process.env.MERMAID_REPAIR_MAX_ATTEMPTS;
  process.env.MERMAID_REPAIR_MAX_ATTEMPTS = '1';

  let callCount = 0;
  const fakeAgent = {
    async invoke() {
      callCount += 1;
      if (callCount === 1) {
        return {
          messages: [
            {
              role: 'tool',
              content: JSON.stringify({
                accepted: false,
                error: 'Proposed source is not valid Mermaid syntax (missing known diagram type).'
              })
            },
            {
              role: 'assistant',
              content: 'I attempted an update.'
            }
          ]
        };
      }

      await stateStore.applyMermaidSource({
        mermaidSource: 'flowchart TD\n  Start[Start] --> Gateway[Gateway]',
        reason: 'retry success'
      });
      return {
        messages: [{ role: 'assistant', content: 'Added a gateway with valid Mermaid.' }]
      };
    }
  };

  try {
    const service = createMermaidLangChainAgent({
      stateStore,
      model: {},
      createAgentImpl: () => fakeAgent
    });

    const result = await service.invoke({
      messages: [{ role: 'user', content: 'add gateway' }]
    });

    assert.equal(callCount, 2);
    assert.equal(stateStore.getState().revisionId, 1);
    assert.match(result.message, /gateway/i);
  } finally {
    process.env.MERMAID_REPAIR_MAX_ATTEMPTS = originalAttempts;
  }
});

test('invoke maps LangChain invoke failures to assistant-safe messages', async () => {
  const stateStore = createDiagramStateStore();
  const boomAgent = {
    async invoke() {
      throw new Error('Tool calling rejected by provider');
    }
  };

  const service = createMermaidLangChainAgent({
    stateStore,
    model: {},
    env: { OPENROUTER_API_KEY: 'test-key', OPENROUTER_MODEL: 'google/gemini-test' },
    createAgentImpl: () => boomAgent
  });

  const result = await service.applyIntent({ prompt: 'touch diagram', settings: {} });

  assert.match(result.message, /Model request failed/);
  assert.match(result.message, /Tool calling rejected/);
});
