import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CITY_MAX_ITEMS,
  GalaxyMetaphorSchema,
  MetaphorDslSchema,
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
  const result = MetaphorDslSchema.safeParse({ metaphor: 'tree', items: [] });
  assert.equal(result.success, false);
});
