import { stateSnapshot } from '@archislop/shared';
import { redactSecrets } from '../utils/redactSecrets.js';
import { LlmNotConfiguredError } from './llmProvider.js';

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
      yield stateSnapshot({ snapshot: afterState });
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
    const detail = redactSecrets(error instanceof Error ? error.message : String(error));
    if (error instanceof LlmNotConfiguredError) {
      yield {
        type: 'TEXT_MESSAGE_CONTENT',
        messageId,
        delta: detail
      };
    } else {
      const regionHint =
        /region|not available in your country|unsupported_country/i.test(detail)
          ? '\n\nIf this is a **region / model availability** issue, set `DEEPSEEK_MODEL*` / `OPENROUTER_MODEL*` / `VERTEX_MODEL*` tier env vars in your server `.env` (for example DeepSeek `deepseek-v4-flash` or OpenRouter `qwen/qwen3-32b`), then restart the API server.\n'
          : '';
      yield {
        type: 'TEXT_MESSAGE_CONTENT',
        messageId,
        delta: `**Model request failed**\n\n${detail}${regionHint}`
      };
    }
  }

  yield {
    type: 'TEXT_MESSAGE_END',
    messageId
  };
}
