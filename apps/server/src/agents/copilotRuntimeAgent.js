import { BuiltInAgent } from '@copilotkit/runtime/v2';
import { LlmNotConfiguredError } from './mermaidLangChainAgent.js';

export async function* createCopilotAgentEvents({ input, agentService }) {
  const messageId = `assistant-${input.runId}`;
  let delta;

  try {
    const result = await agentService.invoke({
      messages: input.messages ?? []
    });
    delta = result.message;
  } catch (error) {
    if (error instanceof LlmNotConfiguredError) {
      delta = error.message;
    } else {
      throw error;
    }
  }

  yield {
    type: 'TEXT_MESSAGE_START',
    messageId
  };
  yield {
    type: 'TEXT_MESSAGE_CONTENT',
    messageId,
    delta
  };
  yield {
    type: 'TEXT_MESSAGE_END',
    messageId
  };
}

export function createCopilotRuntimeAgent({ agentService }) {
  return new BuiltInAgent({
    type: 'custom',
    factory: (context) => createCopilotAgentEvents({ input: context.input, agentService })
  });
}
