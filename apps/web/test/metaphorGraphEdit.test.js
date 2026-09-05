import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { metaphorItemDescriptor, metaphorLinkDescriptor } from '../src/utils/metaphorGraphEdit.js';
import {
  LINK_EDITABLE_METAPHORS,
  LINK_PICK_TOLERANCE_PX,
  LINK_PICK_USER_DATA,
  collectPickableLinks,
  createMetaphorLinkSelectionStore,
  distanceToRoutePx,
  distanceToSegmentPx,
  linkPickKey,
  metaphorKindHasEditableLinks,
  pickLinkAtPoint,
  projectLinkPoint
} from '../src/components/metaphorScenes/metaphorLinkPick.js';
import { graphEditAdapterFor } from '../src/utils/canvasGraphEdit.js';
import {
  LABEL_PLATE_ORDER,
  PICKED_LINK_ORDER
} from '../src/components/metaphorScenes/metaphorDrawOrder.js';

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
  it.each(LINK_EDITABLE_METAPHORS)('renames and deletes a %s link', (metaphor) => {
    const source = docWithLink(metaphor);
    const adapter = graphEditAdapterFor('metaphor3d', source);
    expect(adapter).toBeTruthy();
    const descriptor = metaphorLinkDescriptor({ from: 'a', to: 'b', label: 'sends' }, metaphor);

    const renamed = adapter.renameEdge(source, descriptor.edgeFrom, descriptor.edgeTo, 'carries');
    expect(renamed.ok).toBe(true);
    expect(JSON.parse(renamed.source).links[0].label).toBe('carries');

    const deleted = adapter.deleteEdge(source, descriptor.edgeFrom, descriptor.edgeTo);
    expect(deleted.ok).toBe(true);
    expect(JSON.parse(deleted.source).links ?? []).toHaveLength(0);
  });

  it('offers link editing exactly where the adapter can honour it', () => {
    // The list is a claim about the adapters, so hold it against them: a kind
    // that gains link editing has to be added here, and one that never had it
    // must not be offered a rename whose only outcome is an error toast.
    for (const metaphor of [
      'city',
      'layercake',
      'galaxy',
      'machine',
      'terrain',
      'tree',
      'subway'
    ]) {
      const source = docWithLink(metaphor);
      const adapter = graphEditAdapterFor('metaphor3d', source);
      const canRename = adapter?.renameEdge(source, 'a', 'b', 'carries').ok === true;
      expect(canRename).toBe(metaphorKindHasEditableLinks(metaphor));
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
