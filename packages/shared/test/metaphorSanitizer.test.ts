import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CITY_MAX_ITEMS,
  GalaxyMetaphorSchema,
  METAPHOR_GLYPH_KINDS,
  MetaphorDslSchema,
  MetaphorLegendSchema,
  sanitizeMetaphorDsl
} from '../src/index.js';

test('sanitizeMetaphorDsl parses a well-formed city DSL and fills scene defaults', () => {
  const input = JSON.stringify({
    metaphor: 'city',
    items: [{ id: 'auth', label: 'Auth Service', height: 12, footprint: 3 }]
  });

  const result = sanitizeMetaphorDsl(input);

  assert.ok(result.dsl);
  assert.equal(result.dsl?.metaphor, 'city');
  assert.equal(result.dsl?.scene.theme, 'whiteboard');
  assert.equal(result.dsl?.scene.camera, 'orbit');
  assert.equal(result.dsl?.items.length, 1);
  assert.equal(result.dsl?.links.length, 0);
  assert.ok(result.applied.includes('default-scene'));
});

test('sanitizeMetaphorDsl clamps item position and drops invalid links', () => {
  const input = JSON.stringify({
    metaphor: 'city',
    items: [
      { id: 'a', label: 'A', position: [100, 0, -5] },
      { id: 'b', label: 'B' }
    ],
    links: [
      { from: 'a', to: 'b', label: 'ok' },
      { from: 'a', to: 'missing' },
      { from: 'a', to: 'b' }
    ]
  });
  const result = sanitizeMetaphorDsl(input);
  assert.ok(result.dsl);
  if (result.dsl?.metaphor === 'city') {
    assert.equal(result.dsl.items[0].position?.[0], 30);
    assert.equal(result.dsl.links.length, 1);
    assert.equal(result.dsl.links[0].from, 'a');
  }
  assert.ok(result.applied.includes('clamp-position'));
  assert.ok(result.applied.includes('sanitize-links'));
});

test('MetaphorDslSchema parses city links', () => {
  const dsl = MetaphorDslSchema.parse({
    metaphor: 'city',
    scene: {},
    items: [
      { id: 'api', label: 'API', height: 8, footprint: 2 },
      { id: 'db', label: 'DB', height: 5, footprint: 3 }
    ],
    links: [{ from: 'api', to: 'db', label: 'queries' }]
  });
  assert.equal(dsl.metaphor, 'city');
  if (dsl.metaphor === 'city') {
    assert.equal(dsl.links.length, 1);
    assert.equal(dsl.links[0].label, 'queries');
  }
});

test('sanitizeMetaphorDsl returns null dsl for empty input but does not throw', () => {
  const result = sanitizeMetaphorDsl('');
  assert.equal(result.dsl, null);
  assert.equal(result.text, '');
});

test('sanitizeMetaphorDsl returns null dsl for unparseable JSON without throwing', () => {
  const result = sanitizeMetaphorDsl('{not json');
  assert.equal(result.dsl, null);
});

test('sanitizeMetaphorDsl defaults missing metaphor when structure rewrite is allowed', () => {
  const input = JSON.stringify({ items: [{ id: 'a', label: 'A' }] });
  const result = sanitizeMetaphorDsl(input, { allowStructureRewrite: true });
  assert.equal(result.dsl?.metaphor, 'city');
  assert.ok(result.applied.includes('default-metaphor-city'));
});

test('sanitizeMetaphorDsl refuses structural rewrite when disabled', () => {
  const input = JSON.stringify({ items: [] });
  const result = sanitizeMetaphorDsl(input, { allowStructureRewrite: false });
  assert.equal(result.dsl, null);
});

test('sanitizeMetaphorDsl drops malformed items', () => {
  const input = JSON.stringify({
    metaphor: 'city',
    items: [
      { id: 'good', label: 'Good' },
      { label: 'Missing id' },
      'not an object',
      { id: 'also-good', label: 'Also Good' }
    ]
  });
  const result = sanitizeMetaphorDsl(input);
  assert.equal(result.dsl?.items.length, 2);
  assert.ok(result.applied.includes('drop-malformed-items'));
});

test('sanitizeMetaphorDsl caps city items at CITY_MAX_ITEMS', () => {
  const items = Array.from({ length: CITY_MAX_ITEMS + 10 }, (_, i) => ({
    id: `s${i}`,
    label: `Service ${i}`
  }));
  const input = JSON.stringify({ metaphor: 'city', items });
  const result = sanitizeMetaphorDsl(input);
  assert.equal(result.dsl?.items.length, CITY_MAX_ITEMS);
  assert.ok(result.applied.includes('cap-items'));
});

test('MetaphorDslSchema parses a layercake DSL with components', () => {
  const dsl = MetaphorDslSchema.parse({
    metaphor: 'layercake',
    scene: { theme: 'noir', camera: 'isometric' },
    items: [
      { id: 'db', label: 'Database', thickness: 2, components: ['postgres', 'redis'] },
      { id: 'app', label: 'App', thickness: 3 }
    ]
  });
  assert.equal(dsl.metaphor, 'layercake');
  if (dsl.metaphor === 'layercake') {
    assert.equal(dsl.items[0].components.length, 2);
    assert.equal(dsl.items[1].components.length, 0);
  }
});

test('GalaxyMetaphorSchema accepts cluster grouping', () => {
  const dsl = GalaxyMetaphorSchema.parse({
    metaphor: 'galaxy',
    scene: {},
    items: [{ id: 's1', label: 'S1', magnitude: 3, cluster: 'core' }]
  });
  assert.equal(dsl.items[0].cluster, 'core');
});

test('MetaphorDslSchema rejects invalid metaphor discriminator', () => {
  const result = MetaphorDslSchema.safeParse({ metaphor: 'unknown-shape', items: [] });
  assert.equal(result.success, false);
});

test('MetaphorDslSchema parses a tree DSL with parents', () => {
  const dsl = MetaphorDslSchema.parse({
    metaphor: 'tree',
    scene: {},
    items: [
      { id: 'ceo', label: 'CEO', weight: 8 },
      { id: 'cto', label: 'CTO', parent: 'ceo', weight: 5 },
      { id: 'lead', label: 'Lead', parent: 'cto', weight: 3 }
    ]
  });
  assert.equal(dsl.metaphor, 'tree');
  if (dsl.metaphor === 'tree') {
    assert.equal(dsl.items.length, 3);
    assert.equal(dsl.items[1].parent, 'ceo');
  }
});

test('sanitizeMetaphorDsl breaks tree cycles', () => {
  const input = JSON.stringify({
    metaphor: 'tree',
    items: [
      { id: 'a', label: 'A', parent: 'b' },
      { id: 'b', label: 'B', parent: 'a' }
    ]
  });
  const result = sanitizeMetaphorDsl(input);
  assert.ok(result.dsl);
  if (result.dsl?.metaphor === 'tree') {
    const withParents = result.dsl.items.filter((it) => typeof it.parent === 'string');
    assert.ok(withParents.length < 2, 'cycle should have been broken');
  }
  assert.ok(result.applied.includes('break-tree-cycle'));
});

test('sanitizeMetaphorDsl clears orphan tree parents to root', () => {
  const input = JSON.stringify({
    metaphor: 'tree',
    items: [
      { id: 'root', label: 'Root' },
      { id: 'child', label: 'Child', parent: 'nope' }
    ]
  });
  const result = sanitizeMetaphorDsl(input);
  assert.ok(result.dsl);
  if (result.dsl?.metaphor === 'tree') {
    const child = result.dsl.items.find((it) => it.id === 'child');
    assert.equal(child?.parent, undefined);
  }
  assert.ok(result.applied.includes('orphan-parent-to-root'));
});

test('sanitizeMetaphorDsl breaks tree self-parent', () => {
  const input = JSON.stringify({
    metaphor: 'tree',
    items: [{ id: 'self', label: 'Self', parent: 'self' }]
  });
  const result = sanitizeMetaphorDsl(input);
  assert.ok(result.dsl);
  assert.ok(result.applied.includes('break-tree-self-parent'));
});

test('MetaphorDslSchema parses a terrain DSL with surface metadata', () => {
  const dsl = MetaphorDslSchema.parse({
    metaphor: 'terrain',
    scene: { surface: { metric: 'risk', baseline: 0 } },
    items: [
      { id: 'payments', label: 'Payments', elevation: 14, intensity: 4 },
      { id: 'search', label: 'Search', elevation: 2, intensity: 3 }
    ]
  });
  assert.equal(dsl.metaphor, 'terrain');
  if (dsl.metaphor === 'terrain') {
    assert.equal(dsl.scene.surface?.metric, 'risk');
    assert.equal(dsl.items[0].elevation, 14);
  }
});

test('sanitizeMetaphorDsl clamps terrain elevation and intensity', () => {
  const input = JSON.stringify({
    metaphor: 'terrain',
    items: [
      { id: 'high', label: 'High', elevation: 50, intensity: 20 },
      { id: 'low', label: 'Low', elevation: -30, intensity: 0.01 }
    ]
  });
  const result = sanitizeMetaphorDsl(input);
  assert.ok(result.dsl);
  if (result.dsl?.metaphor === 'terrain') {
    assert.equal(result.dsl.items[0].elevation, 20);
    assert.equal(result.dsl.items[0].intensity, 10);
    assert.equal(result.dsl.items[1].elevation, -10);
    assert.equal(result.dsl.items[1].intensity, 0.1);
  }
  assert.ok(result.applied.includes('clamp-elevation'));
  assert.ok(result.applied.includes('clamp-intensity'));
});

test('CityItemSchema accepts new lighting and condition fields', () => {
  const dsl = MetaphorDslSchema.parse({
    metaphor: 'city',
    scene: {},
    items: [
      { id: 'svc', label: 'Svc', height: 5, footprint: 2, lighting: 'lit', condition: 'aging' }
    ]
  });
  if (dsl.metaphor === 'city') {
    assert.equal(dsl.items[0].lighting, 'lit');
    assert.equal(dsl.items[0].condition, 'aging');
  }
});

test('sanitizeMetaphorDsl normalizes city lighting/condition case and drops invalid values', () => {
  const input = JSON.stringify({
    metaphor: 'city',
    items: [
      { id: 'a', label: 'A', lighting: 'LIT', condition: 'Aging' },
      { id: 'b', label: 'B', lighting: 'glowing', condition: 'haunted' }
    ]
  });
  const result = sanitizeMetaphorDsl(input);
  assert.ok(result.dsl);
  if (result.dsl?.metaphor === 'city') {
    assert.equal(result.dsl.items[0].lighting, 'lit');
    assert.equal(result.dsl.items[0].condition, 'aging');
    assert.equal(result.dsl.items[1].lighting, undefined);
    assert.equal(result.dsl.items[1].condition, undefined);
  }
  assert.ok(result.applied.includes('normalize-lighting-case'));
  assert.ok(result.applied.includes('drop-invalid-lighting'));
});

test('LayercakeSchema accepts cracks and tilt; sanitizer clamps out-of-range values', () => {
  const input = JSON.stringify({
    metaphor: 'layercake',
    items: [{ id: 'l1', label: 'L1', thickness: 1, cracks: 2, tilt: 30 }]
  });
  const result = sanitizeMetaphorDsl(input);
  assert.ok(result.dsl);
  if (result.dsl?.metaphor === 'layercake') {
    assert.equal(result.dsl.items[0].cracks, 1);
    assert.equal(result.dsl.items[0].tilt, 15);
  }
  assert.ok(result.applied.includes('clamp-cracks'));
  assert.ok(result.applied.includes('clamp-tilt'));
});

test('Galaxy binary field is dropped when referencing missing or self', () => {
  const input = JSON.stringify({
    metaphor: 'galaxy',
    items: [
      { id: 'sun', label: 'Sun', magnitude: 4, binary: 'sun' },
      { id: 'moon', label: 'Moon', magnitude: 3, binary: 'ghost' },
      { id: 'pair', label: 'Pair', magnitude: 3, binary: 'sun' }
    ]
  });
  const result = sanitizeMetaphorDsl(input);
  assert.ok(result.dsl);
  if (result.dsl?.metaphor === 'galaxy') {
    assert.equal(result.dsl.items[0].binary, undefined);
    assert.equal(result.dsl.items[1].binary, undefined);
    assert.equal(result.dsl.items[2].binary, 'sun');
  }
  assert.ok(result.applied.includes('drop-orphan-binary'));
});

test('Galaxy scene parses nebula clouds and new blueprint theme/cinematic camera', () => {
  const dsl = MetaphorDslSchema.parse({
    metaphor: 'galaxy',
    scene: {
      theme: 'blueprint',
      camera: 'cinematic',
      nebula: [{ center: [0, 0, 0], radius: 5, color: '#ff00ff' }]
    },
    items: [{ id: 's', label: 'S', magnitude: 3 }]
  });
  if (dsl.metaphor === 'galaxy') {
    assert.equal(dsl.scene.theme, 'blueprint');
    assert.equal(dsl.scene.camera, 'cinematic');
    assert.equal(dsl.scene.nebula?.length, 1);
  }
});

test('MetaphorDslSchema round-trips item.glyph and scene.subtitle/legend', () => {
  const dsl = MetaphorDslSchema.parse({
    metaphor: 'city',
    scene: {
      title: 'Payment platform',
      subtitle: 'Production stack, Aug 2026',
      legend: { height: 'monthly transaction volume', district: 'team' }
    },
    items: [
      { id: 'checkout', label: 'Checkout', height: 18, footprint: 3, glyph: 'service' },
      { id: 'postgres', label: 'Postgres', height: 10, footprint: 4, glyph: 'database' }
    ]
  });
  if (dsl.metaphor === 'city') {
    assert.equal(dsl.scene.subtitle, 'Production stack, Aug 2026');
    assert.equal(dsl.scene.legend?.height, 'monthly transaction volume');
    assert.equal(dsl.scene.legend?.district, 'team');
    assert.equal(dsl.items[0].glyph, 'service');
    assert.equal(dsl.items[1].glyph, 'database');
  }
});

test('MetaphorLegendSchema rejects unknown axis keys (strict)', () => {
  const ok = MetaphorLegendSchema.safeParse({ height: 'x' });
  assert.equal(ok.success, true);
  const bad = MetaphorLegendSchema.safeParse({ height: 'x', bogus: 'y' });
  assert.equal(bad.success, false);
});

test('MetaphorDslSchema rejects unknown glyph value', () => {
  const result = MetaphorDslSchema.safeParse({
    metaphor: 'city',
    scene: {},
    items: [{ id: 'a', label: 'A', glyph: 'imaginary-thing' }]
  });
  assert.equal(result.success, false);
});

test('sanitizeMetaphorDsl drops unknown item glyph and records drop-invalid-glyph', () => {
  const input = JSON.stringify({
    metaphor: 'city',
    items: [
      { id: 'a', label: 'A', glyph: 'imaginary-thing' },
      { id: 'b', label: 'B', glyph: 'database' }
    ]
  });
  const result = sanitizeMetaphorDsl(input);
  assert.ok(result.dsl);
  if (result.dsl?.metaphor === 'city') {
    assert.equal(result.dsl.items[0].glyph, undefined);
    assert.equal(result.dsl.items[1].glyph, 'database');
  }
  assert.ok(result.applied.includes('drop-invalid-glyph'));
});

test('sanitizeMetaphorDsl normalizes mixed-case glyph values', () => {
  const input = JSON.stringify({
    metaphor: 'city',
    items: [{ id: 'a', label: 'A', glyph: 'DataBase' }]
  });
  const result = sanitizeMetaphorDsl(input);
  assert.ok(result.dsl);
  if (result.dsl?.metaphor === 'city') {
    assert.equal(result.dsl.items[0].glyph, 'database');
  }
  assert.ok(result.applied.includes('normalize-glyph-case'));
});

test('sanitizeMetaphorDsl drops unknown legend axes without rejecting the DSL', () => {
  const input = JSON.stringify({
    metaphor: 'city',
    scene: {
      title: 'X',
      legend: { height: 'h', mystery: 'y', district: 'd' }
    },
    items: [{ id: 'a', label: 'A' }]
  });
  const result = sanitizeMetaphorDsl(input);
  assert.ok(result.dsl);
  if (result.dsl?.metaphor === 'city') {
    assert.equal(result.dsl.scene.legend?.height, 'h');
    assert.equal(result.dsl.scene.legend?.district, 'd');
    assert.equal(
      (result.dsl.scene.legend as Record<string, unknown>).mystery,
      undefined
    );
  }
  assert.ok(result.applied.includes('drop-invalid-legend-axis'));
});

test('METAPHOR_GLYPH_KINDS contains a stable, deduplicated list', () => {
  const set = new Set(METAPHOR_GLYPH_KINDS);
  assert.equal(set.size, METAPHOR_GLYPH_KINDS.length, 'glyph kinds must be unique');
  assert.ok(METAPHOR_GLYPH_KINDS.length >= 20, 'expected at least 20 curated glyph kinds');
  for (const k of METAPHOR_GLYPH_KINDS) {
    assert.equal(typeof k, 'string');
    assert.match(k, /^[a-z][a-z0-9-]*$/);
  }
});
