import { describe, expect, it } from 'vitest';
import { switchMetaphorKind } from '../src/utils/switchMetaphorKind.js';

const CITY_DSL = JSON.stringify({
  metaphor: 'city',
  scene: { theme: 'whiteboard', title: 'Platform map' },
  items: [
    { id: 'auth', label: 'Auth', height: 12, footprint: 3, district: 'Core' },
    { id: 'api', label: 'API', height: 8, footprint: 2, district: 'Edge' }
  ],
  links: [{ from: 'auth', to: 'api', label: 'tokens' }]
});

describe('switchMetaphorKind', () => {
  it('remaps city items to galaxy magnitude and cluster', () => {
    const result = switchMetaphorKind(CITY_DSL, 'galaxy');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const dsl = JSON.parse(result.text);
    expect(dsl.metaphor).toBe('galaxy');
    expect(dsl.items[0]).toMatchObject({ id: 'auth', magnitude: 12, cluster: 'Core' });
    expect(dsl.links).toHaveLength(1);
  });

  it('remaps city items to terrain elevation and intensity', () => {
    const result = switchMetaphorKind(CITY_DSL, 'terrain');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const dsl = JSON.parse(result.text);
    expect(dsl.items[0]).toMatchObject({ elevation: 12, intensity: 3 });
  });

  it('returns the same text when kind is unchanged', () => {
    const result = switchMetaphorKind(CITY_DSL, 'city');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(JSON.parse(result.text).metaphor).toBe('city');
  });

  it('fails on invalid source', () => {
    const result = switchMetaphorKind('{not json', 'tree');
    expect(result.ok).toBe(false);
  });

  it('remaps city items to orrery size and inverse orbit', () => {
    const result = switchMetaphorKind(CITY_DSL, 'orrery');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const dsl = JSON.parse(result.text);
    expect(dsl.metaphor).toBe('orrery');
    // height 12 → size capped at 10, orbit pinned to the innermost ring.
    expect(dsl.items[0]).toMatchObject({ id: 'auth', size: 10, orbit: 1 });
    expect(dsl.items[1].orbit).toBeGreaterThan(dsl.items[0].orbit);
  });

  it('remaps city items to river stages in item order with flow from height', () => {
    const result = switchMetaphorKind(CITY_DSL, 'river');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const dsl = JSON.parse(result.text);
    expect(dsl.metaphor).toBe('river');
    expect(dsl.items[0]).toMatchObject({ stage: 0, flow: 12 });
    expect(dsl.items[1]).toMatchObject({ stage: 1, flow: 8 });
  });

  it('remaps an orrery back to galaxy using size as magnitude', () => {
    const orrery = JSON.stringify({
      metaphor: 'orrery',
      scene: {},
      items: [
        { id: 'core', label: 'Core', orbit: 0, size: 8 },
        { id: 'edge', label: 'Edge', orbit: 4, size: 2 }
      ],
      links: []
    });
    const result = switchMetaphorKind(orrery, 'galaxy');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const dsl = JSON.parse(result.text);
    expect(dsl.items[0]).toMatchObject({ id: 'core', magnitude: 8 });
  });

  it('remaps city items to a garden while preserving topic groupings', () => {
    const result = switchMetaphorKind(CITY_DSL, 'garden');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const dsl = JSON.parse(result.text);
    expect(dsl.metaphor).toBe('garden');
    expect(dsl.items[0]).toMatchObject({
      id: 'auth',
      impact: 10,
      maturity: 0.35,
      health: 'steady',
      bed: 'Core'
    });
    expect(dsl.items[1].maturity).toBeGreaterThan(dsl.items[0].maturity);
  });

  it('remaps city items to an archipelago while preserving topic groupings', () => {
    const result = switchMetaphorKind(CITY_DSL, 'archipelago');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const dsl = JSON.parse(result.text);
    expect(dsl.metaphor).toBe('archipelago');
    expect(dsl.items[0]).toMatchObject({
      id: 'auth',
      mass: 12,
      chain: 'Core'
    });
    expect(dsl.items[0].relief).toBeGreaterThanOrEqual(0);
    expect(dsl.items[0].relief).toBeLessThanOrEqual(1);
  });
});
