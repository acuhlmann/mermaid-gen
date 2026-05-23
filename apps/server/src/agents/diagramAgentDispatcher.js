import { createLazyMermaidAgentService } from './mermaidLangChainAgent.js';
import { createLazyInfographicAgentService } from './infographicLangChainAgent.js';

/**
 * @typedef {import('@archislop/shared').DiagramAgentService} DiagramAgentService
 */

/**
 * Routes diagram-agent calls to the Mermaid or Infographic service based on `contentType`.
 * Each contained service satisfies the shared `DiagramAgentService` contract and is
 * lazy: the underlying agent is instantiated only on first use.
 *
 * @param {{ stateStore: unknown, env?: NodeJS.ProcessEnv }} args
 */
export function createDiagramAgentDispatcher({ stateStore, env = process.env } = {}) {
  const mermaidService = createLazyMermaidAgentService({ stateStore, env });
  const infographicService = createLazyInfographicAgentService({ stateStore, env });

  function agentFor(contentType) {
    if (contentType === 'infographic') return infographicService;
    return mermaidService;
  }

  return {
    /** Mermaid-only style intent. Routes that allow Style must reject contentType !== 'mermaid'. */
    async applyStyleIntent(input) {
      return mermaidService.applyStyleIntent(input);
    },

    async applyIntent(input) {
      return agentFor(input.contentType).applyIntent(input);
    },

    async applyTransformIntent(input) {
      return agentFor(input.contentType).applyTransformIntent(input);
    },

    async applyAnalyzeIntent(input) {
      return agentFor(input.contentType).applyAnalyzeIntent(input);
    },

    async runAgentStream(operation, payload, emit) {
      return agentFor(payload.contentType).runAgentStream(operation, payload, emit);
    },

    /** Test/debug accessor — returns the underlying service so individual tests can target one. */
    _services: {
      mermaid: mermaidService,
      infographic: infographicService
    }
  };
}
