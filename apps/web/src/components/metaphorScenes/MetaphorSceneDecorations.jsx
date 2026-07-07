/**
 * Decorative flourish components for the metaphor3d scenes — pulsing spire
 * beacons and penthouse light bands (city), icing drips and sprinkles
 * (layercake), spinning discs and shooting stars (galaxy), canopy sway and
 * meadow fireflies (tree), drifting low-poly clouds (terrain), and the sun
 * glow for the tree sky. Everything is seeded from stable ids (no Math.random)
 * so scenes render identically across frames and reloads. Animated pieces read
 * the shared metaphor clock (frozen during streaming); the sky-level pieces
 * (ShootingStars, SkySunGlow) render outside the clock provider and gate on an
 * `animated` prop instead.
 */
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import { useMetaphorClock } from './metaphorClock.js';
import { GlowSprite } from './MetaphorSceneChrome.jsx';
import { getRadialSpriteTexture, idHash2 } from './sceneUtils.js';

/** Blinking aviation-style light capping a city spire — bloom picks up the pulse. */
export function SpireBeacon({ position, color, seed = 0 }) {
  const matRef = useRef(null);
  const { getTime, animated } = useMetaphorClock();
  useFrame(() => {
    if (!animated || !matRef.current) return;
    const blink = 0.5 + 0.5 * Math.sin(getTime() * 2.4 + seed * Math.PI * 2);
    matRef.current.emissiveIntensity = 0.5 + blink * 1.8;
  });
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[0.09, 10, 10]} />
        <meshStandardMaterial
          ref={matRef}
          color={color}
          emissive={color}
          emissiveIntensity={1.4}
          toneMapped={false}
        />
      </mesh>
      <GlowSprite size={0.85} color={color} opacity={0.35} />
    </group>
  );
}

/** Bright band just under the roof line — reads as penthouse lighting on landmark towers. */
export function PenthouseGlowBand({ footprint, y, color }) {
  return (
    <mesh position={[0, y, 0]}>
      <boxGeometry args={[footprint * 1.04, 0.1, footprint * 1.04]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  );
}

/**
 * Icing drips hanging off the top layer's rim (classic drip-cake look), skipping
 * the cutaway gap like the frosting dollops so nothing floats over the missing
 * slice. Uses the cylinder theta convention (x = r·sin θ, z = r·cos θ).
 */
export function IcingDrips({ radius, topY, thetaLength, color, idSeed }) {
  const drips = useMemo(() => {
    const count = Math.max(10, Math.min(20, Math.round(radius * 2.1)));
    const fullCircle = Math.abs(thetaLength - Math.PI * 2) < 1e-6;
    const margin = 0.22;
    const out = [];
    for (let i = 0; i < count; i += 1) {
      const theta = fullCircle
        ? (i / count) * Math.PI * 2
        : margin + (i / (count - 1)) * (thetaLength - margin * 2);
      out.push({
        x: Math.sin(theta) * (radius + 0.02),
        z: Math.cos(theta) * (radius + 0.02),
        len: 0.28 + idHash2(idSeed, `drip-l${i}`) * 0.55,
        r: 0.05 + idHash2(idSeed, `drip-r${i}`) * 0.035
      });
    }
    return out;
  }, [radius, thetaLength, idSeed]);
  return (
    <group>
      {drips.map((d, i) => (
        <group key={`drip-${i}`} position={[d.x, topY, d.z]}>
          <mesh position={[0, -d.len / 2, 0]}>
            <cylinderGeometry args={[d.r, d.r * 0.75, d.len, 8]} />
            <meshStandardMaterial color={color} roughness={0.32} />
          </mesh>
          <mesh position={[0, -d.len, 0]}>
            <sphereGeometry args={[d.r * 1.25, 10, 8]} />
            <meshStandardMaterial color={color} roughness={0.32} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Confetti sprinkles scattered on the top layer, coloured from the cluster palette. */
export function CakeSprinkles({ radius, topY, thetaLength, palette, idSeed }) {
  const colors = palette?.length ? palette : ['#ffd166', '#4cc9f0', '#ff6bcb', '#06d6a0'];
  const sprinkles = useMemo(() => {
    const count = Math.max(18, Math.min(34, Math.round(radius * 6)));
    const fullCircle = Math.abs(thetaLength - Math.PI * 2) < 1e-6;
    const margin = 0.2;
    const out = [];
    for (let i = 0; i < count; i += 1) {
      const thetaSeed = idHash2(idSeed, `spr-t${i}`);
      const theta = fullCircle
        ? thetaSeed * Math.PI * 2
        : margin + thetaSeed * (thetaLength - margin * 2);
      const dist = Math.sqrt(idHash2(idSeed, `spr-d${i}`)) * Math.max(0.4, radius - 0.6);
      out.push({
        x: Math.sin(theta) * dist,
        z: Math.cos(theta) * dist,
        rot: [
          idHash2(idSeed, `spr-rx${i}`) * Math.PI,
          idHash2(idSeed, `spr-ry${i}`) * Math.PI,
          idHash2(idSeed, `spr-rz${i}`) * Math.PI
        ],
        colorIndex: Math.floor(idHash2(idSeed, `spr-c${i}`) * colors.length)
      });
    }
    return out;
  }, [radius, thetaLength, idSeed, colors.length]);
  return (
    <group>
      {sprinkles.map((s, i) => (
        <mesh key={`spr-${i}`} position={[s.x, topY + 0.05, s.z]} rotation={s.rot}>
          <capsuleGeometry args={[0.035, 0.12, 3, 6]} />
          <meshStandardMaterial
            color={colors[s.colorIndex]}
            emissive={colors[s.colorIndex]}
            emissiveIntensity={0.15}
            roughness={0.3}
          />
        </mesh>
      ))}
    </group>
  );
}

/** Slow Y-axis rotation for galaxy discs — stardust and dust arms drift past the
 *  anchored suns, giving each cluster a majestic spin without moving the items. */
export function SpinningGroup({ speed = 0.04, phase = 0, children }) {
  const ref = useRef(null);
  const { getTime, animated } = useMetaphorClock();
  useFrame(() => {
    if (!animated || !ref.current) return;
    ref.current.rotation.y = phase + getTime() * speed;
  });
  return (
    <group ref={ref} rotation={[0, phase, 0]}>
      {children}
    </group>
  );
}

function ShootingStar({ seed, animated, color }) {
  const groupRef = useRef(null);
  const tailRef = useRef(null);
  const headRef = useRef(null);
  const path = useMemo(() => {
    // Kept low (just above the framed clusters) so the streak crosses the
    // visible sky band instead of passing overhead outside the camera frustum.
    const a1 = seed * Math.PI * 2;
    const a2 = a1 + 0.9 + seed * 0.8;
    const y1 = 18 + seed * 26;
    const r = 70;
    const start = new THREE.Vector3(Math.cos(a1) * r, y1, Math.sin(a1) * r);
    const end = new THREE.Vector3(Math.cos(a2) * r * 0.7, y1 - (10 + seed * 14), Math.sin(a2) * r * 0.7);
    const dir = end.clone().sub(start).normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    return { start, end, quat };
  }, [seed]);
  const period = 6 + seed * 9;
  const duration = 1.15;
  useFrame((state) => {
    const g = groupRef.current;
    if (!g) return;
    if (!animated) {
      g.visible = false;
      return;
    }
    const cycle = (state.clock.elapsedTime + seed * 97) % period;
    if (cycle > duration) {
      g.visible = false;
      return;
    }
    const p = cycle / duration;
    const fade = Math.sin(p * Math.PI);
    g.visible = true;
    g.position.lerpVectors(path.start, path.end, p);
    if (tailRef.current) tailRef.current.opacity = 0.5 * fade;
    if (headRef.current) headRef.current.opacity = 0.95 * fade;
  });
  return (
    <group ref={groupRef} visible={false}>
      <group quaternion={path.quat}>
        {/* Tail trails behind the head (local −Y = backwards along the path). */}
        <mesh position={[0, -4, 0]}>
          <cylinderGeometry args={[0.2, 0.02, 8, 6, 1, true]} />
          <meshBasicMaterial
            ref={tailRef}
            color={color}
            transparent
            opacity={0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      </group>
      <mesh>
        <sphereGeometry args={[0.22, 8, 8]} />
        <meshBasicMaterial
          ref={headRef}
          color="#ffffff"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

const SHOOTING_STAR_SEEDS = [0.13, 0.47, 0.82];

/** Occasional meteors streaking across the galaxy sky. Lives outside the clock
 *  provider (sky level), so it gates on `animated` and uses the frame clock. */
export function ShootingStars({ animated = true, color = '#f8fafc' }) {
  return (
    <group>
      {SHOOTING_STAR_SEEDS.map((seed) => (
        <ShootingStar key={`meteor-${seed}`} seed={seed} animated={animated} color={color} />
      ))}
    </group>
  );
}

/** Gentle wind sway for foliage — a slow rotational breathe around the group's pivot. */
export function SwayGroup({ seed = 0, amplitude = 0.028, speed = 0.5, children }) {
  const ref = useRef(null);
  const { getTime, animated } = useMetaphorClock();
  useFrame(() => {
    if (!animated || !ref.current) return;
    const t = getTime();
    ref.current.rotation.z = Math.sin(t * speed + seed * Math.PI * 2) * amplitude;
    ref.current.rotation.x = Math.cos(t * speed * 0.8 + seed * Math.PI * 4) * amplitude * 0.6;
  });
  return <group ref={ref}>{children}</group>;
}

/** Fireflies wandering and blinking over the tree meadow at dusk height. */
export function MeadowFireflies({ radius, color = '#ffe28a', count = 22, idSeed = 'fireflies' }) {
  const groupRef = useRef(null);
  const { getTime, animated } = useMetaphorClock();
  const flies = useMemo(() => {
    const out = [];
    for (let i = 0; i < count; i += 1) {
      const angle = idHash2(idSeed, `a${i}`) * Math.PI * 2;
      const dist = Math.sqrt(idHash2(idSeed, `d${i}`)) * radius * 0.85;
      out.push({
        x: Math.cos(angle) * dist,
        y: 0.6 + idHash2(idSeed, `y${i}`) * 2.4,
        z: Math.sin(angle) * dist,
        amp: 0.5 + idHash2(idSeed, `m${i}`) * 1.1,
        speed: 0.3 + idHash2(idSeed, `s${i}`) * 0.5,
        phase: idHash2(idSeed, `p${i}`) * Math.PI * 2,
        blink: 1.5 + idHash2(idSeed, `b${i}`) * 2
      });
    }
    return out;
  }, [radius, count, idSeed]);
  useFrame(() => {
    if (!animated || !groupRef.current) return;
    const t = getTime();
    groupRef.current.children.forEach((child, i) => {
      const f = flies[i];
      if (!f) return;
      child.position.set(
        f.x + Math.sin(t * f.speed + f.phase) * f.amp,
        f.y + Math.sin(t * f.speed * 0.7 + f.phase * 2) * 0.4,
        f.z + Math.cos(t * f.speed * 0.85 + f.phase) * f.amp
      );
      child.scale.setScalar(0.7 + (0.55 + 0.45 * Math.sin(t * f.blink + f.phase * 3)) * 0.6);
    });
  });
  return (
    <group ref={groupRef}>
      {flies.map((f, i) => (
        <mesh key={`fly-${i}`} position={[f.x, f.y, f.z]}>
          <sphereGeometry args={[0.055, 6, 6]} />
          <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.9} />
        </mesh>
      ))}
    </group>
  );
}

/** Low-poly cloud puffs drifting gently above the terrain peaks. Oscillating
 *  drift (not wrapping) so clouds never pop in or out at the edges. */
export function TerrainClouds({ halfExtent, maxHeight, idSeed = 'terrain-clouds' }) {
  const groupRef = useRef(null);
  const { getTime, animated } = useMetaphorClock();
  const clouds = useMemo(() => {
    const count = 5;
    const out = [];
    for (let i = 0; i < count; i += 1) {
      const puffCount = 3 + Math.floor(idHash2(idSeed, `pc${i}`) * 2);
      const puffs = [];
      for (let p = 0; p < puffCount; p += 1) {
        puffs.push({
          pos: [
            (p - (puffCount - 1) / 2) * 0.9 + (idHash2(idSeed, `px${i}-${p}`) - 0.5) * 0.4,
            (idHash2(idSeed, `py${i}-${p}`) - 0.5) * 0.3,
            (idHash2(idSeed, `pz${i}-${p}`) - 0.5) * 0.8
          ],
          r: 0.55 + idHash2(idSeed, `pr${i}-${p}`) * 0.45
        });
      }
      out.push({
        x: (idHash2(idSeed, `x${i}`) - 0.5) * halfExtent * 1.7,
        y: maxHeight + 2.2 + idHash2(idSeed, `h${i}`) * 2.4,
        z: (idHash2(idSeed, `z${i}`) - 0.5) * halfExtent * 1.7,
        scale: 0.8 + idHash2(idSeed, `s${i}`) * 0.9,
        amp: 1.5 + idHash2(idSeed, `m${i}`) * 2,
        speed: 0.05 + idHash2(idSeed, `v${i}`) * 0.06,
        phase: idHash2(idSeed, `p${i}`) * Math.PI * 2,
        puffs
      });
    }
    return out;
  }, [halfExtent, maxHeight, idSeed]);
  useFrame(() => {
    if (!animated || !groupRef.current) return;
    const t = getTime();
    groupRef.current.children.forEach((child, i) => {
      const c = clouds[i];
      if (!c) return;
      child.position.x = c.x + Math.sin(t * c.speed + c.phase) * c.amp;
      child.position.y = c.y + Math.sin(t * c.speed * 1.6 + c.phase * 2) * 0.25;
    });
  });
  return (
    <group ref={groupRef}>
      {clouds.map((c, i) => (
        <group key={`cloud-${i}`} position={[c.x, c.y, c.z]} scale={c.scale}>
          {c.puffs.map((p, j) => (
            <mesh key={`puff-${j}`} position={p.pos} scale={[1, 0.62, 1]}>
              <icosahedronGeometry args={[p.r, 0]} />
              <meshStandardMaterial
                color="#f4f6fb"
                flatShading
                roughness={0.9}
                transparent
                opacity={0.92}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/** Warm sun disc + halo for the tree sky, placed toward the directional light.
 *  Rendered outside <Bounds> (sky level), so it never enlarges the framing. */
export function SkySunGlow({ position = [85, 110, 55], color = '#fff3c4' }) {
  const map = getRadialSpriteTexture();
  return (
    <Billboard position={position}>
      <mesh>
        <planeGeometry args={[26, 26]} />
        <meshBasicMaterial
          map={map ?? undefined}
          color="#fffdf2"
          transparent
          opacity={0.95}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <mesh>
        <planeGeometry args={[70, 70]} />
        <meshBasicMaterial
          map={map ?? undefined}
          color={color}
          transparent
          opacity={0.35}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </Billboard>
  );
}
