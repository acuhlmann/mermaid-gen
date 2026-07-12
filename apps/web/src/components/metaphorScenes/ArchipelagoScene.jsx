/**
 * Archipelago metaphor scene — peer domains as islands in a shared ocean.
 * `mass` sizes each island, `relief` raises its peak, `chain` clusters related
 * islands into visible island groups, and `links` span as bridges / ferries
 * across the water. Ideal for bounded contexts, multi-region estates, and
 * federated product lines where isolation IS the story.
 */
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import {
  archipelagoLayout,
  islandRadiusForMass
} from '../../utils/metaphorLayouts/archipelagoLayout.js';
import { Glyph } from '../metaphorGlyphs/index.jsx';
import {
  GlowSprite,
  GradientSkySphere,
  HoverableItem,
  ItemLabel,
  MetaphorGroundShadow,
  MetaphorLinks
} from './MetaphorSceneChrome.jsx';
import { DaylightPollen, SkySunGlow, SoaringBirds } from './MetaphorSceneDecorations.jsx';
import { useMetaphorClock } from './metaphorClock.js';
import { idHash2, shiftColor } from './sceneUtils.js';

function chainTint(theme, index) {
  const palette = theme.districtPalette ?? theme.clusterPalette ?? ['#86efac', '#67e8f9'];
  return palette[index % palette.length];
}

/** Soft rolling ocean disc with a travelling highlight — no opacity flicker. */
function OceanPlane({ radius, theme }) {
  const matRef = useRef(null);
  const { getTime, animated } = useMetaphorClock();
  useFrame(() => {
    if (!animated || !matRef.current) return;
    matRef.current.emissiveIntensity = 0.1 + 0.05 * Math.sin(getTime() * 0.7);
  });
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]}>
        <circleGeometry args={[radius * 1.18, 72]} />
        <meshStandardMaterial
          color={shiftColor(theme.waterColor ?? '#27afe2', { lightness: -0.12, satScale: 0.85 })}
          roughness={0.55}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <circleGeometry args={[radius * 1.08, 72]} />
        <meshStandardMaterial
          ref={matRef}
          color={theme.waterColor ?? '#27afe2'}
          roughness={0.28}
          metalness={0.22}
          emissive={theme.riverDeepColor ?? '#087fb8'}
          emissiveIntensity={0.12}
          transparent
          opacity={0.92}
        />
      </mesh>
    </group>
  );
}

/** Concentric foam rings that breathe around each island's shoreline. */
function ShoreFoam({ radius, idSeed }) {
  const groupRef = useRef(null);
  const { getTime, animated } = useMetaphorClock();
  const rings = useMemo(
    () =>
      [0.92, 1.08, 1.22].map((scale, i) => ({
        scale,
        phase: idHash2(idSeed, `foam${i}`) * Math.PI * 2,
        opacity: 0.22 - i * 0.05
      })),
    [idSeed]
  );
  useFrame(() => {
    if (!animated || !groupRef.current) return;
    const t = getTime();
    groupRef.current.children.forEach((child, i) => {
      const ring = rings[i];
      if (!ring || !child.material) return;
      child.material.opacity = ring.opacity * (0.75 + 0.25 * Math.sin(t * 1.3 + ring.phase));
      const breathe = 1 + 0.018 * Math.sin(t * 0.9 + ring.phase);
      child.scale.set(breathe, breathe, 1);
    });
  });
  return (
    <group ref={groupRef} position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      {rings.map((ring, i) => (
        <mesh key={`foam-${i}`}>
          <ringGeometry args={[radius * ring.scale, radius * (ring.scale + 0.08), 36]} />
          <meshBasicMaterial
            color="#e0f2fe"
            transparent
            opacity={ring.opacity}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

function IslandBody({ island, theme, item }) {
  const land = useMemo(
    () =>
      shiftColor(chainTint(theme, island.chainIndex), {
        lightness: -0.08 + island.relief * 0.1,
        satScale: 0.9
      }),
    [theme, island.chainIndex, island.relief]
  );
  const cliff = useMemo(
    () => shiftColor(theme.treeSoilColor ?? '#8b6843', { lightness: 0.05, satScale: 0.55 }),
    [theme.treeSoilColor]
  );
  const sand = useMemo(
    () => shiftColor(theme.treeSoilColor ?? '#c4a574', { lightness: 0.28, satScale: 0.45 }),
    [theme.treeSoilColor]
  );
  const peakColor = island.relief > 0.7 ? '#f8fafc' : land;
  const trees = useMemo(() => {
    const count = Math.round(2 + island.massHint * 0.35);
    return Array.from({ length: Math.min(7, count) }, (_, i) => {
      const a = idHash2(island.id, `t-a${i}`) * Math.PI * 2;
      const d = island.radius * (0.25 + idHash2(island.id, `t-d${i}`) * 0.45);
      return {
        x: Math.cos(a) * d,
        z: Math.sin(a) * d,
        h: 0.45 + idHash2(island.id, `t-h${i}`) * 0.55,
        conifer: idHash2(island.id, `t-k${i}`) > 0.45
      };
    });
  }, [island.id, island.radius, island.massHint]);

  return (
    <group position={island.position}>
      {/* Submerged shelf */}
      <mesh position={[0, -0.12, 0]} scale={[1.18, 0.35, 1.18]}>
        <icosahedronGeometry args={[island.radius, 1]} />
        <meshStandardMaterial color={cliff} flatShading roughness={0.95} />
      </mesh>
      {/* Beach ring */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[island.radius * 0.78, island.radius * 1.02, 28]} />
        <meshStandardMaterial color={sand} roughness={1} side={THREE.DoubleSide} />
      </mesh>
      {/* Main landmass */}
      <mesh position={[0, island.height * 0.28, 0]} scale={[1, 0.55 + island.relief * 0.45, 1]}>
        <icosahedronGeometry args={[island.radius * 0.92, 1]} />
        <meshStandardMaterial color={land} flatShading roughness={0.82} />
      </mesh>
      {/* Peak */}
      <mesh position={[0, island.height * 0.78, 0]}>
        <coneGeometry
          args={[island.radius * (0.28 + island.relief * 0.18), island.height * 0.55, 7]}
        />
        <meshStandardMaterial color={peakColor} flatShading roughness={0.78} />
      </mesh>
      <ShoreFoam radius={island.radius} idSeed={island.id} />
      {trees.map((t, i) => (
        <group
          key={`tree-${i}`}
          position={[t.x, island.height * 0.42, t.z]}
          scale={0.7 + t.h * 0.4}
        >
          <mesh position={[0, 0.28, 0]}>
            <cylinderGeometry args={[0.04, 0.06, 0.55, 5]} />
            <meshStandardMaterial color={theme.treeTrunkColor ?? '#70451f'} roughness={0.9} />
          </mesh>
          {t.conifer ? (
            <mesh position={[0, 0.72, 0]}>
              <coneGeometry args={[0.28, 0.7, 6]} />
              <meshStandardMaterial
                color={theme.treeLeafColor ?? '#36a852'}
                flatShading
                roughness={0.85}
              />
            </mesh>
          ) : (
            <mesh position={[0, 0.7, 0]}>
              <icosahedronGeometry args={[0.28, 0]} />
              <meshStandardMaterial
                color={theme.treeLeafColor ?? '#36a852'}
                flatShading
                roughness={0.85}
              />
            </mesh>
          )}
        </group>
      ))}
      {item.glyph ? (
        <Billboard position={[0, island.height + 1.15, 0]}>
          <group scale={0.9}>
            <Glyph kind={item.glyph} theme={theme} />
          </group>
        </Billboard>
      ) : null}
      <ItemLabel
        text={item.label}
        position={[0, island.height + (item.glyph ? 1.95 : 1.15), 0]}
        fontSize={0.58}
        color={theme.labelColor}
        outlineColor={theme.labelOutline}
      />
      {island.relief > 0.75 ? (
        <group position={[0, island.height + 0.35, 0]}>
          <GlowSprite size={1.4} color="#ffffff" opacity={0.12} />
        </group>
      ) : null}
    </group>
  );
}

/** Soft chain-name plaque floating above each island group. */
function ChainLabel({ chain, theme }) {
  if (!chain.name || chain.name === 'Open sea') return null;
  return (
    <ItemLabel
      text={chain.name}
      position={[chain.center[0], 0.35, chain.center[2] - chain.radius * 0.85]}
      fontSize={0.5}
      color={theme.labelColor}
      outlineColor={theme.labelOutline}
    />
  );
}

/** Small boats drifting between a few islands — motion that sells the ocean. */
function DriftBoats({ islands, theme }) {
  const groupRef = useRef(null);
  const { getTime, animated } = useMetaphorClock();
  const boats = useMemo(() => {
    if (islands.length < 2) return [];
    const count = Math.min(4, Math.max(1, Math.floor(islands.length / 3)));
    return Array.from({ length: count }, (_, i) => {
      const a = islands[i % islands.length];
      const b = islands[(i * 2 + 1) % islands.length];
      return {
        from: a.position,
        to: b.position,
        phase: idHash2('boat', `p${i}`),
        speed: 0.04 + idHash2('boat', `s${i}`) * 0.03,
        color: shiftColor(theme.slabTrimColor ?? '#fbbf24', {
          lightness: (idHash2('boat', `c${i}`) - 0.5) * 0.1
        })
      };
    });
  }, [islands, theme.slabTrimColor]);

  useFrame(() => {
    if (!groupRef.current) return;
    const t = animated ? getTime() : 0;
    groupRef.current.children.forEach((child, i) => {
      const boat = boats[i];
      if (!boat) return;
      const u = (boat.phase + t * boat.speed) % 1;
      // Ease through mid-crossing so boats don't teleport at the ends.
      const fade = THREE.MathUtils.smoothstep(Math.min(u, 1 - u), 0, 0.12);
      const x = boat.from[0] + (boat.to[0] - boat.from[0]) * u;
      const z = boat.from[2] + (boat.to[2] - boat.from[2]) * u;
      child.position.set(x, 0.08 + Math.sin(t * 2 + boat.phase) * 0.03, z);
      child.visible = fade > 0.05;
      child.scale.setScalar(0.55 + fade * 0.45);
      const dx = boat.to[0] - boat.from[0];
      const dz = boat.to[2] - boat.from[2];
      child.rotation.y = Math.atan2(dx, dz);
    });
  });

  return (
    <group ref={groupRef}>
      {boats.map((boat, i) => (
        <group key={`boat-${i}`}>
          <mesh>
            <boxGeometry args={[0.55, 0.14, 0.22]} />
            <meshStandardMaterial color={boat.color} roughness={0.55} />
          </mesh>
          <mesh position={[0, 0.22, 0]}>
            <coneGeometry args={[0.08, 0.35, 4]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function ArchipelagoScene({ dsl, theme }) {
  const layout = useMemo(() => archipelagoLayout(dsl.items), [dsl.items]);
  const itemById = useMemo(() => new Map(dsl.items.map((item) => [item.id, item])), [dsl.items]);

  const enriched = useMemo(
    () =>
      layout.islands.map((isle) => {
        const item = itemById.get(isle.id);
        const mass = typeof item?.mass === 'number' && Number.isFinite(item.mass) ? item.mass : 4;
        return { ...isle, massHint: mass, radius: isle.radius || islandRadiusForMass(mass) };
      }),
    [layout.islands, itemById]
  );

  const anchors = useMemo(() => {
    const map = new Map();
    for (const isle of enriched) {
      map.set(isle.id, [isle.position[0], isle.height + 0.6, isle.position[2]]);
    }
    return map;
  }, [enriched]);

  const oceanR = layout.bounds.radius;

  return (
    <group>
      <OceanPlane radius={oceanR} theme={theme} />
      {layout.chains.map((chain) => (
        <ChainLabel key={`chain-${chain.name}`} chain={chain} theme={theme} />
      ))}
      {enriched.map((isle) => {
        const item = itemById.get(isle.id);
        if (!item) return null;
        return (
          <HoverableItem key={isle.id} item={item} metaphor="archipelago">
            <IslandBody island={isle} theme={theme} item={item} />
          </HoverableItem>
        );
      })}
      <DriftBoats islands={enriched} theme={theme} />
      <DaylightPollen radius={oceanR * 1.05} count={16} idSeed="arch-pollen" />
      <SoaringBirds
        radius={oceanR * 1.05}
        height={6.5}
        count={3}
        color={theme.labelColor ?? '#1f2937'}
        idSeed="arch-birds"
      />
      <MetaphorGroundShadow theme={theme} y={-0.12} scale={oceanR * 1.6} />
      <MetaphorLinks links={dsl.links} anchors={anchors} theme={theme} variant="arc" />
    </group>
  );
}

/** Clear tropical daylight sky over the archipelago. */
export function ArchipelagoSky({ theme }) {
  return (
    <group>
      <GradientSkySphere
        topColor={theme.skyTopColor ?? '#258fce'}
        horizonColor={theme.skyHorizonColor ?? '#c9e8f0'}
      />
      <SkySunGlow />
    </group>
  );
}
