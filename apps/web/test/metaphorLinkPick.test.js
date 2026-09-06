import { describe, expect, it } from 'vitest';

import {
  LINK_EDITABLE_METAPHORS,
  metaphorKindHasEditableLinks
} from '../src/components/metaphorScenes/metaphorLinkPick.js';
import { graphEditAdapterFor } from '../src/utils/canvasGraphEdit.js';
import { METAPHOR_FLAT_GRAPH_EDIT_KINDS } from '../src/utils/metaphorFlatKindEdit.js';

// `metaphorLinkPick.js` says this file holds `LINK_EDITABLE_METAPHORS` against
// the live adapters, so a kind that gains link editing fails here until it is
// added to the list (#557 — until this file existed the promise in that
// docstring was false, and `metaphorGraphEdit.test.js` iterated a hardcoded
// seven kinds that never re-read the registry). Read one way, the assertion is
// "every listed kind's adapter actually accepts links"; read the other way,
// "every kind whose adapter accepts links is either listed here, gated on its
// document, or carries a written reason it is not".
//
// The assertion is per-(kind, document) rather than per-kind because composite's
// permission is source-derived (`compositeGraphAllowsLink` needs >= 2 authored
// items), so a single boolean per kind could not state it either way — which is
// precisely why composite sat in a pending ledger from #557 piece 1 until the
// gate started taking the source.

const flatSource = (metaphor, items = [{ id: 'a', label: 'A' }]) =>
  JSON.stringify({ metaphor, items });

const COMPOSITE_LINKABLE = JSON.stringify({
  metaphor: 'composite',
  layers: [
    {
      as: 'city',
      items: [
        { id: 'x', label: 'X' },
        { id: 'y', label: 'Y', links: ['x'] }
      ]
    }
  ]
});
const COMPOSITE_LONE = JSON.stringify({
  metaphor: 'composite',
  layers: [{ as: 'city', items: [{ id: 'x', label: 'X' }] }]
});

const SOURCES = {
  city: flatSource('city', [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B', links: ['a'] }
  ]),
  tree: flatSource('tree', [{ id: 'a', label: 'A' }]),
  garden: flatSource('garden'),
  // composite's `canLink` is SOURCE-derived, so it is the one kind that has to
  // be checked against both a linkable and a lone document.
  composite: [COMPOSITE_LINKABLE, COMPOSITE_LONE]
};

function variantsFor(kind) {
  const src = SOURCES[kind] ?? flatSource(kind);
  return Array.isArray(src) ? src : [src];
}

/** Every (document, adapter.canLink, gate) triple this kind is claimed to honour. */
function pairsFor(kind) {
  return variantsFor(kind).map((source) => {
    const adapter = graphEditAdapterFor('metaphor3d', source);
    expect(adapter, `no adapter resolves for kind '${kind}'`).not.toBeNull();
    expect(adapter.contentType).toBe('metaphor3d');
    return {
      source,
      canLink: adapter.canLink === true,
      gate: metaphorKindHasEditableLinks(kind, source)
    };
  });
}

const ALL_KINDS = [
  ...new Set([
    ...Object.keys(METAPHOR_FLAT_GRAPH_EDIT_KINDS),
    'city',
    'tree',
    'garden',
    'composite'
  ])
];

// Kinds whose adapter accepts links on SOME document while the gate stays closed
// on it — with the reason. Empty since #557 piece 2 gave the gate the source:
// composite is now gated per-document rather than pended per-kind. A NEW kind
// landing here without a written reason still fails on purpose, and a kind that
// opens its gate while a document still refuses is caught by `pairsFor` below.
const PENDING_LINK_PICK_DECISIONS = {};

describe('LINK_EDITABLE_METAPHORS against the live adapters', () => {
  it('is complete over the sweep: every kind maps to a metaphor3d adapter', () => {
    for (const kind of ALL_KINDS) {
      pairsFor(kind);
    }
    for (const kind of LINK_EDITABLE_METAPHORS) {
      expect(ALL_KINDS).toContain(kind);
    }
  });

  it('agrees with each adapter, document by document (#557)', () => {
    // The claim the doc block makes, stated where it can actually be falsified:
    // not "this kind is editable" but "for THIS document, the gate says what the
    // adapter says". A static list can only pass this by excluding composite.
    for (const kind of ALL_KINDS) {
      for (const { source, canLink, gate } of pairsFor(kind)) {
        expect(gate, `gate disagrees with adapter.canLink for ${kind}`).toBe(canLink);
      }
    }
  });

  it('exercises the document-derived branch rather than passing on it', () => {
    // A per-document assertion is worthless if every variant of every kind
    // happens to agree: pin that composite genuinely splits.
    const composite = pairsFor('composite');
    expect(composite.filter((pair) => pair.gate)).toHaveLength(1);
    expect(composite.filter((pair) => !pair.gate)).toHaveLength(1);
    // And that "no document supplied" fails closed rather than guessing yes,
    // which would mount a store whose every verb is an error toast.
    expect(metaphorKindHasEditableLinks('composite')).toBe(false);
  });

  it('lists only kinds whose adapter accepts links', () => {
    for (const kind of LINK_EDITABLE_METAPHORS) {
      expect(pairsFor(kind).some((pair) => pair.canLink)).toBe(true);
      expect(metaphorKindHasEditableLinks(kind, variantsFor(kind)[0])).toBe(true);
    }
  });

  it('never lists a kind twice', () => {
    expect(new Set(LINK_EDITABLE_METAPHORS).size).toBe(LINK_EDITABLE_METAPHORS.length);
  });

  it('fails every link-accepting kind that is neither gated nor pended (#557)', () => {
    const unaccounted = [];
    for (const kind of ALL_KINDS) {
      if (pairsFor(kind).some((pair) => pair.gate && pair.canLink)) continue;
      if (pairsFor(kind).some((pair) => pair.canLink)) unaccounted.push(kind);
    }
    expect(unaccounted.sort()).toEqual(Object.keys(PENDING_LINK_PICK_DECISIONS).sort());
  });

  it('holds an empty pending ledger, and keeps it honest if it ever fills', () => {
    // The empty case is the assertion: composite was the only holder of a reason
    // and #557 piece 2 resolved it, so re-opening this ledger has to be a
    // deliberate edit to the line above rather than a kind drifting out of the
    // gate unnoticed.
    expect(PENDING_LINK_PICK_DECISIONS).toEqual({});
    for (const [kind, reason] of Object.entries(PENDING_LINK_PICK_DECISIONS)) {
      expect(reason.trim().length, `${kind} is pended without a reason`).toBeGreaterThan(0);
      expect(pairsFor(kind).some((pair) => pair.canLink && !pair.gate)).toBe(true);
    }
  });

  it('treats structural kinds (tree, garden, the canLink:false flats) as not-graph on purpose', () => {
    const structural = ALL_KINDS.filter((kind) => {
      if (kind === 'composite') return false;
      if (metaphorKindHasEditableLinks(kind, variantsFor(kind)[0])) return false;
      return pairsFor(kind).every((pair) => !pair.canLink);
    });
    // city's siblings in docs/canvas-graph-edit.md: every non-editable swept
    // kind must keep its false, not merely be absent from the list.
    expect(structural).toEqual(
      ALL_KINDS.filter((k) => [...LINK_EDITABLE_METAPHORS, 'composite'].indexOf(k) < 0)
    );
    for (const kind of structural) {
      expect(metaphorKindHasEditableLinks(kind, variantsFor(kind)[0])).toBe(false);
    }
  });
});
