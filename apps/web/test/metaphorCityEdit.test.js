import { describe, expect, it } from 'vitest';
import { sanitizeMetaphorDsl } from '@archislop/shared';
import {
  addLinkedCityNode,
  connectCityNodes,
  deleteCityEdge,
  deleteCityNode,
  isCityFamilySource,
  renameCityEdge,
  renameCityNode
} from '../src/utils/metaphorCityEdit.js';

const CITY = JSON.stringify(
  {
    metaphor: 'city',
    scene: { theme: 'whiteboard', camera: 'orbit' },
    items: [
      { id: 'auth', label: 'Auth', height: 12, footprint: 3, district: 'Core' },
      { id: 'api', label: 'API Gateway', height: 18, footprint: 4, district: 'Core' },
      { id: 'db', label: 'Database', height: 8, footprint: 2, district: 'Data' }
    ],
    links: [{ from: 'auth', to: 'api' }]
  },
  null,
  2
);

describe('isCityFamilySource', () => {
  it('recognises city metaphor JSON only', () => {
    expect(isCityFamilySource(CITY)).toBe(true);
    expect(isCityFamilySource('{"metaphor":"tree","items":[]}')).toBe(false);
    expect(isCityFamilySource('not json')).toBe(false);
  });
});

describe('metaphor city graph edit', () => {
  it('adds a sibling item after the selected building', () => {
    const result = addLinkedCityNode(CITY, 'auth', 'Billing');
    expect(result).toMatchObject({ ok: true, newId: 'n1', newLabel: 'Billing' });
    const parsed = JSON.parse(result.source);
    expect(parsed.items.map((item) => item.id)).toEqual(['auth', 'n1', 'api', 'db']);
    expect(parsed.items[1]).toMatchObject({
      id: 'n1',
      label: 'Billing',
      height: 12,
      footprint: 3,
      district: 'Core'
    });
    expect(sanitizeMetaphorDsl(result.source).dsl).toBeTruthy();
  });

  it('deletes a building and its incident links', () => {
    const result = deleteCityNode(CITY, 'auth');
    expect(result.ok).toBe(true);
    const parsed = JSON.parse(result.source);
    expect(parsed.items.map((item) => item.id)).toEqual(['api', 'db']);
    expect(parsed.links).toEqual([]);
  });

  it('refuses to delete the last building', () => {
    const lone = JSON.stringify({
      metaphor: 'city',
      scene: {},
      items: [{ id: 'only', label: 'Only', height: 5, footprint: 2 }],
      links: []
    });
    expect(deleteCityNode(lone, 'only')).toEqual({ ok: false, reason: 'last' });
  });

  it('renames a building label', () => {
    const result = renameCityNode(CITY, 'db', 'Primary DB');
    expect(result.ok).toBe(true);
    const item = JSON.parse(result.source).items.find((row) => row.id === 'db');
    expect(item.label).toBe('Primary DB');
  });

  it('refuses empty rename labels', () => {
    expect(renameCityNode(CITY, 'db', '   ')).toEqual({ ok: false, reason: 'empty' });
  });

  it('connects two buildings with a new link', () => {
    const result = connectCityNodes(CITY, 'api', 'db');
    expect(result.ok).toBe(true);
    const links = JSON.parse(result.source).links;
    expect(links).toContainEqual({ from: 'api', to: 'db' });
  });

  it('refuses duplicate, self, and missing links', () => {
    expect(connectCityNodes(CITY, 'auth', 'auth')).toEqual({ ok: false, reason: 'self' });
    expect(connectCityNodes(CITY, 'auth', 'api')).toEqual({ ok: false, reason: 'duplicate' });
    expect(connectCityNodes(CITY, 'auth', 'missing')).toEqual({ ok: false, reason: 'missing' });
  });

  it('deletes a link edge', () => {
    const result = deleteCityEdge(CITY, 'auth', 'api');
    expect(result.ok).toBe(true);
    expect(JSON.parse(result.source).links).toEqual([]);
  });

  it('does not support rename edge', () => {
    expect(renameCityEdge(CITY, 'auth', 'api', 'calls')).toEqual({
      ok: false,
      reason: 'not-graph'
    });
  });
});

describe('metaphor city edit guards', () => {
  const tree = '{"metaphor":"tree","items":[]}';

  it('rejects non-city sources', () => {
    expect(addLinkedCityNode(tree, 'a')).toEqual({ ok: false, reason: 'not-city' });
    expect(deleteCityNode(tree, 'a')).toEqual({ ok: false, reason: 'not-city' });
    expect(renameCityNode(tree, 'a', 'x')).toEqual({ ok: false, reason: 'not-city' });
    expect(connectCityNodes(tree, 'a', 'b')).toEqual({ ok: false, reason: 'not-city' });
  });
});
