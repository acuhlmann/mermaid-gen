import { BuiltInAgent } from '@copilotkit/runtime/v2';
import { LlmNotConfiguredError } from './mermaidLangChainAgent.js';

function getVisibleMessages(messages = []) {
  return messages.filter((message) => message.role !== 'system');
}

function hasUserMessage(messages = []) {
  return messages.some((message) => message.role === 'user');
}

export async function* createCopilotAgentEvents({ input, agentService, stateStore }) {
  const messageId = `assistant-${input.runId}`;
  const messages = getVisibleMessages(input.messages);

  yield {
    type: 'TEXT_MESSAGE_START',
    messageId
  };

  if (!hasUserMessage(messages)) {
    yield {
      type: 'TEXT_MESSAGE_CONTENT',
      messageId,
      delta:
        'Hi, I can edit the Mermaid diagram over the AG-UI stream. Ask for a change, or use the prompt bar to send one here.'
    };
    yield {
      type: 'TEXT_MESSAGE_END',
      messageId
    };
    return;
  }

  yield {
    type: 'TEXT_MESSAGE_CONTENT',
    messageId,
    delta: 'Reading the current Mermaid diagram and planning a validated patch...\n\n'
  };

  try {
    const beforeState = stateStore.getState();
    const result = await agentService.invoke({
      messages
    });
    const afterState = stateStore.getState();

    if (afterState.revisionId !== beforeState.revisionId) {
      yield {
        type: 'TEXT_MESSAGE_CONTENT',
        messageId,
        delta: `Applied a validated Mermaid update to revision ${afterState.revisionId}. Streaming the accepted source back into the editor now.\n\n`
      };
    }

    yield {
      type: 'TEXT_MESSAGE_CONTENT',
      messageId,
      delta: result.message
    };
  } catch (error) {
    if (error instanceof LlmNotConfiguredError) {
      yield {
        type: 'TEXT_MESSAGE_CONTENT',
        messageId,
        delta: error.message
      };
    } else {
      throw error;
    }
  }

  yield {
    type: 'TEXT_MESSAGE_END',
    messageId
  };
}

export function createCopilotRuntimeAgent({ agentService, stateStore }) {
  return new BuiltInAgent({
    type: 'custom',
    factory: (context) => createCopilotAgentEvents({ input: context.input, agentService, stateStore })
  });
}
