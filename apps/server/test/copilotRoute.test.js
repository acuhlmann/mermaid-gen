import test from 'node:test';
import assert from 'node:assert/strict';
import { LlmNotConfiguredError } from '../src/agents/mermaidLangChainAgent.js';
import {
  handleClientStateSync,
  handleCoAuthorIntent,
  handleDiagramIntent,
  handleStyleIntent
} from '../src/routes/copilot.js';
import { createDiagramStateStore } from '../src/state/diagramStateStore.js';

function intentPayload(overrides = {}) {
  return {
    prompt: 'Add an API gateway',
    revisionId: 0,
    mermaidSource: 'flowchart TD\n  Start[Start] --> EndNode[End]',
    temperature: 0.7,
    ...overrides
  };
}

test('intent route returns 503 when OpenRouter is not configured', async () => {
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
  assert.match(result.body.error, /OpenRouter is not configured/);
});

test('intent route applies a patch from the agent service', async () => {
  const stateStore = createDiagramStateStore();
  const agentService = {
    async applyIntent() {
      await stateStore.applyMermaidSource({
        mermaidSource: 'flowchart TD\n  Start[Start] --> Gateway[API Gateway]\n  Gateway --> EndNode[End]',
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
  assert.match(result.body.state.mermaidSource, /Gateway/);
  assert.equal(result.body.metadata.llm, true);
  assert.equal(result.body.metadata.agent, 'intent');
});

test('coauthor route applies a patch from the coauthor agent service', async () => {
  const stateStore = createDiagramStateStore();
  const agentService = {
    async applyCoAuthorIntent() {
      await stateStore.applyMermaidSource({
        mermaidSource: 'flowchart TD\n  Start[Start] --> EndNode[End]\n  EndNode --> Surprise[Surprise path]',
        reason: 'coauthor extension'
      });
      return { message: 'Added a surprise extension.' };
    }
  };

  const result = await handleCoAuthorIntent({
    body: {
      ...intentPayload(),
      trigger: 'manual',
      settings: {
        surpriseScale: 4
      }
    },
    stateStore,
    agentService
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.message, 'Added a surprise extension.');
  assert.equal(result.body.patch.nextRevisionId, 1);
  assert.match(result.body.state.mermaidSource, /Surprise/);
  assert.equal(result.body.metadata.agent, 'coauthor');
});

test('coauthor route returns concise no-patch errors', async () => {
  const stateStore = createDiagramStateStore();
  const longModelText = 'Let me break new ground '.repeat(80);
  const agentService = {
    async applyCoAuthorIntent() {
      return { message: longModelText };
    }
  };

  const result = await handleCoAuthorIntent({
    body: {
      ...intentPayload(),
      trigger: 'manual',
      settings: {
        surpriseScale: 5
      }
    },
    stateStore,
    agentService
  });

  assert.equal(result.status, 422);
  assert.equal(result.body.error, 'Co-author did not apply a diagram patch.');
  assert.match(result.body.message, /returned text instead of a valid diagram update/);
  assert.doesNotMatch(result.body.message, /break new ground/);
});

test('style route applies a style patch from the agent service', async () => {
  const stateStore = createDiagramStateStore();
  const agentService = {
    async applyStyleIntent() {
      await stateStore.applyMermaidSource({
        mermaidSource:
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

test('style route returns 503 when OpenRouter is not configured', async () => {
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
  assert.match(result.body.error, /OpenRouter is not configured/);
});

test('client state sync route updates backend source for co-author context', async () => {
  const stateStore = createDiagramStateStore();
  const result = await handleClientStateSync({
    body: {
      mermaidSource: 'flowchart TD\n  Idea[Topic] --> Detail[Client draft]'
    },
    stateStore
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.revisionId, 1);
  assert.match(result.body.mermaidSource, /Client draft/);
});

test('client state sync route rejects invalid Mermaid syntax', async () => {
  const stateStore = createDiagramStateStore();
  const result = await handleClientStateSync({
    body: {
      mermaidSource: 'flowchart TD\n  Broken['
    },
    stateStore
  });

  assert.equal(result.status, 422);
  assert.match(result.body.error, /parser rejected|not valid Mermaid syntax/i);
  assert.equal(stateStore.getState().revisionId, 0);
});
