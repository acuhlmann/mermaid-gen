import test from 'node:test';
import assert from 'node:assert/strict';
import { LlmNotConfiguredError } from '../src/agents/mermaidLangChainAgent.js';
import { handleCoAuthorIntent, handleDiagramIntent } from '../src/routes/copilot.js';
import { createDiagramStateStore } from '../src/state/diagramStateStore.js';

function intentPayload(overrides = {}) {
  return {
    prompt: 'Add an API gateway',
    revisionId: 0,
    mermaidSource: 'flowchart TD\n  Start[Start] --> End[End]',
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
        mermaidSource: 'flowchart TD\n  Start[Start] --> Gateway[API Gateway]\n  Gateway --> End[End]',
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
        mermaidSource: 'flowchart TD\n  Start[Start] --> End[End]\n  End --> Surprise[Surprise path]',
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
        temperature: 1.1,
        topP: 0.95,
        maxNodes: 30,
        styleGuide: 'bold',
        persona: 'playful coauthor'
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
