import { describe, expect, it } from 'vitest';
import {
  METAPHOR_LEGEND_AXES,
  legendAxesFor,
  formatItemMetric
} from '../src/utils/metaphorLegendAxes.js';

describe('legendAxesFor', () => {
  it('returns only the axes the author populated, in order', () => {
    const rows = legendAxesFor('city', {
      height: 'monthly transactions',
      footprint: 'team size',
      district: 'team'
    });
    expect(rows).toEqual([
      { key: 'height', label: 'Height', text: 'monthly transactions' },
      { key: 'footprint', label: 'Footprint', text: 'team size' },
      { key: 'district', label: 'District', text: 'team' }
    ]);
  });

  it('drops axes that are missing, empty, or whitespace-only', () => {
    const rows = legendAxesFor('city', { height: 'load', footprint: '   ', district: '' });
    expect(rows).toEqual([{ key: 'height', label: 'Height', text: 'load' }]);
  });

  it('only considers axes valid for the metaphor', () => {
    // `height` is not a galaxy axis; `magnitude`/`cluster` are.
    const rows = legendAxesFor('galaxy', { magnitude: 'importance', height: 'ignored' });
    expect(rows).toEqual([{ key: 'magnitude', label: 'Magnitude', text: 'importance' }]);
  });

  it('returns [] for unknown metaphor or missing legend', () => {
    expect(legendAxesFor('nope', { height: 'x' })).toEqual([]);
    expect(legendAxesFor('city', null)).toEqual([]);
    expect(legendAxesFor('city', undefined)).toEqual([]);
    expect(legendAxesFor('terrain', {})).toEqual([]);
  });

  it('covers every metaphor kind in the axis map', () => {
    expect(Object.keys(METAPHOR_LEGEND_AXES).sort()).toEqual([
      'city',
      'galaxy',
      'layercake',
      'orrery',
      'river',
      'terrain',
      'tree'
    ]);
  });

  it('exposes the orrery and river axes', () => {
    const orrery = legendAxesFor('orrery', { orbit: 'distance from core', size: 'headcount' });
    expect(orrery).toEqual([
      { key: 'orbit', label: 'Orbit', text: 'distance from core' },
      { key: 'size', label: 'Size', text: 'headcount' }
    ]);
    const river = legendAxesFor('river', { stage: 'funnel step', flow: 'weekly signups' });
    expect(river).toEqual([
      { key: 'stage', label: 'Stage', text: 'funnel step' },
      { key: 'flow', label: 'Flow', text: 'weekly signups' }
    ]);
  });
});

describe('formatItemMetric', () => {
  it('builds tooltip rows from the present numeric + grouping fields', () => {
    const out = formatItemMetric('city', {
      label: 'Auth Service',
      height: 12,
      footprint: 3,
      district: 'platform',
      glyph: 'identity'
    });
    expect(out.label).toBe('Auth Service');
    expect(out.glyph).toBe('identity');
    expect(out.rows).toEqual([
      { label: 'Height', value: '12' },
      { label: 'Footprint', value: '3' },
      { label: 'District', value: 'platform' }
    ]);
  });

  it('relabels numeric rows with the author legend phrase when available', () => {
    const out = formatItemMetric(
      'terrain',
      { label: 'Payments', elevation: 14.25, intensity: 4 },
      { elevation: 'operational risk' }
    );
    expect(out.rows).toEqual([
      { label: 'Operational risk', value: '14.3' },
      { label: 'Intensity', value: '4' }
    ]);
  });

  it('skips absent or non-finite fields and rounds to one decimal', () => {
    const out = formatItemMetric('galaxy', { label: 'Stripe', magnitude: 6.04 });
    expect(out.rows).toEqual([{ label: 'Magnitude', value: '6' }]);
    expect(out.label).toBe('Stripe');
    expect(out.glyph).toBeUndefined();
  });

  it('returns an empty shape for missing item or unknown metaphor', () => {
    expect(formatItemMetric('city', null)).toEqual({ label: '', rows: [], glyph: undefined });
    expect(formatItemMetric('mystery', { label: 'X', height: 3 }).rows).toEqual([]);
  });
});
