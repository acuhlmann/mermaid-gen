import { DeskOsMenuItem, DeskOsMenuSection } from './DeskOsMenu.jsx';
import { formatLocale } from '../i18n/formatLocale.js';
import { hasChartFlintSource } from '../utils/chartFlintExports.js';
import {
  CHART_RENDERERS,
  setChartRenderer,
  useChartRenderer
} from '../state/chartRendererStore.js';

/** Library names, not copy: they read the same in every locale. */
const RENDERER_NAMES = {
  vegalite: 'Vega-Lite',
  echarts: 'ECharts',
  chartjs: 'Chart.js',
  plotly: 'Plotly'
};

/**
 * Deliverable → Chart renderer: which Flint backend draws the chart on the canvas.
 * Shown only for a chart with a Flint source; a plain Vega-Lite chart has nothing else to
 * compile to. Vega-Lite is the one renderer the canvas can edit, so it says so.
 */
export default function DeskOsChartRendererSection({ copy, contentType, diagramSource, close }) {
  const renderer = useChartRenderer();
  if (contentType !== 'chart' || !hasChartFlintSource(diagramSource ?? '')) return null;
  return (
    <DeskOsMenuSection label={copy.rendererSection ?? 'Chart renderer'}>
      {CHART_RENDERERS.map((id) => {
        const name = RENDERER_NAMES[id];
        return (
          <DeskOsMenuItem
            key={id}
            label={name}
            subtitle={
              id === 'vegalite'
                ? (copy.rendererEditable ?? 'Canvas editing')
                : (copy.rendererViewOnly ?? 'View only')
            }
            title={formatLocale(copy.rendererTitle ?? 'Draw this Flint chart with {name}', {
              name
            })}
            current={id === renderer}
            pressed={id === renderer}
            testId={`menubar-chart-renderer-${id}`}
            onSelect={() => {
              close();
              setChartRenderer(id);
            }}
          />
        );
      })}
    </DeskOsMenuSection>
  );
}
