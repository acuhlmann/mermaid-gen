/**
 * Chart theme presets for the `chart` content type.
 *
 * Each preset has two parts:
 *  - `embedTheme`: the vega-themes preset name passed to vega-embed's `theme` option
 *    (or `null` when archislop overrides everything via `config`).
 *  - `configOverrides`: a partial Vega `config` block merged on top of the theme to carry
 *    archislop's brand identity (background, font, accent palette).
 *
 * PR1 ships only the `whiteboard` preset fully tuned; the other three return the same
 * structure for forward compatibility, intentionally re-using the whiteboard palette
 * until per-theme color systems land in PR2.
 */

const WHITEBOARD_CONFIG = {
  background: '#f8fafc',
  font: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
  axis: {
    labelColor: '#0f172a',
    titleColor: '#0f172a',
    gridColor: '#e2e8f0',
    domainColor: '#cbd5e1',
    tickColor: '#cbd5e1'
  },
  legend: {
    labelColor: '#0f172a',
    titleColor: '#0f172a'
  },
  title: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: 600
  },
  view: { stroke: 'transparent' },
  range: {
    category: ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16']
  }
};

export const CHART_THEME_PRESETS = {
  whiteboard: {
    embedTheme: null,
    configOverrides: WHITEBOARD_CONFIG
  },
  noir: {
    embedTheme: 'dark',
    configOverrides: WHITEBOARD_CONFIG
  },
  arcade: {
    embedTheme: null,
    configOverrides: WHITEBOARD_CONFIG
  },
  blueprint: {
    embedTheme: null,
    configOverrides: WHITEBOARD_CONFIG
  }
};

export function resolveChartThemePreset(theme) {
  return CHART_THEME_PRESETS[theme] ?? CHART_THEME_PRESETS.whiteboard;
}

/**
 * Merge archislop theme overrides into a spec's `config` block without mutating the input.
 * Returns a new spec object.
 */
export function applyChartThemeToSpec(spec, theme) {
  const preset = resolveChartThemePreset(theme);
  const existingConfig = (spec && typeof spec.config === 'object' && spec.config) || {};
  return {
    ...spec,
    config: {
      ...preset.configOverrides,
      ...existingConfig,
      axis: { ...preset.configOverrides.axis, ...(existingConfig.axis || {}) },
      legend: { ...preset.configOverrides.legend, ...(existingConfig.legend || {}) },
      title: { ...preset.configOverrides.title, ...(existingConfig.title || {}) }
    }
  };
}
