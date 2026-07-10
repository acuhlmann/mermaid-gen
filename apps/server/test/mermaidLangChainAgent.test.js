import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_OPENROUTER_MODEL_FAST,
  DEFAULT_OPENROUTER_MODEL_QUALITY,
  DEFAULT_VERTEX_MODEL_FAST,
  GO_MAD_TRANSFORM_MAX_TOKENS,
  STREAM_ERROR_NO_MUTATION_REVISION,
  TRANSFORM_MODEL_LIMITS,
  buildDiagramMutationSystemMessage,
  buildPatchRequiredInstruction,
  buildSyntaxGuidanceSystemMessage,
  buildSyntaxRepairInstruction,
  buildTransformUserContent,
  clampGoMadDepth,
  createMermaidLangChainAgent,
  emitIntentTransformStreamResult,
  extractMermaidFromAssistantResult,
  inferMermaidTopKeyword,
  normalizeAgentStreamEvent,
  normalizeModelProfile,
  resolveOpenRouterModelId,
  runInvokeWithStreamingKeepalive,
  shouldAttemptSyntaxRepair,
  toLangChainMessages,
  transformModeModelOptions,
  goMadTransformModelOptions
} from '../src/agents/mermaidLangChainAgent.js';
import {
  forwardNormalizedAgentStreamEvent,
  parseToolApplyResultOutput
} from '../src/agents/_lib/diagramAgentHelpers.js';
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
  assert.ok(
    transformModeModelOptions('refine').temperature <
      transformModeModelOptions('innovate').temperature
  );
  assert.ok(
    transformModeModelOptions('innovate').temperature <
      transformModeModelOptions('goMad').temperature
  );
  // Go Mad chaos is prompt-driven; sampling stays in the range where tool calls
  // and Mermaid syntax remain reliable (see goMadTransformModelOptions).
  assert.ok(transformModeModelOptions('goMad').temperature <= 1.2);
  assert.ok(transformModeModelOptions('goMad').topP >= TRANSFORM_MODEL_LIMITS.topP);
  assert.equal(transformModeModelOptions('goMad').maxTokens, GO_MAD_TRANSFORM_MAX_TOKENS);
  assert.ok(GO_MAD_TRANSFORM_MAX_TOKENS < TRANSFORM_MODEL_LIMITS.maxTokens);
  // exec is the focused, subtractive mode — lower temperature than refine so the
  // VP doesn't get creative and start adding boxes.
  assert.ok(
    transformModeModelOptions('exec').temperature < transformModeModelOptions('refine').temperature
  );
  assert.equal(transformModeModelOptions('exec').maxTokens, TRANSFORM_MODEL_LIMITS.maxTokens);
});

test('goMadTransformModelOptions ramps temperature and topP with depth', () => {
  const shallow = goMadTransformModelOptions(1);
  const deep = goMadTransformModelOptions(12);
  assert.ok(deep.temperature > shallow.temperature);
  assert.ok(deep.temperature <= 1.2);
  assert.ok(deep.topP >= shallow.topP);
  assert.equal(shallow.maxTokens, GO_MAD_TRANSFORM_MAX_TOKENS);
  assert.equal(deep.maxTokens, GO_MAD_TRANSFORM_MAX_TOKENS);
});

test('clampGoMadDepth coerces and clamps', () => {
  assert.equal(clampGoMadDepth(undefined), 1);
  assert.equal(clampGoMadDepth(2), 2);
  assert.equal(clampGoMadDepth(99), 12);
  assert.equal(clampGoMadDepth(1.7), 1);
});

test('inferMermaidTopKeyword skips init comments', () => {
  assert.equal(
    inferMermaidTopKeyword('%%{init:{"theme":"dark"}}%%\nflowchart TD\n  A --> B'),
    'flowchart'
  );
  assert.equal(inferMermaidTopKeyword('sequenceDiagram\n  Alice->>Bob: hi'), 'sequenceDiagram');
});

test('buildTransformUserContent adds escalation for goMad depth >= 2', () => {
  const src = 'flowchart TD\n  A --> B';
  const focus = '';
  const shallow = buildTransformUserContent({
    mode: 'goMad',
    diagramSource: src,
    focusScope: focus,
    goMadDepth: 1
  });
  assert.doesNotMatch(shallow, /GO MAD escalation/);

  const deep = buildTransformUserContent({
    mode: 'goMad',
    diagramSource: src,
    focusScope: focus,
    goMadDepth: 2
  });
  assert.match(deep, /GO MAD escalation \(tier 2\)/);
  assert.match(deep, /MUST NOT stay "flowchart"/);
  assert.match(deep, /gitGraph/);

  const tier5 = buildTransformUserContent({
    mode: 'goMad',
    diagramSource: src,
    focusScope: focus,
    goMadDepth: 5
  });
  assert.match(tier5, /one coherent geek joke/i);

  const tier6 = buildTransformUserContent({
    mode: 'goMad',
    diagramSource: src,
    focusScope: focus,
    goMadDepth: 6
  });
  assert.match(tier6, /wrong-tool/i);

  const tier4 = buildTransformUserContent({
    mode: 'goMad',
    diagramSource: src,
    focusScope: focus,
    goMadDepth: 4
  });
  assert.match(tier4, /≥3|THREE/i);
});

test('buildTransformUserContent ignores goMadDepth for refine', () => {
  const text = buildTransformUserContent({
    mode: 'refine',
    diagramSource: 'flowchart TD\n  A --> B',
    focusScope: '',
    goMadDepth: 9
  });
  assert.doesNotMatch(text, /GO MAD escalation/);
});

test('buildTransformUserContent emits exec policy that is subtractive only', () => {
  const text = buildTransformUserContent({
    mode: 'exec',
    diagramSource: 'flowchart TD\n  A --> B',
    focusScope: ''
  });
  assert.match(text, /EXEC/);
  assert.match(text, /Subtractive only/i);
  assert.match(text, /SAME diagram type/i);
  assert.doesNotMatch(text, /GO MAD escalation/);
});

test('buildTransformUserContent threads advisorPrompt for scoped stakeholder accept', () => {
  const text = buildTransformUserContent({
    mode: 'refine',
    diagramSource: 'flowchart TD\n  A --> B',
    focusScope: '',
    advisorPrompt: 'Rename Cache to Redis'
  });
  assert.match(text, /Stakeholder suggestion to honor/i);
  assert.match(text, /Rename Cache to Redis/);
  assert.match(text, /do not rewrite the whole diagram/i);
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
    env: { OPENROUTER_API_KEY: 'test-key' },
    chatModelFactory: (_e, options) => {
      modelOptions.push(options);
      return {};
    },
    createAgentImpl: () => fakeAgent
  });

  await service.applyTransformIntent({
    mode: 'goMad',
    goMadDepth: 3
  });

  assert.ok(
    modelOptions.some(
      (options) => options.temperature === goMadTransformModelOptions(3).temperature
    )
  );
  assert.ok(
    modelOptions.some(
      (options) => options.temperature > transformModeModelOptions('goMad').temperature
    )
  );
  assert.ok(modelOptions.some((options) => options.maxTokens === GO_MAD_TRANSFORM_MAX_TOKENS));
});

test('resolveOpenRouterModelId maps profiles and env overrides', () => {
  const base = {
    OPENROUTER_API_KEY: 'k',
    OPENROUTER_MODEL: 'fallback-model'
  };
  assert.equal(resolveOpenRouterModelId(base, 'fast'), 'fallback-model');
  assert.equal(
    resolveOpenRouterModelId({ ...base, OPENROUTER_MODEL_FAST: 'mini' }, 'fast'),
    'mini'
  );
  assert.equal(resolveOpenRouterModelId(base, 'quality'), 'fallback-model');
  assert.equal(
    resolveOpenRouterModelId(
      { ...base, OPENROUTER_MODEL_QUALITY: 'anthropic/claude-3.5-sonnet' },
      'quality'
    ),
    'anthropic/claude-3.5-sonnet'
  );
  assert.equal(
    resolveOpenRouterModelId({ OPENROUTER_API_KEY: 'k' }, 'fast'),
    DEFAULT_OPENROUTER_MODEL_FAST
  );
  assert.equal(
    resolveOpenRouterModelId({ OPENROUTER_API_KEY: 'k' }, 'quality'),
    DEFAULT_OPENROUTER_MODEL_QUALITY
  );
  assert.equal(
    resolveOpenRouterModelId({ OPENROUTER_API_KEY: 'k', K_SERVICE: 'my-service' }, 'fast'),
    DEFAULT_OPENROUTER_MODEL_FAST
  );
  assert.equal(
    resolveOpenRouterModelId({ OPENROUTER_API_KEY: 'k', K_SERVICE: 'my-service' }, 'quality'),
    DEFAULT_OPENROUTER_MODEL_QUALITY
  );
  assert.equal(normalizeModelProfile(undefined), 'fast');
  assert.equal(normalizeModelProfile('quality'), 'quality');
});

test('normalizeAgentStreamEvent maps token-bearing stream chunks', () => {
  const mapped = normalizeAgentStreamEvent({
    event: 'on_chat_model_stream',
    data: { chunk: { content: 'hi' } }
  });
  assert.equal(mapped?.type, 'token');
  assert.equal(mapped?.text, 'hi');
});

test('normalizeAgentStreamEvent maps on_tool_start with nested input name', () => {
  const mapped = normalizeAgentStreamEvent({
    event: 'on_tool_start',
    data: { input: { name: 'apply_infographic_patch' } }
  });
  assert.equal(mapped?.type, 'tool_start');
  assert.equal(mapped?.name, 'apply_infographic_patch');
});

test('normalizeAgentStreamEvent attaches applyResult on rejected apply_chart_patch tool_end', () => {
  const mapped = normalizeAgentStreamEvent({
    event: 'on_tool_end',
    data: {
      name: 'apply_chart_patch',
      output: JSON.stringify({
        accepted: false,
        error: 'Vega-Lite compile failed: Invalid encoding channel "colour"'
      })
    }
  });
  assert.equal(mapped?.type, 'tool_end');
  assert.equal(mapped?.name, 'apply_chart_patch');
  assert.deepEqual(mapped?.applyResult, {
    accepted: false,
    error: 'Vega-Lite compile failed: Invalid encoding channel "colour"'
  });
});

test('parseToolApplyResultOutput reads JSON string envelopes', () => {
  const parsed = parseToolApplyResultOutput(
    JSON.stringify({ accepted: false, error: 'Chart DSL must include archislopVersion' })
  );
  assert.deepEqual(parsed, {
    accepted: false,
    error: 'Chart DSL must include archislopVersion'
  });
});

test('parseToolApplyResultOutput reads success metadata from apply envelopes', () => {
  const parsed = parseToolApplyResultOutput(
    JSON.stringify({
      accepted: true,
      state: { revisionId: 9, diagramSource: 'flowchart TD\n  A --> B' },
      patch: { reason: 'Add auth gate', diagramSource: 'flowchart TD\n  A --> B' },
      metadata: {
        validator: 'local-parser',
        graphDiff: {
          nodesAdded: ['Auth'],
          nodesRemoved: [],
          edgesAdded: [{ from: 'A', to: 'Auth' }],
          edgesRemoved: []
        }
      }
    })
  );
  assert.deepEqual(parsed, {
    accepted: true,
    revisionId: 9,
    reason: 'Add auth gate',
    validator: 'local-parser',
    nodesAdded: 1,
    nodesRemoved: 0,
    edgesAdded: 1,
    edgesRemoved: 0
  });
});

test('forwardNormalizedAgentStreamEvent emits tool_apply_result after accepted patch', () => {
  const captured = [];
  forwardNormalizedAgentStreamEvent(captured.push.bind(captured), {
    type: 'tool_end',
    name: 'apply_mermaid_patch',
    id: 'tool_9',
    applyResult: {
      accepted: true,
      revisionId: 5,
      reason: 'Tighten layout',
      nodesAdded: 1
    }
  });
  assert.equal(captured.length, 2);
  assert.equal(captured[1].type, 'tool_apply_result');
  assert.equal(captured[1].accepted, true);
  assert.equal(captured[1].revisionId, 5);
  assert.equal(captured[1].reason, 'Tighten layout');
});

test('forwardNormalizedAgentStreamEvent emits tool_apply_result after rejected patch', () => {
  const captured = [];
  forwardNormalizedAgentStreamEvent(captured.push.bind(captured), {
    type: 'tool_end',
    name: 'apply_chart_patch',
    applyResult: { accepted: false, error: 'Missing $schema in Vega-Lite spec' }
  });
  assert.equal(captured.length, 2);
  assert.equal(captured[0].type, 'tool_end');
  assert.equal(captured[1].type, 'tool_apply_result');
  assert.equal(captured[1].error, 'Missing $schema in Vega-Lite spec');
});

test('shouldAttemptSyntaxRepair detects syntax-like validation errors', () => {
  assert.equal(shouldAttemptSyntaxRepair('Proposed source is not valid Mermaid syntax.'), true);
  assert.equal(shouldAttemptSyntaxRepair('Mermaid validation failed.'), true);
  assert.equal(shouldAttemptSyntaxRepair('Executive simplify is subtractive only'), true);
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
  assert.match(instruction.content, /Do not ask the user for more details/);
  assert.match(instruction.content, /Extend wildly/);
});

test('buildDiagramMutationSystemMessage enforces infer-default and patch-first behavior', () => {
  const msg = buildDiagramMutationSystemMessage();
  assert.equal(msg.role, 'system');
  assert.match(msg.content, /infer a reasonable default/i);
  assert.match(msg.content, /apply_mermaid_patch/);
  assert.match(msg.content, /clarification/i);
});

test('buildSyntaxGuidanceSystemMessage injects rule pack for detected diagram type', async () => {
  const stateStore = createDiagramStateStore();
  await stateStore.applyDiagramSource({
    contentType: 'mermaid',
    diagramSource: 'sequenceDiagram\n  Alice->>Bob: hi',
    reason: 'seed'
  });
  const msg = buildSyntaxGuidanceSystemMessage({ stateStore, mode: 'refine' });
  assert.ok(msg);
  assert.equal(msg.role, 'system');
  assert.match(msg.content, /Active diagram type: sequenceDiagram/);
  assert.match(msg.content, /Sequence diagram rules:/);
  // Refine mode anchors on the type — no "may change type" disclaimer.
  assert.doesNotMatch(msg.content, /no longer apply/);
});

test('buildSyntaxGuidanceSystemMessage marks rules advisory for type-changing modes', async () => {
  const stateStore = createDiagramStateStore();
  await stateStore.applyDiagramSource({
    contentType: 'mermaid',
    diagramSource: 'flowchart TD\n  A --> B',
    reason: 'seed'
  });
  const innovateMsg = buildSyntaxGuidanceSystemMessage({ stateStore, mode: 'innovate' });
  const goMadMsg = buildSyntaxGuidanceSystemMessage({ stateStore, mode: 'goMad' });
  assert.match(innovateMsg.content, /no longer apply/);
  assert.match(goMadMsg.content, /no longer apply/);
});

test('buildSyntaxGuidanceSystemMessage returns null when no diagram type is detectable', () => {
  const stateStore = createDiagramStateStore();
  // Default state has empty diagramSource.
  const msg = buildSyntaxGuidanceSystemMessage({ stateStore, mode: 'refine' });
  assert.equal(msg, null);
});

test('applyIntent with requirePatch passes mutation system message before diagram context', async () => {
  const stateStore = createDiagramStateStore();
  let capturedMessages = null;
  const fakeAgent = {
    async *streamEvents() {
      // Yield nothing so runAgentTurn falls back to invoke (same as missing stream in tests).
    },
    async invoke(payload) {
      capturedMessages = payload.messages;
      await stateStore.applyDiagramSource({
        contentType: 'mermaid',
        diagramSource: 'flowchart TD\n  A[Start] --> B[End]',
        reason: 'test patch'
      });
      return { messages: [{ role: 'assistant', content: 'Applied.' }] };
    }
  };

  const service = createMermaidLangChainAgent({
    stateStore,
    env: { OPENROUTER_API_KEY: 'test-key' },
    chatModelFactory: () => ({}),
    createAgentImpl: () => fakeAgent
  });

  await service.applyIntent({ prompt: 'photosynthesis', settings: {} });

  assert.ok(Array.isArray(capturedMessages));
  const first = capturedMessages[0];
  const second = capturedMessages[1];
  const content0 = typeof first?.content === 'string' ? first.content : '';
  const content1 = typeof second?.content === 'string' ? second.content : '';
  assert.match(content0, /Diagram mutation mode/i);
  assert.match(content0, /apply_mermaid_patch/);
  assert.match(content1, /Current diagram context/i);
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
    env: { OPENROUTER_API_KEY: 'test-key' },
    chatModelFactory: () => ({}),
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
    env: {
      OPENROUTER_API_KEY: 'test-key',
      MERMAID_AGENT_MAX_TOOL_CALLS_PER_RUN: '0'
    },
    chatModelFactory: () => ({}),
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

      await stateStore.applyDiagramSource({
        contentType: 'mermaid',
        diagramSource: 'flowchart TD\n  Start[Start] --> Gateway[Gateway]',
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
      env: { OPENROUTER_API_KEY: 'test-key' },
      chatModelFactory: () => ({}),
      createAgentImpl: () => fakeAgent
    });

    const result = await service.invoke({
      messages: [{ role: 'user', content: 'add gateway' }]
    });

    assert.equal(callCount, 2);
    assert.equal(stateStore.getSlot('mermaid').revisionId, 1);
    assert.match(result.message, /gateway/i);
  } finally {
    process.env.MERMAID_REPAIR_MAX_ATTEMPTS = originalAttempts;
  }
});

test('exhausted repair loop reports the validator root cause, not model prose', async () => {
  const stateStore = createDiagramStateStore();
  const parserError =
    "Mermaid parser rejected source: Parse error on line 7:\nExpecting 'TAGEND', got 'SQS'";
  const fakeAgent = {
    async invoke() {
      return {
        messages: [
          { role: 'tool', content: JSON.stringify({ accepted: false, error: parserError }) },
          { role: 'assistant', content: 'I tried my best, here is a summary of the diagram.' }
        ]
      };
    }
  };

  const service = createMermaidLangChainAgent({
    stateStore,
    env: { OPENROUTER_API_KEY: 'test-key', MERMAID_REPAIR_MAX_ATTEMPTS: '1' },
    chatModelFactory: () => ({}),
    createAgentImpl: () => fakeAgent
  });

  const result = await service.invoke({
    messages: [{ role: 'user', content: 'add gateway' }]
  });

  assert.equal(stateStore.getSlot('mermaid').revisionId, 0, 'no patch should have landed');
  assert.match(result.message, /Diagram update failed:/);
  assert.match(result.message, /Parse error on line 7/);
  assert.equal(result.metadata?.error, parserError);
});

test('transform patch_retry uses the stable fast agent, not the hot transform agent', async () => {
  // Reproduce the Go Mad failure mode: hot agent emits prose-only on the first turn.
  // The patch_retry should land on the stable fast agent rather than rolling the same
  // high-temperature dice a second time.
  const stateStore = createDiagramStateStore();
  let hotCalls = 0;
  let stableCalls = 0;

  const hotAgent = {
    async invoke() {
      hotCalls += 1;
      return {
        messages: [{ role: 'assistant', content: 'Wild prose, zero tool calls, much chaos.' }]
      };
    }
  };
  const stableAgent = {
    async invoke() {
      stableCalls += 1;
      await stateStore.applyDiagramSource({
        contentType: 'mermaid',
        diagramSource: 'flowchart TD\n  A[Start] --> B[End]',
        reason: 'stable fallback patch'
      });
      return { messages: [{ role: 'assistant', content: 'Applied via stable fallback.' }] };
    }
  };

  const service = createMermaidLangChainAgent({
    stateStore,
    env: { OPENROUTER_API_KEY: 'test-key' },
    chatModelFactory: (_e, options) => {
      // Tag the fake model so createAgentImpl can route to the right fake agent.
      const isGoMadHot = typeof options.temperature === 'number' && options.temperature > 1;
      return { __profile: isGoMadHot ? 'hot' : 'stable' };
    },
    createAgentImpl: (opts) => (opts.model?.__profile === 'hot' ? hotAgent : stableAgent)
  });

  const result = await service.applyTransformIntent({ mode: 'goMad', goMadDepth: 4 });

  assert.equal(hotCalls, 1, 'hot agent should run exactly once (first turn)');
  assert.equal(stableCalls, 1, 'stable agent should handle the patch_retry');
  assert.equal(stateStore.getSlot('mermaid').revisionId, 1);
  assert.match(result.message, /stable fallback/i);
});

test('transform syntax repair uses the stable fast agent after a quality failure', async () => {
  const stateStore = createDiagramStateStore();
  let hotCalls = 0;
  let stableCalls = 0;

  const hotAgent = {
    async invoke() {
      hotCalls += 1;
      return {
        messages: [
          { role: 'assistant', content: '' },
          {
            role: 'tool',
            content: JSON.stringify({
              accepted: false,
              error: 'Mermaid parser rejected source: Parse error on line 2.'
            })
          }
        ]
      };
    }
  };
  const stableAgent = {
    async invoke() {
      stableCalls += 1;
      await stateStore.applyDiagramSource({
        contentType: 'mermaid',
        diagramSource: 'flowchart TD\n  A[Start] --> B[End]',
        reason: 'stable syntax repair'
      });
      return { messages: [{ role: 'assistant', content: 'Applied via stable syntax repair.' }] };
    }
  };

  const service = createMermaidLangChainAgent({
    stateStore,
    env: { OPENROUTER_API_KEY: 'test-key', MERMAID_REPAIR_MAX_ATTEMPTS: '1' },
    chatModelFactory: (_e, options) => ({
      __profile:
        typeof options.temperature === 'number' && options.temperature > 0.5 ? 'hot' : 'stable'
    }),
    createAgentImpl: (opts) => (opts.model?.__profile === 'hot' ? hotAgent : stableAgent)
  });

  const result = await service.applyTransformIntent({
    mode: 'innovate',
    modelProfile: 'quality'
  });

  assert.equal(hotCalls, 1, 'quality transform agent should run only for the first creative turn');
  assert.equal(stableCalls, 1, 'stable fast agent should handle the syntax repair turn');
  assert.equal(stateStore.getSlot('mermaid').revisionId, 1);
  assert.match(result.message, /stable syntax repair/i);
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

      await stateStore.applyDiagramSource({
        contentType: 'mermaid',
        diagramSource:
          'flowchart TD\n  Start[Start] --> Portal[Wild Portal]\n  Portal --> EndNode[End]',
        reason: 'forced patch success'
      });
      return {
        messages: [{ role: 'assistant', content: 'Applied a valid wild extension.' }]
      };
    }
  };

  const service = createMermaidLangChainAgent({
    stateStore,
    env: { OPENROUTER_API_KEY: 'test-key' },
    chatModelFactory: () => ({}),
    createAgentImpl: () => fakeAgent
  });

  const result = await service.applyTransformIntent({
    mode: 'goMad'
  });

  assert.equal(callCount, 2);
  assert.equal(stateStore.getSlot('mermaid').revisionId, 1);
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
    env: { OPENROUTER_API_KEY: 'test-key', OPENROUTER_MODEL: 'google/gemini-test' },
    chatModelFactory: () => ({}),
    createAgentImpl: () => boomAgent
  });

  const result = await service.applyIntent({ prompt: 'touch diagram', settings: {} });

  assert.match(result.message, /Model request failed/);
  assert.match(result.message, /Tool calling rejected/);
});

test('Cloud Run auto mode passes Vertex default fast model into chatModelFactory', async () => {
  const captured = [];
  const fakeAgent = {
    async invoke() {
      return { messages: [{ role: 'assistant', content: 'ok' }] };
    }
  };
  const service = createMermaidLangChainAgent({
    stateStore: createDiagramStateStore(),
    env: {
      K_SERVICE: 'mermaid-gen-main',
      GOOGLE_CLOUD_PROJECT: 'myproj',
      OPENROUTER_API_KEY: 'k'
    },
    chatModelFactory: (_e, opts) => {
      captured.push(opts);
      return {};
    },
    createAgentImpl: () => fakeAgent
  });

  await service.applyIntent({ prompt: 'noop', settings: {} });
  assert.ok(captured.some((o) => o.model === DEFAULT_VERTEX_MODEL_FAST));
});

test('emitIntentTransformStreamResult emits coded error when mutation stream ends without revision bump', () => {
  const stateStore = createDiagramStateStore();
  const events = [];
  const emit = (e) => events.push(e);

  emitIntentTransformStreamResult({
    emit,
    operation: 'transform',
    revisionBefore: 0,
    stateStore,
    agentResult: { message: 'I only wrote prose.' }
  });

  assert.equal(events.length, 2);
  assert.equal(events[0].type, 'error');
  assert.equal(events[0].code, 'no_mutation_revision');
  assert.equal(events[0].message, 'I only wrote prose.');
  assert.equal(events[1].type, 'final');
  assert.equal(events[1].revisionChanged, false);
  assert.equal(events[1].message, 'I only wrote prose.');
  assert.equal(events[1].state, undefined);
});

test('emitIntentTransformStreamResult falls back to generic coded error without agent message', () => {
  const stateStore = createDiagramStateStore();
  const events = [];

  emitIntentTransformStreamResult({
    emit: (e) => events.push(e),
    operation: 'intent',
    revisionBefore: 0,
    stateStore,
    agentResult: {}
  });

  assert.equal(events[0].type, 'error');
  assert.equal(events[0].code, 'no_mutation_revision');
  assert.equal(events[0].message, STREAM_ERROR_NO_MUTATION_REVISION);
});

test('emitIntentTransformStreamResult uses infographic slot when contentType is infographic', async () => {
  const stateStore = createDiagramStateStore();
  await stateStore.applyDiagramSource({
    contentType: 'infographic',
    diagramSource: 'template: relation-dagre-flow-tb-simple-circle-node\nnodes: []',
    reason: 'test'
  });
  const events = [];
  emitIntentTransformStreamResult({
    emit: (e) => events.push(e),
    operation: 'intent',
    revisionBefore: 0,
    stateStore,
    agentResult: { message: 'No patch.' },
    contentType: 'infographic'
  });
  assert.equal(events.length, 2);
  assert.equal(events[0].code, 'no_mutation_revision');
  assert.equal(events[1].revisionChanged, false);
});

test('emitIntentTransformStreamResult emits only final when revision advances', async () => {
  const stateStore = createDiagramStateStore();
  await stateStore.applyDiagramSource({
    contentType: 'mermaid',
    diagramSource: 'flowchart TD\n  A[Start] --> B[End]',
    reason: 'test'
  });
  const events = [];
  emitIntentTransformStreamResult({
    emit: (e) => events.push(e),
    operation: 'transform',
    revisionBefore: 0,
    stateStore,
    agentResult: { message: 'Patched.' }
  });
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'final');
  assert.equal(events[0].revisionChanged, true);
  assert.ok(events[0].state);
  assert.equal(events[0].message, 'Patched.');
});

test('runInvokeWithStreamingKeepalive emits status while invoke runs', async () => {
  const prev = process.env.MERMAID_INVOKE_KEEPALIVE_MS;
  process.env.MERMAID_INVOKE_KEEPALIVE_MS = '500';
  const statusTexts = [];
  const result = await runInvokeWithStreamingKeepalive(
    (e) => {
      if (e.type === 'status') statusTexts.push(e.text);
    },
    process.env,
    () => new Promise((resolve) => setTimeout(() => resolve(99), 1100))
  );
  if (prev === undefined) delete process.env.MERMAID_INVOKE_KEEPALIVE_MS;
  else process.env.MERMAID_INVOKE_KEEPALIVE_MS = prev;

  assert.equal(result, 99);
  assert.ok(statusTexts.length >= 1);
  assert.ok(statusTexts.every((t) => t === 'Still working…'));
});

test('extractMermaidFromAssistantResult salvages fenced and bare sources conservatively', () => {
  const fence = (lang, body) => '```' + lang + '\n' + body + '\n```';

  // Fenced ```mermaid block inside prose.
  assert.equal(
    extractMermaidFromAssistantResult({
      messages: [
        { role: 'assistant', content: 'Sure:\n\n' + fence('mermaid', 'flowchart TD\n  A --> B') }
      ]
    }),
    'flowchart TD\n  A --> B'
  );

  // Untagged fence whose first meaningful line (after an init directive) is a diagram decl.
  assert.equal(
    extractMermaidFromAssistantResult({
      messages: [
        { role: 'assistant', content: fence('', '%%{init: {"theme":"dark"}}%%\npie\n  "a" : 1') }
      ]
    }),
    '%%{init: {"theme":"dark"}}%%\npie\n  "a" : 1'
  );

  // Non-mermaid fences are not salvaged.
  assert.equal(
    extractMermaidFromAssistantResult({
      messages: [{ role: 'assistant', content: fence('json', '{"a": 1}') }]
    }),
    null
  );

  // Prose mentioning a diagram type mid-sentence is not salvaged.
  assert.equal(
    extractMermaidFromAssistantResult({
      messages: [{ role: 'assistant', content: 'A flowchart would be great here, let me know.' }]
    }),
    null
  );

  // Bare source without fences.
  assert.equal(
    extractMermaidFromAssistantResult({
      messages: [{ role: 'assistant', content: 'flowchart TD\n  A --> B' }]
    }),
    'flowchart TD\n  A --> B'
  );

  // Only assistant messages are scanned.
  assert.equal(
    extractMermaidFromAssistantResult({
      messages: [{ role: 'user', content: fence('mermaid', 'flowchart TD\n  A --> B') }]
    }),
    null
  );
});

test('prose-mermaid recovery applies a fenced diagram without paying a retry turn', async () => {
  let invokeCount = 0;
  const fakeAgent = {
    async invoke() {
      invokeCount += 1;
      return {
        messages: [
          {
            role: 'assistant',
            content: 'Here you go:\n\n```mermaid\nflowchart TD\n  A[Start] --> B[End]\n```'
          }
        ]
      };
    }
  };

  const stateStore = createDiagramStateStore();
  const before = stateStore.getSlot('mermaid').revisionId;
  const service = createMermaidLangChainAgent({
    stateStore,
    env: { OPENROUTER_API_KEY: 'test-key' },
    chatModelFactory: () => ({}),
    createAgentImpl: () => fakeAgent
  });

  const result = await service.applyIntent({
    prompt: 'draw a start/end flow',
    modelProfile: 'fast'
  });

  // One model turn only — the salvage replaces the whole patch_retry turn.
  assert.equal(invokeCount, 1);
  assert.equal(stateStore.getSlot('mermaid').revisionId, before + 1);
  assert.match(stateStore.getSlot('mermaid').diagramSource, /A\[Start\] --> B\[End\]/);
  assert.equal(result.metadata?.validator, 'prose-mermaid-recovery');
});

test('rejected prose-mermaid recovery seeds the repair loop instead of a patch retry', async () => {
  let invokeCount = 0;
  const fakeAgent = {
    async invoke() {
      invokeCount += 1;
      return {
        messages: [
          // Dangling edge — extractable as mermaid but fails strict validation.
          { role: 'assistant', content: '```mermaid\nflowchart TD\n  A -->\n```' }
        ]
      };
    }
  };

  const stateStore = createDiagramStateStore();
  const before = stateStore.getSlot('mermaid').revisionId;
  const service = createMermaidLangChainAgent({
    stateStore,
    // MERMAID_REPAIR_BACKEND points at an unconfigured backend so the syntax
    // fixer is unavailable and the flow falls through to the agent repair loop.
    env: { OPENROUTER_API_KEY: 'test-key', MERMAID_REPAIR_BACKEND: 'deepseek' },
    chatModelFactory: () => ({}),
    createAgentImpl: () => fakeAgent
  });

  const result = await service.applyIntent({ prompt: 'draw', modelProfile: 'fast' });

  // First turn + exactly one repair turn (which yields no tool failure, so the loop breaks).
  // No patch_retry turn fires: the rejected prose candidate turned into a validation error.
  assert.equal(invokeCount, 2);
  assert.equal(stateStore.getSlot('mermaid').revisionId, before);
  assert.match(result.message, /Diagram update failed/);
});

test('transform-policy rejection skips the syntax fixer and goes to agent repair', async () => {
  const policyError = 'Go Mad tier 3: switch diagram type (still "flowchart").';
  const resultMessages = [
    {
      role: 'assistant',
      content: '',
      tool_calls: [
        { name: 'apply_mermaid_patch', args: { diagramSource: 'flowchart TD\n  A --> B' } }
      ]
    },
    { role: 'tool', content: JSON.stringify({ accepted: false, error: policyError }) }
  ];
  let turnCount = 0;
  const fakeAgent = {
    async invoke() {
      turnCount += 1;
      return { messages: resultMessages };
    },
    async streamEvents() {
      turnCount += 1;
      return (async function* () {
        yield { event: 'on_chain_end', data: { output: { messages: resultMessages } } };
      })();
    }
  };

  const events = [];
  const stateStore = createDiagramStateStore();
  const service = createMermaidLangChainAgent({
    stateStore,
    // Fixer IS available in this env — the skip must come from the policy-error
    // detection, not from fixer unavailability.
    env: { OPENROUTER_API_KEY: 'test-key' },
    chatModelFactory: () => ({}),
    createAgentImpl: () => fakeAgent
  });

  const result = await service.applyTransformIntent({
    mode: 'goMad',
    goMadDepth: 3,
    emit: (e) => events.push(e)
  });

  assert.ok(
    events.every((e) => e.type !== 'syntax_fixer_start'),
    'syntax fixer must not run on a transform-policy rejection'
  );
  // First turn + both repair attempts, no fixer call in between.
  assert.equal(turnCount, 3);
  assert.match(result.message, /Go Mad tier 3/);
});
