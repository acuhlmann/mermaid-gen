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
});
