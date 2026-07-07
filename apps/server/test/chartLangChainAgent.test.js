import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildChartAnalyzeUserContent,
  buildChartTransformUserContent
} from '../src/agents/chartLangChainAgent.js';

const CHART_DSL = JSON.stringify({
  archislopVersion: 1,
  theme: 'whiteboard',
  spec: {
    title: 'Revenue',
    data: { values: [{ quarter: 'Q1', revenue: 100 }] },
    mark: 'bar',
    encoding: {
      x: { field: 'quarter', type: 'ordinal' },
      y: { field: 'revenue', type: 'quantitative' }
    }
  }
});

test('buildChartTransformUserContent includes advisor prompt', () => {
  const body = buildChartTransformUserContent({
    mode: 'refine',
    currentDsl: CHART_DSL,
    advisorPrompt: 'Facet by region'
  });
  assert.match(body, /Stakeholder suggestion/);
  assert.match(body, /Facet by region/);
});

test('buildChartAnalyzeUserContent includes advisor prompt', () => {
  const body = buildChartAnalyzeUserContent({
    kind: 'critique',
    currentDsl: CHART_DSL,
    focusScope: '',
    advisorPrompt: 'Check if Revenue hides seasonality'
  });
  assert.match(body, /Stakeholder suggestion/);
  assert.match(body, /seasonality/);
});
