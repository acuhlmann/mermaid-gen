import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { LlmNotConfiguredError } from '../src/agents/mermaidLangChainAgent.js';
import {
  createCopilotRouter,
  handleClientStateSync,
  handleDiagramAnalyze,
  handleDiagramIntent,
  handleDiagramTransformIntent,
  handleStyleIntent,
  handleUserDiagramEdit
} from '../src/routes/copilot.js';
import { createDiagramStateStore } from '../src/state/diagramStateStore.js';

function intentPayload(overrides = {}) {
  return {
    prompt: 'Add an API gateway',
    revisionId: 0,
    diagramSource: 'flowchart TD\n  Start[Start] --> EndNode[End]',
    contentType: 'mermaid',
    temperature: 0.7,
    ...overrides
  };
}

test('intent route returns 503 when LLM is not configured', async () => {
  const stateStore = createDiagramStateStore();
  const agentService = {
    async applyIntent() {
      throw new LlmNotConfiguredError();
    }
  };

  const result = await handleDiagramIntent({
    body: intentPayload(),
    stateStore,
    agentService
  });

  assert.equal(result.status, 503);
  assert.match(result.body.error, /No LLM backend is configured/);
});

test('intent route applies a patch from the agent service', async () => {
  const stateStore = createDiagramStateStore();
  const agentService = {
    async applyIntent() {
      await stateStore.applyDiagramSource({
        contentType: 'mermaid',
        diagramSource:
          'flowchart TD\n  Start[Start] --> Gateway[API Gateway]\n  Gateway --> EndNode[End]',
        reason: 'add gateway'
      });
      return { message: 'Added API gateway.' };
    }
  };

  const result = await handleDiagramIntent({
    body: intentPayload(),
    stateStore,
    agentService
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.message, 'Added API gateway.');
  assert.equal(result.body.patch.nextRevisionId, 1);
  assert.match(result.body.state.diagramSource, /Gateway/);
  assert.equal(result.body.metadata.llm, true);
  assert.equal(result.body.metadata.agent, 'intent');
  assert.equal(result.body.metadata.contentType, 'mermaid');
  // The intent prompt is recorded on the slot so mode-switch can carry it across.
  assert.equal(result.body.state.lastUserPrompt, 'Add an API gateway');
  assert.equal(stateStore.getSlot('mermaid').lastUserPrompt, 'Add an API gateway');
});

test('intent route does NOT record lastUserPrompt when the agent fails to apply a patch', async () => {
  const stateStore = createDiagramStateStore();
  const agentService = {
    async applyIntent() {
      // Agent returns success message but never bumps revision.
      return { message: 'Could not apply.' };
    }
  };

  const result = await handleDiagramIntent({
    body: intentPayload(),
    stateStore,
    agentService
  });

  assert.equal(result.status, 422);
  assert.equal(stateStore.getSlot('mermaid').lastUserPrompt, null);
});

test('intent route routes infographic contentType to the infographic slot', async () => {
  const stateStore = createDiagramStateStore();
  let receivedInput;
  const agentService = {
    async applyIntent(input) {
      receivedInput = input;
      await stateStore.applyDiagramSource({
        contentType: 'infographic',
        diagramSource:
          'infographic list-row-simple-horizontal-arrow\n  data\n    lists\n      - label A\n      - label B',
        reason: 'infographic intent'
      });
      return { message: 'Infographic patched.' };
    }
  };

  const result = await handleDiagramIntent({
    body: {
      prompt: 'Three-step rollout',
      revisionId: 0,
      diagramSource: '',
      contentType: 'infographic'
    },
    stateStore,
    agentService
  });

  assert.equal(result.status, 200);
  assert.equal(receivedInput.contentType, 'infographic');
  assert.equal(result.body.metadata.contentType, 'infographic');
  assert.equal(result.body.state.contentType, 'infographic');
  // Mermaid slot stays at revisionId 0
  assert.equal(stateStore.getSlot('mermaid').revisionId, 0);
});

test('intent route forwards peerContext to applyIntent', async () => {
  const stateStore = createDiagramStateStore();
  let receivedInput;
  const agentService = {
    async applyIntent(input) {
      receivedInput = input;
      await stateStore.applyDiagramSource({
        contentType: 'infographic',
        diagramSource:
          'infographic list-row-simple-horizontal-arrow\n  data\n    lists\n      - label A\n      - label B',
        reason: 'infographic intent'
      });
      return { message: 'Infographic patched.' };
    }
  };

  const result = await handleDiagramIntent({
    body: {
      prompt: 'Three-step rollout',
      revisionId: 0,
      diagramSource: '',
      contentType: 'infographic',
      settings: {},
      peerContext: { contentType: 'mermaid', diagramSource: 'flowchart TD\n  A --> B' }
    },
    stateStore,
    agentService
  });

  assert.equal(result.status, 200);
  assert.deepEqual(receivedInput.peerContext, {
    contentType: 'mermaid',
    diagramSource: 'flowchart TD\n  A --> B'
  });
});

test('intent route rejects peerContext when it matches intent contentType', async () => {
  const stateStore = createDiagramStateStore();
  const result = await handleDiagramIntent({
    body: {
      prompt: 'Add an API gateway',
      revisionId: 0,
      diagramSource: 'flowchart TD\n  Start[Start] --> EndNode[End]',
      contentType: 'mermaid',
      settings: {},
      peerContext: { contentType: 'mermaid', diagramSource: 'flowchart TD\n  A --> B' }
    },
    stateStore,
    agentService: {
      async applyIntent() {
        return { message: 'noop' };
      }
    }
  });

  assert.equal(result.status, 400);
  assert.match(String(result.body?.error ?? ''), /Invalid intent payload/);
});

test('transform route applies a patch from the transform agent service', async () => {
  const stateStore = createDiagramStateStore();
  const agentService = {
    async applyTransformIntent() {
      await stateStore.applyDiagramSource({
        contentType: 'mermaid',
        diagramSource:
          'flowchart TD\n  Start[Start] --> EndNode[End]\n  EndNode --> Extended[Extended path]',
        reason: 'transform extension'
      });
      return { message: 'Added an extension.' };
    }
  };

  const result = await handleDiagramTransformIntent({
    body: {
      revisionId: 0,
      diagramSource: 'flowchart TD\n  Start[Start] --> EndNode[End]',
      contentType: 'mermaid',
      mode: 'erlich'
    },
    stateStore,
    agentService
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.message, 'Added an extension.');
  assert.equal(result.body.patch.nextRevisionId, 1);
  assert.match(result.body.state.diagramSource, /Extended/);
  assert.equal(result.body.metadata.agent, 'transform:erlich');
});

test('transform route returns concise no-patch errors', async () => {
  const stateStore = createDiagramStateStore();
  const longModelText = 'Let me break new ground '.repeat(80);
  const agentService = {
    async applyTransformIntent() {
      return { message: longModelText };
    }
  };

  const result = await handleDiagramTransformIntent({
    body: {
      revisionId: 0,
      diagramSource: 'flowchart TD\n  Start[Start] --> EndNode[End]',
      contentType: 'mermaid',
      mode: 'russ'
    },
    stateStore,
    agentService
  });

  assert.equal(result.status, 422);
  assert.equal(result.body.error, 'Transform did not apply a diagram patch.');
  assert.match(result.body.message, /transform returned text instead/i);
  assert.doesNotMatch(result.body.message, /break new ground/);
});

test('transform route forwards russDepth to applyTransformIntent', async () => {
  const stateStore = createDiagramStateStore();
  let received;
  const agentService = {
    async applyTransformIntent(input) {
      received = input;
      await stateStore.applyDiagramSource({
        contentType: 'mermaid',
        diagramSource: 'pie title Madness\n  "A" : 1',
        reason: 'go mad depth'
      });
      return { message: 'ok' };
    }
  };

  const result = await handleDiagramTransformIntent({
    body: {
      revisionId: 0,
      diagramSource: 'flowchart TD\n  Start[Start] --> EndNode[End]',
      contentType: 'mermaid',
      mode: 'russ',
      russDepth: 4
    },
    stateStore,
    agentService
  });

  assert.equal(result.status, 200);
  assert.equal(received.russDepth, 4);
});

test('analyze route returns text without mutating state', async () => {
  const stateStore = createDiagramStateStore();
  const agentService = {
    async applyAnalyzeIntent() {
      return { message: 'Solid diagram overall.' };
    }
  };

  const result = await handleDiagramAnalyze({
    body: {
      revisionId: 0,
      diagramSource: 'flowchart TD\n  Start[Start] --> EndNode[End]',
      contentType: 'mermaid',
      kind: 'jared'
    },
    stateStore,
    agentService
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.text, 'Solid diagram overall.');
  assert.equal(result.body.metadata.agent, 'analyze:jared');
  assert.equal(stateStore.getSlot('mermaid').revisionId, 0);
});

test('style route applies a style patch from the agent service', async () => {
  const stateStore = createDiagramStateStore();
  const agentService = {
    async applyStyleIntent() {
      await stateStore.applyDiagramSource({
        contentType: 'mermaid',
        diagramSource:
          '%%{init: {"theme":"dark","look":"neo","themeVariables":{"primaryColor":"#0f766e"},"flowchart":{"curve":"rounded"}}}%%\nflowchart TD\n  Start[Start] --> End[End]',
        reason: 'style update'
      });
      return { message: 'Applied dark styling.' };
    }
  };

  const result = await handleStyleIntent({
    body: {
      ...intentPayload({ prompt: 'Make it dark and rounded' }),
      stylePrompt: 'Make it dark and rounded'
    },
    stateStore,
    agentService
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.message, 'Applied dark styling.');
  assert.equal(result.body.patch.nextRevisionId, 1);
  assert.equal(result.body.state.styleConfig.theme, 'dark');
  assert.equal(result.body.metadata.agent, 'style');
});

test('style route rejects stale revisions', async () => {
  const stateStore = createDiagramStateStore();
  const agentService = {
    async applyStyleIntent() {
      throw new Error('should not run');
    }
  };

  const result = await handleStyleIntent({
    body: intentPayload({ revisionId: 99, prompt: 'Make it dark' }),
    stateStore,
    agentService
  });

  assert.equal(result.status, 409);
  assert.match(result.body.error, /stale/);
});

test('style route rejects infographic contentType', async () => {
  const stateStore = createDiagramStateStore();
  const agentService = {
    async applyStyleIntent() {
      throw new Error('should not run');
    }
  };

  const result = await handleStyleIntent({
    body: intentPayload({ prompt: 'Make it bold', contentType: 'infographic' }),
    stateStore,
    agentService
  });

  assert.equal(result.status, 400);
  assert.match(result.body.error, /only supported for Mermaid/i);
});

test('style route returns 503 when LLM is not configured', async () => {
  const stateStore = createDiagramStateStore();
  const agentService = {
    async applyStyleIntent() {
      throw new LlmNotConfiguredError();
    }
  };

  const result = await handleStyleIntent({
    body: intentPayload({ prompt: 'Make it dark' }),
    stateStore,
    agentService
  });

  assert.equal(result.status, 503);
  assert.match(result.body.error, /No LLM backend is configured/);
});

test('intent handler forwards the abortSignal to the agent service', async () => {
  const stateStore = createDiagramStateStore();
  const controller = new AbortController();
  let received;
  const agentService = {
    async applyIntent(input) {
      received = input;
      return { message: 'ok' };
    }
  };

  await handleDiagramIntent({
    body: intentPayload(),
    stateStore,
    agentService,
    abortSignal: controller.signal
  });

  assert.equal(received.abortSignal, controller.signal);
});

test('transform handler forwards the abortSignal to the agent service', async () => {
  const stateStore = createDiagramStateStore();
  const controller = new AbortController();
  let received;
  const agentService = {
    async applyTransformIntent(input) {
      received = input;
      return { message: 'ok' };
    }
  };

  await handleDiagramTransformIntent({
    body: {
      revisionId: 0,
      diagramSource: 'flowchart TD\n  Start[Start] --> EndNode[End]',
      contentType: 'mermaid',
      mode: 'gilfoyle'
    },
    stateStore,
    agentService,
    abortSignal: controller.signal
  });

  assert.equal(received.abortSignal, controller.signal);
});

test('style handler forwards the abortSignal to the agent service', async () => {
  const stateStore = createDiagramStateStore();
  const controller = new AbortController();
  let received;
  const agentService = {
    async applyStyleIntent(input) {
      received = input;
      return { message: 'ok' };
    }
  };

  await handleStyleIntent({
    body: {
      ...intentPayload({ prompt: 'Make it dark' }),
      stylePrompt: 'Make it dark'
    },
    stateStore,
    agentService,
    abortSignal: controller.signal
  });

  assert.equal(received.abortSignal, controller.signal);
});

test('intent route aborts the agent run when the client disconnects mid-flight', async () => {
  const stateStore = createDiagramStateStore();
  let sawAbort = false;
  let started = () => {};
  const startedPromise = new Promise((resolve) => {
    started = resolve;
  });
  const agentService = {
    async applyIntent(input) {
      started();
      // Block until the REST client disconnects (or a safety timeout the test never
      // reaches on the happy path). The route wires res 'close' → controller.abort().
      await new Promise((resolve) => {
        if (input.abortSignal?.aborted) {
          sawAbort = true;
          return resolve();
        }
        input.abortSignal?.addEventListener('abort', () => {
          sawAbort = true;
          resolve();
        });
        setTimeout(resolve, 5000);
      });
      return { message: 'run finished without applying a patch' };
    }
  };

  const app = express();
  app.use(express.json());
  app.use(
    '/api/copilotkit',
    createCopilotRouter({
      resolveServices: () => ({ sessionId: 'abort-session', stateStore, agentService }),
      pairingCodeStore: { getOrCreateCode: () => 'ABCDEF' },
      sessionRegistry: { getSessionServices: () => ({}) }
    })
  );
  // Swallow the post-abort write error express surfaces when the handler responds on a
  // socket the client already closed — it's expected here, not a test failure.
  app.use((_err, _req, res, next) => {
    if (res.headersSent) return next();
    res.status(500).end();
  });

  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const port = server.address().port;

  try {
    const controller = new AbortController();
    const reqPromise = fetch(`http://127.0.0.1:${port}/api/copilotkit/intent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(intentPayload()),
      signal: controller.signal
    }).catch(() => null);

    // Abort only after the server has actually started the agent run.
    await startedPromise;
    controller.abort();

    await reqPromise;
    // Give the server's 'close' handler a tick to fire.
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(sawAbort, true, 'agent run should observe the abort on client disconnect');
  } finally {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('client state sync route updates backend source', async () => {
  const stateStore = createDiagramStateStore();
  const result = await handleClientStateSync({
    body: {
      contentType: 'mermaid',
      diagramSource: 'flowchart TD\n  Idea[Topic] --> Detail[Client draft]'
    },
    stateStore
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.revisionId, 1);
  assert.match(result.body.diagramSource, /Client draft/);
});

test('client state sync route rejects invalid Mermaid syntax', async () => {
  const stateStore = createDiagramStateStore();
  const result = await handleClientStateSync({
    body: {
      contentType: 'mermaid',
      diagramSource: 'flowchart TD\n  Broken['
    },
    stateStore
  });

  assert.equal(result.status, 422);
  assert.match(result.body.error, /parser rejected|not valid Mermaid syntax/i);
  assert.equal(stateStore.getSlot('mermaid').revisionId, 0);
});

test('client state sync route accepts empty Mermaid source for clear', async () => {
  const stateStore = createDiagramStateStore();
  await handleClientStateSync({
    body: {
      contentType: 'mermaid',
      diagramSource: 'flowchart TD\n  A --> B'
    },
    stateStore
  });
  const result = await handleClientStateSync({
    body: {
      contentType: 'mermaid',
      diagramSource: ''
    },
    stateStore
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.revisionId, 2);
  assert.equal(result.body.diagramSource, '');
});

test('client state sync route accepts infographic DSL', async () => {
  const stateStore = createDiagramStateStore();
  const result = await handleClientStateSync({
    body: {
      contentType: 'infographic',
      diagramSource:
        'infographic list-row-simple-horizontal-arrow\n  data\n    lists\n      - label A\n      - label B'
    },
    stateStore
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.contentType, 'infographic');
  assert.match(result.body.diagramSource, /infographic /);
  // Mermaid slot is untouched.
  assert.equal(stateStore.getSlot('mermaid').revisionId, 0);
});

test('user-edit route applies a mermaid patch with origin user', async () => {
  const stateStore = createDiagramStateStore();
  const result = await handleUserDiagramEdit({
    body: {
      contentType: 'mermaid',
      diagramSource: 'flowchart TD\n  A[Start] --> B[End]\n  B --> C[Next]',
      previousRevisionId: 0,
      reason: 'Connect node'
    },
    stateStore
  });

  assert.equal(result.status, 200);
  assert.match(result.body.state.diagramSource, /C\[Next\]/);
  assert.equal(result.body.patch.origin.kind, 'user');
  assert.equal(result.body.patch.previousRevisionId, 0);
  assert.equal(stateStore.getSlot('mermaid').revisionId, 1);
});

test('user-edit route refuses a stale revision', async () => {
  const stateStore = createDiagramStateStore();
  await handleUserDiagramEdit({
    body: {
      contentType: 'mermaid',
      diagramSource: 'flowchart TD\n  A --> B',
      previousRevisionId: 0,
      reason: 'Connect node'
    },
    stateStore
  });
  const result = await handleUserDiagramEdit({
    body: {
      contentType: 'mermaid',
      diagramSource: 'flowchart TD\n  A --> Z',
      previousRevisionId: 0,
      reason: 'Connect node'
    },
    stateStore
  });

  assert.equal(result.status, 409);
  assert.equal(result.body.code, 'stale_revision');
  assert.match(stateStore.getSlot('mermaid').diagramSource, /A --> B/);
});

test('user-edit route rejects invalid mermaid without mutating', async () => {
  const stateStore = createDiagramStateStore();
  const before = stateStore.getSlot('mermaid');
  const result = await handleUserDiagramEdit({
    body: {
      contentType: 'mermaid',
      diagramSource: 'flowchart TD\n  Broken[',
      previousRevisionId: 0,
      reason: 'Connect node'
    },
    stateStore
  });

  assert.equal(result.status, 422);
  assert.equal(stateStore.getSlot('mermaid'), before);
});

test('user-edit route applies an infographic hierarchy patch with origin user', async () => {
  const stateStore = createDiagramStateStore();
  const source = `infographic hierarchy-tree-curved-line-rounded-rect-node
data
  root
    label Company
    children
      - label Engineering
      - label Sales
`;
  const result = await handleUserDiagramEdit({
    body: {
      contentType: 'infographic',
      diagramSource: `${source}      - label Legal\n`,
      previousRevisionId: 0,
      reason: 'Connect node'
    },
    stateStore
  });

  assert.equal(result.status, 200);
  assert.match(result.body.state.diagramSource, /Legal/);
  assert.equal(result.body.patch.origin.kind, 'user');
  assert.equal(stateStore.getSlot('infographic').revisionId, 1);
});

test('user-edit route rejects chart contentType', async () => {
  const stateStore = createDiagramStateStore();
  const result = await handleUserDiagramEdit({
    body: {
      contentType: 'chart',
      diagramSource: '{"mark":"bar"}',
      previousRevisionId: 0,
      reason: 'Connect node'
    },
    stateStore
  });
  assert.equal(result.status, 400);
});
