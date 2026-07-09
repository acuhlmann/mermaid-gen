export const CONTENT_MODE_OPTIONS = [
  { id: 'mermaid', label: 'Diagram', shortLabel: 'Diagram' },
  { id: 'infographic', label: 'Infographic', shortLabel: 'Infographic' },
  { id: 'metaphor3d', label: '3D metaphor', shortLabel: '3D' },
  { id: 'chart', label: 'Chart', shortLabel: 'Chart' },
  { id: 'anything', label: 'Anything page', shortLabel: 'Anything' }
];

export function isContentMode(value) {
  return CONTENT_MODE_OPTIONS.some((option) => option.id === value);
}

export function contentModeLabel(value) {
  return CONTENT_MODE_OPTIONS.find((option) => option.id === value)?.label ?? 'another mode';
}

export function selectableRenderModes(currentMode) {
  return CONTENT_MODE_OPTIONS.map((option) => ({
    ...option,
    disabled: option.id === currentMode
  }));
}

export function buildRenderSelectionPrompt({ descriptor, sourceMode, targetMode }) {
  const label =
    descriptor?.clickedLabel ||
    descriptor?.partName ||
    descriptor?.label ||
    descriptor?.id ||
    'the selected item';
  const kind = descriptor?.partKind ? String(descriptor.partKind).replace(/[-_]+/g, ' ') : 'selection';
  return [
    `Render "${label}" as ${contentModeLabel(targetMode)}.`,
    `The user clicked a ${kind} in the current ${contentModeLabel(sourceMode)} canvas.`,
    'Center the new output on that selected item, using surrounding context only where it makes the result understandable.'
  ].join(' ');
}
