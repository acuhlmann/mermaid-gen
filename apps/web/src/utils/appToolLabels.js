const TOOL_LABELS = {
  get_diagram_state: 'Read diagram snapshot',
  apply_mermaid_patch: 'Apply diagram update',
  apply_chart_patch: 'Apply chart update',
  apply_infographic_patch: 'Apply infographic update',
  apply_metaphor_patch: 'Apply 3D scene update',
  apply_anything_patch: 'Apply canvas update'
};

/** Human label for an LLM-tool call name shown in the insights pane. */
export function formatToolLabel(name, repeatCount = 1) {
  if (!name) return 'Tool action';
  const base = TOOL_LABELS[name] ?? name.replaceAll('_', ' ');
  if (name === 'apply_mermaid_patch' && repeatCount > 1) {
    const shown = Math.min(repeatCount, 3);
    return `${base} (×${shown})`;
  }
  return base;
}
