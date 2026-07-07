import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildChartAnalyzeFocusInstructions,
  buildChartFocusScopeInstructions
} from '../src/agents/chartFocusInstructions.js';

test('returns empty string when selection kind is not chart-mark', () => {
  assert.equal(buildChartFocusScopeInstructions(null), '');
  assert.equal(buildChartFocusScopeInstructions({ id: 'x' }), '');
  assert.equal(buildChartFocusScopeInstructions({ id: 'x', selectionKind: 'node' }), '');
  assert.equal(buildChartAnalyzeFocusInstructions(null, 'explain'), '');
});

test('mark selection cites datum index and visible label', () => {
  const text = buildChartFocusScopeInstructions({
    id: 'chart:mark:bar:2:Widgets',
    selectionKind: 'chart-mark',
    label: 'Widgets',
    elementType: 'mark',
    markType: 'bar',
    indexes: '2'
  });
  assert.match(text, /Focus scope/);
  assert.match(text, /data mark at data row index 2/);
  assert.match(text, /"Widgets"/);
  assert.match(text, /spec\.data\.values\[2\]/);
});

test('title selection scopes edits to spec.title', () => {
  const text = buildChartFocusScopeInstructions({
    id: 'chart:title:text:Sales',
    selectionKind: 'chart-mark',
    label: 'Sales',
    elementType: 'title'
  });
  assert.match(text, /chart title/);
  assert.match(text, /spec\.data, spec\.mark, and spec\.encoding unchanged/);
});

test('analyze explain mode leads with the selected mark', () => {
  const text = buildChartAnalyzeFocusInstructions(
    {
      id: 'chart:mark:bar:0:North',
      selectionKind: 'chart-mark',
      label: 'North',
      elementType: 'mark',
      markType: 'bar',
      indexes: '0'
    },
    'explain'
  );
  assert.match(text, /Selection focus/);
  assert.match(text, /## Explanation/);
  assert.match(text, /data mark/);
});
