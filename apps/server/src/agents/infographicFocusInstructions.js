/**
 * Selection-scope instructions for the infographic agent.
 *
 * The web client emits `selectionKind: 'infographic-item'` along with:
 *   - `indexes`     — comma-separated path into the main data field (e.g. "0", "1,2").
 *   - `elementType` — which element-type was clicked: item-label / item-desc / item-value /
 *                     item-icon / item-icon-group / item-illus / title / desc.
 *   - `label`       — the item's primary label (resolved on the client by matching
 *                     a sibling `[data-element-type=item-label]` with the same `data-indexes`).
 *   - `clickedLabel`— the literal text of the clicked element (if different from `label`).
 *
 * We translate that into focused English prose the model can act on without having to
 * understand the AntV DOM layer.
 */

function parseIndexes(raw) {
  if (typeof raw !== 'string' || !raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => Number.parseInt(s, 10))
    .filter((n) => Number.isInteger(n) && n >= 0);
}

/**
 * Format an index path into a JS-like accessor for the model.
 *   formatIndexPath([0]) → "[0]"
 *   formatIndexPath([1, 2]) → "[1].children[2]"
 */
function formatIndexPath(indexes) {
  if (!indexes.length) return '';
  return indexes.map((n, i) => (i === 0 ? `[${n}]` : `.children[${n}]`)).join('');
}

const ELEMENT_TYPE_NOUNS = {
  'item-label': 'label',
  'item-desc': 'description',
  'item-value': 'value',
  'item-icon': 'icon',
  'item-icon-group': 'icon',
  'item-illus': 'illustration',
  title: 'title',
  desc: 'top-level description'
};

function describeElement(elementType) {
  return ELEMENT_TYPE_NOUNS[elementType] || 'item';
}

function describeSelection(focusNode) {
  const elementType = focusNode.elementType || '';
  const indexes = parseIndexes(focusNode.indexes);
  const role = describeElement(elementType);
  const labelText = focusNode.label ? ` (visible text: "${focusNode.label}")` : '';
  const clicked =
    focusNode.clickedLabel && focusNode.clickedLabel !== focusNode.label
      ? ` Clicked sub-text: "${focusNode.clickedLabel}".`
      : '';

  if (elementType === 'title' || elementType === 'desc') {
    // Top-level title/desc — no indexes apply.
    return {
      role,
      summary: `the diagram-level ${role}${labelText}.${clicked}`,
      target: `${role}`
    };
  }

  const path = formatIndexPath(indexes);
  // The actual top-level data field (lists / sequences / compares / values / nodes / items / root)
  // depends on the template; we describe the path abstractly as `<field>${path}` so the model
  // adapts to whatever main data field its template uses.
  const target = path ? `the data item at <main-data-field>${path}` : 'the selected item';
  return {
    role,
    summary: `the ${role} of ${target}${labelText}.${clicked}`,
    target
  };
}

/** Mutation-mode instruction (intent / transform). */
export function buildInfographicFocusScopeInstructions(focusNode) {
  if (!focusNode?.id || focusNode.selectionKind !== 'infographic-item') return '';
  const { role, summary, target } = describeSelection(focusNode);

  if (role === 'title' || role === 'top-level description') {
    return `\n\nFocus scope: The user selected ${summary} Prefer edits to that ${role} only — adjust its wording, length, or tone as needed. Leave the main data items (lists / sequences / compares / values / nodes / root) unchanged unless the request explicitly requires it.`;
  }

  return `\n\nFocus scope: The user selected ${summary} Prefer edits centered on ${target} — its label, desc, value, or icon. Keep sibling items and the rest of the data structure unchanged unless the request explicitly requires it. The path notation uses the template's main data field (one of \`lists\`, \`sequences\`, \`compares\`, \`values\`, \`nodes\`, \`items\`, or \`root\`); apply it to whichever field this template actually uses.`;
}

/** Analyze-mode instruction (explain / critique). */
export function buildInfographicAnalyzeFocusInstructions(focusNode, kind) {
  if (!focusNode?.id || focusNode.selectionKind !== 'infographic-item') return '';
  const { role, summary, target } = describeSelection(focusNode);

  if (kind === 'explain') {
    if (role === 'title' || role === 'top-level description') {
      return `\n\nSelection focus: The user selected ${summary} Lead with what this ${role} communicates in ## Explanation and ## Main message — its framing, scope, and any rhetorical effect on the rest of the diagram. Use ## Key data points and ## Takeaways to tie the body of the infographic back to this ${role}. Reference unrelated items only as supporting context.`;
    }
    return `\n\nSelection focus: The user selected ${summary} Lead with this specific item in ## Explanation and ## Main message — what the ${role} says, how the item fits into the surrounding sequence/list/comparison, and why it matters. Use ## Key data points to quote its label/desc/value verbatim, and ## Takeaways to draw conclusions tied to it. Mention sibling items only as supporting context. Refer to the item by its visible label, not by index.`;
  }

  // critique
  if (role === 'title' || role === 'top-level description') {
    return `\n\nSelection focus: The user selected ${summary} In ## Weaknesses and limits, ## Template fit, and ## Actionable improvements, prioritize how well this ${role} frames the body and whether it could be sharper, more specific, or better aligned with the data items below. Keep ## Visual and information density tied to how this ${role} reads. The ## Strengths section is optional — include only if there is something genuinely surprising about this ${role}.`;
  }
  return `\n\nSelection focus: The user selected ${summary} In ## Weaknesses and limits, ## Template fit, and ## Actionable improvements, prioritize issues with this specific item — its label clarity, value accuracy, icon fit, position in the sequence/list, and whether it deserves to stay or be merged/replaced. Keep ## Visual and information density referenced where it applies to this item. The ## Strengths section is optional — include only if there is something genuinely surprising about this item. Address sibling items only after covering ${target}.`;
}
