import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAndPrepareChartPatch, validateChartStrict } from '../src/tools/chartDslTool.js';

const currentState = { revisionId: 2 };

const HELLO_BAR_SPEC = {
  $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
  data: {
    values: [
      { q: 'Q1', rev: 12 },
      { q: 'Q2', rev: 18 }
    ]
  },
  mark: 'bar',
  encoding: {
    x: { field: 'q', type: 'ordinal' },
    y: { field: 'rev', type: 'quantitative' }
  }
};

const VALID_CHART = JSON.stringify({ theme: 'whiteboard', spec: HELLO_BAR_SPEC });

test('validateAndPrepareChartPatch accepts a well-formed Vega-Lite wrapper', async () => {
  const result = await validateAndPrepareChartPatch({
    currentState,
    proposedDiagramSource: VALID_CHART,
    reason: 'test'
  });
  assert.equal(result.accepted, true);
  assert.equal(result.patch.contentType, 'chart');
  assert.equal(result.patch.previousRevisionId, 2);
  assert.equal(result.patch.nextRevisionId, 3);
  assert.equal(result.metadata.validator, 'chart-vega-lite-compile');
  assert.equal(result.metadata.theme, 'whiteboard');
});

test('validateAndPrepareChartPatch rejects non-string input', async () => {
  const result = await validateAndPrepareChartPatch({
    currentState,
    proposedDiagramSource: 42,
    reason: 'test'
  });
  assert.equal(result.accepted, false);
  assert.match(result.error, /must be a string/i);
});

test('validateAndPrepareChartPatch rejects invalid JSON', async () => {
  const result = await validateAndPrepareChartPatch({
    currentState,
    proposedDiagramSource: '{not json',
    reason: 'test'
  });
  assert.equal(result.accepted, false);
  assert.match(result.error, /not valid JSON/i);
});

test('validateAndPrepareChartPatch rejects Vega-Lite compile errors', async () => {
  const broken = JSON.stringify({
    theme: 'whiteboard',
    spec: {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      mark: { type: 'bar', invalid: true },
      encoding: {
        x: { field: 'q', type: 'ordinal' },
        y: { field: 'rev', type: 'quantitative' }
      }
    }
  });
  const result = await validateAndPrepareChartPatch({
    currentState,
    proposedDiagramSource: broken,
    reason: 'test'
  });
  assert.equal(result.accepted, false);
  assert.match(result.error, /Vega-Lite compile/i);
});

test('validateChartStrict mirrors validateAndPrepareChartPatch accept path', () => {
  const result = validateChartStrict(VALID_CHART);
  assert.equal(result.valid, true);
  assert.equal(result.validator, 'chart-vega-lite-compile');
  assert.equal(result.theme, 'whiteboard');
  assert.ok(result.diagramSource);
});

test('validateChartStrict reports zod failures', () => {
  const result = validateChartStrict(JSON.stringify({ theme: 'galaxy', spec: HELLO_BAR_SPEC }));
  assert.equal(result.valid, false);
  assert.equal(result.validator, 'chart-zod');
});

test('validateAndPrepareChartPatch compiles a Flint wrapper and stores both forms', async () => {
  const flint = {
    data: {
      values: [
        { Quarter: 'Q1', Revenue: 12 },
        { Quarter: 'Q2', Revenue: 18 }
      ]
    },
    chart_spec: { chartType: 'Bar Chart', encodings: { x: 'Quarter', y: 'Revenue' } }
  };
  const result = await validateAndPrepareChartPatch({
    currentState,
    proposedDiagramSource: JSON.stringify({ theme: 'whiteboard', flint }),
    reason: 'test'
  });
  assert.equal(result.accepted, true, result.error);
  assert.equal(result.metadata.validator, 'chart-flint-vega-lite-compile');
  const stored = JSON.parse(result.patch.diagramSource);
  assert.deepEqual(stored.flint, flint);
  assert.equal(stored.spec.mark, 'bar');
});
