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

const STAKEHOLDER_SINGLE_PREFIX = 'Apply this stakeholder suggestion to the diagram.';
const STAKEHOLDER_BATCH_PREFIX = 'Apply these stakeholder suggestions to the diagram.';
const STAKEHOLDER_SUGGESTION_MARKER = 'Suggestion: "';

/**
 * Pull the human-facing suggestion out of a wrapped stakeholder intent prompt
 * so Thinking titles quote the ask, not the boilerplate preamble.
 * @param {string | null | undefined} promptText
 * @param {{ batchMore?: string }} [copy]
 * @returns {string | null}
 */
export function extractStakeholderSuggestionDisplay(promptText, copy) {
  const trimmed = (promptText ?? '').trim();
  if (trimmed.startsWith(STAKEHOLDER_SINGLE_PREFIX)) {
    const markerIdx = trimmed.indexOf(STAKEHOLDER_SUGGESTION_MARKER);
    if (markerIdx === -1) return null;
    const start = markerIdx + STAKEHOLDER_SUGGESTION_MARKER.length;
    const end = trimmed.indexOf('"', start);
    if (end === -1) return null;
    const suggestion = trimmed.slice(start, end).trim();
    return suggestion || null;
  }
  if (trimmed.startsWith(STAKEHOLDER_BATCH_PREFIX)) {
    const bullets = trimmed
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('- '))
      .map((line) => line.slice(2).trim())
      .filter(Boolean);
    if (bullets.length === 0) return null;
    if (bullets.length === 1) return bullets[0];
    const moreLabel = copy?.batchMore ?? '(+{count} more)';
    const suffix = moreLabel.replace('{count}', String(bullets.length - 1));
    return `${bullets[0]} ${suffix}`;
  }
  return null;
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

/**
 * Batch intent prompt for multiple office action items (meeting minutes, etc.).
 * @param {string[]} suggestionTexts
 */
export function buildOfficeBatchIntentPrompt(suggestionTexts) {
  const items = (suggestionTexts ?? [])
    .map((text) =>
      String(text ?? '')
        .trim()
        .slice(0, 400)
    )
    .filter(Boolean);
  if (items.length === 0) return '';
  if (items.length === 1) return buildAdvisorIntentPrompt(items[0]);
  const bullets = items.map((text) => `- ${text}`).join('\n');
  return [
    'Apply these stakeholder suggestions to the diagram.',
    'Change only what each suggestion targets; do not rewrite unrelated parts unless required for valid syntax or connectivity.',
    '',
    'Suggestions:',
    bullets
  ].join('\n');
}
