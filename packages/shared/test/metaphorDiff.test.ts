import test from 'node:test';
import assert from 'node:assert/strict';
import { diffMetaphorSources } from '../src/metaphorDiff.js';

const baseScene = JSON.stringify({
  metaphor: 'city',
  scene: { theme: 'whiteboard', camera: 'orbit' },
  items: [
    { id: 'api', label: 'API', height: 4, footprint: 2 },
    { id: 'db', label: 'Database', height: 3, footprint: 2 }
  ],
  links: []
});

test('diffMetaphorSources detects added, modified, and removed items by id', () => {
  const next = JSON.stringify({
    metaphor: 'city',
    scene: { theme: 'whiteboard', camera: 'orbit' },
    items: [
      { id: 'api', label: 'API Gateway', height: 4, footprint: 2 },
      { id: 'cache', label: 'Cache', height: 2, footprint: 1.5 }
    ],
    links: []
  });

  const diff = diffMetaphorSources(baseScene, next);
  assert.deepEqual(diff.modifiedIds, ['api']);
  assert.deepEqual(diff.addedIds, ['cache']);
  assert.deepEqual(diff.removedIds, ['db']);
});

test('diffMetaphorSources includes composite layer items and detects layer moves', () => {
  const before = JSON.stringify({
    metaphor: 'composite',
    layout: 'fused',
    scene: {},
    layers: [
      {
        id: 'domains',
        as: 'archipelago',
        items: [{ id: 'checkout', label: 'Checkout', mass: 8 }]
      },
      {
        id: 'services',
        as: 'city',
        items: [{ id: 'api', label: 'API', height: 6 }]
      }
    ],
    items: [],
    links: []
  });
  const after = JSON.stringify({
    metaphor: 'composite',
    layout: 'fused',
    scene: {},
    layers: [
      {
        id: 'domains',
        as: 'archipelago',
        items: [{ id: 'checkout', label: 'Checkout', mass: 10 }]
      },
      {
        id: 'journey',
        as: 'river',
        items: [
          { id: 'api', label: 'API', stage: 1, flow: 6 },
          { id: 'delivery', label: 'Delivery', stage: 2, flow: 4 }
        ]
      }
    ],
    items: [],
    links: []
  });

  const diff = diffMetaphorSources(before, after);
  assert.deepEqual(diff.addedIds, ['delivery']);
  assert.deepEqual(diff.modifiedIds, ['api', 'checkout']);
  assert.deepEqual(diff.removedIds, []);
});
