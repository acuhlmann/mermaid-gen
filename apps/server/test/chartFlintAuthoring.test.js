import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compileFlintChartWrapper,
  isFlintChartAuthoringEnabled
} from '../src/tools/chartFlintAuthoring.js';
import { validateAndPrepareChartPatch, validateChartStrict } from '../src/tools/chartDslTool.js';
import {
  CHART_FLINT_SYSTEM_PROMPT,
  listFlintChartTypes
} from '../src/prompts/chartFlintSystemPrompt.js';

const FLINT_ON = { CHART_AUTHORING: 'flint' };
const FLINT_OFF = {};

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

test('isFlintChartAuthoringEnabled reads CHART_AUTHORING', () => {
  assert.equal(isFlintChartAuthoringEnabled(FLINT_ON), true);
  assert.equal(isFlintChartAuthoringEnabled({ CHART_AUTHORING: 'FLINT' }), true);
  assert.equal(isFlintChartAuthoringEnabled({ CHART_AUTHORING: 'vegalite' }), false);
  assert.equal(isFlintChartAuthoringEnabled(FLINT_OFF), false);
});

test('compileFlintChartWrapper compiles Flint to a Vega-Lite wrapper and keeps the theme', () => {
  const result = compileFlintChartWrapper(JSON.stringify(GROUPED_BAR));
  assert.equal(result.handled, true);
  assert.equal(result.ok, true, result.error);
  const wrapper = JSON.parse(result.text);
  assert.equal(wrapper.theme, 'noir');
  assert.equal(wrapper.flint, undefined);
  assert.equal(wrapper.spec.$schema, 'https://vega.github.io/schema/vega-lite/v5.json');
  assert.equal(wrapper.spec.title.text, 'Cloud overtakes on-prem');
  assert.equal(wrapper.spec.data.values.length, 4);
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

test('compileFlintChartWrapper refuses url data and mixed wrappers', () => {
  const urlData = { ...GROUPED_BAR, flint: { ...GROUPED_BAR.flint, data: { url: 'x.csv' } } };
  assert.match(compileFlintChartWrapper(JSON.stringify(urlData)).error, /inline data only/);
  const both = { ...GROUPED_BAR, spec: { mark: 'bar' } };
  assert.match(compileFlintChartWrapper(JSON.stringify(both)).error, /not both/);
});

test('validateAndPrepareChartPatch compiles Flint only when the flag is on', async () => {
  const source = JSON.stringify(GROUPED_BAR);
  const on = await validateAndPrepareChartPatch({
    currentState: { revisionId: 0 },
    proposedDiagramSource: source,
    reason: 'test',
    env: FLINT_ON
  });
  assert.equal(on.accepted, true, on.error);
  assert.equal(on.metadata.validator, 'chart-flint-vega-lite-compile');
  assert.equal(on.metadata.authoring, 'flint');
  assert.ok(JSON.parse(on.patch.diagramSource).spec.mark);

  // Flag off: the wrapper has no "spec", so the existing ladder rejects it as before.
  const off = await validateAndPrepareChartPatch({
    currentState: { revisionId: 0 },
    proposedDiagramSource: source,
    reason: 'test',
    env: FLINT_OFF
  });
  assert.equal(off.accepted, false);
});

test('validateAndPrepareChartPatch still accepts Vega-Lite while the flag is on', async () => {
  const vl = JSON.parse(compileFlintChartWrapper(JSON.stringify(GROUPED_BAR)).text);
  const result = await validateAndPrepareChartPatch({
    currentState: { revisionId: 0 },
    proposedDiagramSource: JSON.stringify(vl),
    reason: 'style edit',
    env: FLINT_ON
  });
  assert.equal(result.accepted, true);
  assert.equal(result.metadata.validator, 'chart-vega-lite-compile');
});

test('validateChartStrict surfaces Flint errors under the flag', () => {
  const bad = JSON.stringify(withChartSpec({ chartType: 'Bar Graph' }));
  const result = validateChartStrict(bad, FLINT_ON);
  assert.equal(result.valid, false);
  assert.equal(result.validator, 'chart-flint');
  assert.equal(validateChartStrict(JSON.stringify(GROUPED_BAR), FLINT_ON).valid, true);
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
