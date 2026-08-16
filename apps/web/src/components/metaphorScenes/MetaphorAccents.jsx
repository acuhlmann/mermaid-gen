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

/** Height of the shaft above the anchor, in world units. */
const SHAFT_HEIGHT = 5.5;

function AccentBeam({ position, color }) {
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
      pinRef.current.position.y = SHAFT_HEIGHT + 1.35 + Math.sin(t * 1.15) * 0.22;
      pinRef.current.rotation.y = t * 0.6;
    }
  });

  const shaftGeometry = useMemo(
    () => new THREE.CylinderGeometry(0.5, 0.16, SHAFT_HEIGHT, 16, 1, true),
    []
  );

  return (
    <group position={position}>
      {/* Light shaft: additive, no depth write, so it reads as light rather than
          as a translucent cone parked on top of the item. */}
      <mesh geometry={shaftGeometry} position={[0, SHAFT_HEIGHT / 2 + 0.45, 0]}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.1}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <group ref={haloRef} position={[0, 0.35, 0]}>
        <GlowSprite size={3.2} color={color} opacity={0.26} />
      </group>
      <mesh ref={ringRef} position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.15, 1.4, 44]} />
        <meshBasicMaterial color={color} transparent opacity={0.92} depthWrite={false} />
      </mesh>
      {/* An OPAQUE, lit pin above the shaft. The shaft and halo are translucent,
          which makes them a matter of contrast — and against the whiteboard
          theme's near-white sky there is barely any contrast to spend. A solid
          shape carries the marker on any background, and a slow bob keeps it
          reading as a pointer rather than as scene furniture. */}
      <mesh ref={pinRef} position={[0, SHAFT_HEIGHT + 1.35, 0]} rotation={[Math.PI, 0, 0]}>
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
  // Amber by default: it is the one hue no metaphor palette uses for an
  // encoding, so the marker can never be mistaken for a district or cluster.
  const color = theme.accentMarkerColor ?? theme.slabTrimColor ?? theme.starColor ?? '#fbbf24';
  return (
    <group>
      {accented.map((item) => (
        <AccentBeam key={`accent-${item.id}`} position={anchors.get(item.id)} color={color} />
      ))}
    </group>
  );
}
