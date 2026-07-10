import { focusPayload } from './appInsightHelpers.js';

/**
 * Focus node for API routes — strips UI-only `source` from advisor orchestrator focus.
 * @param {{ id?: string, source?: string } | null | undefined} descriptor
 * @returns {import('./appInsightHelpers.js').FocusPayload | undefined}
 */
export function focusNodeFromAdvisorDescriptor(descriptor) {
  if (!descriptor?.id) return undefined;
  const { source: _source, ...focusNode } = descriptor;
  return focusNode;
}

/**
 * Prefer advisor bubble focus (selected/hover), then explicit override, then canvas selection.
 * @param {{
 *   advisorFocusDescriptor?: { id?: string } | null,
 *   focusTarget?: unknown,
 *   selectedNode?: unknown
 * }} args
 */
export function resolveAdvisorFocusNode({ advisorFocusDescriptor, focusTarget, selectedNode }) {
  const fromAdvisor = focusNodeFromAdvisorDescriptor(advisorFocusDescriptor);
  if (fromAdvisor?.id) return fromAdvisor;
  if (focusTarget) return focusPayload(focusTarget);
  return focusPayload(selectedNode);
}

/** User intent prompt when accepting a stakeholder suggestion via the intent route. */
export function buildAdvisorIntentPrompt(suggestionText) {
  const trimmed = String(suggestionText ?? '')
    .trim()
    .slice(0, 400);
  if (!trimmed) return '';
  return [
    'Apply this stakeholder suggestion to the diagram.',
    'Change only what the suggestion targets; do not rewrite unrelated parts unless required for valid syntax or connectivity.',
    '',
    `Suggestion: "${trimmed}"`
  ].join('\n');
}
