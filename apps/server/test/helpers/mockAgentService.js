/**
 * Build a minimal in-memory agent service stub for route/dispatcher tests.
 *
 * @param {Record<string, Function>} [handlers]
 */
export function createMockAgentService(handlers = {}) {
  return {
    async applyIntent(input) {
      return handlers.applyIntent?.(input) ?? { message: 'ok' };
    },
    async applyTransformIntent(input) {
      return handlers.applyTransformIntent?.(input) ?? { message: 'ok' };
    },
    async applyAnalyzeIntent(input) {
      return handlers.applyAnalyzeIntent?.(input) ?? { message: 'ok' };
    },
    async applyStyleIntent(input) {
      return handlers.applyStyleIntent?.(input) ?? { message: 'ok' };
    },
    async runAgentStream(operation, payload, emit) {
      return (
        handlers.runAgentStream?.(operation, payload, emit) ?? {
          message: 'ok',
          operation,
          contentType: payload?.contentType
        }
      );
    }
  };
}

/**
 * Label each slot service so dispatcher routing assertions stay table-driven.
 * @param {string} label
 */
export function createLabeledAgentStub(label) {
  return createMockAgentService({
    async applyIntent(input) {
      return { message: `${label}:intent`, contentType: input?.contentType };
    },
    async applyTransformIntent(input) {
      return { message: `${label}:transform`, contentType: input?.contentType };
    },
    async applyAnalyzeIntent(input) {
      return { message: `${label}:analyze`, contentType: input?.contentType };
    },
    async applyStyleIntent(input) {
      return { message: `${label}:style`, contentType: input?.contentType };
    },
    async runAgentStream(operation, payload, emit) {
      if (typeof emit === 'function') emit({ type: 'status', message: `${label}:${operation}` });
      return { message: `${label}:stream`, operation, contentType: payload?.contentType };
    }
  });
}
