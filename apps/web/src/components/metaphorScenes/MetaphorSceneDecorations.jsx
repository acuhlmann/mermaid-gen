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
import { FRAME_IGNORE_DATA } from './sceneFraming.js';
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
    <group userData={FRAME_IGNORE_DATA}>
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
    const end = new THREE.Vector3(
      Math.cos(a2) * r * 0.7,
      y1 - (10 + seed * 14),
      Math.sin(a2) * r * 0.7
    );
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
    <group userData={FRAME_IGNORE_DATA}>
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
    <group ref={groupRef} userData={FRAME_IGNORE_DATA}>
      {flies.map((f, i) => (
        <mesh key={`fly-${i}`} position={[f.x, f.y, f.z]}>
          <sphereGeometry args={[0.055, 6, 6]} />
          <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.9} />
        </mesh>
      ))}
    </group>
  );
}

/** Sunlit pollen and dandelion seeds drifting over daytime outdoor scenes. */
export function DaylightPollen({ radius, count = 18, idSeed = 'pollen' }) {
  const groupRef = useRef(null);
  const { getTime, animated } = useMetaphorClock();
  const motes = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = idHash2(idSeed, `a${i}`) * Math.PI * 2;
        const dist = Math.sqrt(idHash2(idSeed, `d${i}`)) * radius * 0.85;
        return {
          x: Math.cos(angle) * dist,
          y: 0.8 + idHash2(idSeed, `y${i}`) * 3.2,
          z: Math.sin(angle) * dist,
          phase: idHash2(idSeed, `p${i}`) * Math.PI * 2,
          speed: 0.15 + idHash2(idSeed, `s${i}`) * 0.22,
          sway: 0.35 + idHash2(idSeed, `w${i}`) * 0.7,
          scale: 0.7 + idHash2(idSeed, `z${i}`) * 0.8
        };
      }),
    [count, idSeed, radius]
  );
  useFrame(() => {
    if (!animated || !groupRef.current) return;
    const t = getTime();
    groupRef.current.children.forEach((child, i) => {
      const mote = motes[i];
      if (!mote) return;
      child.position.set(
        mote.x + Math.sin(t * mote.speed + mote.phase) * mote.sway,
        mote.y + Math.sin(t * mote.speed * 0.7 + mote.phase) * 0.35,
        mote.z + Math.cos(t * mote.speed * 0.85 + mote.phase) * mote.sway
      );
      child.rotation.y = t * mote.speed + mote.phase;
    });
  });
  return (
    <group ref={groupRef} userData={FRAME_IGNORE_DATA}>
      {motes.map((mote, i) => (
        <group
          key={`pollen-${i}`}
          position={[mote.x, mote.y, mote.z]}
          scale={mote.scale}
          rotation={[0, mote.phase, 0]}
        >
          <mesh>
            <sphereGeometry args={[0.035, 6, 6]} />
            <meshStandardMaterial color="#fffdf1" roughness={0.75} />
          </mesh>
          <mesh position={[0, 0.08, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.07, 8]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.48} side={THREE.DoubleSide} />
          </mesh>
        </group>
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
    <group ref={groupRef} userData={FRAME_IGNORE_DATA}>
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

/** Tiny emissive cars circling the city's ring road with a headlight glow —
 *  the skyline reads as alive even before any flow links animate. */
export function CityTraffic({ radius, theme, count = 9, idSeed = 'traffic' }) {
  const groupRef = useRef(null);
  const { getTime, animated } = useMetaphorClock();
  const cars = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        lane: radius * (0.78 + idHash2(idSeed, `l${i}`) * 0.14),
        phase: idHash2(idSeed, `p${i}`) * Math.PI * 2,
        speed: (0.14 + idHash2(idSeed, `s${i}`) * 0.12) * (idHash2(idSeed, `d${i}`) > 0.5 ? 1 : -1)
      })),
    [radius, count, idSeed]
  );
  const headlight = theme.windowEmissiveColor ?? theme.windowColor ?? '#fef3c7';
  const taillight = theme.treeAccentColor ?? '#f87171';
  useFrame(() => {
    if (!animated || !groupRef.current) return;
    const t = getTime();
    groupRef.current.children.forEach((child, i) => {
      const car = cars[i];
      if (!car) return;
      const angle = car.phase + t * car.speed;
      child.position.set(Math.cos(angle) * car.lane, 0.09, Math.sin(angle) * car.lane);
      child.rotation.y = -angle + (car.speed > 0 ? 0 : Math.PI);
    });
  });
  return (
    <group ref={groupRef} userData={FRAME_IGNORE_DATA}>
      {cars.map((car, i) => (
        <group
          key={`car-${i}`}
          position={[Math.cos(car.phase) * car.lane, 0.09, Math.sin(car.phase) * car.lane]}
        >
          <mesh>
            <boxGeometry args={[0.16, 0.09, 0.3]} />
            <meshStandardMaterial
              color={car.speed > 0 ? headlight : taillight}
              emissive={car.speed > 0 ? headlight : taillight}
              emissiveIntensity={1.1}
              toneMapped={false}
            />
          </mesh>
          <GlowSprite size={0.6} color={car.speed > 0 ? headlight : taillight} opacity={0.4} />
        </group>
      ))}
    </group>
  );
}

/** Celebration sparkles drifting up around the cake, looping forever. */
export function RisingSparkles({ radius, height, palette, count = 22, idSeed = 'sparkle' }) {
  const groupRef = useRef(null);
  const { getTime, animated } = useMetaphorClock();
  const colors = palette?.length ? palette : ['#ffd166', '#4cc9f0', '#ff6bcb', '#06d6a0'];
  const sparks = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = idHash2(idSeed, `a${i}`) * Math.PI * 2;
        const dist = radius * (0.55 + idHash2(idSeed, `d${i}`) * 0.75);
        return {
          x: Math.cos(angle) * dist,
          z: Math.sin(angle) * dist,
          phase: idHash2(idSeed, `p${i}`),
          speed: 0.05 + idHash2(idSeed, `s${i}`) * 0.06,
          sway: 0.2 + idHash2(idSeed, `w${i}`) * 0.3,
          colorIndex: Math.floor(idHash2(idSeed, `c${i}`) * colors.length)
        };
      }),
    [radius, count, idSeed, colors.length]
  );
  useFrame(() => {
    if (!animated || !groupRef.current) return;
    const t = getTime();
    groupRef.current.children.forEach((child, i) => {
      const s = sparks[i];
      if (!s) return;
      const cycle = (s.phase + t * s.speed) % 1;
      child.position.set(
        s.x + Math.sin(t * 0.8 + s.phase * 9) * s.sway,
        -0.9 + cycle * (height + 2.2),
        s.z + Math.cos(t * 0.7 + s.phase * 7) * s.sway
      );
      const fade = Math.sin(cycle * Math.PI);
      child.scale.setScalar(0.5 + fade * 0.8);
    });
  });
  return (
    <group ref={groupRef} userData={FRAME_IGNORE_DATA}>
      {sparks.map((s, i) => (
        <mesh key={`spark-${i}`} position={[s.x, -0.9, s.z]}>
          <sphereGeometry args={[0.05, 6, 6]} />
          <meshBasicMaterial
            color={colors[s.colorIndex]}
            toneMapped={false}
            transparent
            opacity={0.85}
          />
        </mesh>
      ))}
    </group>
  );
}

/** Flat additive glow disc on the ground — a soft spotlight pool under a
 *  centrepiece (e.g. the cake stand). Not billboarded: it hugs the floor. */
export function FloorGlowDisc({ radius, color, opacity = 0.22, y = 0 }) {
  const map = getRadialSpriteTexture();
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]}>
      <planeGeometry args={[radius * 2, radius * 2]} />
      <meshBasicMaterial
        map={map ?? undefined}
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  );
}

/** Expanding, fading shockwave ring — a slow supernova pulse for the galaxy's
 *  brightest star. Billboarded so the ring always faces the viewer. */
export function SupernovaPulse({ position, color, period = 7, idSeed = 'nova' }) {
  const ringRef = useRef(null);
  const matRef = useRef(null);
  const { getTime, animated } = useMetaphorClock();
  const offset = useMemo(() => idHash2(idSeed, 'offset') * period, [idSeed, period]);
  useFrame(() => {
    if (!ringRef.current || !matRef.current) return;
    if (!animated) {
      ringRef.current.visible = false;
      return;
    }
    const cycle = ((getTime() + offset) % period) / period;
    // Only the first ~40% of the period shows the pulse; then the star rests.
    if (cycle > 0.4) {
      ringRef.current.visible = false;
      return;
    }
    const p = cycle / 0.4;
    ringRef.current.visible = true;
    const scale = 0.6 + p * 4.2;
    ringRef.current.scale.set(scale, scale, scale);
    matRef.current.opacity = 0.55 * (1 - p);
  });
  return (
    <Billboard position={position}>
      <mesh ref={ringRef} visible={false}>
        <ringGeometry args={[0.86, 1, 40]} />
        <meshBasicMaterial
          ref={matRef}
          color={color}
          transparent
          opacity={0}
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </Billboard>
  );
}

/** Leaves shed from the canopies, tumbling and drifting to the meadow floor. */
export function FallingLeaves({ radius, height, color, count = 14, idSeed = 'leaf-fall' }) {
  const groupRef = useRef(null);
  const { getTime, animated } = useMetaphorClock();
  const leaves = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = idHash2(idSeed, `a${i}`) * Math.PI * 2;
        const dist = Math.sqrt(idHash2(idSeed, `d${i}`)) * radius * 0.8;
        return {
          x: Math.cos(angle) * dist,
          z: Math.sin(angle) * dist,
          phase: idHash2(idSeed, `p${i}`),
          speed: 0.03 + idHash2(idSeed, `s${i}`) * 0.03,
          sway: 0.5 + idHash2(idSeed, `w${i}`) * 0.8,
          spin: 1 + idHash2(idSeed, `r${i}`) * 2
        };
      }),
    [radius, count, idSeed]
  );
  useFrame(() => {
    if (!animated || !groupRef.current) return;
    const t = getTime();
    groupRef.current.children.forEach((child, i) => {
      const leaf = leaves[i];
      if (!leaf) return;
      const cycle = (leaf.phase + t * leaf.speed) % 1;
      child.position.set(
        leaf.x + Math.sin(t * 0.9 + leaf.phase * 8) * leaf.sway,
        height * (1 - cycle) + 0.2,
        leaf.z + Math.cos(t * 0.7 + leaf.phase * 5) * leaf.sway * 0.7
      );
      child.rotation.set(t * leaf.spin, leaf.phase * 6, t * leaf.spin * 0.6);
    });
  });
  return (
    <group ref={groupRef} userData={FRAME_IGNORE_DATA}>
      {leaves.map((leaf, i) => (
        <mesh key={`fall-${i}`} position={[leaf.x, height, leaf.z]}>
          <planeGeometry args={[0.16, 0.22]} />
          <meshStandardMaterial color={color} side={THREE.DoubleSide} transparent opacity={0.9} />
        </mesh>
      ))}
    </group>
  );
}

/** One wing, root to tip. */
const BIRD_WING_SPAN = 0.4;
/** Wing depth. ~7:1 is a gull; the old 3.5:1 was a plank. */
const BIRD_WING_CHORD = 0.055;
/** How far the silhouette is pulled toward the sky it is seen against. */
const BIRD_HAZE = 0.42;
/** Distant things are also thinner in the air, not only paler. */
const BIRD_OPACITY = 0.55;

/**
 * Silhouette birds circling lazily over a scene, wings flapping — shared by the
 * nature scenes (terrain, tree, river, garden, archipelago, bridge, iceberg,
 * fused). Reads the metaphor clock, so birds hold still during streaming like
 * every other animated flourish.
 *
 * A bird is only ever read as a bird if it reads as FAR. Each wing used to be a
 * 0.52 × 0.15 quad in near-black at 0.8 alpha — a 3.5:1 rectangle, which at the
 * camera distances these scenes actually solve to draws a pair of hard dark
 * slabs. Measured on the fused composite at desktop, they landed as ~30 px dark
 * chevrons in an otherwise pale sky, and read as rendering artefacts rather than
 * as wildlife (they were reported as "stray dark checkmarks"). Three things fix
 * it, all of them the aerial-perspective rule this codebase already applies to a
 * receded composite layer: a real wing proportion, less alpha, and — the one
 * that matters most — a silhouette lerped TOWARD the sky it is seen against
 * rather than a fixed near-black. Anything genuinely distant loses contrast with
 * its background; a bird that does not is a hole punched in the sky.
 */
export function SoaringBirds({
  radius = 10,
  height = 8,
  count = 3,
  color = '#1f2937',
  /** The sky the birds are seen against; the silhouette is pulled toward it. */
  hazeColor = null,
  idSeed = 'birds'
}) {
  const wingColor = useMemo(() => {
    if (!hazeColor) return color;
    try {
      return `#${new THREE.Color(color).lerp(new THREE.Color(hazeColor), BIRD_HAZE).getHexString()}`;
    } catch {
      return color;
    }
  }, [color, hazeColor]);
  const groupRef = useRef(null);
  const { getTime, animated } = useMetaphorClock();
  const birds = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        phase: idHash2(idSeed, `p${i}`) * Math.PI * 2,
        speed:
          (0.1 + idHash2(idSeed, `s${i}`) * 0.08) * (idHash2(idSeed, `dir${i}`) > 0.5 ? 1 : -1),
        r: radius * (0.5 + idHash2(idSeed, `r${i}`) * 0.5),
        h: height + idHash2(idSeed, `h${i}`) * 3,
        flap: 4 + idHash2(idSeed, `f${i}`) * 3
      })),
    [radius, height, count, idSeed]
  );
  useFrame(() => {
    if (!animated || !groupRef.current) return;
    const t = getTime();
    groupRef.current.children.forEach((child, i) => {
      const b = birds[i];
      if (!b) return;
      const angle = b.phase + t * b.speed;
      child.position.set(
        Math.cos(angle) * b.r,
        b.h + Math.sin(t * 0.7 + b.phase) * 0.5,
        Math.sin(angle) * b.r
      );
      child.rotation.y = -angle + (b.speed > 0 ? 0 : Math.PI);
      const flap = Math.sin(t * b.flap + b.phase) * 0.55;
      if (child.children[0]) child.children[0].rotation.z = 0.25 + flap;
      if (child.children[1]) child.children[1].rotation.z = -0.25 - flap;
    });
  });
  return (
    <group ref={groupRef} userData={FRAME_IGNORE_DATA}>
      {birds.map((b, i) => (
        <group key={`bird-${i}`} position={[Math.cos(b.phase) * b.r, b.h, Math.sin(b.phase) * b.r]}>
          <mesh position={[BIRD_WING_SPAN / 2, 0, 0]} rotation={[0, 0, 0.25]}>
            <planeGeometry args={[BIRD_WING_SPAN, BIRD_WING_CHORD]} />
            <meshBasicMaterial
              color={wingColor}
              side={THREE.DoubleSide}
              transparent
              opacity={BIRD_OPACITY}
              depthWrite={false}
            />
          </mesh>
          <mesh position={[-BIRD_WING_SPAN / 2, 0, 0]} rotation={[0, 0, -0.25]}>
            <planeGeometry args={[BIRD_WING_SPAN, BIRD_WING_CHORD]} />
            <meshBasicMaterial
              color={wingColor}
              side={THREE.DoubleSide}
              transparent
              opacity={BIRD_OPACITY}
              depthWrite={false}
            />
          </mesh>
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

/* ---------------------------------------------------------------------------
 * Mood ambience — the `scene.mood` particle layer shared by every kind. One
 * parameterized vocabulary (embers, snow, petals, rain, stars, aurora) seeded
 * from stable ids and driven by the metaphor clock, so streaming and reduced
 * motion freeze into a stable pose. Glow-type particles use additive blending:
 * it is commutative, so overlapping transparent sprites never flip draw order
 * and shimmer (the river source/mouth flicker pattern).
 * ------------------------------------------------------------------------- */

/** Loop progress along a path, fading in/out at both ends so the wrap-around
 *  teleport is invisible. */
function moodLoop(progress) {
  const edge = Math.min(progress, 1 - progress);
  return THREE.MathUtils.smoothstep(edge, 0, 0.16);
}

function MoodDriftField({ fx, radius, rising }) {
  const groupRef = useRef(null);
  const { getTime, animated } = useMetaphorClock();
  const isRain = fx.type === 'rain';
  const drops = useMemo(
    () =>
      Array.from({ length: fx.count ?? 24 }, (_, i) => ({
        x: (idHash2('mood', `x${i}`) - 0.5) * 2 * radius,
        z: (idHash2('mood', `z${i}`) - 0.5) * 2 * radius,
        phase: idHash2('mood', `p${i}`),
        speed: (isRain ? 0.5 : 0.05) + idHash2('mood', `s${i}`) * (isRain ? 0.35 : 0.05),
        sway: 0.4 + idHash2('mood', `w${i}`) * (isRain ? 0.2 : 1.1),
        size: 0.6 + idHash2('mood', `r${i}`) * 0.8,
        alt: idHash2('mood', `a${i}`) > 0.5
      })),
    [fx.count, radius, isRain]
  );
  const span = isRain ? 13 : 10;
  useFrame(() => {
    if (!animated || !groupRef.current) return;
    const t = getTime();
    groupRef.current.children.forEach((child, i) => {
      const d = drops[i];
      if (!d) return;
      const progress = (d.phase + t * d.speed) % 1;
      const y = rising ? 0.4 + progress * span : 12.4 - progress * span;
      child.position.set(
        d.x + Math.sin(t * 0.7 + d.phase * 7) * d.sway,
        y,
        d.z + Math.cos(t * 0.55 + d.phase * 5) * d.sway
      );
      if (!isRain) child.rotation.y = t * 1.2 + d.phase * Math.PI * 2;
      if (!isRain) child.rotation.x = Math.sin(t * 1.4 + d.phase * 9) * 0.9;
      if (child.material) child.material.opacity = 0.75 * moodLoop(progress);
    });
  });
  const additive = fx.type !== 'petals';
  return (
    <group ref={groupRef} rotation={isRain ? [0, 0, 0.1] : [0, 0, 0]}>
      {drops.map((d, i) => (
        <mesh key={`drop-${i}`} position={[d.x, 6, d.z]} scale={d.size}>
          {isRain ? (
            <boxGeometry args={[0.02, 0.55, 0.02]} />
          ) : fx.type === 'petals' ? (
            <planeGeometry args={[0.16, 0.11]} />
          ) : (
            <sphereGeometry args={[0.05, 6, 6]} />
          )}
          {fx.type === 'petals' ? (
            <meshStandardMaterial
              color={d.alt ? fx.color2 : fx.color}
              roughness={0.7}
              side={THREE.DoubleSide}
              transparent
              opacity={0.85}
              depthWrite={false}
            />
          ) : (
            <meshBasicMaterial
              color={d.alt && fx.color2 ? fx.color2 : fx.color}
              transparent
              opacity={0.75}
              depthWrite={false}
              blending={additive ? THREE.AdditiveBlending : THREE.NormalBlending}
              toneMapped={false}
            />
          )}
        </mesh>
      ))}
    </group>
  );
}

/** Twinkling stars scattered high above the scene (night mood). */
function MoodStarField({ color, count = 34, radius }) {
  const groupRef = useRef(null);
  const { getTime, animated } = useMetaphorClock();
  const stars = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = idHash2('moodstar', `a${i}`) * Math.PI * 2;
        const dist = Math.sqrt(idHash2('moodstar', `d${i}`)) * radius * 1.3;
        return {
          x: Math.cos(angle) * dist,
          y: 13 + idHash2('moodstar', `y${i}`) * 13,
          z: Math.sin(angle) * dist,
          size: 0.5 + idHash2('moodstar', `s${i}`) * 1.1,
          blink: 0.8 + idHash2('moodstar', `b${i}`) * 2.2,
          phase: idHash2('moodstar', `p${i}`) * Math.PI * 2
        };
      }),
    [count, radius]
  );
  useFrame(() => {
    if (!animated || !groupRef.current) return;
    const t = getTime();
    groupRef.current.children.forEach((child, i) => {
      const s = stars[i];
      if (!s) return;
      child.scale.setScalar(s.size * (0.65 + 0.35 * Math.sin(t * s.blink + s.phase)));
    });
  });
  return (
    <group ref={groupRef}>
      {stars.map((s, i) => (
        <mesh key={`star-${i}`} position={[s.x, s.y, s.z]} scale={s.size}>
          <sphereGeometry args={[0.06, 6, 6]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.9}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

/** Broad aurora curtains waving slowly far around the scene (aurora mood). */
function MoodAuroraCurtains({ color, color2, count = 3 }) {
  const meshRefs = useRef([]);
  const { getTime, animated } = useMetaphorClock();
  const curtains = useMemo(() => {
    return Array.from({ length: count }, (_, c) => {
      const geom = new THREE.PlaneGeometry(46, 15, 48, 1);
      const positions = geom.attributes.position;
      const colors = new Float32Array(positions.count * 3);
      const from = new THREE.Color(color);
      const to = new THREE.Color(color2 ?? color);
      for (let i = 0; i < positions.count; i += 1) {
        const u = (positions.getX(i) + 23) / 46;
        const mixed = from.clone().lerp(to, u);
        colors[i * 3] = mixed.r;
        colors[i * 3 + 1] = mixed.g;
        colors[i * 3 + 2] = mixed.b;
      }
      geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      return {
        geom,
        base: Float32Array.from(positions.array),
        angle: (c / count) * Math.PI * 2 + 0.5,
        radius: 46 + c * 7,
        y: 24 + c * 3,
        offset: c * 1.7
      };
    });
  }, [color, color2, count]);
  useFrame(() => {
    curtains.forEach((curtain, c) => {
      const mesh = meshRefs.current[c];
      if (!mesh) return;
      const t = animated ? getTime() : 0;
      const pos = mesh.geometry.attributes.position;
      for (let i = 0; i < pos.count; i += 1) {
        const bx = curtain.base[i * 3];
        const by = curtain.base[i * 3 + 1];
        // Slow vertical billow, stronger toward the top edge.
        const strength = (by + 7.5) / 15;
        pos.setZ(i, Math.sin(bx * 0.22 + t * 0.5 + curtain.offset) * 2.6 * strength);
      }
      pos.needsUpdate = true;
    });
  });
  return (
    <group>
      {curtains.map((curtain, c) => (
        <mesh
          key={`curtain-${c}`}
          ref={(el) => {
            meshRefs.current[c] = el;
          }}
          geometry={curtain.geom}
          position={[
            Math.cos(curtain.angle) * curtain.radius,
            curtain.y,
            Math.sin(curtain.angle) * curtain.radius
          ]}
          rotation={[0, -curtain.angle + Math.PI / 2, 0]}
          frustumCulled={false}
        >
          <meshBasicMaterial
            vertexColors
            transparent
            opacity={0.14}
            depthWrite={false}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
            fog={false}
          />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Ambient particle layer for the DSL's `scene.mood`. Rendered outside <Bounds>
 * with a fixed spread so it never reframes the subject; `fx` is the particle
 * descriptor stashed on the theme by applyMoodToTheme.
 */
export function MoodAmbience({ fx, radius = 30 }) {
  if (!fx?.type) return null;
  if (fx.type === 'fireflies') {
    return (
      <MeadowFireflies
        radius={radius}
        color={fx.color ?? '#ffe28a'}
        count={fx.count ?? 22}
        idSeed="mood-fireflies"
      />
    );
  }
  if (fx.type === 'stars') {
    return <MoodStarField color={fx.color ?? '#dbeafe'} count={fx.count} radius={radius} />;
  }
  if (fx.type === 'aurora') {
    return <MoodAuroraCurtains color={fx.color ?? '#5eead4'} color2={fx.color2} count={fx.count} />;
  }
  if (fx.type === 'embers' || fx.type === 'snow' || fx.type === 'petals' || fx.type === 'rain') {
    return <MoodDriftField fx={fx} radius={radius} rising={fx.type === 'embers'} />;
  }
  return null;
}
