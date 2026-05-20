import { BuiltInAgent } from '@copilotkit/runtime/v2';
import { createCopilotAgentEvents } from './copilotAgentEvents.js';

export { createCopilotAgentEvents } from './copilotAgentEvents.js';

export function createCopilotRuntimeAgent({ agentService, stateStore }) {
  return new BuiltInAgent({
    type: 'custom',
    factory: (context) => createCopilotAgentEvents({ input: context.input, agentService, stateStore })
  });
}

export function createSessionAwareCopilotRuntimeAgent({ getSessionServicesForInput }) {
  return new BuiltInAgent({
    type: 'custom',
    factory: (context) => {
      const { agentService, stateStore } = getSessionServicesForInput(context.input);
      return createCopilotAgentEvents({
        input: context.input,
        agentService,
        stateStore
      });
    }
  });
}
