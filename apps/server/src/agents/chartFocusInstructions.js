/**
 * Selection-scope instructions for the chart (Vega-Lite) agent.
 *
 * The web client emits `selectionKind: 'chart-mark'` with:
 *   - `elementType` — mark | axis-tick | axis-title | legend | legend-label | title
 *   - `indexes`     — datum row index when the user clicked a data mark
 *   - `markType`    — Vega mark type (bar, line, point, …)
 *   - `label`       — visible label / datum text for the selection
 */

const ELEMENT_TYPE_NOUNS = {
  mark: 'data mark',
  'axis-tick': 'axis tick',
  'axis-title': 'axis title',
  axis: 'axis',
  legend: 'legend',
  'legend-label': 'legend entry',
  title: 'chart title'
};

function describeElement(elementType) {
  return ELEMENT_TYPE_NOUNS[elementType] || 'chart element';
}

function describeSelection(focusNode) {
  const elementType = focusNode.elementType || 'mark';
  const role = describeElement(elementType);
  const labelText = focusNode.label ? ` (visible text: "${focusNode.label}")` : '';
  const markHint = focusNode.markType ? ` [${focusNode.markType} mark]` : '';
  const indexHint =
    focusNode.indexes != null && focusNode.indexes !== ''
      ? ` at data row index ${focusNode.indexes}`
      : '';

  if (elementType === 'title') {
    return {
      role,
      summary: `the chart title${labelText}.`,
      target: 'spec.title'
    };
  }
  if (elementType === 'legend' || elementType === 'legend-label') {
    return {
      role,
      summary: `the ${role}${labelText}${markHint}.`,
      target: 'spec.encoding.color.legend or related legend configuration'
    };
  }
  if (elementType.startsWith('axis')) {
    return {
      role,
      summary: `the ${role}${labelText}${markHint}.`,
      target: 'the relevant spec.encoding.* axis (title, labels, scale, or grid)'
    };
  }

  return {
    role,
    summary: `the ${role}${indexHint}${labelText}${markHint}.`,
    target:
      focusNode.indexes != null && focusNode.indexes !== ''
        ? `spec.data.values[${focusNode.indexes}] and its encodings`
        : 'the clicked mark and its encodings'
  };
}

/** Mutation-mode instruction (intent / transform). */
export function buildChartFocusScopeInstructions(focusNode) {
  if (!focusNode?.id || focusNode.selectionKind !== 'chart-mark') return '';
  const { role, summary, target } = describeSelection(focusNode);

  if (role === 'chart title') {
    return `\n\nFocus scope: The user selected ${summary} Prefer edits to the title and its framing only. Keep spec.data, spec.mark, and spec.encoding unchanged unless the request explicitly requires it.`;
  }
  if (role === 'legend' || role === 'legend entry') {
    return `\n\nFocus scope: The user selected ${summary} Prefer edits centered on ${target} — labels, symbol size, orientation, or placement. Keep the underlying data values and mark geometry unchanged unless the request explicitly requires it.`;
  }
  if (role.startsWith('axis')) {
    return `\n\nFocus scope: The user selected ${summary} Prefer edits centered on ${target}. Keep unrelated encodings and data rows unchanged unless the request explicitly requires it.`;
  }

  return `\n\nFocus scope: The user selected ${summary} Prefer edits centered on ${target} — the datum's field values, color/position encodings, labels, or ordering for that row. Keep sibling data rows and unrelated chart structure unchanged unless the request explicitly requires it. Refer to the item by its visible label, not by index.`;
}

/** Analyze-mode instruction (explain / critique). */
export function buildChartAnalyzeFocusInstructions(focusNode, kind) {
  if (!focusNode?.id || focusNode.selectionKind !== 'chart-mark') return '';
  const { role, summary, target } = describeSelection(focusNode);

  if (kind === 'richard') {
    return `\n\nSelection focus: The user selected ${summary} Lead with what this ${role} communicates in ## Explanation and ## Main message. Use ## Key data points to quote its label/value verbatim, and ## Takeaways to draw conclusions tied to it. Mention other marks only as supporting context.`;
  }

  return `\n\nSelection focus: The user selected ${summary} In ## Weaknesses and limits, ## Template fit, and ## Actionable improvements, prioritize issues with this ${role} — clarity, encoding fit, scale distortion, color accessibility, or whether the datum deserves emphasis. Keep ## Visual and information density referenced where it applies to ${target}. The ## Strengths section is optional — include only if there is something genuinely surprising about this selection.`;
}
