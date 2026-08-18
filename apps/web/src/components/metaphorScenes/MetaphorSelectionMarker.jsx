/**
 * In-canvas marker for the tap-selected item.
 *
 * Without it the inspector panel is disconnected copy: on a phone you tap a
 * shape, a card slides up, and nothing on the scene says which shape answered.
 *
 * Four choices here are corrections to what a first pass gets wrong:
 *
 * 1. It is sized from the item's **horizontal footprint**, never its full
 *    bounding sphere. A city tower is 18 units tall and 3 wide, so a
 *    billboarded ring big enough to enclose it is a hoop around the entire
 *    skyline — measured, it swallowed the whole scene and read as a rendering
 *    bug rather than a selection.
 * 2. Labels are excluded from that measurement. A one-word name is a ~7-unit
 *    wide plate hovering over a 3-unit tower, so a box that counts it reports
 *    an item twice its real width. The plate already carries `FRAME_IGNORE`;
 *    the troika text beside it is found through its material.
 * 3. It renders at the **scene root** in world coordinates rather than inside
 *    `<SceneFrame><Center>`, because the object's world position already
 *    carries those transforms — re-applying them would double them.
 * 4. It is depth-test-free, the same rule the accent callout follows: this is
 *    an annotation *about* the scene, so a tower drawn in front of the item you
 *    picked must not hide the answer to "which one did I tap".
 *
 * It subscribes to the selection store on its own (useSyncExternalStore) so a
 * tap re-renders this component and nothing else — the scene's layouts and
 * memos never re-run.
 */
import { useMemo, useRef, useSyncExternalStore } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { FRAME_IGNORE, FRAME_IGNORE_DATA } from './sceneFraming.js';
import { useMetaphorClock } from './metaphorClock.js';

/** Sky-400 — matches the inspector panel's left edge, which is the only thing
 *  tying the card to the shape. Held constant across every theme, like the
 *  accent marker's amber, so no palette can spend it on meaning. */
const MARKER_COLOR = '#38bdf8';

/** Floor so a pinhead item (a subway stop, a distant star) still reads. */
const MIN_RADIUS = 0.7;

const scratchBox = new THREE.Box3();
const scratchGeometryBox = new THREE.Box3();
const scratchCenter = new THREE.Vector3();
const scratchSize = new THREE.Vector3();
const scratchWorld = new THREE.Vector3();

/**
 * World bounds of an item's own geometry — its shape, not the annotations that
 * describe it. Prunes `FRAME_IGNORE` subtrees (the label's backing plate, glow
 * discs) and troika text, which is detected through its material because the
 * class carries no marker of its own.
 */
function measureShape(object) {
  object.updateWorldMatrix(true, true);
  scratchBox.makeEmpty();
  let found = false;
  const visit = (node) => {
    if (!node.visible || node.userData?.[FRAME_IGNORE]) return;
    if (node.material?.isTroikaTextMaterial) return;
    const geometry = node.geometry;
    if (geometry) {
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      const local = geometry.boundingBox;
      if (local && !local.isEmpty()) {
        scratchGeometryBox.copy(local).applyMatrix4(node.matrixWorld);
        scratchBox.union(scratchGeometryBox);
        found = true;
      }
    }
    for (const child of node.children) visit(child);
  };
  visit(object);
  return found && !scratchBox.isEmpty() ? scratchBox : null;
}

/**
 * Resolve the selected id to a live scene object plus the offset from its group
 * origin to the ring's resting place, and the radius that rings it.
 *
 * The offset is measured once per selection rather than every frame: walking an
 * item group's geometry is far too costly at 60fps, and an item that animates
 * (an orbiting planet, a cycling pod) moves its group without changing its own
 * shape — so the offset stays true while the world position does the moving.
 */
function measureSelected(scene, id, contentKey) {
  if (!scene || !id) return null;
  const object = scene.getObjectByName(id);
  if (!object) return null;
  const box = measureShape(object);
  if (!box) return null;
  box.getCenter(scratchCenter);
  box.getSize(scratchSize);
  object.getWorldPosition(scratchWorld);
  // The ring rests at the item's base, where a spotlight would fall. For a
  // floating item (a star, a submerged block) that is simply its underside.
  const anchor = new THREE.Vector3(scratchCenter.x, box.min.y, scratchCenter.z);
  return {
    object,
    contentKey,
    offset: anchor.sub(scratchWorld),
    radius: Math.max(MIN_RADIUS, Math.max(scratchSize.x, scratchSize.z) * 0.62)
  };
}

export function MetaphorSelectionMarker({ store, contentKey }) {
  const selected = useSyncExternalStore(store.subscribe, store.get, store.get);
  const scene = useThree((state) => state.scene);
  const groupRef = useRef(null);
  const { getTime, animated } = useMetaphorClock();
  const selectedId = typeof selected?.item?.id === 'string' ? selected.item.id : null;

  // Re-measured when the pick changes or the scene's structure does — a re-run
  // rebuilds every mesh, so a cached object reference would point at a corpse.
  const measured = useMemo(
    () => measureSelected(scene, selectedId, contentKey),
    [scene, selectedId, contentKey]
  );

  useFrame(() => {
    const group = groupRef.current;
    if (!group || !measured) return;
    measured.object.getWorldPosition(scratchWorld);
    group.position.copy(scratchWorld).add(measured.offset);
    // Slow breathing, not a blink: a flashing selection reads as an error.
    group.scale.setScalar(animated ? 1 + Math.sin(getTime() * 1.6) * 0.05 : 1);
  });

  if (!measured) return null;
  const { radius } = measured;

  return (
    <group ref={groupRef} userData={FRAME_IGNORE_DATA}>
      {/* Flat on the ground plane — `ringGeometry`, like `circleGeometry`, is
          authored in the XY plane and needs the -π/2 tip to lie down. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]} renderOrder={31}>
        <ringGeometry args={[radius, radius * 1.16, 56]} />
        <meshBasicMaterial
          color={MARKER_COLOR}
          transparent
          opacity={0.95}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Faint outer halo so the pick still reads where the ring's own hue is
          close to the ground it lies on. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} renderOrder={30}>
        <ringGeometry args={[radius * 1.16, radius * 1.5, 56]} />
        <meshBasicMaterial
          color={MARKER_COLOR}
          transparent
          opacity={0.22}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}
