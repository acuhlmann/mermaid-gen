import { describe, expect, it } from 'vitest';
import {
  accentThesisFromDsl,
  compositeLayerSummaries,
  flattenMetaphorItems
} from '../src/utils/metaphorReading.js';

const COMPOSITE = {
  metaphor: 'composite',
  scene: { title: 'Commerce current' },
  layers: [
    {
      id: 'domains',
      as: 'archipelago',
      label: 'Commerce domains as islands',
      items: [
        {
          id: 'checkout',
          label: 'Checkout',
          accent: true,
          note: 'Checkout carries the load'
        }
      ]
    },
    {
      id: 'services',
      as: 'city',
      label: '  ',
      items: [{ id: 'payments-api', label: 'Payments API' }]
    }
  ]
};

describe('flattenMetaphorItems', () => {
  it('walks composite layers and keeps the layer each item came from', () => {
    const entries = flattenMetaphorItems(COMPOSITE);
    expect(entries).toHaveLength(2);
    expect(entries[0].item.id).toBe('checkout');
    expect(entries[0].layer.id).toBe('domains');
    expect(entries[1].layer.as).toBe('city');
  });

  it('walks a base metaphor items array', () => {
    const entries = flattenMetaphorItems({
      metaphor: 'city',
      items: [{ id: 'auth', label: 'Auth' }]
    });
    expect(entries).toEqual([{ item: { id: 'auth', label: 'Auth' }, layer: null }]);
  });

  it('returns [] for missing documents', () => {
    expect(flattenMetaphorItems(null)).toEqual([]);
    expect(flattenMetaphorItems({})).toEqual([]);
  });
});

describe('accentThesisFromDsl', () => {
  it('returns the accented item note from a composite', () => {
    expect(accentThesisFromDsl(COMPOSITE)).toBe('Checkout carries the load');
  });

  it('returns the accented item note from a base metaphor', () => {
    expect(
      accentThesisFromDsl({
        metaphor: 'river',
        items: [
          { id: 'signup', label: 'Sign up', accent: true, note: '  50% drop here  ' },
          { id: 'pay', label: 'Pay', note: 'ignored' }
        ]
      })
    ).toBe('50% drop here');
  });

  it('returns empty when there is no accented note', () => {
    expect(accentThesisFromDsl({ metaphor: 'city', items: [{ id: 'a', label: 'A' }] })).toBe('');
  });
});

describe('compositeLayerSummaries', () => {
  it('uses the author label when present and falls back to the kind', () => {
    expect(compositeLayerSummaries(COMPOSITE)).toEqual([
      {
        id: 'domains',
        as: 'archipelago',
        label: 'Commerce domains as islands',
        itemCount: 1
      },
      { id: 'services', as: 'city', label: 'city', itemCount: 1 }
    ]);
  });

  it('returns [] for non-composite documents', () => {
    expect(compositeLayerSummaries({ metaphor: 'city', layers: COMPOSITE.layers })).toEqual([]);
    expect(compositeLayerSummaries(null)).toEqual([]);
  });
});
