/** Transform modes runnable via `runTransform` (diagram must be non-empty). */
export const ADVISOR_TRANSFORM_MODES = new Set(['gilfoyle', 'dinesh', 'erlich', 'russ', 'barker']);

/**
 * Analyze kinds runnable via `runAnalyze` (diagram must be non-empty). Richard has
 * no transform-mode prompt pack (see `isTransformMode` in mermaidAnalysisPrompts.js) —
 * his "Do it" click re-runs the read-only explain/critique flow instead of mutating
 * the diagram, which matches his pattern-naming voice ("critique feedback", not edits).
 */
export const ADVISOR_ANALYZE_KINDS = new Set(['jared', 'richard']);

/**
 * Classifies advisor "Do it" persona into the correct agent operation.
 * @param {string} persona
 * @param {boolean} hasDiagramSource
 * @returns {'transform' | 'analyze' | 'intent'}
 */
export function resolveAdvisorAcceptOperation(persona, hasDiagramSource) {
  if (hasDiagramSource && ADVISOR_TRANSFORM_MODES.has(persona)) return 'transform';
  if (hasDiagramSource && ADVISOR_ANALYZE_KINDS.has(persona)) return 'analyze';
  return 'intent';
}
