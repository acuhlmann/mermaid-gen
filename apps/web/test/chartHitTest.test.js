// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  buildChartDescriptorFromDomHit,
  buildChartDescriptorFromVegaItem,
  findChartTapTarget,
  isChartInteractiveDomNode,
  isChartVegaItemSelectable
} from '../src/utils/chartHitTest.js';

describe('chartHitTest', () => {
  it('buildChartDescriptorFromVegaItem returns null without an item', () => {
    expect(buildChartDescriptorFromVegaItem(null, {}, null)).toBeNull();
  });

  it('buildChartDescriptorFromVegaItem maps a data mark with datum index', () => {
    const descriptor = buildChartDescriptorFromVegaItem(
      {
        index: 2,
        datum: { category: 'Widgets', amount: 42 },
        mark: { marktype: 'bar', role: 'mark' }
      },
      { target: { tagName: 'rect' } },
      null
    );
    expect(descriptor.kind).toBe('chart-mark');
    expect(descriptor.elementType).toBe('mark');
    expect(descriptor.indexes).toBe('2');
    expect(descriptor.label).toBe('Widgets');
    expect(descriptor.partKind).toBe('mark');
    expect(descriptor.id).toMatch(/^chart:mark:bar:2:/);
  });

  it('buildChartDescriptorFromVegaItem rejects axis domain lines without labels', () => {
    expect(
      buildChartDescriptorFromVegaItem(
        { mark: { marktype: 'rule', role: 'axis' } },
        { target: { tagName: 'line' } },
        null
      )
    ).toBeNull();
  });

  it('isChartVegaItemSelectable accepts legend entries and rejects legend frames', () => {
    expect(
      isChartVegaItemSelectable({ mark: { role: 'legend' }, datum: { label: 'North' } })
    ).toBe(true);
    expect(isChartVegaItemSelectable({ mark: { role: 'legend' } })).toBe(false);
  });

  it('isChartVegaItemSelectable accepts axis titles rendered as text marks', () => {
    expect(
      isChartVegaItemSelectable({
        text: 'Revenue',
        mark: { marktype: 'text', role: 'axis' }
      })
    ).toBe(true);
  });

  it('buildChartDescriptorFromDomHit maps axis title hits', () => {
    const node = {
      nodeType: 1,
      tagName: 'text',
      getAttribute: (name) => (name === 'aria-roledescription' ? 'axis title' : 'Revenue'),
      textContent: 'Revenue'
    };
    const descriptor = buildChartDescriptorFromDomHit({
      node,
      roleDesc: 'axis title',
      label: 'Revenue'
    });
    expect(descriptor.kind).toBe('chart-mark');
    expect(descriptor.elementType).toBe('axis-title');
    expect(descriptor.partKind).toBe('axis');
    expect(descriptor.label).toBe('Revenue');
  });

  it('findChartTapTarget walks up to a mark element', () => {
    const boundary = {
      nodeType: 1,
      tagName: 'div',
      contains: () => true
    };
    const mark = {
      nodeType: 1,
      tagName: 'path',
      parentNode: boundary,
      getAttribute: (name) => {
        if (name === 'aria-roledescription') return 'mark';
        if (name === 'aria-label') return 'North';
        return '';
      },
      textContent: ''
    };
    const hit = findChartTapTarget(mark, boundary);
    expect(hit).toBeTruthy();
    expect(hit.label).toBe('North');
    expect(isChartInteractiveDomNode(mark, boundary)).toBe(true);
  });
});
