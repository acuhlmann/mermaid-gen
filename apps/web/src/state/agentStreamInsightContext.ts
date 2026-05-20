import type { InsightEventContext } from './applyAgentStreamInsightEvent.js';

/** Dependencies for building an agent-stream insight reducer context (extracted from App.jsx). */
export type AgentStreamInsightDeps = Omit<
  InsightEventContext,
  'sectionId' | 'operation' | 'variant' | 'diagramUndoBaseline'
>;

export function buildAgentStreamInsightContext(
  sectionId: string,
  operation: string | undefined,
  variant: string | undefined,
  diagramUndoBaseline: unknown,
  deps: AgentStreamInsightDeps
): InsightEventContext {
  return {
    sectionId,
    operation,
    variant,
    diagramUndoBaseline,
    ...deps
  };
}
