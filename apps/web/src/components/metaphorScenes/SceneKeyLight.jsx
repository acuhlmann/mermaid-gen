/**
 * Key light + shadow rig for metaphor scenes.
 *
 * Scenes previously had only `<ContactShadows>` — a soft blur under the subject
 * — and no cast shadows at all, so a skyline, a grove and a gear plate all read
 * as flat cut-outs floating on a disc. A single shadow-mapped key light is the
 * cheapest thing that makes them read as objects with volume standing on ground.
 *
 * The detail that does the work: the shadow camera is **fitted to the content**,
 * not fixed. A directional light's shadow uses an orthographic frustum; leave it
 * at three's default ±5 and a 40-unit tree grove gets shadows for its middle 25%
 * and hard clipping everywhere else. It is re-fitted from the same `sceneFit`
 * the camera framing publishes, so it tracks scene size for free.
 *
 * What casts and receives is decided by `sceneShadowPolicy.js`.
 */
import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { FRAME_IGNORE } from './sceneFraming.js';
import {
  SHADOW_INTENSITY,
  SHADOW_MAP_SIZE,
  meshShouldCast,
  meshShouldReceive
} from './sceneShadowPolicy.js';

/**
 * Walks the content once per `contentKey` and flags what casts and receives.
 * Ambience subtrees are skipped whole — a firefly casting a shadow is both
 * wrong and expensive.
 */
export function SceneShadowFlags({ contentKey, targetRef }) {
  useEffect(() => {
    const root = targetRef?.current;
    if (!root) return;
    const visit = (object) => {
      if (object.userData?.[FRAME_IGNORE]) return;
      if (object.isMesh) {
        object.castShadow = meshShouldCast(object);
        object.receiveShadow = meshShouldReceive(object);
      }
      for (const child of object.children) visit(child);
    };
    visit(root);
  }, [contentKey, targetRef]);
  return null;
}

/**
 * The scene's key light. `direction` is the theme's authored light position,
 * normalised and re-placed at a distance that suits the fitted content.
 *
 * @param {object} props
 * @param {[number, number, number]} props.direction
 * @param {number} props.intensity
 * @param {string} [props.color]
 * @param {{ radius: number, center: number[], ready: boolean }} props.fitRef
 * @param {string} props.contentKey — re-fits the shadow frustum on scene change
 */
export function SceneKeyLight({
  direction,
  intensity,
  color = '#ffffff',
  fillColor = '#ffffff',
  fitRef,
  contentKey
}) {
  const lightRef = useRef(null);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    const light = lightRef.current;
    if (!light) return;
    const radius = Math.max(4, fitRef?.ready ? fitRef.radius : 14);
    const center = fitRef?.ready ? fitRef.center : [0, 0, 0];

    const length = Math.hypot(direction[0], direction[1], direction[2]) || 1;
    const distance = radius * 2.6;
    light.position.set(
      center[0] + (direction[0] / length) * distance,
      center[1] + (direction[1] / length) * distance,
      center[2] + (direction[2] / length) * distance
    );
    light.target.position.set(center[0], center[1], center[2]);
    light.target.updateMatrixWorld();

    // Ortho frustum wide enough for the whole subject plus the ground its
    // shadows fall on, which is why this is 1.5x rather than exactly the radius.
    const extent = radius * 1.5;
    const camera = light.shadow.camera;
    camera.left = -extent;
    camera.right = extent;
    camera.top = extent;
    camera.bottom = -extent;
    camera.near = Math.max(0.5, distance - radius * 3);
    camera.far = distance + radius * 3;
    camera.updateProjectionMatrix();
    // Bias scales with world size: a constant one that hides acne on a 10-unit
    // scene leaves visible peter-panning on a 60-unit one.
    light.shadow.bias = -0.0006 * (radius / 14);
    light.shadow.normalBias = 0.02 * (radius / 14);
    // Shadows darken; they must not black out. The dark themes already run a
    // low ambient, so a full-strength shadow term turned the bridge's shores
    // and the noir city's flanks into unreadable silhouettes — the shape was
    // there and nothing else was. Capping the term keeps shadow as depth
    // information rather than as an occlusion of the content.
    light.shadow.intensity = SHADOW_INTENSITY;
    invalidate?.();
    // `fitRef` is a stable mutable record; contentKey is what signals it changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- (reason: fitRef is a mutable ref object, not reactive state)
  }, [contentKey, direction, invalidate, fitRef]);

  return (
    <>
      <directionalLight
        ref={lightRef}
        intensity={intensity}
        color={color}
        castShadow
        shadow-mapSize-width={SHADOW_MAP_SIZE}
        shadow-mapSize-height={SHADOW_MAP_SIZE}
      />
      {/* Soft complementary fill from the opposite side lifts the shadowed faces
          so forms read as rounded and dimensional instead of flat. Tinting it
          with the theme's horizon colour auto-gates its strength: bright themes
          (near-white horizon) get a real fill, while dark/noir themes stay
          dramatic — the light contributes almost nothing. */}
      <directionalLight
        position={[-direction[0], direction[1] * 0.6, -direction[2]]}
        intensity={intensity * 0.28}
        color={fillColor}
      />
    </>
  );
}
