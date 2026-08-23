import { compile } from 'vega-lite';
import { describe, expect, it } from 'vitest';
import {
  addLinkedChartRow,
  connectChartRows,
  deleteChartRow,
  isChartValuesFamilySource,
  renameChartRow
} from '../src/utils/chartGraphEdit.js';

const BAR_CHART = JSON.stringify(
  {
    archislopVersion: 1,
    theme: 'whiteboard',
    spec: {
      mark: 'bar',
      encoding: {
        x: { field: 'category', type: 'nominal' },
        y: { field: 'amount', type: 'quantitative' }
      },
      data: {
        values: [
          { category: 'Widgets', amount: 42 },
          { category: 'Gadgets', amount: 28 }
        ]
      }
    }
  },
  null,
  2
);

function compiles(source) {
  const parsed = JSON.parse(source);
  expect(() => compile(parsed.spec)).not.toThrow();
}

describe('isChartValuesFamilySource', () => {
  it('accepts inline spec.data.values and rejects other chart shapes', () => {
    expect(isChartValuesFamilySource(BAR_CHART)).toBe(true);
    expect(
      isChartValuesFamilySource(
        JSON.stringify({
          archislopVersion: 1,
          theme: 'whiteboard',
          spec: { mark: 'bar', data: { url: 'https://example.com/data.json' } }
        })
      )
    ).toBe(false);
    expect(isChartValuesFamilySource('flowchart TD\n  A --> B')).toBe(false);
  });
});

describe('chartGraphEdit verbs', () => {
  it('adds a sibling row after the selected index', () => {
    const result = addLinkedChartRow(BAR_CHART, '0');
    expect(result).toMatchObject({ ok: true, newId: '1', newLabel: 'Item 1' });
    const next = JSON.parse(result.source);
    expect(next.spec.data.values).toHaveLength(3);
    expect(next.spec.data.values[1]).toEqual({ category: 'Item 1', amount: 0 });
    compiles(result.source);
  });

  it('deletes a row and refuses the last row', () => {
    const deleted = deleteChartRow(BAR_CHART, '1');
    expect(deleted.ok).toBe(true);
    expect(JSON.parse(deleted.source).spec.data.values).toHaveLength(1);
    compiles(deleted.source);

    expect(deleteChartRow(deleted.source, '0')).toMatchObject({ ok: false, reason: 'last' });
  });

  it('renames the primary label field on a row', () => {
    const renamed = renameChartRow(BAR_CHART, '0', 'Hardware');
    expect(renamed.ok).toBe(true);
    expect(JSON.parse(renamed.source).spec.data.values[0].category).toBe('Hardware');
    compiles(renamed.source);

    expect(renameChartRow(BAR_CHART, '0', '   ')).toMatchObject({ ok: false, reason: 'empty' });
    expect(renameChartRow(BAR_CHART, '9', 'Nope')).toMatchObject({ ok: false, reason: 'missing' });
  });

  it('refuses connect', () => {
    expect(connectChartRows()).toMatchObject({ ok: false, reason: 'no-link' });
  });
});
