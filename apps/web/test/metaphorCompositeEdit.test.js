import { describe, expect, it } from 'vitest';
import { sanitizeMetaphorDsl } from '@archislop/shared';
import {
  addCompositeLayer,
  addLinkedCompositeNode,
  compositeGraphAllowsLink,
  connectCompositeNodes,
  deleteCompositeEdge,
  deleteCompositeNode,
  isCompositeFamilySource,
  removeCompositeLayer,
  renameCompositeEdge,
  renameCompositeNode
} from '../src/utils/metaphorCompositeEdit.js';

const COMPOSITE = JSON.stringify(
  {
    metaphor: 'composite',
    scene: { theme: 'whiteboard', camera: 'orbit' },
    layout: 'fused',
    seed: 0,
    novelty: 0.55,
    motionIntensity: 0.65,
    layers: [
      {
        id: 'platform',
        as: 'city',
        label: 'Platform',
        items: [
          { id: 'auth', label: 'Auth', height: 12, footprint: 3, district: 'Core' },
          { id: 'api', label: 'API Gateway', height: 18, footprint: 4, district: 'Core' }
        ]
      },
      {
        id: 'domains',
        as: 'archipelago',
        label: 'Domains',
        items: [
          { id: 'checkout', label: 'Checkout', mass: 8, chain: 'Buy' },
          { id: 'discover', label: 'Discover', mass: 5, chain: 'Browse' }
        ]
      }
    ],
    items: [],
    links: [{ from: 'auth', to: 'api' }]
  },
  null,
  2
);

describe('isCompositeFamilySource', () => {
  it('recognises composite metaphor JSON with layers', () => {
    expect(isCompositeFamilySource(COMPOSITE)).toBe(true);
    expect(isCompositeFamilySource('{"metaphor":"city","items":[]}')).toBe(false);
    expect(isCompositeFamilySource('{"metaphor":"composite","layers":[]}')).toBe(false);
    expect(isCompositeFamilySource('not json')).toBe(false);
  });
});

describe('compositeGraphAllowsLink', () => {
  it('allows link when at least two items exist across layers', () => {
    expect(compositeGraphAllowsLink(COMPOSITE)).toBe(true);
  });

  it('refuses link for a single-item composite', () => {
    const lone = JSON.stringify({
      metaphor: 'composite',
      scene: {},
      layout: 'fused',
      layers: [
        { id: 'only', as: 'city', items: [{ id: 'a', label: 'A', height: 5, footprint: 2 }] }
      ],
      items: [],
      links: []
    });
    expect(compositeGraphAllowsLink(lone)).toBe(false);
  });
});

describe('metaphor composite graph edit', () => {
  it('adds a sibling in the selected layer and re-ids on global collision', () => {
    const withCollision = JSON.stringify({
      metaphor: 'composite',
      scene: {},
      layout: 'fused',
      layers: [
        {
          id: 'a',
          as: 'city',
          items: [{ id: 'auth', label: 'Auth', height: 10, footprint: 2 }]
        },
        {
          id: 'b',
          as: 'garden',
          items: [{ id: 'n1', label: 'Existing', maturity: 0.5, impact: 0.5, health: 0.5 }]
        }
      ],
      items: [],
      links: []
    });
    const result = addLinkedCompositeNode(withCollision, 'auth', 'Billing');
    expect(result).toMatchObject({
      ok: true,
      newId: 'n2',
      newLabel: 'Billing',
      metaphorKind: 'city'
    });
    const parsed = JSON.parse(result.source);
    expect(parsed.layers[0].items.map((item) => item.id)).toEqual(['auth', 'n2']);
    expect(sanitizeMetaphorDsl(result.source).dsl).toBeTruthy();
  });

  it('adds a child in a tree layer', () => {
    const treeComposite = JSON.stringify({
      metaphor: 'composite',
      scene: {},
      layout: 'fused',
      layers: [
        {
          id: 'org',
          as: 'tree',
          items: [{ id: 'ceo', label: 'CEO', weight: 5 }]
        }
      ],
      items: [],
      links: []
    });
    const result = addLinkedCompositeNode(treeComposite, 'ceo', 'Engineering');
    expect(result).toMatchObject({
      ok: true,
      newId: 'n1',
      newLabel: 'Engineering',
      metaphorKind: 'tree'
    });
    const child = JSON.parse(result.source).layers[0].items.find((item) => item.id === 'n1');
    expect(child).toMatchObject({ label: 'Engineering', parent: 'ceo' });
  });

  it('deletes an item and purges composite-level links touching it', () => {
    const result = deleteCompositeNode(COMPOSITE, 'auth');
    expect(result).toMatchObject({ ok: true, metaphorKind: 'city' });
    const parsed = JSON.parse(result.source);
    expect(parsed.layers[0].items.map((item) => item.id)).toEqual(['api']);
    expect(parsed.links).toEqual([]);
  });

  it('refuses to delete the last item in a layer', () => {
    const loneLayer = JSON.stringify({
      metaphor: 'composite',
      scene: {},
      layout: 'fused',
      layers: [{ id: 'solo', as: 'garden', items: [{ id: 'only', label: 'Only', maturity: 0.5 }] }],
      items: [],
      links: []
    });
    expect(deleteCompositeNode(loneLayer, 'only')).toEqual({ ok: false, reason: 'last' });
  });

  it('renames an item in its layer', () => {
    const result = renameCompositeNode(COMPOSITE, 'checkout', 'Payments');
    expect(result.ok).toBe(true);
    const item = JSON.parse(result.source).layers[1].items.find((row) => row.id === 'checkout');
    expect(item.label).toBe('Payments');
  });

  it('connects items across layers on composite links', () => {
    const result = connectCompositeNodes(COMPOSITE, 'api', 'checkout');
    expect(result.ok).toBe(true);
    const links = JSON.parse(result.source).links;
    expect(links).toContainEqual({ from: 'api', to: 'checkout' });
  });

  it('refuses duplicate composite links', () => {
    expect(connectCompositeNodes(COMPOSITE, 'auth', 'api')).toEqual({
      ok: false,
      reason: 'duplicate'
    });
  });

  it('deletes a composite-level link', () => {
    const result = deleteCompositeEdge(COMPOSITE, 'auth', 'api');
    expect(result.ok).toBe(true);
    expect(JSON.parse(result.source).links).toEqual([]);
  });

  it('delegates add/delete/rename to a flat kind layer', () => {
    const machineComposite = JSON.stringify({
      metaphor: 'composite',
      scene: {},
      layout: 'fused',
      layers: [
        {
          id: 'plant',
          as: 'machine',
          items: [
            { id: 'drive', label: 'Drive', size: 4, speed: 5, axle: 'main' },
            { id: 'idle', label: 'Idle', size: 2, speed: 1, axle: 'main' }
          ]
        }
      ],
      items: [],
      links: []
    });
    const added = addLinkedCompositeNode(machineComposite, 'drive', 'Reducer');
    expect(added).toMatchObject({ ok: true, newId: 'n1', metaphorKind: 'machine' });
    expect(JSON.parse(added.source).layers[0].items.map((item) => item.id)).toEqual([
      'drive',
      'n1',
      'idle'
    ]);

    const renamed = renameCompositeNode(added.source, 'n1', 'Gearbox');
    expect(renamed.ok).toBe(true);
    const gear = JSON.parse(renamed.source).layers[0].items.find((row) => row.id === 'n1');
    expect(gear.label).toBe('Gearbox');
  });

  it('purges composite links when a tree delete removes a node', () => {
    const treeComposite = JSON.stringify({
      metaphor: 'composite',
      scene: {},
      layout: 'fused',
      layers: [
        {
          id: 'org',
          as: 'tree',
          items: [
            { id: 'ceo', label: 'CEO', weight: 5 },
            { id: 'eng', label: 'Engineering', parent: 'ceo', weight: 4 },
            { id: 'ops', label: 'Ops', parent: 'ceo', weight: 3 }
          ]
        },
        {
          id: 'platform',
          as: 'city',
          items: [{ id: 'api', label: 'API', height: 10, footprint: 2 }]
        }
      ],
      items: [],
      links: [
        { from: 'eng', to: 'api' },
        { from: 'ceo', to: 'api' }
      ]
    });
    const result = deleteCompositeNode(treeComposite, 'eng');
    expect(result.ok).toBe(true);
    const parsed = JSON.parse(result.source);
    expect(parsed.layers[0].items.map((item) => item.id)).toEqual(['ceo', 'ops']);
    expect(parsed.links).toEqual([{ from: 'ceo', to: 'api' }]);
  });
});

describe('metaphor composite graph edit guards', () => {
  it('refuses connect when fewer than two items exist', () => {
    const lone = JSON.stringify({
      metaphor: 'composite',
      scene: {},
      layout: 'fused',
      layers: [
        { id: 'solo', as: 'city', items: [{ id: 'only', label: 'Only', height: 5, footprint: 2 }] }
      ],
      items: [],
      links: []
    });
    expect(connectCompositeNodes(lone, 'only', 'only')).toEqual({ ok: false, reason: 'no-link' });
  });

  it('refuses self-links and missing endpoints', () => {
    expect(connectCompositeNodes(COMPOSITE, 'auth', 'auth')).toEqual({ ok: false, reason: 'self' });
    expect(connectCompositeNodes(COMPOSITE, 'auth', 'missing')).toEqual({
      ok: false,
      reason: 'missing'
    });
  });

  it('refuses add/delete/rename on unknown ids and invalid documents', () => {
    expect(addLinkedCompositeNode(COMPOSITE, 'missing', 'X')).toEqual({
      ok: false,
      reason: 'missing'
    });
    expect(deleteCompositeNode(COMPOSITE, 'missing')).toEqual({ ok: false, reason: 'missing' });
    expect(renameCompositeNode(COMPOSITE, 'missing', 'X')).toEqual({
      ok: false,
      reason: 'missing'
    });
    expect(addLinkedCompositeNode('not json', 'auth', 'X')).toEqual({
      ok: false,
      reason: 'not-graph'
    });
  });

  it('refuses deleting a link that is not present', () => {
    expect(deleteCompositeEdge(COMPOSITE, 'auth', 'checkout')).toEqual({
      ok: false,
      reason: 'missing'
    });
  });

  it('refuses to rename a composite link that does not exist', () => {
    expect(renameCompositeEdge(COMPOSITE, 'auth', 'checkout', 'calls')).toEqual({
      ok: false,
      reason: 'missing'
    });
  });

  it('refuses renameCompositeEdge on invalid documents', () => {
    expect(renameCompositeEdge('not json', 'auth', 'api', 'calls')).toEqual({
      ok: false,
      reason: 'not-graph'
    });
  });
});

describe('renameCompositeEdge', () => {
  it('sets a composite-level link label', () => {
    const result = renameCompositeEdge(COMPOSITE, 'auth', 'api', 'calls');
    expect(result.ok).toBe(true);
    const links = JSON.parse(result.source).links;
    expect(links).toContainEqual({ from: 'auth', to: 'api', label: 'calls' });
  });

  it('clears a composite-level link label when renamed to empty', () => {
    const labeled = JSON.stringify({
      metaphor: 'composite',
      scene: {},
      layout: 'fused',
      layers: [
        { id: 'a', as: 'city', items: [{ id: 'auth', label: 'Auth', height: 10, footprint: 2 }] },
        { id: 'b', as: 'city', items: [{ id: 'api', label: 'API', height: 10, footprint: 2 }] }
      ],
      items: [],
      links: [{ from: 'auth', to: 'api', label: 'calls' }]
    });
    const result = renameCompositeEdge(labeled, 'auth', 'api', '   ');
    expect(result.ok).toBe(true);
    const links = JSON.parse(result.source).links;
    expect(links).toEqual([{ from: 'auth', to: 'api' }]);
  });
});

/** Every item id across every layer of a composite document. */
function allItemIds(doc) {
  return doc.layers.flatMap((layer) => (layer.items ?? []).map((item) => item.id));
}

function twoCityLayers(links = []) {
  return JSON.stringify(
    {
      metaphor: 'composite',
      scene: {},
      layout: 'fused',
      layers: [
        {
          id: 'core',
          as: 'city',
          label: 'Core',
          items: [
            { id: 'auth', label: 'Auth', height: 10, footprint: 2, links: ['api'] },
            { id: 'api', label: 'API', height: 8, footprint: 2 }
          ]
        },
        { id: 'edge', as: 'city', items: [{ id: 'cdn', label: 'CDN', height: 6, footprint: 2 }] }
      ],
      items: [],
      links
    },
    null,
    2
  );
}

describe('layer-level Add (#536)', () => {
  it('duplicates a layer in place, after its origin', () => {
    const result = addCompositeLayer(twoCityLayers(), 0);
    expect(result.ok).toBe(true);
    const doc = JSON.parse(result.source);
    expect(doc.layers.map((layer) => layer.as)).toEqual(['city', 'city', 'city']);
    expect(doc.layers[1].label).toBe('Core');
    expect(doc.layers[1].items).toHaveLength(2);
    expect(result.newLayerId).toBe(doc.layers[1].id);
    expect(result.newLayerId).not.toBe('core');
  });

  it('gives the copy ids that collide with nothing, and rewires its own references', () => {
    const doc = JSON.parse(addCompositeLayer(twoCityLayers(), 0).source);
    const ids = allItemIds(doc);
    // Duplicate ids would not render a second tower, they would make one id
    // ambiguous — and findLayerForItem resolves to the FIRST layer holding an id,
    // so an edit aimed at the copy would silently hit the original.
    expect(new Set(ids).size).toBe(ids.length);
    const [origin, copy] = [doc.layers[0], doc.layers[1]];
    expect(copy.items.map((item) => item.id)).not.toEqual(origin.items.map((item) => item.id));
    // The clone's internal `links` must point at its OWN copies, not the
    // originals it was duplicated from.
    const copyAuth = copy.items[0];
    const copiedIds = copy.items.map((item) => item.id);
    expect(copyAuth.links).toHaveLength(1);
    expect(copiedIds).toContain(copyAuth.links[0]);
    expect(origin.items.map((item) => item.id)).not.toContain(copyAuth.links[0]);
  });

  it('refuses a fifth layer, which the schema would reject anyway', () => {
    let source = twoCityLayers();
    for (let i = 0; i < 2; i += 1) {
      source = addCompositeLayer(source, 0).source;
    }
    expect(JSON.parse(source).layers).toHaveLength(4);
    expect(addCompositeLayer(source, 0)).toMatchObject({ ok: false, reason: 'capacity' });
  });

  it('refuses an out-of-range layer, a non-composite source, and stays valid when it succeeds', () => {
    expect(addCompositeLayer(twoCityLayers(), 9)).toMatchObject({ ok: false, reason: 'missing' });
    expect(addCompositeLayer(twoCityLayers(), -1)).toMatchObject({ ok: false, reason: 'missing' });
    expect(addCompositeLayer('{"metaphor":"city","items":[]}', 0)).toMatchObject({
      ok: false,
      reason: 'not-graph'
    });
    const validated = sanitizeMetaphorDsl(
      addCompositeLayer(twoCityLayers(), 0).source,
      'composite'
    );
    // `sanitizeMetaphorDsl` returns { text, applied, dsl }, not an { ok } verdict,
    // so validity is asserted structurally: the duplicated layer survives a
    // validation round-trip with its fresh ids and per-kind fields intact.
    expect(validated.dsl.layers).toHaveLength(3);
    expect(validated.applied).toEqual([]);
    expect(validated.dsl.layers[1].items.every((item) => typeof item.height === 'number')).toBe(
      true
    );
  });
});

describe('layer-level Remove (#536)', () => {
  it('drops the layer and every link that touched its items', () => {
    const withLink = twoCityLayers([
      { from: 'auth', to: 'cdn', label: 'warms' },
      { from: 'auth', to: 'api', label: 'calls' }
    ]);
    const result = removeCompositeLayer(withLink, 1);
    expect(result.ok).toBe(true);
    expect(result.removedLayerId).toBe('edge');
    expect(result.removedItemCount).toBe(1);
    const doc = JSON.parse(result.source);
    expect(doc.layers.map((layer) => layer.id)).toEqual(['core']);
    // The relation to the deleted node is gone; the unrelated one is not.
    expect(doc.links).toEqual([{ from: 'auth', to: 'api', label: 'calls' }]);
  });

  it('refuses to remove the only layer, and reports a non-layer as missing', () => {
    const single = JSON.stringify({
      metaphor: 'composite',
      scene: {},
      layout: 'fused',
      layers: [
        { id: 'only', as: 'city', items: [{ id: 'a', label: 'A', height: 5, footprint: 2 }] }
      ],
      items: [],
      links: []
    });
    expect(removeCompositeLayer(single, 0)).toMatchObject({ ok: false, reason: 'last' });
    expect(removeCompositeLayer(twoCityLayers(), 7)).toMatchObject({
      ok: false,
      reason: 'missing'
    });
    const validated = sanitizeMetaphorDsl(
      removeCompositeLayer(twoCityLayers(), 1).source,
      'composite'
    );
    expect(validated.dsl.layers).toHaveLength(1);
    expect(validated.applied).toEqual([]);
  });

  it('removes a layer that per-item Delete can only shrink, never retire', () => {
    // What #536 described as a `{ as, items: [] }` husk does not actually occur
    // for these kinds: each delegate refuses its last item, so a layer can be
    // reduced to ONE item and then no further — but it still cannot be removed,
    // which is the real gap. Verified here rather than assumed, because the
    // issue's framing would have led a reader to hunt for a code path that
    // empties a layer, and there isn't one.
    let source = JSON.stringify({
      metaphor: 'composite',
      scene: {},
      layout: 'fused',
      layers: [
        {
          id: 'core',
          as: 'city',
          items: [
            { id: 'a', label: 'A', height: 5, footprint: 2 },
            { id: 'b', label: 'B', height: 5, footprint: 2 }
          ]
        },
        { id: 'spare', as: 'city', items: [{ id: 'c', label: 'C', height: 5, footprint: 2 }] }
      ],
      items: [],
      links: []
    });

    // The spare layer is down to one item, and deleting that item is refused by
    // the city delegate.
    expect(deleteCompositeNode(source, 'c')).toMatchObject({ ok: false });
    source = deleteCompositeNode(source, 'b').source;
    expect(JSON.parse(source).layers.map((l) => l.id)).toEqual(['core', 'spare']);

    // Remove-layer is the only verb that can get rid of it.
    source = removeCompositeLayer(source, 1).source;
    expect(JSON.parse(source).layers.map((l) => l.id)).toEqual(['core']);
  });
});
