import { describe, expect, it } from 'vitest';
import { sanitizeMetaphorDsl } from '@archislop/shared';
import {
  addLinkedCompositeNode,
  compositeGraphAllowsLink,
  connectCompositeNodes,
  deleteCompositeEdge,
  deleteCompositeNode,
  isCompositeFamilySource,
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
