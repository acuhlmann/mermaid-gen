import { describe, expect, it } from 'vitest';
import {
  allocateFlatItemId,
  allocateFlatItemLabel,
  appendLink,
  deleteLinkedEdge,
  fail,
  findLinkedEdge,
  hasDirectedLink,
  insertSiblingAfter,
  isMetaphorFlatSource,
  itemsById,
  ok,
  parseMetaphorFlatDoc,
  purgeLinksForNode,
  renameLinkedEdge,
  serializeMetaphorFlatDoc
} from '../src/utils/metaphorFlatItemsCore.js';

const MACHINE = JSON.stringify(
  {
    metaphor: 'machine',
    items: [
      { id: 'drive', label: 'Drive', size: 4 },
      { id: 'idle', label: 'Idle', size: 2 }
    ],
    links: [{ from: 'drive', to: 'idle' }]
  },
  null,
  2
);

describe('metaphorFlatItemsCore result helpers', () => {
  it('builds ok/fail envelopes', () => {
    expect(ok('src', { newId: 'n1' })).toEqual({ ok: true, source: 'src', newId: 'n1' });
    expect(fail('missing')).toEqual({ ok: false, reason: 'missing' });
  });
});

describe('isMetaphorFlatSource', () => {
  it('accepts matching metaphor scenes with items[]', () => {
    expect(isMetaphorFlatSource(MACHINE, 'machine')).toBe(true);
    expect(isMetaphorFlatSource(MACHINE, 'galaxy')).toBe(false);
    expect(isMetaphorFlatSource('not json', 'machine')).toBe(false);
    expect(isMetaphorFlatSource(JSON.stringify({ metaphor: 'machine' }), 'machine')).toBe(false);
  });
});

describe('parseMetaphorFlatDoc', () => {
  it('returns the parsed doc for a matching kind', () => {
    const doc = parseMetaphorFlatDoc(MACHINE, 'machine');
    expect(doc?.metaphor).toBe('machine');
    expect(doc?.items).toHaveLength(2);
  });

  it('returns null for the wrong kind or invalid JSON', () => {
    expect(parseMetaphorFlatDoc(MACHINE, 'galaxy')).toBeNull();
    expect(parseMetaphorFlatDoc('{bad', 'machine')).toBeNull();
  });
});

describe('serializeMetaphorFlatDoc', () => {
  it('preserves a trailing newline from the original source', () => {
    const doc = parseMetaphorFlatDoc(`${MACHINE}\n`, 'machine');
    expect(serializeMetaphorFlatDoc(doc, `${MACHINE}\n`)).toMatch(/\n$/);
    expect(serializeMetaphorFlatDoc(doc, MACHINE)).not.toMatch(/\n$/);
  });
});

describe('itemsById', () => {
  it('indexes only items with string ids', () => {
    const doc = parseMetaphorFlatDoc(MACHINE, 'machine');
    const ids = itemsById(doc);
    expect([...ids.keys()]).toEqual(['drive', 'idle']);
    doc.items.push({ label: 'No id' }, { id: 42, label: 'Bad' });
    expect([...itemsById(doc).keys()]).toEqual(['drive', 'idle']);
  });
});

describe('allocateFlatItemId', () => {
  it('skips ids already present', () => {
    const doc = parseMetaphorFlatDoc(
      JSON.stringify({
        metaphor: 'machine',
        items: [
          { id: 'n1', label: 'One' },
          { id: 'n2', label: 'Two' }
        ]
      }),
      'machine'
    );
    expect(allocateFlatItemId(doc)).toBe('n3');
  });
});

describe('allocateFlatItemLabel', () => {
  it('avoids colliding with existing labels', () => {
    const doc = parseMetaphorFlatDoc(
      JSON.stringify({
        metaphor: 'machine',
        items: [
          { id: 'a', label: 'Item 1' },
          { id: 'b', label: 'Item 2' }
        ]
      }),
      'machine'
    );
    expect(allocateFlatItemLabel(doc)).toBe('Item 3');
  });
});

describe('insertSiblingAfter', () => {
  it('inserts after the anchor and appends when the anchor is missing', () => {
    const doc = parseMetaphorFlatDoc(MACHINE, 'machine');
    const newItem = { id: 'n1', label: 'Reducer' };
    expect(insertSiblingAfter(doc, 'drive', newItem)).toBe(1);
    expect(doc.items.map((item) => item.id)).toEqual(['drive', 'n1', 'idle']);

    const tail = { id: 'n2', label: 'Tail' };
    expect(insertSiblingAfter(doc, 'missing', tail)).toBe(3);
    expect(doc.items.at(-1)).toEqual(tail);
  });
});

describe('link helpers', () => {
  it('tracks directed links and purges both endpoints on delete', () => {
    const doc = parseMetaphorFlatDoc(MACHINE, 'machine');
    expect(hasDirectedLink(doc, 'drive', 'idle')).toBe(true);
    expect(hasDirectedLink(doc, 'idle', 'drive')).toBe(false);

    appendLink(doc, 'idle', 'drive');
    expect(hasDirectedLink(doc, 'idle', 'drive')).toBe(true);

    purgeLinksForNode(doc, 'drive');
    expect(doc.links).toEqual([]);
  });

  it('initializes links[] when purging from a doc with no links', () => {
    const doc = parseMetaphorFlatDoc(
      JSON.stringify({ metaphor: 'machine', items: [{ id: 'only', label: 'Only' }] }),
      'machine'
    );
    purgeLinksForNode(doc, 'only');
    expect(doc.links).toEqual([]);
  });
});

describe('findLinkedEdge', () => {
  it('finds a directed link and returns null when absent or unlinked', () => {
    const doc = parseMetaphorFlatDoc(MACHINE, 'machine');
    expect(findLinkedEdge(doc, 'drive', 'idle')).toEqual({ from: 'drive', to: 'idle' });
    expect(findLinkedEdge(doc, 'idle', 'drive')).toBeNull();

    const noLinks = parseMetaphorFlatDoc(
      JSON.stringify({ metaphor: 'machine', items: [{ id: 'only', label: 'Only' }] }),
      'machine'
    );
    expect(findLinkedEdge(noLinks, 'a', 'b')).toBeNull();
  });
});

describe('deleteLinkedEdge', () => {
  it('removes the matching link and fails when it is absent', () => {
    const doc = parseMetaphorFlatDoc(MACHINE, 'machine');
    const result = deleteLinkedEdge(doc, MACHINE, 'drive', 'idle');
    expect(result.ok).toBe(true);
    expect(doc.links).toEqual([]);
    expect(JSON.parse(result.source).links).toEqual([]);

    expect(deleteLinkedEdge(doc, MACHINE, 'drive', 'idle')).toEqual({
      ok: false,
      reason: 'missing'
    });
  });

  it('fails when the doc has no links array', () => {
    const doc = parseMetaphorFlatDoc(
      JSON.stringify({ metaphor: 'machine', items: [{ id: 'only', label: 'Only' }] }),
      'machine'
    );
    expect(deleteLinkedEdge(doc, MACHINE, 'a', 'b')).toEqual({ ok: false, reason: 'missing' });
  });
});

describe('renameLinkedEdge', () => {
  it('sets a link label and clears it when renamed to blank', () => {
    const doc = parseMetaphorFlatDoc(MACHINE, 'machine');
    const renamed = renameLinkedEdge(doc, MACHINE, 'drive', 'idle', 'drives');
    expect(renamed.ok).toBe(true);
    expect(doc.links).toContainEqual({ from: 'drive', to: 'idle', label: 'drives' });

    const cleared = renameLinkedEdge(doc, renamed.source, 'drive', 'idle', '   ');
    expect(cleared.ok).toBe(true);
    expect(doc.links).toEqual([{ from: 'drive', to: 'idle' }]);
  });

  it('fails to rename a link that does not exist', () => {
    const doc = parseMetaphorFlatDoc(MACHINE, 'machine');
    expect(renameLinkedEdge(doc, MACHINE, 'idle', 'drive', 'x')).toEqual({
      ok: false,
      reason: 'missing'
    });
  });
});
