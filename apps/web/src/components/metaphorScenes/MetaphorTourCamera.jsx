/**
 * Camera for the guided read: it flies to the beat the panel is describing.
 *
 * Without it the tour is a caption track. "The largest cluster is Billing" is
 * only useful if you can see which shape Billing is, and on a phone-sized
 * canvas showing forty items, the selection ring alone is a 20-pixel circle you
 * have to find. Moving the camera is what turns the sentence into a pointer.
 *
 * Four rules, each a correction to the obvious implementation:
 *
 * 1. **It keeps the viewer's own viewing angle.** The goal is a distance and a
 *    look-at target along the direction the camera is *already* looking, never
 *    a canned three-quarter shot. Yanking the azimuth on every Next is
 *    disorienting, and it throws away the angle the viewer chose by orbiting.
 * 2. **It aims at the item's centre, not its anchor.** A city anchor is the
 *    roof line; framing there puts the tower's whole body below the frame.
 * 3. **It never zooms past the scene's own fit.** The overview distance is the
 *    ceiling and a fraction of it is the floor, so a scene of pinhead items (a
 *    galaxy of stars) cannot fly the camera inside its own geometry.
 * 4. **It stops when it arrives.** The goal is cleared once the camera settles,
 *    so a viewer who orbits mid-beat is not fought by an easing that keeps
 *    dragging them back.
 *
 * Reduced motion gets the same framing, arrived at instantly — the information
 * is in *where* the camera ends up, so honouring the preference must not mean
 * losing the pointer.
 */
import { useEffect, useRef, useSyncExternalStore } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { measureItemPlacement } from './itemBounds.js';
import { currentBeat } from '../metaphorTourStore.js';

/** Breathing room around the framed item, as a multiple of the tight fit. */
const ITEM_FRAME_MARGIN = 1.15;

/**
 * On a portrait canvas the read is a bottom sheet, so the lower third of the
 * frame is behind a panel. Aiming below the item lifts it into the clear
 * area — whatever sits at the look-at target lands at screen centre, so
 * dropping the target raises the subject. Expressed as a fraction of the
 * frame's visible half-height, which keeps it identical at every distance.
 */
const PORTRAIT_LIFT = 0.17;

/** Distance floor/ceiling as fractions of the whole-scene fit distance. */
const MIN_FIT_FRACTION = 0.16;
const MAX_FIT_FRACTION = 0.92;

/** Per-second easing rate; ~0.55s to close the gap to within a percent. */
const EASE_RATE = 7;

/** World units below which the flight counts as arrived. */
const ARRIVE_EPSILON = 0.02;

const scratchDirection = new THREE.Vector3();
const scratchTarget = new THREE.Vector3();
const scratchWorld = new THREE.Vector3();

/**
 * @param {object} props
 * @param {ReturnType<typeof import('../metaphorTourStore.js').createMetaphorTourStore>} props.store
 * @param {{ distance: number, radius: number, center: number[], ready: boolean }} props.fitRef
 * @param {string} props.contentKey — a re-run rebuilds every mesh; re-resolve on it
 * @param {boolean} [props.reducedMotion]
 */
export function MetaphorTourCamera({ store, fitRef, contentKey, reducedMotion = false }) {
  const state = useSyncExternalStore(store.subscribe, store.get, store.get);
  const camera = useThree((three) => three.camera);
  const controls = useThree((three) => three.controls);
  const scene = useThree((three) => three.scene);
  const beat = currentBeat(state);
  const beatId = beat?.id ?? null;
  const focusId = beat?.focus?.id ?? null;
  const goalRef = useRef(null);
  const wasTouringRef = useRef(false);

  useEffect(() => {
    const touring = beatId !== null;
    // Ending a read returns the camera to the overview. A viewer who closes the
    // tour while zoomed onto one tower would otherwise be stranded there with
    // no affordance that says "you are looking at 3% of the scene".
    if (!touring) {
      goalRef.current = wasTouringRef.current && fitRef?.ready ? { placement: null } : null;
      wasTouringRef.current = false;
      return;
    }
    wasTouringRef.current = true;
    if (!focusId) {
      goalRef.current = { placement: null };
      return;
    }
    // A beat that names an item the scene cannot resolve (a mid-stream mesh, an
    // id the author reused) leaves the camera where it is. Falling through to
    // the overview framing would read as the tour flying AWAY from the thing it
    // just named, which is worse than not moving.
    const placement = measureItemPlacement(scene, focusId);
    goalRef.current = placement ? { placement } : null;
  }, [beatId, focusId, scene, contentKey, fitRef]);

  useFrame((_, delta) => {
    const goal = goalRef.current;
    if (!goal || !controls || !fitRef?.ready) return;

    const fitDistance = Math.max(0.5, fitRef.distance);
    if (goal.placement) {
      goal.placement.object.getWorldPosition(scratchWorld);
      scratchTarget.copy(scratchWorld).add(goal.placement.centerOffset);
    } else {
      scratchTarget.set(fitRef.center[0], fitRef.center[1], fitRef.center[2]);
    }
    // Solved against BOTH half-angles, not a constant multiple of the radius.
    // A phone canvas is ~0.46 aspect, so its horizontal half-angle is less
    // than half its vertical one — measured, a fixed multiple that framed a
    // tower perfectly on a desktop ran it off both sides of a portrait screen.
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const tanH = tanV * Math.max(0.2, camera.aspect);
    let wanted = fitDistance;
    if (goal.placement) {
      const radius = Math.max(0.5, goal.placement.boundRadius);
      wanted = THREE.MathUtils.clamp(
        (radius / Math.min(tanV, tanH)) * ITEM_FRAME_MARGIN,
        fitDistance * MIN_FIT_FRACTION,
        fitDistance * MAX_FIT_FRACTION
      );
      if (camera.aspect < 1) scratchTarget.y -= wanted * tanV * PORTRAIT_LIFT;
    }

    // The viewer's current direction, so only the distance and the look-at
    // point move. A degenerate direction (camera sitting on its own target)
    // falls back to the camera's forward axis rather than snapping to a default.
    scratchDirection.copy(camera.position).sub(controls.target);
    if (scratchDirection.lengthSq() < 1e-6) camera.getWorldDirection(scratchDirection).negate();
    scratchDirection.normalize();

    const step = reducedMotion ? 1 : 1 - Math.exp(-EASE_RATE * Math.max(0, delta));
    const before =
      controls.target.distanceTo(scratchTarget) +
      Math.abs(camera.position.distanceTo(controls.target) - wanted);
    controls.target.lerp(scratchTarget, step);
    const distance = THREE.MathUtils.lerp(
      camera.position.distanceTo(controls.target),
      wanted,
      step
    );
    camera.position.copy(controls.target).addScaledVector(scratchDirection, distance);
    // Near/far follow the flight: a plane solved for a 90-unit overview clips
    // the front off an item framed at 6 units.
    camera.near = Math.max(0.1, distance / 120);
    camera.far = Math.max(distance * 12, 900);
    camera.updateProjectionMatrix();
    controls.update?.();

    if (before < ARRIVE_EPSILON || reducedMotion) goalRef.current = null;
  });

  return null;
}
