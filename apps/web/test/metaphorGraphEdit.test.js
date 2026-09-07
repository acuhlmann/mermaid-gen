import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { metaphorItemDescriptor, metaphorLinkDescriptor } from '../src/utils/metaphorGraphEdit.js';
import {
  LINK_EDITABLE_METAPHORS,
  LINK_PICK_TOLERANCE_PX,
  LINK_PICK_USER_DATA,
  LINK_PICK_WIDTH_SCALE,
  collectPickableLinks,
  createMetaphorLinkSelectionStore,
  distanceToRoutePx,
  distanceToSegmentPx,
  isPickableFusedLink,
  linkPickKey,
  linkPickUserData,
  metaphorKindHasEditableLinks,
  pickLinkAtPoint,
  projectLinkPoint
} from '../src/components/metaphorScenes/metaphorLinkPick.js';
import { fusedLinkPresentation } from '../src/components/metaphorScenes/linkRoutes.js';
import { planFusedCompositeWorld } from '../src/components/metaphorScenes/fusedCompositePlanner.js';
import { renameCompositeEdge } from '../src/utils/metaphorCompositeEdit.js';
import { graphEditAdapterFor } from '../src/utils/canvasGraphEdit.js';
import { METAPHOR_FLAT_GRAPH_EDIT_KINDS } from '../src/utils/metaphorFlatKindEdit.js';
import {
  LABEL_PLATE_ORDER,
  PICKED_LINK_ORDER
} from '../src/components/metaphorScenes/metaphorDrawOrder.js';

// The composites the product actually ships, read from disk rather than
// transcribed — the same source `fusedCompositePlanner.test.js` uses, because a
// hand-copied approximation would not reproduce the fixture's own links.
const FIXTURE_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../docs/fixtures/metaphor3d'
);
const COMPOSITE_FIXTURE_NAMES = fs
  .readdirSync(FIXTURE_DIR)
  .filter((name) => name.startsWith('composite-') && name.endsWith('.json'));

function readCompositeFixture(name) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, name), 'utf8'));
}

describe('metaphorItemDescriptor', () => {
  it('returns null without an item id', () => {
    expect(metaphorItemDescriptor(null, 'tree')).toBeNull();
    expect(metaphorItemDescriptor({}, 'tree')).toBeNull();
    expect(metaphorItemDescriptor({ label: 'CEO' }, 'tree')).toBeNull();
  });

  it('builds the canvas graph-edit descriptor shape', () => {
    expect(metaphorItemDescriptor({ id: 'ceo', label: ' CEO ' }, 'tree')).toEqual({
      kind: 'metaphor-item',
      id: 'metaphor3d-ceo',
      dataId: 'ceo',
      partName: 'CEO',
      label: 'CEO',
      metaphor: 'tree'
    });
  });

  it('falls back to the id for label and defaults metaphor to tree', () => {
    expect(metaphorItemDescriptor({ id: 'ceo' })).toMatchObject({
      label: 'ceo',
      partName: 'ceo',
      metaphor: 'tree'
    });
  });

  it('preserves the scene metaphor kind on the descriptor', () => {
    expect(metaphorItemDescriptor({ id: 'n1', label: 'Branch' }, 'city')).toMatchObject({
      dataId: 'n1',
      metaphor: 'city'
    });
  });
});

/** Two-item flat doc with one labelled link, for whichever kind is under test. */
function docWithLink(metaphor) {
  return JSON.stringify({
    metaphor,
    items: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' }
    ],
    links: [{ from: 'a', to: 'b', label: 'sends' }]
  });
}

/**
 * A fused world with `count` items in one layer and, when it has two, one
 * labelled link between them.
 *
 * Composite is the only kind this file needs a separate shape for, and the
 * one-item form is the point: its link permission is a property of the document
 * rather than the kind, so `compositeGraphAllowsLink` refuses a wire until two
 * items exist across the layers.
 */
function compositeWithItems(count) {
  const items = [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' }
  ].slice(0, count);
  return JSON.stringify(
    {
      metaphor: 'composite',
      layout: 'fused',
      layers: [{ id: 'l1', as: 'city', items }],
      items: [],
      links: count >= 2 ? [{ from: 'a', to: 'b', label: 'sends' }] : []
    },
    null,
    2
  );
}

/** A document of `metaphor` carrying one link whose ends are `a` and `b`. */
function linkFixtureFor(metaphor) {
  return metaphor === 'composite' ? compositeWithItems(2) : docWithLink(metaphor);
}

describe('distanceToSegmentPx', () => {
  it('measures perpendicular distance inside the segment', () => {
    expect(distanceToSegmentPx(50, 10, [0, 0], [100, 0])).toBeCloseTo(10);
  });

  it('clamps to the endpoints outside the segment', () => {
    expect(distanceToSegmentPx(-30, 0, [0, 0], [100, 0])).toBeCloseTo(30);
    expect(distanceToSegmentPx(130, 0, [0, 0], [100, 0])).toBeCloseTo(30);
  });

  it('falls back to point distance on a degenerate segment', () => {
    // An elbow route's vertical leg projects to a single pixel when seen
    // end-on; the length-squared divisor is zero there.
    expect(distanceToSegmentPx(3, 4, [0, 0], [0, 0])).toBeCloseTo(5);
  });
});

describe('distanceToRoutePx', () => {
  const route = [
    [0, 0],
    [0, 100],
    [100, 100]
  ];

  it('takes the closest of all segments', () => {
    expect(distanceToRoutePx(50, 95, route)).toBeCloseTo(5);
    expect(distanceToRoutePx(6, 20, route)).toBeCloseTo(6);
  });

  it('is Infinity for a route with nothing drawable left', () => {
    expect(distanceToRoutePx(0, 0, undefined)).toBe(Infinity);
    expect(distanceToRoutePx(0, 0, [[0, 0]])).toBe(Infinity);
    // Every segment has an endpoint behind the camera.
    expect(distanceToRoutePx(0, 0, [null, null, null])).toBe(Infinity);
  });

  it('skips only the segments whose endpoint is behind the camera', () => {
    expect(distanceToRoutePx(50, 4, [[0, 0], [100, 0], null])).toBeCloseTo(4);
  });
});

describe('pickLinkAtPoint', () => {
  const routes = [
    {
      link: 'near',
      screenPoints: [
        [0, 100],
        [200, 100]
      ]
    },
    {
      link: 'far',
      screenPoints: [
        [0, 300],
        [200, 300]
      ]
    }
  ];

  it('returns the nearest route within tolerance', () => {
    const hit = pickLinkAtPoint({ routes, x: 100, y: 108 });
    expect(hit).toEqual({ link: 'near', distancePx: 8 });
  });

  it('returns null when nothing is within tolerance', () => {
    expect(pickLinkAtPoint({ routes, x: 100, y: 200 })).toBeNull();
  });

  it('prefers the closer of two routes both inside tolerance', () => {
    const crowded = [
      {
        link: 'a',
        screenPoints: [
          [0, 100],
          [200, 100]
        ]
      },
      {
        link: 'b',
        screenPoints: [
          [0, 112],
          [200, 112]
        ]
      }
    ];
    expect(pickLinkAtPoint({ routes: crowded, x: 100, y: 110 }).link).toBe('b');
  });

  it('honours an explicit tolerance', () => {
    expect(pickLinkAtPoint({ routes, x: 100, y: 108, tolerancePx: 4 })).toBeNull();
    expect(pickLinkAtPoint({ routes, x: 100, y: 108, tolerancePx: 20 })?.link).toBe('near');
  });

  it('tolerates an empty or missing route list', () => {
    expect(pickLinkAtPoint({ routes: [], x: 0, y: 0 })).toBeNull();
    expect(pickLinkAtPoint({ routes: undefined, x: 0, y: 0 })).toBeNull();
  });

  it('defaults to a touch-sized tolerance', () => {
    expect(LINK_PICK_TOLERANCE_PX).toBeGreaterThanOrEqual(16);
    expect(pickLinkAtPoint({ routes, x: 100, y: 100 + LINK_PICK_TOLERANCE_PX - 1 })).not.toBeNull();
    expect(pickLinkAtPoint({ routes, x: 100, y: 100 + LINK_PICK_TOLERANCE_PX + 1 })).toBeNull();
  });
});

describe('projectLinkPoint', () => {
  /** A camera at +Z looking at the origin, the standing orbit setup. */
  function cameraAt(z) {
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    camera.position.set(0, 0, z);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();
    return camera;
  }

  const identity = new THREE.Matrix4();
  const size = { width: 400, height: 400 };

  it('puts the origin at the centre of the canvas', () => {
    const px = projectLinkPoint([0, 0, 0], identity, cameraAt(10), size);
    expect(px[0]).toBeCloseTo(200);
    expect(px[1]).toBeCloseTo(200);
  });

  it('maps +x right and +y up', () => {
    const camera = cameraAt(10);
    const right = projectLinkPoint([1, 0, 0], identity, camera, size);
    const up = projectLinkPoint([0, 1, 0], identity, camera, size);
    expect(right[0]).toBeGreaterThan(200);
    expect(up[1]).toBeLessThan(200);
  });

  it('rejects a point behind the camera rather than mirroring it', () => {
    // The whole reason for the guard: `Vector3.project` divides by a negative
    // w behind the eye and returns a plausible mirrored position, which would
    // hand the hit-test a segment crossing the entire canvas.
    expect(projectLinkPoint([0, 0, 40], identity, cameraAt(10), size)).toBeNull();
  });

  it('carries the group transform, so an animated group moves its route', () => {
    const camera = cameraAt(10);
    const still = projectLinkPoint([0, 0, 0], identity, camera, size);
    const moved = projectLinkPoint(
      [0, 0, 0],
      new THREE.Matrix4().makeTranslation(2, 0, 0),
      camera,
      size
    );
    expect(moved[0]).toBeGreaterThan(still[0]);
  });
});

describe('collectPickableLinks', () => {
  function sceneWithLink(payload, { visible = true } = {}) {
    const root = new THREE.Group();
    const group = new THREE.Group();
    group.visible = visible;
    group.userData = { [LINK_PICK_USER_DATA]: payload };
    root.add(group);
    return root;
  }

  const payload = {
    link: { from: 'a', to: 'b', label: 'sends' },
    points: [
      [0, 0, 0],
      [1, 1, 1]
    ]
  };

  it('finds a published route and keeps the object that carries it', () => {
    const root = sceneWithLink(payload);
    const found = collectPickableLinks(root);
    expect(found).toHaveLength(1);
    expect(found[0].link).toEqual(payload.link);
    expect(found[0].object).toBe(root.children[0]);
  });

  it('ignores hidden groups and unpublished ones', () => {
    expect(collectPickableLinks(sceneWithLink(payload, { visible: false }))).toHaveLength(0);
    expect(collectPickableLinks(new THREE.Group())).toHaveLength(0);
    expect(collectPickableLinks(null)).toHaveLength(0);
  });

  it('ignores a malformed payload rather than yielding a half link', () => {
    expect(collectPickableLinks(sceneWithLink({ link: { from: 'a' }, points: [] }))).toHaveLength(
      0
    );
    expect(collectPickableLinks(sceneWithLink({ link: { from: 'a', to: 'b' } }))).toHaveLength(0);
  });
});

describe('createMetaphorLinkSelectionStore', () => {
  const picked = (from, to) => ({ link: { from, to, label: '' }, object: {}, points: [] });

  it('notifies subscribers on set and clear', () => {
    const store = createMetaphorLinkSelectionStore();
    let seen = 0;
    const unsubscribe = store.subscribe(() => {
      seen += 1;
    });
    store.set(picked('a', 'b'));
    expect(store.get()?.link.from).toBe('a');
    store.clear();
    expect(store.get()).toBeNull();
    expect(seen).toBe(2);
    unsubscribe();
  });

  it('toggles the same pair off and a different pair on', () => {
    const store = createMetaphorLinkSelectionStore();
    store.toggle(picked('a', 'b'));
    expect(store.get()).not.toBeNull();
    store.toggle(picked('a', 'b'));
    expect(store.get()).toBeNull();
    store.toggle(picked('a', 'b'));
    store.toggle(picked('b', 'c'));
    expect(store.get()?.link.to).toBe('c');
  });

  it('routes a pick request to the pending channel, once', () => {
    const store = createMetaphorLinkSelectionStore();
    let woken = 0;
    store.subscribePending(() => {
      woken += 1;
    });
    store.requestPick({ clientX: 10, clientY: 20 });
    expect(woken).toBe(1);
    expect(store.takePending()).toEqual({ clientX: 10, clientY: 20 });
    expect(store.takePending()).toBeNull();
  });

  it('drops a request nobody subscribed to, leaving the selection alone', () => {
    const store = createMetaphorLinkSelectionStore();
    store.set(picked('a', 'b'));
    store.requestPick({ clientX: 1, clientY: 1 });
    expect(store.get()?.link.from).toBe('a');
  });
});

describe('metaphorLinkDescriptor', () => {
  it('builds the edge descriptor the shared hook already reads', () => {
    expect(metaphorLinkDescriptor({ from: 'a', to: 'b', label: ' sends ' }, 'city')).toEqual({
      kind: 'edge',
      id: 'metaphor3d-link-a-b',
      edgeFrom: 'a',
      edgeTo: 'b',
      label: 'sends',
      partName: 'sends',
      metaphor: 'city'
    });
  });

  it('leaves an unlabelled link with an empty prefill, not a guess', () => {
    const descriptor = metaphorLinkDescriptor({ from: 'a', to: 'b' }, 'galaxy');
    expect(descriptor.label).toBe('');
    expect(descriptor.partName).toBe('a → b');
  });

  it('returns null without both ends', () => {
    expect(metaphorLinkDescriptor(null, 'city')).toBeNull();
    expect(metaphorLinkDescriptor({ from: 'a' }, 'city')).toBeNull();
    expect(metaphorLinkDescriptor({ to: 'b' }, 'city')).toBeNull();
  });
});

describe('the descriptor reaches the mutators it was dead code for (#495)', () => {
  // Composite joins the list because #495's whole complaint was a mutator that
  // was registered, tested and unreachable, and `renameCompositeEdge`/
  // `deleteCompositeEdge` were exactly that until the gate learned to read the
  // document (#557). `metaphorLinkPick.test.js` owns the gate sweep; what
  // belongs here is that the descriptor actually reaches each one.
  it.each([...LINK_EDITABLE_METAPHORS, 'composite'])(
    'renames and deletes a %s link',
    (metaphor) => {
      const source = linkFixtureFor(metaphor);
      const adapter = graphEditAdapterFor('metaphor3d', source);
      expect(adapter).toBeTruthy();
      const descriptor = metaphorLinkDescriptor({ from: 'a', to: 'b', label: 'sends' }, metaphor);

      const renamed = adapter.renameEdge(source, descriptor.edgeFrom, descriptor.edgeTo, 'carries');
      expect(renamed.ok).toBe(true);
      expect(JSON.parse(renamed.source).links[0].label).toBe('carries');

      const deleted = adapter.deleteEdge(source, descriptor.edgeFrom, descriptor.edgeTo);
      expect(deleted.ok).toBe(true);
      expect(JSON.parse(deleted.source).links ?? []).toHaveLength(0);
    }
  );

  it('offers link editing exactly where the adapter can honour it', () => {
    // The list is a claim about the adapters, so hold it against them: a kind
    // that gains link editing has to be added here, and one that never had it
    // must not be offered a rename whose only outcome is an error toast.
    // Composite is absent from this sweep only because its fixture lives in
    // layers; `metaphorLinkPick.test.js` covers it both ways.
    for (const metaphor of [
      ...Object.keys(METAPHOR_FLAT_GRAPH_EDIT_KINDS),
      'city',
      'tree',
      'garden'
    ]) {
      const source = docWithLink(metaphor);
      const adapter = graphEditAdapterFor('metaphor3d', source);
      const canRename = adapter?.renameEdge(source, 'a', 'b', 'carries').ok === true;
      expect(canRename).toBe(metaphorKindHasEditableLinks(metaphor, source));
    }
  });

  it('keeps the pair as the identity, with no invented edge id', () => {
    // `findLinkedEdge`/`renameLinkedEdge` resolve on {from,to} and
    // `connectCityNodes` refuses a duplicate pair, so a second name for the
    // same edge would be a synchronisation problem with no upside.
    const descriptor = metaphorLinkDescriptor({ from: 'a', to: 'b' }, 'city');
    expect(descriptor.edgeFrom).toBe('a');
    expect(descriptor.edgeTo).toBe('b');
    expect(linkPickKey('a', 'b')).not.toBe(linkPickKey('b', 'a'));
  });
});

describe('the picked link is ranked below the caption it confirms', () => {
  it('draws under the label plate', () => {
    expect(PICKED_LINK_ORDER).toBeLessThan(LABEL_PLATE_ORDER);
  });
});

/**
 * The fused world's half of #495 (`link-pick-fused`).
 *
 * `LegacyCompositeScene` and `FusedCompositeScene` draw a composite's relations
 * from two different sources, and only one of them is editable.
 * `planFusedCompositeWorld`'s `makeLinks` concatenates the document's authored
 * `links[]` with `inferredRelationships()`, which synthesises a route for every
 * item carrying `parent`, `moon` or `binary`. The two are drawn identically and
 * behave differently under an edit: `renameCompositeEdge`/`deleteCompositeEdge`
 * both resolve against `doc.links`, so an inferred route answers `missing`.
 *
 * These pin the filter to that fact rather than to its own wording — every
 * published route must be one the mutators honour, and every route the mutators
 * refuse must be unpublished.
 */
describe('the fused world publishes only the routes an editor can honour', () => {
  const compositeWithBoth = {
    metaphor: 'composite',
    layout: 'fused',
    seed: 'link-pick-fused',
    novelty: 0.6,
    motionIntensity: 0.6,
    scene: {},
    layers: [
      {
        id: 'ground',
        as: 'archipelago',
        items: [
          { id: 'a', label: 'Ingest', mass: 8, relief: 0.7 },
          { id: 'b', label: 'Store', mass: 9, relief: 0.6 }
        ]
      },
      {
        id: 'org',
        as: 'tree',
        items: [
          { id: 'root', label: 'Platform', weight: 8 },
          { id: 'leaf', label: 'Search', weight: 5, parent: 'root' }
        ]
      }
    ],
    items: [],
    links: [{ from: 'a', to: 'b', label: 'feeds' }]
  };
  const source = JSON.stringify(compositeWithBoth, null, 2);

  it('plans an authored route and an inferred one side by side', () => {
    // The premise of the filter. Without both kinds in one plan there is
    // nothing to filter, and this test would pass while asserting nothing.
    const plan = planFusedCompositeWorld(compositeWithBoth);
    expect(plan.links.some((link) => !link.inferred)).toBe(true);
    expect(plan.links.some((link) => link.inferred)).toBe(true);
  });

  it('publishes exactly the routes the composite mutators can resolve', () => {
    const plan = planFusedCompositeWorld(compositeWithBoth);
    for (const link of plan.links) {
      const renamed = renameCompositeEdge(source, link.from, link.to, 'carries');
      expect(isPickableFusedLink(link)).toBe(renamed.ok);
      if (!renamed.ok) expect(renamed.reason).toBe('missing');
    }
  });

  it('loses no authored route on a shipped composite fixture', () => {
    // The filter is a subtraction, so the risk it carries is over-subtracting.
    // None of the three shipped composites authors a `parent`/`moon`/`binary`,
    // so every one of their plan links must survive it.
    for (const name of COMPOSITE_FIXTURE_NAMES) {
      const fixture = readCompositeFixture(name);
      const plan = planFusedCompositeWorld(fixture);
      const published = plan.links.filter(isPickableFusedLink);
      expect(published.length).toBe(plan.links.length);
      expect(published.length).toBeGreaterThan(0);
      for (const link of published) {
        const text = JSON.stringify(fixture, null, 2);
        expect(renameCompositeEdge(text, link.from, link.to, 'carries').ok).toBe(true);
      }
    }
  });

  it('refuses a half link and an inferred one, whatever else they carry', () => {
    expect(isPickableFusedLink({ from: 'a', to: 'b' })).toBe(true);
    expect(isPickableFusedLink({ from: 'a', to: 'b', inferred: true })).toBe(false);
    expect(isPickableFusedLink({ from: 'a' })).toBe(false);
    expect(isPickableFusedLink(null)).toBe(false);
  });

  it('carries the label through to the pick payload, and nothing else', () => {
    const payload = linkPickUserData(
      { from: 'a', to: 'b', label: 'feeds', kind: 'flow', inferred: false },
      [
        [0, 0, 0],
        [1, 2, 3]
      ]
    )[LINK_PICK_USER_DATA];
    expect(payload.link).toEqual({ from: 'a', to: 'b', label: 'feeds' });
    expect(payload.points).toHaveLength(2);
    // A non-string label would reach `metaphorLinkDescriptor` and become the
    // rename dialog's prefill.
    expect(
      linkPickUserData({ from: 'a', to: 'b', label: 7 }, [])[LINK_PICK_USER_DATA].link.label
    ).toBe('');
  });
});

describe('a picked fused link outranks every state that would hide it', () => {
  it('is drawn at full strength through mute and dim alike', () => {
    // A tap on a wire whose layer is pressed away used to answer at 0.22
    // opacity, and a tap that moves the pointer off the hovered item answered
    // at 0.18 — an answer the viewer cannot see is the same as no answer.
    for (const state of [
      { muted: true, activeId: null },
      { muted: false, activeId: 'someone-else' },
      { muted: true, activeId: 'someone-else' }
    ]) {
      const resting = fusedLinkPresentation({ related: false, ...state });
      const picked = fusedLinkPresentation({ related: false, ...state, picked: true });
      expect(resting.opacity).toBeLessThan(0.5);
      expect(picked.opacity).toBe(1);
      expect(picked.cased).toBe(true);
      expect(picked.dimmed).toBe(false);
      expect(picked.emphasis).toBe(LINK_PICK_WIDTH_SCALE);
      expect(picked.emphasis).toBeGreaterThan(resting.emphasis);
    }
  });

  it('leaves the resting scene exactly as it was', () => {
    for (const state of [
      { related: false, muted: false, activeId: null },
      { related: true, muted: false, activeId: 'a' },
      { related: false, muted: true, activeId: null },
      { related: false, muted: false, activeId: 'b' }
    ]) {
      expect(fusedLinkPresentation(state)).toEqual(
        fusedLinkPresentation({ ...state, picked: false })
      );
    }
  });
});
