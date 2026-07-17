import { describe, expect, it } from 'vitest';
import {
  planFusedCompositeWorld,
  resolveCompositeMotionTransform
} from '../src/components/metaphorScenes/fusedCompositePlanner.js';
import {
  COMPOSITE_CAPABILITY_BY_KIND,
  COMPOSITE_PRIMITIVE_REGISTRY
} from '../src/components/metaphorScenes/compositePrimitiveRegistry.js';
import { resolveCompositeLayerTransform } from '../src/components/metaphorScenes/compositeLayerTransform.js';

const BASE_KINDS = Object.keys(COMPOSITE_CAPABILITY_BY_KIND);

function itemFor(kind, suffix) {
  const base = { id: `${kind}-${suffix}`, label: `${kind} ${suffix}` };
  if (kind === 'archipelago') return { ...base, mass: 8, relief: 0.7 };
  if (kind === 'city') return { ...base, height: 12, footprint: 2.5 };
  if (kind === 'layercake') return { ...base, thickness: 3, components: ['one'] };
  if (kind === 'galaxy') return { ...base, magnitude: 9 };
  if (kind === 'tree') return { ...base, weight: 7 };
  if (kind === 'terrain') return { ...base, elevation: 13, intensity: 4 };
  if (kind === 'orrery') return { ...base, orbit: 3, size: 6 };
  if (kind === 'river') return { ...base, stage: Number(suffix) || 0, flow: 9 };
  return { ...base, maturity: 0.7, impact: 7, health: 'thriving' };
}

function dslFor(kinds, seed = 'matrix') {
  return {
    metaphor: 'composite',
    layout: 'fused',
    seed,
    novelty: 0.65,
    motionIntensity: 0.7,
    scene: {},
    layers: kinds.map((kind, index) => ({
      id: `layer-${kind}-${index}`,
      as: kind,
      items: [itemFor(kind, String(index + 1))]
    })),
    items: [],
    links: []
  };
}

function expectFiniteVector(vector) {
  expect(vector).toHaveLength(3);
  for (const value of vector) expect(Number.isFinite(value)).toBe(true);
}

describe('Composite v2 primitive registry', () => {
  it('declares bounded anchors, placement, motion, and cost for every capability', () => {
    for (const capability of Object.values(COMPOSITE_CAPABILITY_BY_KIND)) {
      const primitive = COMPOSITE_PRIMITIVE_REGISTRY[capability.primitive];
      expect(primitive).toBeDefined();
      expect(primitive.role).toBe(capability.role);
      expect(primitive.anchor).toBeTruthy();
      expect(primitive.placement).toBeTruthy();
      expect(primitive.motionStyle).toBeTruthy();
      expect(primitive.estimatedCost).toBeGreaterThan(0);
      expect(primitive.bounds.radius[0]).toBeLessThanOrEqual(primitive.bounds.radius[1]);
      expect(primitive.bounds.height[0]).toBeLessThanOrEqual(primitive.bounds.height[1]);
    }
  });
});

describe('Composite v1 layout compatibility', () => {
  it('keeps explicit adjacent spacing and overlay transforms', () => {
    expect(resolveCompositeLayerTransform({}, 0, 'adjacent', 2).position).toEqual([-14, 0, 0]);
    expect(resolveCompositeLayerTransform({}, 1, 'adjacent', 2).position).toEqual([14, 0, 0]);
    expect(resolveCompositeLayerTransform({}, 1, 'overlay', 2).position).toEqual([0, 0.04, 0]);
    expect(
      resolveCompositeLayerTransform(
        { transform: { position: [3, 2, 1], scale: 0.5 } },
        0,
        'adjacent',
        2
      )
    ).toEqual({ position: [3, 2, 1], scale: 0.5 });
  });
});

describe('planFusedCompositeWorld', () => {
  it('is deeply deterministic for the same source and seed', () => {
    const dsl = dslFor(['archipelago', 'city', 'river'], 'stable-world');
    expect(planFusedCompositeWorld(dsl)).toEqual(planFusedCompositeWorld(dsl));
  });

  it('changes bounded topology/placements when the seed changes', () => {
    const first = planFusedCompositeWorld(dslFor(['city', 'garden', 'galaxy'], 'seed-a'));
    const second = planFusedCompositeWorld(dslFor(['city', 'garden', 'galaxy'], 'seed-b'));
    expect(first.signature).not.toBe(second.signature);
    expect(first.sites.map((site) => site.position)).not.toEqual(
      second.sites.map((site) => site.position)
    );
    expect(first.worldRadius).toBeLessThanOrEqual(23);
    expect(second.worldRadius).toBeLessThanOrEqual(23);
  });

  it('uses novelty to change topology without changing the semantic anchors set', () => {
    const conservativeDsl = dslFor(['city', 'garden', 'galaxy'], 'same-seed');
    conservativeDsl.novelty = 0.1;
    const novelDsl = { ...conservativeDsl, novelty: 0.92 };
    const conservative = planFusedCompositeWorld(conservativeDsl);
    const novel = planFusedCompositeWorld(novelDsl);
    expect(conservative.topology).toBe('ring');
    expect(novel.topology).not.toBe('ring');
    expect([...conservative.anchors.keys()].sort()).toEqual([...novel.anchors.keys()].sort());
    expect(conservative.sites.map((site) => site.position)).not.toEqual(
      novel.sites.map((site) => site.position)
    );
  });

  it('fuses archipelago sites, city landmarks, and a river path through real anchors', () => {
    const dsl = {
      ...dslFor(['archipelago', 'city', 'river'], 'commerce'),
      layers: [
        {
          id: 'domains',
          as: 'archipelago',
          items: [
            { id: 'checkout', label: 'Checkout', mass: 12, relief: 0.8 },
            { id: 'catalog', label: 'Catalog', mass: 8, relief: 0.5 }
          ]
        },
        {
          id: 'services',
          as: 'city',
          items: [
            { id: 'payments-api', label: 'Payments API', height: 14, footprint: 3 },
            { id: 'inventory', label: 'Inventory', height: 9, footprint: 2 }
          ]
        },
        {
          id: 'journey',
          as: 'river',
          items: [
            { id: 'browse', label: 'Browse', stage: 0, flow: 12 },
            { id: 'purchase', label: 'Purchase', stage: 1, flow: 8 }
          ]
        }
      ],
      links: [
        { from: 'checkout', to: 'payments-api', kind: 'flow' },
        { from: 'payments-api', to: 'purchase', kind: 'flow' }
      ]
    };
    const plan = planFusedCompositeWorld(dsl);
    expect(plan.sites).toHaveLength(2);
    expect(plan.sites.every((site) => site.primitive === 'island')).toBe(true);
    expect(plan.nodes.filter((node) => node.kind === 'city')).toHaveLength(2);
    expect(plan.nodes.every((node) => plan.sites.some((site) => site.id === node.attachedTo))).toBe(
      true
    );
    expect(plan.paths).toHaveLength(1);
    expect(plan.paths[0].stations).toHaveLength(2);
    expect(plan.links).toHaveLength(2);
    for (const link of plan.links) {
      expect(link.fromAnchor).toBe(plan.anchors.get(link.from));
      expect(link.toAnchor).toBe(plan.anchors.get(link.to));
      expectFiniteVector(link.fromAnchor);
      expectFiniteVector(link.toAnchor);
    }
  });

  it('produces finite plans and stable anchors for every ordered layer-kind pair', () => {
    for (const firstKind of BASE_KINDS) {
      for (const secondKind of BASE_KINDS) {
        const dsl = dslFor([firstKind, secondKind], `${firstKind}-${secondKind}`);
        const plan = planFusedCompositeWorld(dsl);
        expect(Number.isFinite(plan.estimatedCost)).toBe(true);
        expect(plan.estimatedCost).toBeGreaterThan(0);
        expect(Number.isFinite(plan.groundRadius)).toBe(true);
        expect(plan.groundRadius).toBeGreaterThan(0);
        for (const site of plan.sites) {
          expectFiniteVector(site.position);
          expectFiniteVector(site.anchor);
        }
        for (const node of plan.nodes) {
          expectFiniteVector(node.position);
          expectFiniteVector(node.anchor);
          expectFiniteVector(node.labelOffset);
        }
        for (const path of plan.paths) {
          for (const point of path.points) expectFiniteVector(point);
          expect(path.width).toBeLessThanOrEqual(0.42);
          for (const station of path.stations) expectFiniteVector(station.labelOffset);
        }
        for (const layer of dsl.layers) {
          for (const item of layer.items) {
            const anchor = plan.anchors.get(item.id);
            expect(anchor, `missing ${firstKind}/${secondKind}:${item.id}`).toBeDefined();
            expectFiniteVector(anchor);
          }
        }
      }
    }
  });

  it('resolves reduced motion as a deterministic frozen pose', () => {
    const motion = { style: 'orbit', phase: 1.2, speed: 0.8, amplitude: 0.2 };
    const frozenA = resolveCompositeMotionTransform(motion, 10, 0.7, false);
    const frozenB = resolveCompositeMotionTransform(motion, 99, 0.7, false);
    const animated = resolveCompositeMotionTransform(motion, 10, 0.7, true);
    expect(frozenA).toEqual(frozenB);
    expect(frozenA.offset.some((value) => Math.abs(value) > 0)).toBe(true);
    expect(animated).not.toEqual(frozenA);
  });
});
