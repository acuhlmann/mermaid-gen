/** Transform modes runnable via `runTransform` (diagram must be non-empty). */
export const ADVISOR_TRANSFORM_MODES = new Set(['gilfoyle', 'dinesh', 'erlich', 'goMad', 'barker']);

/** Analyze kinds runnable via `runAnalyze` (diagram must be non-empty). */
export const ADVISOR_ANALYZE_KINDS = new Set(['critique', 'explain']);

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
