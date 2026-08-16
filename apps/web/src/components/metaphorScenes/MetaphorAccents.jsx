/**
 * Renders the `accent` marker: a light shaft and a halo over the item that IS
 * the scene's headline insight.
 *
 * The prompt has always told the agent to compose so its most extreme element
 * carries the thesis ("if everything is medium, the scene has no thesis"), but
 * nothing in the renderer ever *showed* which element that was — the viewer had
 * to infer it by comparing sizes. `accent` makes the claim explicit, and this
 * is what draws it.
 *
 * It rides each scene's existing `anchors` map, the same one `MetaphorLinks`
 * uses, because that map already answers the only question a marker needs: the
 * world point at the top of the thing. Fourteen scenes build it; none of them
 * needed a new concept to light one item up.
 */
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { GlowSprite } from './MetaphorSceneChrome.jsx';
import { useMetaphorClock } from './metaphorClock.js';
import { isDarkBackdrop } from './sceneUtils.js';

/** Height of the shaft above the anchor, in world units. */
const SHAFT_HEIGHT = 5.5;

/** The marker's hue, held constant across every theme. */
const ACCENT_MARKER_COLOR = '#fbbf24';

function AccentBeam({ position, color, additive }) {
  const haloRef = useRef(null);
  const ringRef = useRef(null);
  const pinRef = useRef(null);
  const { getTime, animated } = useMetaphorClock();

  useFrame(() => {
    const t = animated ? getTime() : 0;
    // Slow breathing rather than a blink: this marks the topic's thesis, and a
    // flashing thesis reads as an error state.
    const pulse = 0.72 + 0.28 * Math.sin(t * 1.15);
    if (haloRef.current) haloRef.current.scale.setScalar(pulse);
    if (ringRef.current) {
      ringRef.current.rotation.z = t * 0.35;
      ringRef.current.scale.setScalar(0.94 + 0.06 * Math.sin(t * 1.15 + 1));
    }
    if (pinRef.current) {
      pinRef.current.position.y = pinHeight + Math.sin(t * 1.15) * 0.22;
      pinRef.current.rotation.y = t * 0.6;
    }
  });

  // Without a shaft to cap, the pin sits closer to the item it marks.
  const pinHeight = additive ? SHAFT_HEIGHT + 1.35 : 2.6;

  const shaftGeometry = useMemo(
    () => new THREE.CylinderGeometry(0.5, 0.16, SHAFT_HEIGHT, 16, 1, true),
    []
  );

  return (
    <group position={position}>
      {/* Light shaft — dark backdrops only, and that is a real conclusion rather
          than a shortcut. Additive blending can only ADD light, so over
          whiteboard's near-white sky it is mathematically incapable of showing
          up; switching that same cone to normal blending does make it visible,
          but a pale translucent cone over a pale sky reads as a smudge sitting
          on the subject, and it dulled the very flower it was pointing at. A
          beam is a light effect and light effects need darkness. On bright
          themes the ring and the pin carry the marker on their own. */}
      {additive ? (
        <mesh geometry={shaftGeometry} position={[0, SHAFT_HEIGHT / 2 + 0.45, 0]}>
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.18}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      ) : null}
      {additive ? (
        <group ref={haloRef} position={[0, 0.35, 0]}>
          <GlowSprite size={3.2} color={color} opacity={0.3} />
        </group>
      ) : null}
      <mesh ref={ringRef} position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.15, 1.4, 44]} />
        <meshBasicMaterial color={color} transparent opacity={0.92} depthWrite={false} />
      </mesh>
      {/* An OPAQUE, lit pin above the shaft. The shaft and halo are translucent,
          which makes them a matter of contrast — and against the whiteboard
          theme's near-white sky there is barely any contrast to spend. A solid
          shape carries the marker on any background, and a slow bob keeps it
          reading as a pointer rather than as scene furniture. */}
      <mesh ref={pinRef} position={[0, pinHeight, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.42, 0.95, 5]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.55}
          roughness={0.35}
          metalness={0.15}
        />
      </mesh>
    </group>
  );
}

/**
 * @param {object} props
 * @param {Array<Record<string, unknown>>} props.items — the scene's items
 * @param {Map<string, [number, number, number]>} props.anchors — id → world anchor
 * @param {Record<string, unknown>} props.theme
 */
export function MetaphorAccents({ items, anchors, theme }) {
  const accented = useMemo(
    () => (items ?? []).filter((item) => item?.accent === true && anchors?.has(item.id)),
    [items, anchors]
  );
  if (!accented.length) return null;
  // Fixed amber, not a theme colour. Falling back through `slabTrimColor` /
  // `starColor` looked harmless and defeated the point: those ARE encoding
  // colours, so on noir the marker came out the same slate as the cake trim and
  // stopped reading as "look here". The marker has to be one hue no palette
  // spends on meaning; a theme that genuinely needs another sets
  // `accentMarkerColor` explicitly.
  const color = theme.accentMarkerColor ?? ACCENT_MARKER_COLOR;
  const additive = isDarkBackdrop(theme);
  return (
    <group>
      {accented.map((item) => (
        <AccentBeam
          key={`accent-${item.id}`}
          position={anchors.get(item.id)}
          color={color}
          additive={additive}
        />
      ))}
    </group>
  );
}
