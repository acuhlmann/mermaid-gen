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
      'archipelago',
      'bridge',
      'city',
      'composite',
      'cycle',
      'galaxy',
      'garden',
      'iceberg',
      'layercake',
      'machine',
      'orrery',
      'river',
      'subway',
      'terrain',
      'tree'
    ]);
  });

  it('exposes bridge span, load, side, and strain axes', () => {
    const axes = legendAxesFor('bridge', {
      span: 'migration stage',
      load: 'traffic volume',
      side: 'owner team',
      strain: 'coupling risk'
    });
    expect(axes).toEqual([
      { key: 'span', label: 'Span', text: 'migration stage' },
      { key: 'load', label: 'Load', text: 'traffic volume' },
      { key: 'side', label: 'Side', text: 'owner team' },
      { key: 'strain', label: 'Strain', text: 'coupling risk' }
    ]);
  });

  it('exposes cycle phase, size, and friction axes', () => {
    const axes = legendAxesFor('cycle', {
      phase: 'lifecycle stage',
      size: 'cohort size',
      friction: 'drop-off risk'
    });
    expect(axes).toEqual([
      { key: 'phase', label: 'Phase', text: 'lifecycle stage' },
      { key: 'size', label: 'Size', text: 'cohort size' },
      { key: 'friction', label: 'Friction', text: 'drop-off risk' }
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

  it('exposes garden growth, impact, grouping, and health axes', () => {
    const garden = legendAxesFor('garden', {
      maturity: 'delivery maturity',
      impact: 'customer impact',
      bed: 'strategic theme',
      health: 'delivery health'
    });
    expect(garden).toEqual([
      { key: 'maturity', label: 'Maturity', text: 'delivery maturity' },
      { key: 'impact', label: 'Impact', text: 'customer impact' },
      { key: 'bed', label: 'Bed', text: 'strategic theme' },
      { key: 'health', label: 'Health', text: 'delivery health' }
    ]);
  });

  it('exposes archipelago mass, relief, and chain axes', () => {
    const axes = legendAxesFor('archipelago', {
      mass: 'weekly orders',
      relief: 'domain maturity',
      chain: 'region'
    });
    expect(axes).toEqual([
      { key: 'mass', label: 'Mass', text: 'weekly orders' },
      { key: 'relief', label: 'Relief', text: 'domain maturity' },
      { key: 'chain', label: 'Chain', text: 'region' }
    ]);
  });

  it('exposes machine size, speed, axle, and torque axes', () => {
    const axes = legendAxesFor('machine', {
      size: 'criticality',
      speed: 'rps',
      axle: 'subsystem',
      torque: 'saturation'
    });
    expect(axes).toEqual([
      { key: 'size', label: 'Size', text: 'criticality' },
      { key: 'speed', label: 'Speed', text: 'rps' },
      { key: 'axle', label: 'Axle', text: 'subsystem' },
      { key: 'torque', label: 'Torque', text: 'saturation' }
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

  it('formats garden maturity, impact, bed, and health', () => {
    const out = formatItemMetric(
      'garden',
      {
        label: 'Support copilot',
        maturity: 0.85,
        impact: 8,
        bed: 'Customer care',
        health: 'thriving'
      },
      { maturity: 'delivery maturity', impact: 'customer impact' }
    );
    expect(out.rows).toEqual([
      { label: 'Delivery maturity', value: '0.9' },
      { label: 'Customer impact', value: '8' },
      { label: 'Bed', value: 'Customer care' },
      { label: 'Health', value: 'thriving' }
    ]);
  });

  it('formats archipelago mass, relief, and chain', () => {
    const out = formatItemMetric(
      'archipelago',
      { label: 'Checkout EU', mass: 14, relief: 0.85, chain: 'Europe' },
      { mass: 'weekly orders', relief: 'domain maturity' }
    );
    expect(out.rows).toEqual([
      { label: 'Weekly orders', value: '14' },
      { label: 'Domain maturity', value: '0.9' },
      { label: 'Chain', value: 'Europe' }
    ]);
  });
});
