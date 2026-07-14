import { describe, expect, it } from 'vitest';
import { resolveCompositeLayerTransform } from '../src/components/metaphorScenes/CompositeScene.jsx';

describe('resolveCompositeLayerTransform', () => {
  it('fans adjacent layers along +X around the origin', () => {
    const a = resolveCompositeLayerTransform({ id: 'a' }, 0, 'adjacent', 2);
    const b = resolveCompositeLayerTransform({ id: 'b' }, 1, 'adjacent', 2);
    expect(a.position[0]).toBeLessThan(0);
    expect(b.position[0]).toBeGreaterThan(0);
    expect(a.scale).toBe(1);
  });

  it('honours explicit transform overrides', () => {
    const t = resolveCompositeLayerTransform(
      { id: 'a', transform: { position: [3, 1, -2], scale: 0.5 } },
      0,
      'adjacent',
      2
    );
    expect(t.position).toEqual([3, 1, -2]);
    expect(t.scale).toBe(0.5);
  });

  it('stacks overlay layers with a tiny Y stagger', () => {
    const t = resolveCompositeLayerTransform({ id: 'a' }, 2, 'overlay', 3);
    expect(t.position).toEqual([0, 0.08, 0]);
  });
});
