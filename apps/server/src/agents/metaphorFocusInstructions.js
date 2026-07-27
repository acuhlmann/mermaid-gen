/**
 * Selection-scope instructions for the metaphor3d agent.
 *
 * The web client emits `selectionKind: 'metaphor-item'` with:
 *   - `id`    — stable item id from the DSL (`items[].id`)
 *   - `label` — visible label on the mesh
 */

/** Mutation-mode instruction (intent / transform gilfoyle / fix). */
export function buildMetaphorFocusScopeInstructions(focusNode) {
  if (!focusNode?.id || focusNode.selectionKind !== 'metaphor-item') return '';
  const label = focusNode.label ? ` (“${focusNode.label}”)` : '';
  return `\n\nFocus scope: The user selected metaphor item \`${focusNode.id}\`${label}. Prefer edits centered on that item in the \`items\` array — its label, note, glyph, grouping, and the numeric/status fields for the active metaphor (height/footprint, thickness, magnitude, weight, elevation/intensity, orbit/size, stage/flow/hazard, or maturity/impact/health). Keep sibling items and the overall metaphor type unchanged unless the request explicitly requires broader changes. Refer to the item by its visible label, not by index.`;
}

/** Analyze-mode instruction (explain / critique). */
export function buildMetaphorAnalyzeFocusInstructions(focusNode, kind) {
  if (!focusNode?.id || focusNode.selectionKind !== 'metaphor-item') return '';
  const label = focusNode.label ? ` (“${focusNode.label}”)` : '';
  if (kind === 'explain') {
    return `\n\nSelection focus: The user selected metaphor item \`${focusNode.id}\`${label}. Lead with what this item communicates in the spatial story — its relative magnitude, position, and label. Tie the rest of the scene back to this item as supporting context.`;
  }
  return `\n\nSelection focus: The user selected metaphor item \`${focusNode.id}\`${label}. Prioritize whether this item earns its magnitude/position, whether the label is clear, and whether it should stay, merge, or be replaced. Address the whole scene only after covering this item.`;
}
