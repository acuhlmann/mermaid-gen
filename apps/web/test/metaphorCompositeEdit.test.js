import { describe, expect, it } from 'vitest';
import { sanitizeMetaphorDsl } from '@archislop/shared';
import {
  addLinkedCompositeNode,
  compositeGraphAllowsLink,
  connectCompositeNodes,
  deleteCompositeEdge,
  deleteCompositeNode,
  isCompositeFamilySource,
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
});
