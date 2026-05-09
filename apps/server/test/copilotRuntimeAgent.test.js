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

  for await (const event of createCopilotAgentEvents({
    input: { runId: 'run-1', messages: [] },
    agentService
  })) {
    events.push(event);
  }

  assert.deepEqual(
    events.map((event) => event.type),
    ['TEXT_MESSAGE_START', 'TEXT_MESSAGE_CONTENT', 'TEXT_MESSAGE_END']
  );
  assert.equal(events[1].delta, 'Applied a diagram update.');
});
