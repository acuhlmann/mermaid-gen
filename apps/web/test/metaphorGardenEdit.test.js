import { describe, expect, it } from 'vitest';
import { sanitizeMetaphorDsl } from '@archislop/shared';
import {
  addLinkedGardenNode,
  connectGardenNodes,
  deleteGardenEdge,
  deleteGardenNode,
  isGardenFamilySource,
  renameGardenNode
} from '../src/utils/metaphorGardenEdit.js';

const GARDEN = JSON.stringify(
  {
    metaphor: 'garden',
    scene: { theme: 'whiteboard', camera: 'orbit' },
    items: [
      {
        id: 'signup',
        label: 'Signup',
        maturity: 0.8,
        impact: 5,
        bed: 'Growth',
        health: 'thriving'
      },
      {
        id: 'checkout',
        label: 'Checkout',
        maturity: 0.4,
        impact: 4,
        bed: 'Growth',
        health: 'steady'
      },
      { id: 'support', label: 'Support', maturity: 0.6, impact: 3, bed: 'Care', health: 'at-risk' }
    ],
    links: []
  },
  null,
  2
);

describe('isGardenFamilySource', () => {
  it('recognises garden metaphor JSON only', () => {
    expect(isGardenFamilySource(GARDEN)).toBe(true);
    expect(isGardenFamilySource('{"metaphor":"city","items":[]}')).toBe(false);
    expect(isGardenFamilySource('not json')).toBe(false);
  });
});

describe('metaphor garden graph edit', () => {
  it('adds a sibling plant after the selected item', () => {
    const result = addLinkedGardenNode(GARDEN, 'signup', 'Referrals');
    expect(result).toMatchObject({ ok: true, newId: 'n1', newLabel: 'Referrals' });
    const parsed = JSON.parse(result.source);
    expect(parsed.items.map((item) => item.id)).toEqual(['signup', 'n1', 'checkout', 'support']);
    expect(parsed.items[1]).toMatchObject({
      id: 'n1',
      label: 'Referrals',
      maturity: 0.8,
      impact: 5,
      bed: 'Growth',
      health: 'thriving'
    });
    expect(sanitizeMetaphorDsl(result.source).dsl).toBeTruthy();
  });

  it('deletes a plant', () => {
    const result = deleteGardenNode(GARDEN, 'support');
    expect(result.ok).toBe(true);
    expect(JSON.parse(result.source).items.map((item) => item.id)).toEqual(['signup', 'checkout']);
  });

  it('refuses to delete the last plant', () => {
    const lone = JSON.stringify({
      metaphor: 'garden',
      scene: {},
      items: [{ id: 'only', label: 'Only', maturity: 0.5, impact: 2, health: 'steady' }],
      links: []
    });
    expect(deleteGardenNode(lone, 'only')).toEqual({ ok: false, reason: 'last' });
  });

  it('renames a plant label', () => {
    const result = renameGardenNode(GARDEN, 'checkout', 'Cart');
    expect(result.ok).toBe(true);
    const item = JSON.parse(result.source).items.find((row) => row.id === 'checkout');
    expect(item.label).toBe('Cart');
  });

  it('refuses empty rename labels', () => {
    expect(renameGardenNode(GARDEN, 'checkout', '   ')).toEqual({ ok: false, reason: 'empty' });
  });

  it('does not support link verbs', () => {
    expect(connectGardenNodes(GARDEN, 'signup', 'checkout')).toEqual({
      ok: false,
      reason: 'no-link'
    });
    expect(deleteGardenEdge(GARDEN, 'signup', 'checkout')).toEqual({
      ok: false,
      reason: 'not-graph'
    });
  });
});

describe('metaphor garden edit guards', () => {
  const city = '{"metaphor":"city","items":[]}';

  it('rejects non-garden sources', () => {
    expect(addLinkedGardenNode(city, 'a')).toEqual({ ok: false, reason: 'not-garden' });
    expect(deleteGardenNode(city, 'a')).toEqual({ ok: false, reason: 'not-garden' });
    expect(renameGardenNode(city, 'a', 'x')).toEqual({ ok: false, reason: 'not-garden' });
  });
});
