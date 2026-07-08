import test from 'node:test';
import assert from 'node:assert/strict';
import { diffChartSources } from '../src/chartDiff.js';

const baseChart = JSON.stringify({
  archislopVersion: 1,
  theme: 'whiteboard',
  spec: {
    mark: 'bar',
    data: {
      values: [
        { category: 'A', amount: 10 },
        { category: 'B', amount: 20 }
      ]
    },
    encoding: {
      x: { field: 'category', type: 'nominal' },
      y: { field: 'amount', type: 'quantitative' }
    }
  }
});

test('diffChartSources detects added, modified, and removed rows by index', () => {
  const next = JSON.stringify({
    archislopVersion: 1,
    theme: 'whiteboard',
    spec: {
      mark: 'bar',
      data: {
        values: [
          { category: 'A', amount: 11 },
          { category: 'B', amount: 20 },
          { category: 'C', amount: 30 }
        ]
      },
      encoding: {
        x: { field: 'category', type: 'nominal' },
        y: { field: 'amount', type: 'quantitative' }
      }
    }
  });

  const diff = diffChartSources(baseChart, next);
  assert.deepEqual(diff.modifiedIds, ['0']);
  assert.deepEqual(diff.addedIds, ['2']);
  assert.deepEqual(diff.removedIds, []);
});

test('diffChartSources returns empty diff for identical sources', () => {
  const diff = diffChartSources(baseChart, baseChart);
  assert.deepEqual(diff, { addedIds: [], modifiedIds: [], removedIds: [] });
});
