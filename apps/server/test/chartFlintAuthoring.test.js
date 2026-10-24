import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chartSourceForModel,
  compileFlintChartWrapper,
  isFlintChartAuthoringEnabled
} from '../src/tools/chartFlintAuthoring.js';
import { validateAndPrepareChartPatch, validateChartStrict } from '../src/tools/chartDslTool.js';
import { createChartTools } from '../src/agents/diagramTools.js';
import {
  CHART_FLINT_SYSTEM_PROMPT,
  listFlintChartTypes
} from '../src/prompts/chartFlintSystemPrompt.js';

const GROUPED_BAR = {
  archislopVersion: 1,
  theme: 'noir',
  flint: {
    data: {
      values: [
        { Quarter: 'Q1', Product: 'Cloud', Revenue: 120 },
        { Quarter: 'Q1', Product: 'On-prem', Revenue: 80 },
        { Quarter: 'Q2', Product: 'Cloud', Revenue: 150 },
        { Quarter: 'Q2', Product: 'On-prem', Revenue: 72 }
      ]
    },
    semantic_types: { Quarter: 'Quarter', Product: 'Category', Revenue: 'Amount' },
    chart_spec: {
      chartType: 'Grouped Bar Chart',
      title: 'Cloud overtakes on-prem',
      encodings: { x: 'Quarter', y: 'Revenue', group: 'Product' }
    }
  }
};

const withChartSpec = (patch) => ({
  ...GROUPED_BAR,
  flint: { ...GROUPED_BAR.flint, chart_spec: { ...GROUPED_BAR.flint.chart_spec, ...patch } }
});

test('isFlintChartAuthoringEnabled defaults to Flint; vegalite opts out', () => {
  assert.equal(isFlintChartAuthoringEnabled({}), true);
  assert.equal(isFlintChartAuthoringEnabled({ CHART_AUTHORING: 'flint' }), true);
  assert.equal(isFlintChartAuthoringEnabled({ CHART_AUTHORING: 'VegaLite' }), false);
});

test('compileFlintChartWrapper stores Flint as source beside the derived Vega-Lite', () => {
  const result = compileFlintChartWrapper(JSON.stringify(GROUPED_BAR));
  assert.equal(result.handled, true);
  assert.equal(result.ok, true, result.error);
  const wrapper = JSON.parse(result.text);
  assert.equal(wrapper.theme, 'noir');
  assert.deepEqual(wrapper.flint, GROUPED_BAR.flint);
  assert.equal(wrapper.spec.$schema, 'https://vega.github.io/schema/vega-lite/v5.json');
  assert.equal(wrapper.spec.title.text, 'Cloud overtakes on-prem');
  // Same rows, same order — the canvas row editor relies on this to mirror its edits.
  assert.deepEqual(wrapper.spec.data.values, GROUPED_BAR.flint.data.values);
  // Flint's private annotations never reach the slot.
  assert.equal(
    Object.keys(wrapper.spec).some((k) => k.startsWith('_')),
    false
  );
});

test('compileFlintChartWrapper leaves the categorical palette to the archislop theme', () => {
  const { text } = compileFlintChartWrapper(JSON.stringify(GROUPED_BAR));
  const color = JSON.parse(text).spec.encoding.color;
  assert.equal(color.type, 'nominal');
  assert.equal(color.scale?.scheme, undefined);
});

test('compileFlintChartWrapper accepts a fenced block', () => {
  const result = compileFlintChartWrapper('```json\n' + JSON.stringify(GROUPED_BAR) + '\n```');
  assert.equal(result.ok, true);
});

test('compileFlintChartWrapper passes non-Flint sources through untouched', () => {
  assert.deepEqual(compileFlintChartWrapper('{not json'), { handled: false });
  assert.deepEqual(compileFlintChartWrapper(JSON.stringify({ spec: { mark: 'bar' } })), {
    handled: false
  });
  assert.deepEqual(compileFlintChartWrapper(42), { handled: false });
});

test('compileFlintChartWrapper names the missing field', () => {
  const result = compileFlintChartWrapper(
    JSON.stringify(withChartSpec({ encodings: { x: 'Quartr', y: 'Revenue' } }))
  );
  assert.equal(result.ok, false);
  assert.match(result.error, /Quartr/);
});

test('compileFlintChartWrapper lists the valid chart types on an unknown one', () => {
  const result = compileFlintChartWrapper(
    JSON.stringify(withChartSpec({ chartType: 'Bar Graph' }))
  );
  assert.equal(result.ok, false);
  assert.match(result.error, /Unknown chart type/);
  assert.match(result.error, /Grouped Bar Chart/);
});

test('compileFlintChartWrapper refuses url data and a non-object vegaConfig', () => {
  const urlData = { ...GROUPED_BAR, flint: { ...GROUPED_BAR.flint, data: { url: 'x.csv' } } };
  assert.match(compileFlintChartWrapper(JSON.stringify(urlData)).error, /inline data only/);
  const badConfig = { ...GROUPED_BAR, vegaConfig: ['nope'] };
  assert.match(compileFlintChartWrapper(JSON.stringify(badConfig)).error, /vegaConfig/);
});

test('compileFlintChartWrapper recompiles spec from flint and keeps vegaConfig on top', () => {
  const styled = {
    ...GROUPED_BAR,
    vegaConfig: { background: '#000000', axis: { gridColor: '#ff00ff' } },
    // A stale or model-invented spec never wins over the Flint source.
    spec: { mark: 'point' }
  };
  const wrapper = JSON.parse(compileFlintChartWrapper(JSON.stringify(styled)).text);
  assert.notEqual(wrapper.spec.mark, 'point');
  assert.equal(wrapper.spec.config.background, '#000000');
  assert.equal(wrapper.spec.config.axis.gridColor, '#ff00ff');
  assert.deepEqual(wrapper.vegaConfig, styled.vegaConfig);
  // Flint's own config survives the merge.
  assert.ok(wrapper.spec.config.axisX);
});

test('compileFlintChartWrapper treats a Vega-Lite-only edit as a hand edit and drops flint', () => {
  const stored = compileFlintChartWrapper(JSON.stringify(GROUPED_BAR)).text;
  const edited = JSON.parse(stored);
  edited.spec.mark = 'point';
  const result = compileFlintChartWrapper(JSON.stringify(edited), { previousSource: stored });
  assert.equal(result.ok, true);
  assert.equal(result.droppedFlint, true);
  const wrapper = JSON.parse(result.text);
  assert.equal(wrapper.flint, undefined);
  assert.equal(wrapper.spec.mark, 'point');
});

test('compileFlintChartWrapper recompiles when the flint rows changed with the spec', () => {
  const stored = compileFlintChartWrapper(JSON.stringify(GROUPED_BAR)).text;
  const edited = JSON.parse(stored);
  const extra = { Quarter: 'Q3', Product: 'Cloud', Revenue: 190 };
  edited.spec.data.values.push(extra);
  edited.flint.data.values.push(extra);
  const result = compileFlintChartWrapper(JSON.stringify(edited), { previousSource: stored });
  assert.equal(result.droppedFlint, undefined);
  assert.equal(JSON.parse(result.text).flint.data.values.length, 5);
});

test('chartSourceForModel hides the derived spec from the model', () => {
  const stored = compileFlintChartWrapper(
    JSON.stringify({ ...GROUPED_BAR, vegaConfig: { background: '#fff' } })
  ).text;
  const view = JSON.parse(chartSourceForModel(stored));
  assert.equal(view.spec, undefined);
  assert.deepEqual(view.flint, GROUPED_BAR.flint);
  assert.deepEqual(view.vegaConfig, { background: '#fff' });
  const plain = JSON.stringify({ theme: 'whiteboard', spec: { mark: 'bar' } });
  assert.equal(chartSourceForModel(plain), plain);
});

test('get_chart_dsl shows the Flint model view in Flint mode, the raw source otherwise', async () => {
  const stored = compileFlintChartWrapper(JSON.stringify(GROUPED_BAR)).text;
  const stateStore = {
    getSlot: () => ({ revisionId: 'r1', diagramSource: stored, updatedAt: 0 })
  };
  const read = async (authoring) => {
    const [getChartDsl] = createChartTools({ stateStore, authoring });
    return JSON.parse(JSON.parse(await getChartDsl.invoke({})).diagramSource);
  };
  const flintView = await read('flint');
  assert.equal(flintView.spec, undefined);
  assert.deepEqual(flintView.flint, GROUPED_BAR.flint);
  assert.ok((await read('vegalite')).spec);
});

test('validateAndPrepareChartPatch stores the Flint wrapper and its compiled spec', async () => {
  const result = await validateAndPrepareChartPatch({
    currentState: { revisionId: 0, diagramSource: '' },
    proposedDiagramSource: JSON.stringify(GROUPED_BAR),
    reason: 'test'
  });
  assert.equal(result.accepted, true, result.error);
  assert.equal(result.metadata.validator, 'chart-flint-vega-lite-compile');
  assert.equal(result.metadata.authoring, 'flint');
  const stored = JSON.parse(result.patch.diagramSource);
  assert.deepEqual(stored.flint, GROUPED_BAR.flint);
  assert.ok(stored.spec.mark);
});

test('validateAndPrepareChartPatch hand edit of a Flint chart stores plain Vega-Lite', async () => {
  const first = await validateAndPrepareChartPatch({
    currentState: { revisionId: 0, diagramSource: '' },
    proposedDiagramSource: JSON.stringify(GROUPED_BAR),
    reason: 'agent'
  });
  const edited = JSON.parse(first.patch.diagramSource);
  edited.spec.title = 'Edited by hand';
  const second = await validateAndPrepareChartPatch({
    currentState: { revisionId: 1, diagramSource: first.patch.diagramSource },
    proposedDiagramSource: JSON.stringify(edited),
    reason: 'client sync'
  });
  assert.equal(second.accepted, true, second.error);
  assert.equal(second.metadata.validator, 'chart-vega-lite-compile');
  const stored = JSON.parse(second.patch.diagramSource);
  assert.equal(stored.flint, undefined);
  assert.equal(stored.spec.title, 'Edited by hand');
});

test('validateChartStrict surfaces Flint errors', () => {
  const bad = JSON.stringify(withChartSpec({ chartType: 'Bar Graph' }));
  const result = validateChartStrict(bad);
  assert.equal(result.valid, false);
  assert.equal(result.validator, 'chart-flint');
  assert.equal(validateChartStrict(JSON.stringify(GROUPED_BAR)).valid, true);
});

test('every chart type in the Flint prompt compiles from the installed library', () => {
  const types = listFlintChartTypes().map((t) => t.chart);
  assert.ok(types.includes('Line Chart'));
  assert.ok(!types.includes('Choropleth'));
  for (const chart of types) assert.ok(CHART_FLINT_SYSTEM_PROMPT.includes(`- ${chart}:`), chart);
});

test('compileFlintChartWrapper keeps the row order for non-English month names', () => {
  const monate = [
    'Jan',
    'Feb',
    'Mär',
    'Apr',
    'Mai',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Okt',
    'Nov',
    'Dez'
  ];
  const wrapper = {
    theme: 'whiteboard',
    flint: {
      data: { values: monate.map((Monat, i) => ({ Monat, Kosten: 80 + i })) },
      semantic_types: { Monat: 'Month', Kosten: 'Amount' },
      chart_spec: { chartType: 'Bar Chart', encodings: { x: 'Monat', y: 'Kosten' } }
    }
  };
  const { text } = compileFlintChartWrapper(JSON.stringify(wrapper));
  assert.deepEqual(JSON.parse(text).spec.encoding.x.sort, monate);
});

test('compileFlintChartWrapper leaves Flint ordering for English month names', () => {
  const months = ['Mar', 'Jan', 'Feb'];
  const wrapper = {
    flint: {
      data: { values: months.map((Month, i) => ({ Month, Cost: 80 + i })) },
      semantic_types: { Month: 'Month', Cost: 'Amount' },
      chart_spec: { chartType: 'Bar Chart', encodings: { x: 'Month', y: 'Cost' } }
    }
  };
  const { text } = compileFlintChartWrapper(JSON.stringify(wrapper));
  assert.deepEqual(JSON.parse(text).spec.encoding.x.sort, ['Jan', 'Feb', 'Mar']);
});

test('compileFlintChartWrapper rescues one surplus closing brace', () => {
  const result = compileFlintChartWrapper(`${JSON.stringify(GROUPED_BAR)}}`);
  assert.equal(result.ok, true);
});

test('compileFlintChartWrapper carries the stored vegaConfig through a content edit', () => {
  const stored = compileFlintChartWrapper(
    JSON.stringify({ ...GROUPED_BAR, vegaConfig: { background: '#111111' } })
  ).text;
  const contentEdit = JSON.stringify(withChartSpec({ title: 'Retitled' }));
  const kept = JSON.parse(compileFlintChartWrapper(contentEdit, { previousSource: stored }).text);
  assert.deepEqual(kept.vegaConfig, { background: '#111111' });
  assert.equal(kept.spec.config.background, '#111111');

  const cleared = JSON.parse(
    compileFlintChartWrapper(JSON.stringify({ ...GROUPED_BAR, vegaConfig: {} }), {
      previousSource: stored
    }).text
  );
  assert.equal(cleared.vegaConfig, undefined);
});
