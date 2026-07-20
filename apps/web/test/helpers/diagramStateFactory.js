/**
 * Minimal diagram store state for Vitest component and reducer tests.
 */
export function createDiagramStateFixture(overrides = {}) {
  return {
    sessionId: 'test-session',
    activeContentType: 'mermaid',
    slots: {
      mermaid: {
        diagramSource: 'flowchart TD\n  A[Start] --> B[End]',
        revisionId: 1,
        lastUserPrompt: null
      },
      infographic: { diagramSource: '', revisionId: 0, lastUserPrompt: null },
      metaphor3d: { diagramSource: '', revisionId: 0, lastUserPrompt: null },
      chart: { diagramSource: '', revisionId: 0, lastUserPrompt: null },
      anything: { diagramSource: '', revisionId: 0, lastUserPrompt: null },
      forms: { diagramSource: '', revisionId: 0, lastUserPrompt: null }
    },
    insights: [],
    ...overrides
  };
}

/**
 * @param {Array<Record<string, unknown>>} events
 */
export function createMockAgentStream(events = []) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const event of events) yield event;
    }
  };
}
