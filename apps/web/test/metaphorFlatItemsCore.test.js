import { describe, expect, it } from 'vitest';
import { METAPHOR_KINDS, switchMetaphorKind } from '../src/utils/switchMetaphorKind.js';
import { MAGNITUDE_DOMAIN, fitMagnitudes } from '../src/utils/metaphorMagnitudeFit.js';
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

/**
 * The magnitude fit, and the kind-pair sweep that is its real contract.
 *
 * These belong in a `metaphorMagnitudeFit.test.js` of their own and cannot have
 * one: `scripts/test-affected.test.mjs`'s reverse sweep requires every
 * `metaphor*` suite to appear in `METAPHOR_BLAST_TESTS`, that list lives in
 * `scripts/test-affected-lib.mjs`, and `routine:guard --reachable` gives that
 * file to the `improve` routine alone. `switchMetaphorKind.test.js` is listed
 * there but is outside the `metaphor3d` automation's `allowedPaths`, so this
 * suite — cross-kind item concerns, which is what a magnitude fit is — is the
 * closest home both rules allow. Tracked as `metaphor-suite-blast-list` in
 * `docs/automations/ledger/metaphor3d.md`.
 */
describe('fitMagnitudes', () => {
  it('returns the input untouched when every value already fits the domain', () => {
    const values = [12, 8, 3];
    expect(fitMagnitudes(values, [0.5, 20])).toBe(values);
  });

  it('preserves ratios exactly when the target domain can hold the dynamic range', () => {
    const fitted = fitMagnitudes([90, 45, 9], [0.2, 10]);
    expect(fitted).toEqual([10, 5, 1]);
  });

  it('preserves order when the dynamic range is wider than the target can express', () => {
    // 100:0.5 is 200:1; layercake's 10:0.2 domain is only 50:1, so ratios cannot
    // survive and rank is what is left to keep.
    const fitted = fitMagnitudes([100, 40, 0.5], [0.2, 10]);
    expect(fitted[0]).toBeGreaterThan(fitted[1]);
    expect(fitted[1]).toBeGreaterThan(fitted[2]);
    expect(fitted[0]).toBeLessThanOrEqual(10);
    expect(fitted[2]).toBeGreaterThanOrEqual(0.2);
  });

  it('maps a signed source range into a positive target domain without inverting it', () => {
    // terrain elevation runs to -10; a city tower's height must be positive.
    // 5 sits at the midpoint of [-10, 20], so it lands at the midpoint of [0.5, 100].
    const fitted = fitMagnitudes([20, 5, -10], [0.5, 100]);
    expect(fitted).toEqual([100, 50.25, 0.5]);
  });

  it('leaves a single out-of-range value on the domain ceiling', () => {
    expect(fitMagnitudes([54], [0.2, 10])).toEqual([10]);
  });

  it('keeps equal magnitudes equal rather than inventing a hierarchy', () => {
    // A document that says three things are the same size must still say so on
    // the other side of a switch — the fit may only shrink or grow the set, and
    // an affine map over a zero-width range would have spread them apart.
    expect(fitMagnitudes([50, 50, 50], [0.2, 10])).toEqual([10, 10, 10]);
  });

  it('survives an empty set and an all-zero set', () => {
    expect(fitMagnitudes([], [0.2, 10])).toEqual([]);
    expect(fitMagnitudes([0, 0], [0.2, 10])).toEqual([0.2, 0.2]);
  });
});

/**
 * The kind-pair sweep. This is what pins `MAGNITUDE_DOMAIN` to the schema: an
 * entry wider than `metaphorSchema.ts` allows makes the sanitizer reject that
 * document and the switch refuses, which fails the first assertion below.
 *
 * Before the magnitude fit, 15 of these 196 pairs refused outright (every
 * wide-range kind into `layercake`, plus city -> galaxy and five sources whose
 * secondary encoding could reach zero or below going into `city`), and 51 more
 * succeeded while flattening the item ordering onto the target's ceiling.
 */
describe('kind-pair sweep', () => {
  const BASE_KINDS = METAPHOR_KINDS.filter((kind) => kind !== 'composite');

  /** The field each kind states an item's main magnitude in. */
  const PRIMARY_FIELD = {
    city: 'height',
    layercake: 'thickness',
    galaxy: 'magnitude',
    tree: 'weight',
    terrain: 'elevation',
    orrery: 'size',
    river: 'flow',
    garden: 'impact',
    archipelago: 'mass',
    machine: 'size',
    bridge: 'load',
    cycle: 'size',
    subway: 'traffic',
    iceberg: 'mass'
  };
  const SECONDARY_FIELD = {
    city: 'footprint',
    terrain: 'intensity',
    orrery: 'orbit',
    archipelago: 'relief',
    machine: 'speed',
    iceberg: 'depth'
  };
  /** What an author may legally put in a kind's secondary field. */
  const SECONDARY_RANGE = {
    city: [0.5, 20],
    terrain: [0.1, 10],
    orrery: [0, 12],
    archipelago: [0, 1],
    machine: [0, 10],
    iceberg: [-1, 1]
  };

  /** Four items descending across the full range the source kind allows. */
  function sourceDocument(kind) {
    const across = ([lo, hi]) =>
      [0, 1, 2, 3].map((i) => Number((hi - ((hi - lo) * i) / 3).toFixed(2)));
    const primaries = across(MAGNITUDE_DOMAIN[kind].primary);
    const secondaries = SECONDARY_FIELD[kind] ? across(SECONDARY_RANGE[kind]) : null;
    const items = primaries.map((value, i) => {
      const item = { id: `item-${i}`, label: `Item ${i}`, [PRIMARY_FIELD[kind]]: value };
      if (secondaries) item[SECONDARY_FIELD[kind]] = secondaries[i];
      if (kind === 'river') item.stage = i * 25;
      if (kind === 'garden') item.maturity = 0.5;
      if (kind === 'bridge') item.span = i * 30;
      if (kind === 'cycle') item.phase = i * 25;
      if (kind === 'subway') item.stop = i * 30;
      if (kind === 'layercake') item.components = ['Component'];
      return item;
    });
    return JSON.stringify({
      metaphor: kind,
      scene: { theme: 'whiteboard', title: `${kind} source` },
      items,
      links: [{ from: 'item-0', to: 'item-1', label: 'uses' }]
    });
  }

  function primariesOf(text) {
    const dsl = JSON.parse(text);
    const kind = dsl.metaphor === 'composite' ? dsl.layers[0].as : dsl.metaphor;
    const items = dsl.metaphor === 'composite' ? dsl.layers[0].items : dsl.items;
    return items.map((item) => item[PRIMARY_FIELD[kind]]);
  }

  /**
   * Every ordered pair, switched once. Deliberately two cases rather than 196:
   * this is a pure-function sweep, and 196 separate `it()` blocks bought nothing
   * over a loop while adding enough scheduler load to the web suite to tip a
   * timing-sensitive test elsewhere in it. Both failures name the offending
   * pairs, so a regression is still diagnosable from the message alone.
   */
  function sweep() {
    const rows = [];
    for (const from of BASE_KINDS) {
      const source = sourceDocument(from);
      for (const to of METAPHOR_KINDS) {
        if (to === from) continue;
        const result = switchMetaphorKind(source, to);
        rows.push({ pair: `${from} -> ${to}`, result });
      }
    }
    return rows;
  }

  it('switches every one of the 196 kind pairs', () => {
    const rows = sweep();
    // The companion non-empty assertion: a sweep over a derived set that came
    // back empty would pass while examining nothing.
    expect(rows).toHaveLength(196);
    const refused = rows
      .filter(({ result }) => !result.ok)
      .map(({ pair, result }) => `${pair}: ${result.error}`);
    expect(refused).toEqual([]);
  });

  it('keeps every item ranked as the source document ranked it', () => {
    // Each source is strictly descending, so every target must be too — no two
    // items may land on one value and none may overtake a larger sibling.
    const rows = sweep();
    // The companion non-empty assertion: a sweep over a derived set that came
    // back empty would pass while examining nothing.
    expect(rows).toHaveLength(196);
    const broken = [];
    for (const { pair, result } of rows) {
      if (!result.ok) continue;
      const magnitudes = primariesOf(result.text);
      const ordered =
        magnitudes.length === 4 && magnitudes.every((v, i) => i === 0 || v < magnitudes[i - 1]);
      if (!ordered) broken.push(`${pair}: [${magnitudes.join(', ')}]`);
    }
    expect(broken).toEqual([]);
  });
});
