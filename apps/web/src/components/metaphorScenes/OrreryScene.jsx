/**
 * Orrery metaphor scene — the subject as a solar system: a blazing sun at the
 * core (items with orbit 0), planets on concentric orbit rings (orbit value =
 * distance from the core, size = body scale), moons circling their parent
 * planet, and a spinning asteroid belt past the outermost ring. Rings carry a
 * travelling shimmer so the system reads as revolving without moving the
 * labelled bodies (labels, links, and hover anchors stay stable). Reuses the
 * galaxy's deep-space sky (GalaxySky, mounted by MetaphorRenderer).
 */
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard, Line } from '@react-three/drei';
import { orreryOrbitLayout } from '../../utils/metaphorLayouts/orreryOrbitLayout.js';
import { resolveClusterColor, resolveGalaxyVividTheme } from '../../utils/metaphorThemePresets.js';
import { Glyph } from '../metaphorGlyphs/index.jsx';
import { GlowSprite, HoverableItem, ItemLabel, MetaphorLinks } from './MetaphorSceneChrome.jsx';
import { MetaphorAccents } from './MetaphorAccents.jsx';
import { SpinningGroup } from './MetaphorSceneDecorations.jsx';
import { useMetaphorClock } from './metaphorClock.js';
import { getRadialSpriteTexture, idHash, idHash2, shiftColor } from './sceneUtils.js';

function clampedSize(item) {
  const raw = typeof item?.size === 'number' && Number.isFinite(item.size) ? item.size : 3;
  return THREE.MathUtils.clamp(raw, 0.1, 10);
}

function planetRadius(item) {
  return 0.34 + Math.sqrt(clampedSize(item)) * 0.26;
}

/** Blazing core star: layered corona sprites + a breathing emissive surface. */
function SunCore({ item, position, color, theme }) {
  const matRef = useRef(null);
  const flareRef = useRef(null);
  const { getTime, animated } = useMetaphorClock();
  const radius = item ? 1.05 + Math.sqrt(clampedSize(item)) * 0.32 : 1.0;
  const phase = useMemo(() => idHash(item?.id ?? 'core') * Math.PI * 2, [item]);
  const flares = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => ({
        angle: (i / 6) * Math.PI * 2 + phase * 0.1,
        len: radius * (1.6 + idHash2(item?.id ?? 'core', `flare${i}`) * 0.9),
        phase: idHash2(item?.id ?? 'core', `fp${i}`) * Math.PI * 2
      })),
    [item, radius, phase]
  );
  useFrame(() => {
    if (!animated || !matRef.current) return;
    const t = getTime();
    matRef.current.emissiveIntensity = 1.5 + 0.35 * Math.sin(t * 1.4 + phase);
    if (flareRef.current) {
      flareRef.current.rotation.y = t * 0.15;
      flareRef.current.children.forEach((child, i) => {
        const f = flares[i];
        if (!f || !child.material) return;
        child.material.opacity = 0.18 + 0.12 * Math.abs(Math.sin(t * 1.8 + f.phase));
      });
    }
  });
  const surface = useMemo(() => shiftColor(color, { lightness: 0.18, satScale: 0.9 }), [color]);
  return (
    <group position={position}>
      <GlowSprite size={radius * 7.5} color={color} opacity={0.3} />
      <GlowSprite size={radius * 4} color={surface} opacity={0.5} />
      <group ref={flareRef}>
        {flares.map((f, i) => (
          <mesh
            key={`flare-${i}`}
            rotation={[0, 0, f.angle]}
            position={[Math.cos(f.angle) * radius * 0.2, 0, Math.sin(f.angle) * radius * 0.2]}
          >
            <planeGeometry args={[f.len, radius * 0.18]} />
            <meshBasicMaterial
              color={surface}
              transparent
              opacity={0.22}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        ))}
      </group>
      <mesh>
        <sphereGeometry args={[radius, 24, 24]} />
        <meshStandardMaterial
          ref={matRef}
          color={surface}
          emissive={surface}
          emissiveIntensity={1.5}
          toneMapped={false}
        />
      </mesh>
      <pointLight color={color} intensity={2.2} distance={40} decay={1.6} />
      {item ? (
        <ItemLabel
          text={item.label}
          position={[0, radius + 1.0, 0]}
          fontSize={0.6}
          color={theme.labelColor}
          outlineColor={theme.labelOutline}
        />
      ) : null}
    </group>
  );
}

/** One orbit circle plus a shimmer mote travelling along it (implied revolution). */
function OrbitRing({ radius, color, index }) {
  const moteRef = useRef(null);
  const { getTime, animated } = useMetaphorClock();
  const phase = useMemo(() => idHash2(`ring-${index}`, 'mote') * Math.PI * 2, [index]);
  const points = useMemo(() => {
    const segments = 96;
    const pts = [];
    for (let i = 0; i <= segments; i += 1) {
      const angle = (i / segments) * Math.PI * 2;
      pts.push([Math.cos(angle) * radius, 0, Math.sin(angle) * radius]);
    }
    return pts;
  }, [radius]);
  useFrame(() => {
    if (!animated || !moteRef.current) return;
    // Inner rings sweep faster — Keplerian feel without moving the planets.
    const angle = phase + getTime() * (0.5 / (1 + index * 0.6));
    moteRef.current.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
  });
  return (
    <group>
      <Line points={points} color={color} lineWidth={1} transparent opacity={0.32} />
      <group ref={moteRef} position={[radius, 0, 0]}>
        <GlowSprite size={0.8} color={color} opacity={0.55} />
      </group>
    </group>
  );
}

/** Faint local orbit circle drawn around a planet that owns moons. */
function MoonOrbitHint({ center, radius, color }) {
  const points = useMemo(() => {
    const segments = 40;
    const pts = [];
    for (let i = 0; i <= segments; i += 1) {
      const angle = (i / segments) * Math.PI * 2;
      pts.push([
        center[0] + Math.cos(angle) * radius,
        center[1] + 0.2,
        center[2] + Math.sin(angle) * radius
      ]);
    }
    return pts;
  }, [center, radius]);
  return <Line points={points} color={color} lineWidth={0.7} transparent opacity={0.22} />;
}

function PlanetBody({ item, position, color, isMoon, theme }) {
  const radius = isMoon ? 0.16 + Math.sqrt(clampedSize(item)) * 0.12 : planetRadius(item);
  const bodyColor = useMemo(
    () =>
      shiftColor(color, {
        lightness: (idHash2(item.id, 'planet-l') - 0.5) * 0.18,
        hueShift: (idHash2(item.id, 'planet-h') - 0.5) * 0.08,
        satScale: 0.9 + idHash2(item.id, 'planet-s') * 0.25
      }),
    [color, item.id]
  );
  const atmosphere = useMemo(
    () => shiftColor(bodyColor, { lightness: 0.2, satScale: 0.8 }),
    [bodyColor]
  );
  // Saturn-style ring system on a seeded subset of the larger planets.
  const hasRings = !isMoon && clampedSize(item) >= 2 && idHash2(item.id, 'ring-sys') > 0.55;
  const ringTilt = useMemo(
    () => [
      Math.PI / 2 + (idHash2(item.id, 'ring-tx') - 0.5) * 0.8,
      0,
      (idHash2(item.id, 'ring-tz') - 0.5) * 0.8
    ],
    [item.id]
  );
  return (
    <group position={position}>
      <GlowSprite size={radius * 4.2} color={atmosphere} opacity={isMoon ? 0.18 : 0.26} />
      <mesh>
        <sphereGeometry args={[radius, 20, 20]} />
        <meshStandardMaterial
          color={bodyColor}
          emissive={bodyColor}
          emissiveIntensity={0.22}
          roughness={0.55}
          metalness={0.1}
        />
      </mesh>
      {hasRings ? (
        <mesh rotation={ringTilt}>
          <torusGeometry args={[radius * 1.75, radius * 0.14, 2, 48]} />
          <meshStandardMaterial
            color={atmosphere}
            emissive={atmosphere}
            emissiveIntensity={0.25}
            transparent
            opacity={0.8}
          />
        </mesh>
      ) : null}
      {item.glyph && !isMoon ? (
        <Billboard>
          <group position={[radius + 0.85, 0, 0]} scale={Math.max(0.5, Math.min(1.1, radius))}>
            <Glyph kind={item.glyph} theme={theme} />
          </group>
        </Billboard>
      ) : null}
      <ItemLabel
        text={item.label}
        position={[0, radius + (isMoon ? 0.45 : 0.65), 0]}
        fontSize={isMoon ? 0.34 : 0.45}
        color={theme.labelColor}
        outlineColor={theme.labelOutline}
      />
    </group>
  );
}

/** Ring of drifting rocky debris past the outermost orbit — pure ambience. */
function AsteroidBelt({ radius, color }) {
  const map = getRadialSpriteTexture();
  const geometry = useMemo(() => {
    const count = 260;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const angle = idHash2('belt', `a${i}`) * Math.PI * 2;
      const r = radius + (idHash2('belt', `r${i}`) - 0.5) * 1.4;
      positions[i * 3] = Math.cos(angle) * r;
      positions[i * 3 + 1] = (idHash2('belt', `y${i}`) - 0.5) * 0.5;
      positions[i * 3 + 2] = Math.sin(angle) * r;
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geom;
  }, [radius]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <SpinningGroup speed={0.02} phase={1.3}>
      <points geometry={geometry}>
        <pointsMaterial
          map={map ?? undefined}
          color={color}
          size={0.12}
          sizeAttenuation
          transparent
          opacity={0.7}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </points>
    </SpinningGroup>
  );
}

export function OrreryScene({ dsl, theme }) {
  const spaceTheme = useMemo(() => resolveGalaxyVividTheme(theme), [theme]);
  const layout = useMemo(() => orreryOrbitLayout(dsl.items), [dsl.items]);
  const sunColor = spaceTheme.slabTrimColor ?? spaceTheme.starColor ?? '#ffd166';

  const anchors = useMemo(() => {
    const map = new Map();
    for (const item of dsl.items) {
      const pos = layout.positions.get(item.id);
      if (pos) map.set(item.id, [...pos]);
    }
    return map;
  }, [dsl.items, layout.positions]);

  const ringIndexByOrbit = useMemo(() => {
    const map = new Map();
    layout.rings.forEach((ring) => map.set(ring.orbit, ring.index));
    return map;
  }, [layout.rings]);

  const sunItems = useMemo(
    () => dsl.items.filter((item) => layout.sunIds.includes(item.id)),
    [dsl.items, layout.sunIds]
  );

  const moonHints = useMemo(() => {
    const parents = new Map();
    for (const [moonId, parentId] of layout.moonParent) {
      const moonPos = layout.positions.get(moonId);
      const parentPos = layout.positions.get(parentId);
      if (!moonPos || !parentPos) continue;
      const dist = Math.hypot(moonPos[0] - parentPos[0], moonPos[2] - parentPos[2]);
      const prev = parents.get(parentId);
      if (!prev || dist > prev.radius) parents.set(parentId, { center: parentPos, radius: dist });
    }
    return [...parents.values()];
  }, [layout.moonParent, layout.positions]);

  const beltRadius =
    layout.rings.length >= 2 ? layout.rings[layout.rings.length - 1].radius + 1.6 : null;

  return (
    <group>
      {layout.rings.map((ring) => (
        <OrbitRing
          key={`orbit-${ring.index}`}
          radius={ring.radius}
          index={ring.index}
          color={resolveClusterColor(spaceTheme, ring.index)}
        />
      ))}
      {moonHints.map((hint, i) => (
        <MoonOrbitHint
          key={`moon-hint-${i}`}
          center={hint.center}
          radius={hint.radius}
          color={spaceTheme.binaryGlowColor ?? spaceTheme.starColor}
        />
      ))}
      {sunItems.length === 0 ? (
        <SunCore item={null} position={[0, 0, 0]} color={sunColor} theme={theme} />
      ) : null}
      {dsl.items.map((item) => {
        const position = layout.positions.get(item.id);
        if (!position) return null;
        const isSun = layout.sunIds.includes(item.id);
        const isMoon = layout.moonParent.has(item.id);
        const ringIdx =
          isSun || isMoon
            ? 0
            : (ringIndexByOrbit.get(
                typeof item.orbit === 'number' && Number.isFinite(item.orbit) ? item.orbit : 3
              ) ?? 0);
        return (
          <HoverableItem key={item.id} item={item} metaphor="orrery">
            {isSun ? (
              <SunCore item={item} position={position} color={sunColor} theme={theme} />
            ) : (
              <PlanetBody
                item={item}
                position={position}
                color={resolveClusterColor(spaceTheme, ringIdx)}
                isMoon={isMoon}
                theme={theme}
              />
            )}
          </HoverableItem>
        );
      })}
      {beltRadius ? (
        <AsteroidBelt radius={beltRadius} color={spaceTheme.nebulaDustColor ?? sunColor} />
      ) : null}
      <MetaphorAccents items={dsl.items} anchors={anchors} theme={theme} />
      <MetaphorLinks links={dsl.links} anchors={anchors} theme={theme} variant="arc" />
    </group>
  );
}
