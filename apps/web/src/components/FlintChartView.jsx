import { useEffect, useMemo, useRef, useState } from 'react';
import { FlintChart } from 'flint-chart/react';
import {
  canvasElementToPngBlob,
  dataUrlToBlob,
  registerViewportPngExporter,
  svgElementToPngBlob,
  unregisterViewportPngExporter
} from '../utils/viewportPngExport.js';

/**
 * Draws a chart's Flint source with one of Flint's non-Vega backends (ECharts, Chart.js,
 * Plotly) through Flint's own React component. ChartRenderer lazy-loads this file only when
 * the viewer picked such a renderer, and each backend's library is a further lazy chunk
 * inside flint-chart, so none of them ships with the main bundle.
 *
 * Vega-Lite keeps its own path in ChartRenderer: canvas editing and hit-testing read the
 * Vega SVG, which these backends do not draw.
 */

/** Same box the server compiles the Vega-Lite at (DEFAULT_FLINT_BASE_SIZE). */
const BASE_SIZE = { width: 720, height: 440 };
const COMPACT_SIZE = { width: 380, height: 260 };

/** Canvas background per archislop theme; only noir is dark today (chartThemePresets.js). */
const THEME_BACKGROUND = { noir: '#1f1f1f' };
const DEFAULT_BACKGROUND = '#f8fafc';

/** The Flint input with the canvas size the server compiles with, unless the spec sets one. */
function withBaseSize(flint, compact) {
  const chartSpec = flint.chart_spec ?? {};
  if (chartSpec.baseSize) return flint;
  return { ...flint, chart_spec: { ...chartSpec, baseSize: compact ? COMPACT_SIZE : BASE_SIZE } };
}

/** A PNG of what the backend drew: Plotly's own export (it layers several SVGs), else the canvas or SVG. */
async function surfaceToPngBlob(element, background) {
  const plot = element?.querySelector('.js-plotly-plot');
  if (plot) {
    const { default: Plotly } = await import('plotly.js-dist-min');
    return dataUrlToBlob(await Plotly.toImage(plot, { format: 'png', scale: 2 }));
  }
  const canvas = element?.querySelector('canvas');
  if (canvas) return canvasElementToPngBlob(canvas, { background });
  const svg = element?.querySelector('svg');
  if (svg) return svgElementToPngBlob(svg, { background });
  throw new Error('Chart is not ready to export — wait for it to render.');
}

export default function FlintChartView({ flint, backend, theme, compact = false }) {
  const surfaceRef = useRef(null);
  const [error, setError] = useState(null);
  const spec = useMemo(() => withBaseSize(flint, compact), [flint, compact]);
  const background = THEME_BACKGROUND[theme] ?? DEFAULT_BACKGROUND;

  useEffect(() => setError(null), [spec, backend]);

  useEffect(() => {
    if (compact) return undefined;
    const exporter = () => surfaceToPngBlob(surfaceRef.current?.element, background);
    registerViewportPngExporter('chart', exporter);
    return () => unregisterViewportPngExporter('chart', exporter);
  }, [background, compact]);

  if (error) {
    return (
      <div className="chart-error-state" role="alert">
        <pre className="chart-error-detail">{error}</pre>
      </div>
    );
  }

  return (
    <div className="chart-renderer-root" data-chart-renderer={backend}>
      <FlintChart
        className="chart-embed-container flint-chart-view"
        spec={spec}
        backend={backend}
        background={background}
        fit="scale-down"
        onRender={(surface) => {
          surfaceRef.current = surface;
        }}
        onError={(err) => setError(err?.message ?? String(err))}
      />
    </div>
  );
}
