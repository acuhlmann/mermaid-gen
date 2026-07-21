import { CONTROLS_EN } from '../i18n/locales/controls.en.js';

/** Build content-mode picker options from localized control strings. */
export function buildContentModeOptions(controls) {
  const m = controls.contentModes;
  return [
    {
      id: 'auto',
      label: m.auto,
      shortLabel: m.autoShort,
      subtitle: m.autoSubtitle
    },
    {
      id: 'mermaid',
      label: m.mermaid,
      shortLabel: m.mermaidShort,
      subtitle: m.mermaidSubtitle,
      techLabel: m.mermaidTech
    },
    {
      id: 'infographic',
      label: m.infographic,
      shortLabel: m.infographicShort,
      subtitle: m.infographicSubtitle,
      techLabel: m.infographicTech
    },
    {
      id: 'metaphor3d',
      label: m.metaphor3d,
      shortLabel: m.metaphor3dShort,
      subtitle: m.metaphor3dSubtitle,
      techLabel: m.metaphor3dTech
    },
    {
      id: 'chart',
      label: m.chart,
      shortLabel: m.chartShort,
      subtitle: m.chartSubtitle,
      techLabel: m.chartTech
    },
    {
      id: 'forms',
      label: m.forms,
      shortLabel: m.formsShort,
      subtitle: m.formsSubtitle,
      techLabel: m.formsTech
    },
    {
      id: 'anything',
      label: m.anything,
      shortLabel: m.anythingShort,
      subtitle: m.anythingSubtitle,
      techLabel: m.anythingTech
    }
  ];
}

/** Default English options — used by tests and non-React callers. */
export const CONTENT_MODE_OPTIONS = buildContentModeOptions(CONTROLS_EN);

export function isContentMode(value, options = CONTENT_MODE_OPTIONS) {
  return options.some((option) => option.id === value);
}

/** Real diagram slots only — excludes the Auto picker sentinel. */
export function isConcreteContentMode(value) {
  return (
    value === 'mermaid' ||
    value === 'infographic' ||
    value === 'metaphor3d' ||
    value === 'chart' ||
    value === 'forms' ||
    value === 'anything'
  );
}

export function contentModeLabel(value, options = CONTENT_MODE_OPTIONS) {
  return options.find((option) => option.id === value)?.label ?? 'another mode';
}

/** Sibling modes for "Render as…" — never offers Auto (that is Go-only classification). */
export function selectableRenderModes(currentMode, options = CONTENT_MODE_OPTIONS) {
  return options
    .filter((option) => option.id !== 'auto')
    .map((option) => ({
      ...option,
      disabled: option.id === currentMode
    }));
}

export function buildRenderSelectionPrompt({
  descriptor,
  sourceMode,
  targetMode,
  options = CONTENT_MODE_OPTIONS
}) {
  const label =
    descriptor?.clickedLabel ||
    descriptor?.partName ||
    descriptor?.label ||
    descriptor?.id ||
    'the selected item';
  const kind = descriptor?.partKind
    ? String(descriptor.partKind).replace(/[-_]+/g, ' ')
    : 'selection';
  return [
    `Render "${label}" as ${contentModeLabel(targetMode, options)}.`,
    `The user clicked a ${kind} in the current ${contentModeLabel(sourceMode, options)} canvas.`,
    'Center the new output on that selected item, using surrounding context only where it makes the result understandable.'
  ].join(' ');
}

/** Localized Go Mad button label by streak. */
export function goMadShapeLabel(streak, actions) {
  const a = actions ?? {
    goMad: 'Go Mad',
    goMadder: 'Go Madder',
    goMaddest: 'Go Maddest',
    maxMadness: 'Max madness'
  };
  if (streak <= 0) return a.goMad;
  if (streak === 1) return a.goMadder;
  if (streak === 2) return a.goMaddest;
  return a.maxMadness;
}
