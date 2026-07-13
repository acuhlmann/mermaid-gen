import { createLazyMermaidAgentService } from './mermaidLangChainAgent.js';
import { createLazyInfographicAgentService } from './infographicLangChainAgent.js';
import { createLazyMetaphorAgentService } from './metaphorLangChainAgent.js';
import { createLazyChartAgentService } from './chartLangChainAgent.js';
import { createLazyAnythingAgentService } from './anythingLangChainAgent.js';
import { createLazyFormsAgentService } from './formsLangChainAgent.js';

/**
 * @typedef {import('@archislop/shared').DiagramAgentService} DiagramAgentService
 */

/**
 * Routes diagram-agent calls to the per-content-type service based on `contentType`.
 * Each contained service satisfies the shared `DiagramAgentService` contract and is
 * lazy: the underlying agent is instantiated only on first use.
 *
 * @param {{ stateStore: unknown, env?: NodeJS.ProcessEnv }} args
 */
export function createDiagramAgentDispatcher({ stateStore, env = process.env } = {}) {
  const mermaidService = createLazyMermaidAgentService({ stateStore, env });
  const infographicService = createLazyInfographicAgentService({ stateStore, env });
  const metaphorService = createLazyMetaphorAgentService({ stateStore, env });
  const chartService = createLazyChartAgentService({ stateStore, env });
  const anythingService = createLazyAnythingAgentService({ stateStore, env });
  const formsService = createLazyFormsAgentService({ stateStore, env });

  function agentFor(contentType) {
    if (contentType === 'infographic') return infographicService;
    if (contentType === 'metaphor3d') return metaphorService;
    if (contentType === 'chart') return chartService;
    if (contentType === 'anything') return anythingService;
    if (contentType === 'forms') return formsService;
    return mermaidService;
  }

  return {
    /** Style intent — supported by mermaid and chart. Routes that allow Style must reject contentType
     *  not in ('mermaid', 'chart'). */
    async applyStyleIntent(input) {
      if (input?.contentType === 'chart') {
        return chartService.applyStyleIntent(input);
      }
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
      infographic: infographicService,
      metaphor3d: metaphorService,
      chart: chartService,
      anything: anythingService,
      forms: formsService
    }
  };
}
