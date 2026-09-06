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
// "every kind whose adapter accepts links is either listed here or carries a
// written reason it is not". Composite is today's only holder of a reason.

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
  // composite's `canLink` is SOURCE-derived (`compositeGraphAllowsLink` needs
  // two authored items), so it gets both a linkable and a lone variant.
  composite: [COMPOSITE_LINKABLE, COMPOSITE_LONE]
};

function adapterCanLink(kind) {
  const src = SOURCES[kind] ?? flatSource(kind);
  const variants = Array.isArray(src) ? src : [src];
  return variants.map((source) => {
    const adapter = graphEditAdapterFor('metaphor3d', source);
    expect(adapter, `no adapter resolves for kind '${kind}'`).not.toBeNull();
    expect(adapter.contentType).toBe('metaphor3d');
    return adapter.canLink === true;
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

// Kinds whose adapter accepts links but which are deliberately NOT in
// `LINK_EDITABLE_METAPHORS` — with the reason. #557 left "decide composite"
// (mount the pick store and reach the shipped mutators, or say why this is
// never going to be a pickable surface — `docs/canvas-graph-edit.md` family
// notes) as `metaphor3d`'s or the owner's judgement rather than a
// transcription. A NEW kind landing here without a written reason fails on
// purpose.
const PENDING_LINK_PICK_DECISIONS = {
  composite:
    '#557 — adapter is live (renameCompositeEdge performs a real edit, MetaphorLinks publishes routes) but the renderer store-gate stays closed'
};

describe('LINK_EDITABLE_METAPHORS against the live adapters', () => {
  it('is complete over the sweep: every kind maps to a metaphor3d adapter', () => {
    for (const kind of ALL_KINDS) {
      adapterCanLink(kind);
    }
    for (const kind of LINK_EDITABLE_METAPHORS) {
      expect(ALL_KINDS).toContain(kind);
    }
  });

  it('lists only kinds whose adapter accepts links', () => {
    for (const kind of LINK_EDITABLE_METAPHORS) {
      expect(adapterCanLink(kind)).toContain(true);
      expect(metaphorKindHasEditableLinks(kind)).toBe(true);
    }
  });

  it('never lists a kind twice', () => {
    expect(new Set(LINK_EDITABLE_METAPHORS).size).toBe(LINK_EDITABLE_METAPHORS.length);
  });

  it('fails every link-accepting kind that is neither listed nor pended (#557)', () => {
    const unaccounted = [];
    for (const kind of ALL_KINDS) {
      if (metaphorKindHasEditableLinks(kind)) continue;
      if (adapterCanLink(kind).includes(true)) unaccounted.push(kind);
    }
    expect(unaccounted.sort()).toEqual(Object.keys(PENDING_LINK_PICK_DECISIONS).sort());
  });

  it('keeps the pending ledger honest about every entry in it', () => {
    for (const kind of Object.keys(PENDING_LINK_PICK_DECISIONS)) {
      expect(metaphorKindHasEditableLinks(kind)).toBe(false);
      expect(adapterCanLink(kind).includes(true)).toBe(true);
    }
  });

  it('treats structural kinds (tree, garden, the canLink:false flats) as not-graph on purpose', () => {
    const structural = ALL_KINDS.filter((kind) => {
      if (kind === 'composite') return false;
      if (metaphorKindHasEditableLinks(kind)) return false;
      return adapterCanLink(kind).every((canLink) => !canLink);
    });
    // city's siblings in docs/canvas-graph-edit.md: every non-editable swept
    // kind must keep its false, not merely be absent from the list.
    expect(structural).toEqual(
      ALL_KINDS.filter((k) => [...LINK_EDITABLE_METAPHORS, 'composite'].indexOf(k) < 0)
    );
    for (const kind of structural) {
      expect(metaphorKindHasEditableLinks(kind)).toBe(false);
    }
  });
});
