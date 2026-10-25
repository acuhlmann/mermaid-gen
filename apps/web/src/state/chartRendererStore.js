import { useSyncExternalStore } from 'react';

/**
 * Which library draws a Flint-sourced chart on the canvas. The slot stores the Flint
 * spec plus the Vega-Lite compiled from it (apps/server/src/tools/chartFlintAuthoring.js);
 * Vega-Lite stays the default because canvas editing, hit-testing and themes read its SVG.
 * The other backends mount through Flint's own `FlintChart` (flint-chart/react).
 *
 * A viewer preference, not slot content: switching renderer never writes a revision, and a
 * chart without a Flint source always draws with Vega-Lite. Same hand-rolled
 * useSyncExternalStore pub/sub as officeViewModeStore.js, persisted per browser.
 */

/** @typedef {'vegalite' | 'echarts' | 'chartjs' | 'plotly'} ChartRendererId */

/** @type {readonly ChartRendererId[]} */
export const CHART_RENDERERS = ['vegalite', 'echarts', 'chartjs', 'plotly'];

const STORAGE_KEY = 'archislop.chartRenderer';

/** @param {unknown} value @returns {value is ChartRendererId} */
export const isChartRenderer = (value) => CHART_RENDERERS.includes(/** @type {any} */ (value));

function readStored() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isChartRenderer(stored) ? stored : 'vegalite';
  } catch {
    return 'vegalite';
  }
}

/** @type {ChartRendererId} */
let renderer = typeof window === 'undefined' ? 'vegalite' : readStored();

/** @type {Set<() => void>} */
const listeners = new Set();

/**
 * @param {() => void} listener
 * @returns {() => void} unsubscribe
 */
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** @returns {ChartRendererId} */
export function getChartRenderer() {
  return renderer;
}

/** @param {ChartRendererId} next */
export function setChartRenderer(next) {
  if (!isChartRenderer(next) || next === renderer) return;
  renderer = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Private mode / blocked storage: the choice still holds for this tab.
  }
  for (const fn of listeners) fn();
}

/** @returns {ChartRendererId} */
export function useChartRenderer() {
  return useSyncExternalStore(subscribe, getChartRenderer, () => 'vegalite');
}

/** @internal Reset between tests. */
export function _resetChartRendererForTests() {
  renderer = 'vegalite';
  listeners.clear();
}
