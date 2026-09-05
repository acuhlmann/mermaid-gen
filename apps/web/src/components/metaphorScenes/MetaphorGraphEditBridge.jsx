/**
 * Bridges Metaphor3D tap-selection to the canvas graph-edit stack (radial menu,
 * toolbar anchor, /user-edit). Three.js owns hit-testing; this module owns the
 * descriptor shape the shared hook already understands.
 *
 * Two things are picked in these scenes and both arrive here: an ITEM, which
 * `HoverableItem` selects through R3F's own pointer events, and a LINK, which
 * has no mesh to hang a handler on and is resolved in screen space by
 * `metaphorLinkPick.js`. They are mutually exclusive by construction — the item
 * tap clears the link store, and the link pick runs only from the canvas's
 * `onPointerMissed`, which R3F raises only when no item consumed the tap — so
 * this file reads both stores and never has to arbitrate between them.
 */
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { measureItemPlacement } from './itemBounds.js';
import { samplePolyline } from './sceneUtils.js';
import {
  LINK_PICK_TOLERANCE_PX,
  collectPickableLinks,
  linkPickKey,
  pickLinkAtPoint,
  projectLinkPoint,
  useMetaphorLinkSelection
} from './metaphorLinkPick.js';
import { metaphorItemDescriptor, metaphorLinkDescriptor } from '../../utils/metaphorGraphEdit.js';

const scratchWorld = new THREE.Vector3();

const noopSubscribe = () => () => {};
const nullSnapshot = () => null;

/**
 * Screen rect of a canvas, in page coordinates, falling back to R3F's own size
 * when the container has not been measured yet.
 *
 * @param {import('react').RefObject<HTMLElement | null>} containerRef
 * @param {{ width: number, height: number }} size
 */
function canvasRect(containerRef, size) {
  const rect = containerRef.current?.getBoundingClientRect();
  return {
    left: rect?.left ?? 0,
    top: rect?.top ?? 0,
    width: rect?.width ?? size.width,
    height: rect?.height ?? size.height
  };
}

/**
 * Every candidate route with its points carried into canvas pixels, ready for
 * the pure hit-test.
 *
 * @param {ReturnType<typeof collectPickableLinks>} candidates
 * @param {THREE.Camera} camera
 * @param {{ width: number, height: number }} rect
 */
function projectRoutes(candidates, camera, rect) {
  const view = { width: rect.width, height: rect.height };
  return candidates.map((candidate) => {
    candidate.object.updateWorldMatrix(true, false);
    return {
      link: candidate,
      screenPoints: candidate.points.map((point) =>
        projectLinkPoint(point, candidate.object.matrixWorld, camera, view)
      )
    };
  });
}

/**
 * Toolbar anchor for a picked LINK.
 *
 * A wire has no footprint to ring, so the toolbar hangs off the middle of the
 * route and the "node box" the radial menu keeps clear of is the route's own
 * projected extent. Recomputed from the live object every frame, because a kind
 * that animates its groups (galaxy's drift, machine's rotation) moves the route
 * under a set of local points that never change.
 *
 * @returns {object | null}
 */
function linkToolbarAnchor(picked, camera, rect, contentKey) {
  picked.object.updateWorldMatrix(true, false);
  const view = { width: rect.width, height: rect.height };
  const midPx = projectLinkPoint(
    samplePolyline(picked.points, 0.5),
    picked.object.matrixWorld,
    camera,
    view
  );
  if (!midPx) return null;
  let minX = midPx[0];
  let maxX = midPx[0];
  let minY = midPx[1];
  let maxY = midPx[1];
  for (const point of picked.points) {
    const px = projectLinkPoint(point, picked.object.matrixWorld, camera, view);
    if (!px) continue;
    minX = Math.min(minX, px[0]);
    maxX = Math.max(maxX, px[0]);
    minY = Math.min(minY, px[1]);
    maxY = Math.max(maxY, px[1]);
  }
  const nodeId = linkPickKey(picked.link.from, picked.link.to);
  const left = rect.left + midPx[0];
  const centerY = rect.top + midPx[1];
  return {
    key: `${nodeId}:${contentKey}:${Math.round(left)}:${Math.round(centerY)}`,
    anchor: {
      nodeId,
      left,
      top: rect.top + maxY + 10,
      nodeTop: rect.top + minY,
      nodeBottom: rect.top + maxY,
      nodeLeft: rect.left + minX,
      nodeRight: rect.left + maxX,
      centerY
    }
  };
}

/**
 * Toolbar anchor for a picked ITEM: its ground point projected to the canvas,
 * with a box sized from the footprint `itemBounds.js` measured.
 *
 * @returns {object | null}
 */
function itemToolbarAnchor(scene, itemId, camera, rect, contentKey) {
  const placement = measureItemPlacement(scene, itemId);
  if (!placement) return null;
  placement.object.getWorldPosition(scratchWorld);
  scratchWorld.add(placement.baseOffset);
  const ndc = scratchWorld.clone().project(camera);
  const px = rect.left + (ndc.x * 0.5 + 0.5) * rect.width;
  const py = rect.top + (-ndc.y * 0.5 + 0.5) * rect.height;
  const radius = Math.max(12, placement.groundRadius * 8);
  const top = py + radius + 10;
  return {
    key: `${itemId}:${contentKey}:${Math.round(px)}:${Math.round(top)}`,
    anchor: {
      nodeId: itemId,
      left: px,
      top,
      nodeTop: py - radius,
      nodeBottom: py + radius,
      nodeLeft: px - radius,
      nodeRight: px + radius,
      centerY: py
    }
  };
}

/**
 * Keeps the external-store selection, parent selectedNode, and screen anchor in
 * sync without re-rendering the scene graph.
 *
 * @param {{
 *   selectionStore: ReturnType<import('../metaphorSelection.js').createMetaphorSelectionStore>;
 *   selectedNode?: object | null;
 *   onSelectedNodeChange?: (value: object | null) => void;
 *   onNodeToolbarAnchor?: (value: object | null) => void;
 *   containerRef: import('react').RefObject<HTMLElement | null>;
 *   contentKey: string;
 *   defaultMetaphor?: string | null;
 * }} props
 */
export function MetaphorGraphEditBridge({
  selectionStore,
  selectedNode = null,
  onSelectedNodeChange,
  onNodeToolbarAnchor,
  containerRef,
  contentKey,
  defaultMetaphor = null
}) {
  const selected = useSyncExternalStore(
    selectionStore.subscribe,
    selectionStore.get,
    selectionStore.get
  );
  // From context rather than a prop: the provider already decides whether this
  // kind's links are editable, and a prop would be a second place to get that
  // condition right.
  const linkSelectionStore = useMetaphorLinkSelection();
  const pickedLink = useSyncExternalStore(
    linkSelectionStore?.subscribe ?? noopSubscribe,
    linkSelectionStore?.get ?? nullSnapshot,
    linkSelectionStore?.get ?? nullSnapshot
  );
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const lastAnchorKeyRef = useRef('');
  const lastDescriptorIdRef = useRef(null);

  /**
   * Resolve a canvas pointer point to the link under it, or null.
   *
   * The renderer owns the gesture and this owns the answer, because the
   * canvas-level `onPointerMissed` that raises the tap lives on `<Canvas>`,
   * outside R3F's context — and the camera, scene and canvas size the answer
   * needs are readable only from inside it. The request travels through the
   * store rather than through a ref handed down, so neither side writes to the
   * other's state.
   */
  const resolveLinkAt = useCallback(
    (event) => {
      if (!linkSelectionStore) return null;
      const rect = canvasRect(containerRef, size);
      if (!(rect.width > 0) || !(rect.height > 0)) return null;
      const candidates = collectPickableLinks(scene);
      if (!candidates.length) return null;
      camera.updateMatrixWorld();
      const hit = pickLinkAtPoint({
        routes: projectRoutes(candidates, camera, rect),
        x: (event?.clientX ?? 0) - rect.left,
        y: (event?.clientY ?? 0) - rect.top,
        tolerancePx: LINK_PICK_TOLERANCE_PX
      });
      if (!hit) return null;
      return { link: hit.link.link, object: hit.link.object, points: hit.link.points };
    },
    [camera, containerRef, linkSelectionStore, scene, size]
  );

  useEffect(() => {
    if (!linkSelectionStore) return undefined;
    return linkSelectionStore.subscribePending(() => {
      const point = linkSelectionStore.takePending();
      if (!point) return;
      const picked = resolveLinkAt(point);
      if (picked) linkSelectionStore.toggle(picked);
      else linkSelectionStore.clear();
    });
  }, [linkSelectionStore, resolveLinkAt]);

  useEffect(() => {
    if (selectedNode?.kind !== 'metaphor-item' || !selectedNode?.dataId) {
      if (!selectedNode && selectionStore.get()) {
        selectionStore.clear();
      }
      // A parent that drops the selection entirely drops the link too —
      // otherwise a committed rename leaves a sky-blue wire pinned to a route
      // the document no longer describes.
      if (!selectedNode && linkSelectionStore?.get()) {
        linkSelectionStore.clear();
      }
      return;
    }
    const current = selectionStore.get();
    if (current?.item?.id === selectedNode.dataId) return;
    selectionStore.set({
      item: {
        id: selectedNode.dataId,
        label: selectedNode.label ?? selectedNode.partName ?? selectedNode.dataId
      },
      metaphor: selectedNode.metaphor ?? defaultMetaphor ?? 'tree',
      layerLabel: null
    });
  }, [defaultMetaphor, linkSelectionStore, selectedNode, selectionStore]);

  useEffect(() => {
    if (!onSelectedNodeChange) return;
    let descriptor = null;
    if (pickedLink?.link) {
      descriptor = metaphorLinkDescriptor(pickedLink.link, defaultMetaphor);
    } else if (selected) {
      descriptor = metaphorItemDescriptor(selected.item, selected.metaphor ?? defaultMetaphor);
    }
    const nextId = descriptor?.id ?? null;
    if (nextId === lastDescriptorIdRef.current && (descriptor || !(selected || pickedLink))) {
      return;
    }
    lastDescriptorIdRef.current = nextId;
    onSelectedNodeChange(descriptor);
  }, [defaultMetaphor, onSelectedNodeChange, pickedLink, selected]);

  useFrame(() => {
    if (!onNodeToolbarAnchor) return;
    const rect = canvasRect(containerRef, size);
    const live =
      pickedLink?.object?.parent != null
        ? linkToolbarAnchor(pickedLink, camera, rect, contentKey)
        : selected?.item?.id
          ? itemToolbarAnchor(scene, selected.item.id, camera, rect, contentKey)
          : null;
    if (!live) {
      if (lastAnchorKeyRef.current !== '') {
        lastAnchorKeyRef.current = '';
        onNodeToolbarAnchor(null);
      }
      return;
    }
    if (live.key === lastAnchorKeyRef.current) return;
    lastAnchorKeyRef.current = live.key;
    onNodeToolbarAnchor(live.anchor);
  });

  return null;
}
