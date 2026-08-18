import { describe, expect, it } from 'vitest';
import {
  planFusedCompositeWorld,
  resolveCompositeAtmosphere,
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

  it('binds landmarks to substrate sites by shared district/chain/label affinity', () => {
    const dsl = {
      metaphor: 'composite',
      layout: 'fused',
      seed: 'affinity-bind',
      novelty: 0.4,
      motionIntensity: 0.6,
      scene: {},
      layers: [
        {
          id: 'domains',
          as: 'archipelago',
          items: [
            { id: 'checkout-domain', label: 'Checkout', mass: 12, relief: 0.8, chain: 'Buy' },
            { id: 'catalog-domain', label: 'Catalog', mass: 9, relief: 0.5, chain: 'Discover' }
          ]
        },
        {
          id: 'services',
          as: 'city',
          items: [
            {
              id: 'payments-api',
              label: 'Payments API',
              height: 16,
              footprint: 3,
              district: 'Checkout',
              lighting: 'lit'
            },
            {
              id: 'search-api',
              label: 'Search API',
              height: 10,
              footprint: 2,
              district: 'Catalog',
              lighting: 'dim'
            }
          ]
        }
      ],
      items: [],
      links: []
    };
    const plan = planFusedCompositeWorld(dsl);
    const payments = plan.nodes.find((node) => node.id === 'payments-api');
    const search = plan.nodes.find((node) => node.id === 'search-api');
    expect(payments.attachedTo).toBe('site:checkout-domain');
    expect(search.attachedTo).toBe('site:catalog-domain');
    expect(payments.affinityBound).toBe(true);
    expect(search.affinityBound).toBe(true);
    expect(payments.presentation.lighting).toBe('lit');
    expect(search.presentation.lighting).toBe('dim');
    expect(plan.groups.some((group) => group.memberIds.includes('payments-api'))).toBe(true);

    // The floor placard shows `display`, not `label`. `label` is the matching
    // token — lowercased and stripped of filler words so "Checkout domain" and
    // "Checkout" bind to one another — and printing that on the floor would
    // rewrite the user's own noun, which every scene is required to preserve.
    const checkout = plan.groups.find((group) => group.memberIds.includes('payments-api'));
    expect(checkout.display).toBe('Checkout');
    expect(checkout.label).toBe('checkout');
  });

  it('encodes storytelling fields, connectors, LOD, and atmosphere on the plan', () => {
    const dsl = {
      metaphor: 'composite',
      layout: 'fused',
      seed: 'story-world',
      novelty: 0.55,
      motionIntensity: 0.8,
      scene: {},
      layers: [
        {
          id: 'islands',
          as: 'archipelago',
          items: [{ id: 'core', label: 'Core', mass: 10, relief: 0.7, chain: 'Platform' }]
        },
        {
          id: 'plants',
          as: 'garden',
          items: [
            {
              id: 'growth',
              label: 'Growth',
              maturity: 0.9,
              impact: 8,
              bed: 'Platform',
              health: 'thriving'
            }
          ]
        },
        {
          id: 'org',
          as: 'tree',
          items: [
            { id: 'root', label: 'Root', weight: 8 },
            { id: 'leaf', label: 'Leaf', weight: 3, parent: 'root' }
          ]
        },
        {
          id: 'journey',
          as: 'river',
          items: [
            { id: 'start', label: 'Start', stage: 0, flow: 12, hazard: 0.1 },
            { id: 'risk', label: 'Risk', stage: 1, flow: 4, hazard: 0.8 }
          ]
        }
      ],
      items: [],
      links: []
    };
    const plan = planFusedCompositeWorld(dsl);
    expect(plan.atmosphere).toBe('archipelago');
    expect(['high', 'medium', 'low']).toContain(plan.lod);
    expect(plan.connectors.some((connector) => connector.to === 'leaf')).toBe(true);
    const bloom = plan.nodes.find((node) => node.id === 'growth');
    expect(bloom.presentation.health).toBe('thriving');
    expect(bloom.height).toBeGreaterThan(1);
    const riskStation = plan.paths[0].stations.find((station) => station.id === 'risk');
    expect(riskStation.presentation.hazard).toBeCloseTo(0.8);
    expect(plan.paths[0].moteSpeed).toBeGreaterThan(0.04);
  });

  it('draws iceberg layers as berg landmarks, not anonymous towers', () => {
    const dsl = dslFor(['archipelago', 'iceberg'], 'iceberg-berg');
    dsl.layers[1].items = [{ id: 'debt', label: 'Tech debt', mass: 14, peril: 0.8 }];
    const plan = planFusedCompositeWorld(dsl);
    const debt = plan.nodes.find((node) => node.id === 'debt');
    expect(debt.primitive).toBe('berg');
    expect(debt.presentation.peril).toBeCloseTo(0.8);
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
        expect(plan.lod).toBeTruthy();
        expect(plan.atmosphere).toBeTruthy();
        for (const site of plan.sites) {
          expectFiniteVector(site.position);
          expectFiniteVector(site.anchor);
        }
        for (const node of plan.nodes) {
          expectFiniteVector(node.position);
          expectFiniteVector(node.anchor);
          expectFiniteVector(node.labelOffset);
          expect(node.presentation).toBeTruthy();
        }
        for (const path of plan.paths) {
          for (const point of path.points) expectFiniteVector(point);
          expect(path.width).toBeLessThanOrEqual(0.48);
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

  it('gives flow motion a distinct animated transform from pulse/bob', () => {
    const flow = resolveCompositeMotionTransform(
      { style: 'flow', phase: 0.4, speed: 1.1, amplitude: 0.2 },
      4,
      0.8,
      true
    );
    const pulse = resolveCompositeMotionTransform(
      { style: 'pulse', phase: 0.4, speed: 1.1, amplitude: 0.2 },
      4,
      0.8,
      true
    );
    expect(flow).not.toEqual(pulse);
    expect(Math.hypot(flow.offset[0], flow.offset[2])).toBeGreaterThan(0);
  });
});

describe('resolveCompositeAtmosphere', () => {
  it('prefers substrate ocean sky over the first layer kind', () => {
    expect(
      resolveCompositeAtmosphere({
        layers: [
          { as: 'city', items: [] },
          { as: 'archipelago', items: [] }
        ]
      })
    ).toBe('archipelago');
  });

  it('falls back to river daylight when paths exist without substrate', () => {
    expect(
      resolveCompositeAtmosphere({
        layers: [
          { as: 'city', items: [] },
          { as: 'river', items: [] }
        ]
      })
    ).toBe('river');
  });
});
