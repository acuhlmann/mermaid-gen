import test from 'node:test';
import assert from 'node:assert/strict';
import { authorMetaphorUsda, METAPHOR_USDA_MAPPING_VERSION } from '../src/metaphorUsda.js';
import { MetaphorDslSchema } from '../src/metaphorSchema.js';
import type { MetaphorBaseKind } from '../src/metaphorSchema.js';

function author(doc: unknown): string {
  return authorMetaphorUsda(MetaphorDslSchema.parse(doc));
}

const baseScene = { theme: 'whiteboard', camera: 'orbit' };

test('authorMetaphorUsda emits the USDA header and layer metadata', () => {
  const usda = author({
    metaphor: 'city',
    scene: { theme: 'noir', camera: 'orbit', title: 'Payments platform' },
    items: [{ id: 'api', label: 'API' }],
    links: []
  });

  assert.ok(usda.startsWith('#usda 1.0\n'));
  assert.ok(usda.includes('    defaultPrim = "World"'));
  assert.ok(usda.includes('    upAxis = "Y"'));
  assert.ok(usda.includes('    metersPerUnit = 1'));
  assert.ok(
    usda.includes(`string "archislop:mappingVersion" = "${METAPHOR_USDA_MAPPING_VERSION}"`)
  );
  assert.ok(usda.includes('string "archislop:metaphor" = "city"'));
  assert.ok(usda.includes('string "archislop:sceneTheme" = "noir"'));
  assert.ok(usda.includes('string "archislop:sceneCamera" = "orbit"'));
  assert.ok(usda.includes('string "archislop:sceneTitle" = "Payments platform"'));
  assert.ok(usda.endsWith('}\n'));
});

test('authorMetaphorUsda emits kind scope, item prims, and typed attributes', () => {
  const usda = author({
    metaphor: 'city',
    scene: baseScene,
    items: [
      {
        id: 'payments-api',
        label: 'Payments API',
        height: 12,
        footprint: 3,
        district: 'core',
        lighting: 'lit',
        condition: 'aging',
        position: [1, 2, 3],
        glyph: 'service',
        note: 'Handles card auth'
      }
    ],
    links: []
  });

  assert.ok(usda.includes('def Xform "World"'));
  assert.ok(usda.includes('def Xform "city" ('));
  assert.ok(usda.includes('doc = "archislop metaphor kind: city"'));
  assert.ok(usda.includes('def Xform "payments_api" ('));
  assert.ok(usda.includes('doc = "Payments API"'));
  assert.ok(usda.includes('custom string archislop:id = "payments-api"'));
  assert.ok(usda.includes('custom string archislop:label = "Payments API"'));
  assert.ok(usda.includes('custom double3 archislop:position = (1, 2, 3)'));
  assert.ok(usda.includes('custom token archislop:glyph = "service"'));
  assert.ok(usda.includes('custom string archislop:note = "Handles card auth"'));
  assert.ok(usda.includes('custom double archislop:height = 12'));
  assert.ok(usda.includes('custom double archislop:footprint = 3'));
  assert.ok(usda.includes('custom string archislop:district = "core"'));
  assert.ok(usda.includes('custom token archislop:lighting = "lit"'));
  assert.ok(usda.includes('custom token archislop:condition = "aging"'));
});

test('authorMetaphorUsda sanitizes ids to USD names and preserves originals', () => {
  const usda = author({
    metaphor: 'terrain',
    scene: baseScene,
    items: [
      { id: 'a-b', label: 'Dash', elevation: 1, intensity: 1 },
      { id: 'a_b', label: 'Underscore', elevation: 2, intensity: 1 },
      { id: '1st', label: 'Leading digit', elevation: 3, intensity: 1 }
    ],
    links: []
  });

  assert.ok(usda.includes('def Xform "a_b" ('));
  assert.ok(usda.includes('def Xform "a_b_2" ('));
  assert.ok(usda.includes('def Xform "_1st" ('));
  assert.ok(usda.includes('custom string archislop:id = "a-b"'));
  assert.ok(usda.includes('custom string archislop:id = "a_b"'));
  assert.ok(usda.includes('custom string archislop:id = "1st"'));
});

const KIND_FIXTURES: Record<
  MetaphorBaseKind,
  { items: Array<Record<string, unknown>>; fields: string[] }
> = {
  city: {
    items: [
      {
        id: 'a',
        label: 'A',
        height: 12,
        footprint: 3,
        district: 'core',
        lighting: 'dim',
        condition: 'new'
      }
    ],
    fields: ['height', 'footprint', 'district', 'lighting', 'condition']
  },
  layercake: {
    items: [{ id: 'a', label: 'A', thickness: 2, components: ['x', 'y'], cracks: 0.5, tilt: 3 }],
    fields: ['thickness', 'components', 'cracks', 'tilt']
  },
  galaxy: {
    items: [
      { id: 'a', label: 'A', magnitude: 8, cluster: 'c1', binary: 'b' },
      { id: 'b', label: 'B', magnitude: 4 }
    ],
    fields: ['magnitude', 'cluster', 'binary']
  },
  tree: {
    items: [
      { id: 'oak', label: 'Oak', weight: 5, kind: 'trunk' },
      { id: 'leaf1', label: 'Leaf', parent: 'oak', weight: 1, kind: 'leaf' }
    ],
    fields: ['parent', 'weight', 'kind']
  },
  terrain: {
    items: [{ id: 'a', label: 'A', elevation: 5, intensity: 2 }],
    fields: ['elevation', 'intensity']
  },
  orrery: {
    items: [
      { id: 'sun', label: 'Sun', orbit: 0, size: 8 },
      { id: 'm1', label: 'Moonlet', orbit: 2, size: 1, moon: 'sun' }
    ],
    fields: ['orbit', 'size', 'moon']
  },
  river: {
    items: [{ id: 'a', label: 'A', stage: 1, flow: 6, hazard: 0.4 }],
    fields: ['stage', 'flow', 'hazard']
  },
  garden: {
    items: [{ id: 'a', label: 'A', maturity: 0.7, impact: 4, bed: 'core', health: 'at-risk' }],
    fields: ['maturity', 'impact', 'bed', 'health']
  },
  archipelago: {
    items: [{ id: 'a', label: 'A', mass: 6, relief: 0.5, chain: 'north' }],
    fields: ['mass', 'relief', 'chain']
  },
  machine: {
    items: [
      { id: 'a', label: 'A', size: 4, speed: 2, axle: 'main', torque: 0.6, mesh: 'b' },
      { id: 'b', label: 'B', size: 3, speed: 1 }
    ],
    fields: ['size', 'speed', 'axle', 'torque', 'mesh']
  },
  bridge: {
    items: [{ id: 'a', label: 'A', span: 40, load: 5, side: 'legacy', strain: 0.5 }],
    fields: ['span', 'load', 'side', 'strain']
  },
  cycle: {
    items: [{ id: 'a', label: 'A', phase: 25, size: 4, friction: 0.3 }],
    fields: ['phase', 'size', 'friction']
  }
};

test('authorMetaphorUsda covers every per-kind field for every base kind', () => {
  for (const [kind, fixture] of Object.entries(KIND_FIXTURES)) {
    const usda = author({ metaphor: kind, scene: baseScene, items: fixture.items, links: [] });
    for (const field of fixture.fields) {
      assert.ok(
        usda.includes(`archislop:${field}`),
        `${kind}: expected attribute archislop:${field} in output`
      );
    }
    assert.ok(usda.includes('custom string archislop:id ='), `${kind}: id attribute missing`);
    assert.ok(usda.includes('custom string archislop:label ='), `${kind}: label attribute missing`);
  }
});

test('authorMetaphorUsda maps enum lists, dashed tokens, and double3 correctly', () => {
  const usda = author({
    metaphor: 'layercake',
    scene: baseScene,
    items: [
      { id: 'a', label: 'A', thickness: 2, components: ['api', 'db'], cracks: 0.25, tilt: 5 }
    ],
    links: []
  });
  assert.ok(usda.includes('custom string[] archislop:components = ["api", "db"]'));

  const garden = author({
    metaphor: 'garden',
    scene: baseScene,
    items: [{ id: 'a', label: 'A', maturity: 0.7, impact: 4, health: 'at-risk' }],
    links: []
  });
  assert.ok(garden.includes('custom token archislop:health = "at-risk"'));
});

test('authorMetaphorUsda emits item references as relationships', () => {
  const usda = author({
    metaphor: 'tree',
    scene: baseScene,
    items: [
      { id: 'oak', label: 'Oak', weight: 5 },
      { id: 'leaf1', label: 'Leaf', parent: 'oak', weight: 1 },
      { id: 'leaf2', label: 'Orphan', parent: 'ghost', weight: 1 }
    ],
    links: []
  });

  assert.ok(usda.includes('custom rel archislop:parent = </World/tree/oak>'));
  // Dangling reference falls back to the raw id string (no data loss).
  assert.ok(usda.includes('custom string archislop:parent = "ghost"'));
});

test('authorMetaphorUsda emits links as rels with aligned kind/label arrays', () => {
  const usda = author({
    metaphor: 'city',
    scene: baseScene,
    items: [
      { id: 'api', label: 'API', height: 12, footprint: 3 },
      { id: 'db', label: 'DB', height: 6, footprint: 4 },
      { id: 'cache', label: 'Cache', height: 2, footprint: 1 }
    ],
    links: [
      { from: 'api', to: 'db', kind: 'flow', label: 'writes' },
      { from: 'api', to: 'cache' },
      { from: 'api', to: 'ghost' },
      { from: 'db', to: 'api', kind: 'dependency' }
    ]
  });

  assert.ok(usda.includes('custom rel archislop:links = [</World/city/db>, </World/city/cache>]'));
  assert.ok(usda.includes('custom uniform token[] archislop:linkKinds = ["flow", ""]'));
  assert.ok(usda.includes('custom string[] archislop:linkLabels = ["writes", ""]'));
  assert.ok(usda.includes('custom rel archislop:links = [</World/city/api>]'));
  // Dangling link targets are skipped entirely.
  assert.ok(!usda.includes('ghost'));
});

test('authorMetaphorUsda fuses composite layers as scopes with planner controls', () => {
  const usda = author({
    metaphor: 'composite',
    scene: { theme: 'arcade', camera: 'orbit' },
    layout: 'fused',
    seed: 'demo',
    novelty: 0.4,
    motionIntensity: 0.8,
    layers: [
      {
        id: 'flow-layer',
        as: 'river',
        label: 'Flow',
        items: [{ id: 's1', label: 'Source', stage: 0, flow: 4 }]
      },
      {
        id: 'beds',
        as: 'garden',
        transform: { position: [2, 0, 1], scale: 1.5 },
        items: [{ id: 'p1', label: 'Plant', maturity: 0.6, impact: 3 }]
      }
    ],
    links: [{ from: 's1', to: 'p1', kind: 'flow', label: 'feeds' }]
  });

  assert.ok(usda.includes('string "archislop:metaphor" = "composite"'));
  assert.ok(usda.includes('string "archislop:layout" = "fused"'));
  assert.ok(usda.includes('string "archislop:seed" = "demo"'));
  assert.ok(usda.includes('string "archislop:novelty" = "0.4"'));
  assert.ok(usda.includes('string "archislop:motionIntensity" = "0.8"'));
  assert.ok(usda.includes('def Xform "flow_layer" ('));
  assert.ok(usda.includes('custom string archislop:layerId = "flow-layer"'));
  assert.ok(usda.includes('custom token archislop:layerAs = "river"'));
  assert.ok(usda.includes('custom string archislop:layerLabel = "Flow"'));
  assert.ok(usda.includes('custom double3 archislop:layerPosition = (2, 0, 1)'));
  assert.ok(usda.includes('custom double archislop:layerScale = 1.5'));
  // Cross-layer links resolve through the globally unique item ids.
  assert.ok(usda.includes('custom rel archislop:links = [</World/beds/p1>]'));
  // Composite items keep absent optionals absent (no schema defaults applied).
  assert.ok(usda.includes('custom double archislop:maturity = 0.6'));
  assert.ok(!usda.includes('archislop:health'));
});

test('authorMetaphorUsda encodes structured scene extras as JSON layer data', () => {
  const usda = author({
    metaphor: 'terrain',
    scene: {
      theme: 'whiteboard',
      camera: 'orbit',
      legend: { elevation: 'risk score' },
      surface: { metric: 'risk', baseline: 1 }
    },
    items: [{ id: 'a', label: 'A', elevation: 5, intensity: 2 }],
    links: []
  });

  assert.ok(usda.includes('string "archislop:sceneLegend" = "{\\"elevation\\":\\"risk score\\"}"'));
  assert.ok(
    usda.includes('string "archislop:sceneSurface" = "{\\"metric\\":\\"risk\\",\\"baseline\\":1}"')
  );

  const galaxy = author({
    metaphor: 'galaxy',
    scene: { ...baseScene, nebula: [{ center: [0, 0, 0], radius: 6 }] },
    items: [{ id: 'a', label: 'A', magnitude: 4 }],
    links: []
  });
  assert.ok(
    galaxy.includes('string "archislop:sceneNebula" = "[{\\"center\\":[0,0,0],\\"radius\\":6}]"')
  );
});

test('authorMetaphorUsda is deterministic and structurally balanced', () => {
  const doc = {
    metaphor: 'machine',
    scene: baseScene,
    items: [
      { id: 'a', label: 'A', size: 4, speed: 2, mesh: 'b' },
      { id: 'b', label: 'B', size: 3, speed: 1 }
    ],
    links: [{ from: 'a', to: 'b', kind: 'ownership', label: 'drives' }]
  };
  const first = author(doc);
  const second = author(doc);
  assert.equal(first, second);

  const opens = (first.match(/\{/g) ?? []).length;
  const closes = (first.match(/\}/g) ?? []).length;
  assert.equal(opens, closes);

  const primNames = [...first.matchAll(/def Xform "([^"]+)"/g)].map((match) => match[1]);
  assert.ok(primNames.length > 0);
  for (const name of primNames) {
    assert.match(name, /^[A-Za-z_][A-Za-z0-9_]*$/);
  }
});
