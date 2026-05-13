import test from 'node:test';
import assert from 'node:assert/strict';
import { createCopilotAgentEvents } from '../src/agents/copilotRuntimeAgent.js';

test('Copilot runtime agent streams the LangChain agent response', async () => {
  const events = [];
  const agentService = {
    async invoke() {
      return { message: 'Applied a diagram update.' };
    }
  };
  const stateStore = {
    getState() {
      return { revisionId: 1, diagramSource: 'flowchart TD\n  A-->B' };
    }
  };

  for await (const event of createCopilotAgentEvents({
    input: {
      runId: 'run-1',
      messages: [{ role: 'user', content: 'Add a node' }]
    },
    agentService,
    stateStore
  })) {
    events.push(event);
  }

  assert.deepEqual(
    events.map((event) => event.type),
    ['TEXT_MESSAGE_START', 'TEXT_MESSAGE_CONTENT', 'TEXT_MESSAGE_CONTENT', 'TEXT_MESSAGE_END']
  );
  assert.match(events[1].delta, /Reading the current Mermaid diagram/);
  assert.equal(events[2].delta, 'Applied a diagram update.');
});

test('Copilot runtime agent yields assistant text for invoke failures instead of aborting the AG-UI run', async () => {
  const events = [];
  const agentService = {
    async invoke() {
      throw new Error('This model is not available in your region.');
    }
  };
  const stateStore = {
    getState() {
      return { revisionId: 1, diagramSource: 'flowchart TD\n  A-->B' };
    }
  };

  for await (const event of createCopilotAgentEvents({
    input: {
      runId: 'run-err',
      messages: [{ role: 'user', content: 'Add a node' }]
    },
    agentService,
    stateStore
  })) {
    events.push(event);
  }

  assert.equal(events.at(-1)?.type, 'TEXT_MESSAGE_END');
  assert.ok(events.some((e) => e.type === 'TEXT_MESSAGE_CONTENT' && String(e.delta).includes('Model request failed')));
  assert.ok(events.some((e) => e.type === 'TEXT_MESSAGE_CONTENT' && String(e.delta).includes('region')));
});
