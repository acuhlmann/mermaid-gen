import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TRANSFORM_MODEL_LIMITS,
  buildPatchRequiredInstruction,
  buildSyntaxRepairInstruction,
  createMermaidLangChainAgent,
  normalizeAgentStreamEvent,
  shouldAttemptSyntaxRepair,
  toLangChainMessages,
  transformModeModelOptions
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

test('transform mode picks increasing temperatures', () => {
  assert.ok(transformModeModelOptions('refine').temperature < transformModeModelOptions('innovate').temperature);
  assert.ok(transformModeModelOptions('innovate').temperature < transformModeModelOptions('goMad').temperature);
  assert.ok(transformModeModelOptions('goMad').temperature > 1.12);
  assert.equal(transformModeModelOptions('goMad').topP, TRANSFORM_MODEL_LIMITS.topP);
  assert.equal(transformModeModelOptions('goMad').maxTokens, TRANSFORM_MODEL_LIMITS.maxTokens);
});

test('applyTransformIntent uses hotter transform model for goMad', async () => {
  const modelOptions = [];

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
    createTransformChatModel: (options) => {
      modelOptions.push(options);
      return {};
    },
    createAgentImpl: () => fakeAgent
  });

  await service.applyTransformIntent({
    mode: 'goMad'
  });

  assert.ok(modelOptions.some((options) => options.temperature === transformModeModelOptions('goMad').temperature));
});

test('normalizeAgentStreamEvent maps token-bearing stream chunks', () => {
  const mapped = normalizeAgentStreamEvent({
    event: 'on_chat_model_stream',
    data: { chunk: { content: 'hi' } }
  });
  assert.equal(mapped?.type, 'token');
  assert.equal(mapped?.text, 'hi');
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

test('buildPatchRequiredInstruction asks for a patch after prose-only output', () => {
  const instruction = buildPatchRequiredInstruction({
    messages: [{ role: 'user', content: 'Extend wildly.' }]
  });

  assert.equal(instruction.role, 'user');
  assert.match(instruction.content, /did not apply a diagram patch/i);
  assert.match(instruction.content, /apply_mermaid_patch/);
  assert.match(instruction.content, /once with complete/);
  assert.match(instruction.content, /Extend wildly/);
});

test('createMermaidLangChainAgent attaches tool-call middleware by default', async () => {
  const stateStore = createDiagramStateStore();
  let capturedOptions;

  const fakeAgent = {
    async invoke() {
      return { messages: [{ role: 'assistant', content: 'OK.' }] };
    }
  };

  const service = createMermaidLangChainAgent({
    stateStore,
    model: {},
    env: { OPENROUTER_API_KEY: 'test-key' },
    createAgentImpl: (opts) => {
      capturedOptions ??= opts;
      return fakeAgent;
    }
  });

  await service.invoke({ messages: [{ role: 'user', content: 'hello' }] });

  assert.ok(Array.isArray(capturedOptions.middleware));
  assert.equal(capturedOptions.middleware.length, 1);
});

test('createMermaidLangChainAgent omits middleware when MERMAID_AGENT_MAX_TOOL_CALLS_PER_RUN=0', async () => {
  const stateStore = createDiagramStateStore();
  let capturedOptions;

  const fakeAgent = {
    async invoke() {
      return { messages: [{ role: 'assistant', content: 'OK.' }] };
    }
  };

  const service = createMermaidLangChainAgent({
    stateStore,
    model: {},
    env: {
      OPENROUTER_API_KEY: 'test-key',
      MERMAID_AGENT_MAX_TOOL_CALLS_PER_RUN: '0'
    },
    createAgentImpl: (opts) => {
      capturedOptions ??= opts;
      return fakeAgent;
    }
  });

  await service.invoke({ messages: [{ role: 'user', content: 'hello' }] });

  assert.equal(capturedOptions.middleware, undefined);
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

test('transform retries once when the model returns prose without applying a patch', async () => {
  const stateStore = createDiagramStateStore();
  let callCount = 0;
  const fakeAgent = {
    async invoke() {
      callCount += 1;
      if (callCount === 1) {
        return {
          messages: [{ role: 'assistant', content: 'Here is a creative idea in prose only.' }]
        };
      }

      await stateStore.applyMermaidSource({
        mermaidSource: 'flowchart TD\n  Start[Start] --> Portal[Wild Portal]\n  Portal --> EndNode[End]',
        reason: 'forced patch success'
      });
      return {
        messages: [{ role: 'assistant', content: 'Applied a valid wild extension.' }]
      };
    }
  };

  const service = createMermaidLangChainAgent({
    stateStore,
    model: {},
    env: { OPENROUTER_API_KEY: 'test-key' },
    createTransformChatModel: () => ({}),
    createAgentImpl: () => fakeAgent
  });

  const result = await service.applyTransformIntent({
    mode: 'goMad'
  });

  assert.equal(callCount, 2);
  assert.equal(stateStore.getState().revisionId, 1);
  assert.match(result.message, /valid wild extension/i);
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
