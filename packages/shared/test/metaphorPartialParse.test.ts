import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parsePartialMetaphorDsl,
  partialToRenderableMetaphorDsl
} from '../src/metaphorPartialParse.js';

test('parsePartialMetaphorDsl returns complete items from partial JSON', () => {
  const raw = `{"metaphor":"city","scene":{"theme":"whiteboard"},"items":[{"id":"a","label":"Alpha","height":5`;
  const partial = parsePartialMetaphorDsl(raw);
  assert.ok(partial);
  assert.equal(partial!.metaphor, 'city');
  assert.equal(partial!.scene?.theme, 'whiteboard');
  assert.equal(partial!.items.length, 0);
});

test('parsePartialMetaphorDsl accumulates items as objects complete', () => {
  const raw = `{"metaphor":"city","items":[{"id":"a","label":"Alpha","height":5},{"id":"b","label":"Beta","height":3},{"id":"c","label":"Gam`;
  const partial = parsePartialMetaphorDsl(raw);
  assert.ok(partial);
  assert.equal(partial!.items.length, 2);
  assert.equal(partial!.items[0]!.id, 'a');
  assert.equal(partial!.items[1]!.id, 'b');
});

test('parsePartialMetaphorDsl parses full JSON', () => {
  const raw = JSON.stringify({
    metaphor: 'city',
    scene: { theme: 'noir', camera: 'orbit' },
    items: [{ id: 'x', label: 'X', height: 4 }]
  });
  const partial = parsePartialMetaphorDsl(raw);
  assert.ok(partial);
  assert.equal(partial!.items.length, 1);
  assert.equal(partial!.scene?.theme, 'noir');
});

test('partialToRenderableMetaphorDsl requires metaphor', () => {
  assert.equal(partialToRenderableMetaphorDsl({ items: [], links: [] }), null);
  const dsl = partialToRenderableMetaphorDsl({
    metaphor: 'galaxy',
    scene: { theme: 'arcade' },
    items: [{ id: 's1', label: 'Star', magnitude: 3 }],
    links: []
  });
  assert.ok(dsl);
  assert.equal(dsl!.metaphor, 'galaxy');
  assert.deepEqual(dsl!.links, []);
});

test('parsePartialMetaphorDsl accumulates complete links during streaming', () => {
  const raw = `{"metaphor":"city","items":[{"id":"a","label":"A"},{"id":"b","label":"B"}],"links":[{"from":"a","to":"b","label":"calls"},{"from":"b","to":"c`;
  const partial = parsePartialMetaphorDsl(raw);
  assert.ok(partial);
  assert.equal(partial!.links.length, 1);
  assert.equal(partial!.links[0]!.from, 'a');
});

test('parsePartialMetaphorDsl returns null for empty input', () => {
  assert.equal(parsePartialMetaphorDsl(''), null);
  assert.equal(parsePartialMetaphorDsl('   '), null);
});

test('parsePartialMetaphorDsl accepts tree and terrain kinds', () => {
  const tree = parsePartialMetaphorDsl(
    '{"metaphor":"tree","items":[{"id":"root","label":"Root","weight":4}'
  );
  assert.ok(tree);
  assert.equal(tree!.metaphor, 'tree');

  const terrain = parsePartialMetaphorDsl(
    '{"metaphor":"terrain","scene":{"theme":"blueprint","camera":"cinematic"},"items":[{"id":"a","label":"A","elevation":5}'
  );
  assert.ok(terrain);
  assert.equal(terrain!.metaphor, 'terrain');
  assert.equal(terrain!.scene?.theme, 'blueprint');
  assert.equal(terrain!.scene?.camera, 'cinematic');
});

test('parsePartialMetaphorDsl surfaces item.glyph on completed items during streaming', () => {
  const raw =
    '{"metaphor":"city","items":[{"id":"a","label":"A","glyph":"database"},{"id":"b","label":"B","glyph":"queue"},{"id":"c","label":"Gam';
  const partial = parsePartialMetaphorDsl(raw);
  assert.ok(partial);
  assert.equal(partial!.items.length, 2);
  assert.equal((partial!.items[0] as { glyph?: string }).glyph, 'database');
  assert.equal((partial!.items[1] as { glyph?: string }).glyph, 'queue');
});

test('parsePartialMetaphorDsl streams complete composite layers and planner controls', () => {
  const raw =
    '{"metaphor":"composite","layout":"fused","seed":"festival-v1","novelty":0.7,"motionIntensity":0.6,"layers":[{"id":"grounds","as":"archipelago","items":[{"id":"main-stage","label":"Main Stage","mass":8}]},{"id":"flow","as":"river","items":[{"id":"arrival","label":"Arrival"';
  const partial = parsePartialMetaphorDsl(raw);
  assert.ok(partial);
  assert.equal(partial!.metaphor, 'composite');
  assert.equal(partial!.layout, 'fused');
  assert.equal(partial!.seed, 'festival-v1');
  assert.equal(partial!.novelty, 0.7);
  assert.equal(partial!.motionIntensity, 0.6);
  assert.equal(partial!.layers?.length, 1);
  assert.equal(partial!.layers?.[0]?.id, 'grounds');

  const renderable = partialToRenderableMetaphorDsl(partial!);
  assert.ok(renderable);
  assert.equal(renderable!.metaphor, 'composite');
  assert.deepEqual(renderable!.items, []);
  assert.equal((renderable!.layers as unknown[]).length, 1);
});

test('parsePartialMetaphorDsl preserves full composite layers instead of top-level empty items', () => {
  const raw = JSON.stringify({
    metaphor: 'composite',
    layout: 'fused',
    seed: 42,
    layers: [
      {
        id: 'services',
        as: 'city',
        items: [{ id: 'api', label: 'API', height: 8 }]
      }
    ],
    items: [],
    links: []
  });
  const partial = parsePartialMetaphorDsl(raw);
  assert.ok(partial);
  assert.equal(partial!.items.length, 0);
  assert.equal(partial!.layers?.length, 1);
  assert.equal(partial!.seed, 42);
});
