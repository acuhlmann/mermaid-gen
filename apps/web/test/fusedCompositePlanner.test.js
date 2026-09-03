import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  fusedLabelImportance,
  fusedSiteLabelImportance,
  planFusedCompositeWorld,
  resolveCompositeAtmosphere,
  resolveCompositeMotionTransform,
  resolveSiteLabelOffset
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

// The composites the product actually ships, read from disk rather than
// transcribed: the placement below depends on the fixture's own seed, novelty
// and item metrics, so a hand-copied approximation would not reproduce it.
const FIXTURE_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../docs/fixtures/metaphor3d'
);
const COMPOSITE_FIXTURES = fs
  .readdirSync(FIXTURE_DIR)
  .filter((name) => name.startsWith('composite-') && name.endsWith('.json'));

function readCompositeFixture(name) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, name), 'utf8'));
}

// The whole visual contract of a site's own name is two fields: labelOffset's
// x/z (FusedCompositeScene.jsx, fusedCompositePrimitives.jsx) and labelLift
// (fusedCompositePrimitives.jsx). Nothing else in the renderer reads the
// placement, so exact agreement on these numbers IS "the label has not moved" —
// no capture needed to know a refactor of the planner left the picture alone.
// Re-derived here from the doc block above assignSiteLabelPlacement rather than
// from its code: outward unit ray scaled to 0.68 of the site radius (a site at
// the middle of the world has no outward and keeps a near corner), lifted by
// however far the tallest thing attached to it rises above its own top, plus a
// fixed clearance.
const SITE_LABEL_REACH = 0.68;
const SITE_LABEL_CREST_CLEARANCE = 1.5;

function expectedLabelPlacement(site, nodes) {
  const x = site.position[0];
  const z = site.position[2];
  const length = Math.hypot(x, z);
  const reach = site.radius * SITE_LABEL_REACH;
  const offset =
    length > 0.01
      ? [(x / length) * reach, (z / length) * reach]
      : [reach * Math.SQRT1_2, reach * Math.SQRT1_2];
  let crest;
  for (const node of nodes) {
    if (node.attachedTo !== site.id) continue;
    const top = node.position[1] + node.height;
    if (crest === undefined || top > crest) crest = top;
  }
  const own = site.position[1] + site.height;
  return {
    offset,
    lift: crest === undefined ? 0 : Math.max(0, crest - own + SITE_LABEL_CREST_CLEARANCE)
  };
}

const LABEL_PLACEMENT_GOLDEN_DSL = {
  metaphor: 'composite',
  layout: 'fused',
  seed: 'label-placement-golden',
  novelty: 0.55,
  motionIntensity: 0.65,
  scene: {},
  layers: [
    {
      id: 'domains',
      as: 'archipelago',
      items: [
        { id: 'checkout', label: 'Checkout', mass: 14, relief: 0.8 },
        { id: 'catalog', label: 'Catalog', mass: 11, relief: 0.6 },
        { id: 'fulfilment', label: 'Fulfilment', mass: 9, relief: 0.5 },
        { id: 'identity', label: 'Identity', mass: 6, relief: 0.35 }
      ]
    },
    {
      id: 'services',
      as: 'city',
      items: [
        { id: 'gateway', label: 'Gateway', height: 38, footprint: 3, district: 'Checkout' },
        { id: 'orders', label: 'Orders', height: 22, footprint: 2.4, district: 'Checkout' },
        { id: 'search', label: 'Search', height: 16, footprint: 2, district: 'Catalog' },
        { id: 'pickers', label: 'Pickers', height: 9, footprint: 1.8, district: 'Fulfilment' }
      ]
    }
  ],
  items: [],
  links: []
};

// Captured from the planner before the assignSiteLabelPlacement extraction
// (issue #422). Three loaded islands and one bare one, each on a different
// outward bearing.
const LABEL_PLACEMENT_GOLDEN = [
  { id: 'site:checkout', offset: [-0.1977823888042746, 2.505482640102307], lift: 5.49748743718593 },
  {
    id: 'site:catalog',
    offset: [-2.353317939282824, -0.31680428884675454],
    lift: 4.325628140703518
  },
  {
    id: 'site:fulfilment',
    offset: [0.42638247280519936, -2.2308176588158255],
    lift: 3.9527638190954772
  },
  { id: 'site:identity', offset: [2.0296149233047616, 0.505066117633536], lift: 0 }
];

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

  it('does not print a territory name an island already carries', () => {
    // "Checkout" here is both an island's own label and the district its tower
    // claims, so the group and the island name the same thing. Drawing the
    // placard as well put the same word twice within a few pixels of itself,
    // which reads as a rendering fault rather than as two facts.
    const dsl = {
      metaphor: 'composite',
      layout: 'fused',
      seed: 'placard-dedupe',
      novelty: 0.4,
      motionIntensity: 0.6,
      scene: {},
      layers: [
        {
          id: 'domains',
          as: 'archipelago',
          items: [
            { id: 'checkout-domain', label: 'Checkout', mass: 12, relief: 0.8, chain: 'Buy' },
            { id: 'catalog-domain', label: 'Catalog', mass: 9, relief: 0.5, chain: 'Buy' }
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
              district: 'Checkout'
            },
            { id: 'search-api', label: 'Search API', height: 10, footprint: 2, district: 'Buy' }
          ]
        }
      ],
      items: [],
      links: []
    };
    const plan = planFusedCompositeWorld(dsl);
    const checkout = plan.groups.find((group) => group.label === 'checkout');
    const buy = plan.groups.find((group) => group.label === 'buy');
    expect(checkout.namedByMember).toBe(true);
    // "Buy" is a shared chain nobody is named after — it still earns a placard.
    expect(buy.namedByMember).toBe(false);
  });

  it('stands a territory placard on the ground it covers, not inside it', () => {
    const dsl = {
      metaphor: 'composite',
      layout: 'fused',
      seed: 'placard-height',
      novelty: 0.4,
      motionIntensity: 0.6,
      scene: {},
      layers: [
        {
          id: 'domains',
          as: 'archipelago',
          items: [
            { id: 'a', label: 'Alpha', mass: 14, relief: 0.9, chain: 'Stream' },
            { id: 'b', label: 'Beta', mass: 12, relief: 0.8, chain: 'Stream' }
          ]
        }
      ],
      items: [],
      links: []
    };
    const plan = planFusedCompositeWorld(dsl);
    const stream = plan.groups.find((group) => group.label === 'stream');
    // An island sits ON the ocean the group ring is drawn on, so a placard left
    // at ring height is buried inside the island it names.
    expect(stream.surfaceY).toBeGreaterThan(0);
    expect(stream.surfaceY).toBeLessThanOrEqual(12);
  });

  it('parks each island name on its outward shoulder, clear of its own landmarks', () => {
    const dsl = {
      metaphor: 'composite',
      layout: 'fused',
      seed: 'label-offsets',
      novelty: 0.5,
      motionIntensity: 0.6,
      scene: {},
      layers: [
        {
          id: 'domains',
          as: 'archipelago',
          items: [
            { id: 'a', label: 'Alpha', mass: 12, relief: 0.7 },
            { id: 'b', label: 'Beta', mass: 10, relief: 0.6 },
            { id: 'c', label: 'Gamma', mass: 8, relief: 0.5 }
          ]
        }
      ],
      items: [],
      links: []
    };
    const plan = planFusedCompositeWorld(dsl);
    expect(plan.sites.length).toBeGreaterThan(0);
    for (const site of plan.sites) {
      const [dx, , dz] = site.labelOffset;
      expect(Math.hypot(dx, dz)).toBeGreaterThan(0);
      expect(Math.hypot(dx, dz)).toBeLessThanOrEqual(site.radius);
      const outward = site.position[0] * dx + site.position[2] * dz;
      // Points away from the middle of the world, where the open water is.
      expect(outward).toBeGreaterThan(0);
    }
  });

  it('lifts each island name clear of the tallest landmark planted on it', () => {
    const dsl = {
      metaphor: 'composite',
      layout: 'fused',
      seed: 'label-lift',
      novelty: 0.5,
      motionIntensity: 0.6,
      scene: {},
      layers: [
        {
          id: 'domains',
          as: 'archipelago',
          items: [
            { id: 'a', label: 'Alpha', mass: 12, relief: 0.7 },
            { id: 'b', label: 'Beta', mass: 10, relief: 0.6 },
            { id: 'c', label: 'Gamma', mass: 8, relief: 0.5 }
          ]
        },
        {
          id: 'services',
          as: 'city',
          items: [
            { id: 's1', label: 'One', height: 40, footprint: 2 },
            { id: 's2', label: 'Two', height: 18, footprint: 2 }
          ]
        }
      ],
      items: [],
      links: []
    };
    const plan = planFusedCompositeWorld(dsl);
    expect(plan.nodes.length).toBe(2);
    const crest = new Map();
    for (const node of plan.nodes) {
      const top = node.position[1] + node.height;
      crest.set(node.attachedTo, Math.max(crest.get(node.attachedTo) ?? -Infinity, top));
    }
    let carried = 0;
    for (const site of plan.sites) {
      expect(Number.isFinite(site.labelLift)).toBe(true);
      expect(site.labelLift).toBeGreaterThanOrEqual(0);
      const top = crest.get(site.id);
      if (top === undefined) {
        // Nothing is standing on this one, so its name has nothing to clear.
        expect(site.labelLift).toBe(0);
        continue;
      }
      carried += 1;
      // The name is drawn at `height + lift`, in the site's own local space.
      const labelY = site.position[1] + site.height + site.labelLift;
      // Clear of the crest by more than the 0.9 a node's OWN name sits above
      // its top — otherwise the two names land in one square of screen and the
      // declutter pass drops the tower's, which outranks nothing.
      expect(labelY - top).toBeGreaterThan(0.9);
    }
    // A test that found no loaded island would pass while examining nothing.
    expect(carried).toBeGreaterThan(0);
  });

  it('keeps the exact island-name placement the fixed composite fixture shipped with', () => {
    const plan = planFusedCompositeWorld(LABEL_PLACEMENT_GOLDEN_DSL);
    const actual = plan.sites.map((site) => ({
      id: site.id,
      offset: [site.labelOffset[0], site.labelOffset[2]],
      lift: site.labelLift
    }));
    // Exact, not approximate: the placement is a pure function of the plan, so
    // any drift at all means some name landed somewhere else on screen.
    expect(actual).toEqual(LABEL_PLACEMENT_GOLDEN);
  });

  it('places every island name by the outward-shoulder + crest-clearance rule', () => {
    const fixtures = [
      LABEL_PLACEMENT_GOLDEN_DSL,
      ...BASE_KINDS.flatMap((first) =>
        BASE_KINDS.map((second) => dslFor([first, second], `label-sweep-${first}-${second}`))
      )
    ];
    let checked = 0;
    let lifted = 0;
    for (const dsl of fixtures) {
      const plan = planFusedCompositeWorld(dsl);
      for (const site of plan.sites) {
        const want = expectedLabelPlacement(site, plan.nodes);
        expect(site.labelOffset[0]).toBe(want.offset[0]);
        expect(site.labelOffset[1]).toBe(0);
        expect(site.labelOffset[2]).toBe(want.offset[1]);
        expect(site.labelLift).toBe(want.lift);
        checked += 1;
        if (want.lift > 0) lifted += 1;
        // No planner-laid-out site is ever at the middle of the world, so the
        // near-corner fallback is unreachable from here — it is covered
        // directly against resolveSiteLabelOffset in the next case instead.
        expect(Math.hypot(site.position[0], site.position[2])).toBeGreaterThan(0.01);
      }
    }
    // A sweep that found no sites, or only bare ones, would pass while
    // examining almost nothing — both branches of the lift have to be covered.
    expect(checked).toBeGreaterThan(80);
    expect(lifted).toBeGreaterThan(0);
  });

  it('gives a site with no outward a near corner instead of dividing by zero', () => {
    const reach = 4 * 0.68;
    expect(resolveSiteLabelOffset({ position: [0, 0, 0], radius: 4 })).toEqual([
      reach * Math.SQRT1_2,
      0,
      reach * Math.SQRT1_2
    ]);
    // Just inside the 0.01 dead zone still counts as no outward...
    expect(resolveSiteLabelOffset({ position: [0.004, 0, 0.004], radius: 4 })[0]).toBe(
      reach * Math.SQRT1_2
    );
    // ...and just outside it takes the real ray.
    expect(resolveSiteLabelOffset({ position: [1, 0, 0], radius: 4 })).toEqual([reach, 0, 0]);
    // A site with no position at all resolves rather than throwing.
    expect(resolveSiteLabelOffset({ radius: 4 })).toEqual([
      reach * Math.SQRT1_2,
      0,
      reach * Math.SQRT1_2
    ]);
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

  // A landmark's name has to read as ITS name. #519 pushed each name out to
  // `site.radius * 0.6` from its landmark so two landmarks on one island stop
  // contesting a single screen slot — but the push is sized from the SITE and
  // knows nothing about the next island, so two landmarks on adjacent sites are
  // both walked into the water between them. Measured on the shipped festival
  // composite before this guard: `artist-check-in`'s name sat 2.10 units from
  // artist-check-in and 0.68 from shuttle-control, and shuttle-control's own
  // name 1.90 from itself and 1.57 from artist-check-in. Both names read as the
  // wrong landmark's — the failure #519 exists to prevent, moved one island
  // over. `node.anchor` shares its x/z with `node.position`, so the distance
  // from a name to its own landmark IS the reach of its `labelOffset`.
  it('keeps every landmark name nearer the landmark it names than any other', () => {
    expect(COMPOSITE_FIXTURES.length).toBeGreaterThan(0);
    let compared = 0;
    for (const name of COMPOSITE_FIXTURES) {
      const plan = planFusedCompositeWorld(readCompositeFixture(name));
      expect(plan.nodes.length, `${name} planned no landmarks`).toBeGreaterThan(1);
      for (const node of plan.nodes) {
        const labelX = node.anchor[0] + node.labelOffset[0];
        const labelZ = node.anchor[2] + node.labelOffset[2];
        const own = Math.hypot(labelX - node.position[0], labelZ - node.position[2]);
        for (const other of plan.nodes) {
          if (other === node) continue;
          const away = Math.hypot(labelX - other.position[0], labelZ - other.position[2]);
          compared += 1;
          expect(
            away,
            `${name}: ${node.id}'s name is ${away.toFixed(2)} from ${other.id} ` +
              `and ${own.toFixed(2)} from itself`
          ).toBeGreaterThan(own);
        }
      }
    }
    expect(compared).toBeGreaterThan(0);
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

describe('label ranks across a fused world', () => {
  const dsl = {
    metaphor: 'composite',
    layout: 'fused',
    seed: 'ranks',
    scene: {},
    layers: [
      {
        id: 'domains',
        as: 'archipelago',
        items: [
          { id: 'd1', label: 'Big', mass: 15 },
          { id: 'd2', label: 'Small', mass: 6 }
        ]
      },
      {
        id: 'services',
        as: 'city',
        items: [
          { id: 's1', label: 'Tall', height: 18, footprint: 3 },
          { id: 's2', label: 'Short', height: 4, footprint: 2 }
        ]
      },
      {
        id: 'journey',
        as: 'river',
        items: [
          { id: 'r1', label: 'Start', stage: 0, flow: 16 },
          { id: 'r2', label: 'End', stage: 100, flow: 3 }
        ]
      }
    ],
    items: [],
    links: []
  };

  const rankOf = (world, id) =>
    [...world.nodes, ...world.paths.flatMap((path) => path.stations)].find((body) => body.id === id)
      ?.labelRank;

  it('gives a journey station a rank at all', () => {
    // It carried no importance before, so every path layer tied with the link
    // captions at the bottom and a crowded canvas dropped the whole journey.
    const world = planFusedCompositeWorld(dsl);
    expect(typeof rankOf(world, 'r1')).toBe('number');
    // Above the 0 an unranked label falls to, which is where link captions sit.
    expect(fusedLabelImportance(rankOf(world, 'r1'))).toBeGreaterThan(0);
  });

  it('takes one layer at a time, so a tower cannot outrank a whole river', () => {
    const world = planFusedCompositeWorld(dsl);
    // Every layer's first name outranks every layer's second.
    expect(rankOf(world, 's1')).toBeLessThan(rankOf(world, 'r2'));
    expect(rankOf(world, 'r1')).toBeLessThan(rankOf(world, 's2'));
  });

  it('orders within a layer by that layer own metric', () => {
    const world = planFusedCompositeWorld(dsl);
    expect(rankOf(world, 's1')).toBeLessThan(rankOf(world, 's2'));
    expect(rankOf(world, 'r1')).toBeLessThan(rankOf(world, 'r2'));
  });

  it('ranks are distinct, so nearness never decides between layers', () => {
    const world = planFusedCompositeWorld(dsl);
    const ranks = [...world.nodes, ...world.paths.flatMap((p) => p.stations)].map(
      (body) => body.labelRank
    );
    // Coverage claim: an unpopulated world would pass the uniqueness check
    // below while examining nothing.
    expect(ranks.length).toBeGreaterThan(0);
    expect(new Set(ranks).size).toBe(ranks.length);
  });

  it('keeps every site above every landmark', () => {
    const world = planFusedCompositeWorld(dsl);
    const loadedSites = world.sites.filter((site) => site.item);
    expect(loadedSites.length).toBeGreaterThan(0);
    expect(world.nodes.length).toBeGreaterThan(0);
    const worstSite = Math.min(
      ...loadedSites.map((site) => fusedSiteLabelImportance(site.labelRank))
    );
    const bestNode = Math.max(...world.nodes.map((node) => fusedLabelImportance(node.labelRank)));
    expect(worstSite).toBeGreaterThan(bestNode);
  });

  it('carries a layerKey on every ranked body, for the declutter pass', () => {
    const world = planFusedCompositeWorld(dsl);
    const loadedSites = world.sites.filter((s) => s.item);
    expect(world.nodes.length).toBeGreaterThan(0);
    expect(world.paths.length).toBeGreaterThan(0);
    expect(loadedSites.length).toBeGreaterThan(0);
    for (const node of world.nodes) expect(typeof node.layerId).toBe('string');
    for (const path of world.paths) expect(typeof path.layerId).toBe('string');
    for (const site of loadedSites) {
      expect(typeof site.layerId).toBe('string');
    }
  });
});
