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
  islandCrestY,
  islandRadiusForMass,
  ISLAND_LABEL_CLEARANCE
} from '../../utils/metaphorLayouts/archipelagoLayout.js';
import { Glyph } from '../metaphorGlyphs/index.jsx';
import {
  GradientSkySphere,
  HoverableItem,
  ItemLabel,
  MetaphorGroundShadow,
  MetaphorLinks
} from './MetaphorSceneChrome.jsx';
import { MetaphorAccents } from './MetaphorAccents.jsx';
import { DaylightPollen, SkySunGlow, SoaringBirds } from './MetaphorSceneDecorations.jsx';
import { useMetaphorClock } from './metaphorClock.js';
import { idHash2, shiftColor } from './sceneUtils.js';
import { FRAME_IGNORE_DATA } from './sceneFraming.js';

/** Chain tint stays in the green/teal family so islands read as land, not pastel blobs. */
function chainTint(theme, index) {
  const palette = theme.archipelagoGreenPalette ?? [
    '#3d9a4a',
    '#2f8f5b',
    '#4aa86a',
    '#287a48',
    '#5bb872'
  ];
  return palette[index % palette.length];
}

/**
 * Soft rolling ocean disc with a travelling highlight — no opacity flicker.
 * Out of the camera fit: open water reaching past the islands is scaffolding,
 * and it was the binding constraint on every archipelago. See sceneFraming.js.
 */
function OceanPlane({ radius, theme }) {
  const matRef = useRef(null);
  const { getTime, animated } = useMetaphorClock();
  useFrame(() => {
    if (!animated || !matRef.current) return;
    matRef.current.emissiveIntensity = 0.1 + 0.05 * Math.sin(getTime() * 0.7);
  });
  return (
    <group userData={FRAME_IGNORE_DATA}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]}>
        <circleGeometry args={[radius * 1.07, 72]} />
        <meshStandardMaterial
          color={shiftColor(theme.waterColor ?? '#27afe2', { lightness: -0.12, satScale: 0.85 })}
          roughness={0.55}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <circleGeometry args={[radius * 1.0, 72]} />
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

/** Palm / broadleaf / shrub — keeps the silhouette leafy rather than geometric. */
function IslandTree({ kind, trunkColor, leafColor, scale = 1 }) {
  if (kind === 'palm') {
    return (
      <group scale={scale}>
        <mesh position={[0, 0.55, 0]}>
          <cylinderGeometry args={[0.035, 0.06, 1.1, 6]} />
          <meshStandardMaterial color={trunkColor} roughness={0.92} />
        </mesh>
        {[0, 1, 2, 3, 4].map((i) => {
          const a = (i / 5) * Math.PI * 2;
          return (
            <mesh
              key={`frond-${i}`}
              position={[Math.cos(a) * 0.22, 1.05, Math.sin(a) * 0.22]}
              rotation={[0.55, -a, 0.15]}
              scale={[0.55, 0.12, 0.22]}
            >
              <sphereGeometry args={[0.55, 8, 6]} />
              <meshStandardMaterial color={leafColor} flatShading roughness={0.78} />
            </mesh>
          );
        })}
      </group>
    );
  }
  if (kind === 'shrub') {
    return (
      <group scale={scale * 0.75}>
        <mesh position={[0, 0.22, 0]}>
          <icosahedronGeometry args={[0.28, 0]} />
          <meshStandardMaterial color={leafColor} flatShading roughness={0.85} />
        </mesh>
        <mesh position={[0.14, 0.28, 0.08]}>
          <icosahedronGeometry args={[0.18, 0]} />
          <meshStandardMaterial
            color={shiftColor(leafColor, { lightness: 0.08 })}
            flatShading
            roughness={0.85}
          />
        </mesh>
      </group>
    );
  }
  // Broadleaf canopy on a short trunk.
  return (
    <group scale={scale}>
      <mesh position={[0, 0.32, 0]}>
        <cylinderGeometry args={[0.045, 0.07, 0.64, 6]} />
        <meshStandardMaterial color={trunkColor} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.78, 0]}>
        <icosahedronGeometry args={[0.38, 0]} />
        <meshStandardMaterial color={leafColor} flatShading roughness={0.82} />
      </mesh>
      <mesh position={[0.18, 0.92, 0.1]}>
        <icosahedronGeometry args={[0.24, 0]} />
        <meshStandardMaterial
          color={shiftColor(leafColor, { lightness: 0.06 })}
          flatShading
          roughness={0.82}
        />
      </mesh>
    </group>
  );
}

/**
 * Natural green island: light sandy shore, squat verdant hills, palms/shrubs.
 * Relief gently lifts the ridge and densifies canopy — never a reactor dome.
 */
function IslandBody({ island, theme, item }) {
  const grass = useMemo(
    () =>
      shiftColor(chainTint(theme, island.chainIndex), {
        lightness: -0.02 + island.relief * 0.05,
        satScale: 1.08
      }),
    [theme, island.chainIndex, island.relief]
  );
  const canopy = useMemo(
    () =>
      shiftColor(theme.treeLeafColor ?? grass, {
        lightness: 0.05,
        satScale: 1.12,
        hueShift: (idHash2(island.id, 'canopy-h') - 0.5) * 0.04
      }),
    [theme.treeLeafColor, grass, island.id]
  );
  const cliff = useMemo(
    () => shiftColor(theme.treeSoilColor ?? '#7a5a3a', { lightness: 0.1, satScale: 0.4 }),
    [theme.treeSoilColor]
  );
  const sand = useMemo(
    () => shiftColor('#edd9a6', { lightness: (idHash2(island.id, 'sand') - 0.5) * 0.05 }),
    [island.id]
  );
  const trunkColor = theme.treeTrunkColor ?? '#6b4423';

  // Low overlapping hills — heavily squashed so they read as land, not domes.
  const lobes = useMemo(() => {
    const count = 2 + Math.round(idHash2(island.id, 'lobes') * 2);
    return Array.from({ length: count }, (_, i) => {
      const a = (i / count) * Math.PI * 2 + idHash2(island.id, `lobe-a${i}`) * 0.5;
      const dist = island.radius * (0.06 + idHash2(island.id, `lobe-d${i}`) * 0.2);
      const r = island.radius * (0.58 + idHash2(island.id, `lobe-r${i}`) * 0.3);
      const h =
        island.height * (0.32 + island.relief * 0.25 + idHash2(island.id, `lobe-h${i}`) * 0.1);
      return {
        x: Math.cos(a) * dist,
        z: Math.sin(a) * dist,
        r,
        h,
        squash: 0.24 + island.relief * 0.12 + idHash2(island.id, `lobe-s${i}`) * 0.05
      };
    });
  }, [island]);

  const bushes = useMemo(() => {
    const count = Math.max(
      7,
      Math.min(18, Math.round(6 + island.massHint * 0.65 + island.relief * 5))
    );
    return Array.from({ length: count }, (_, i) => {
      const a = idHash2(island.id, `b-a${i}`) * Math.PI * 2;
      const d = island.radius * (0.08 + idHash2(island.id, `b-d${i}`) * 0.68);
      const kindRoll = idHash2(island.id, `b-k${i}`);
      return {
        x: Math.cos(a) * d,
        z: Math.sin(a) * d,
        y: 0.14 + island.height * (0.1 + idHash2(island.id, `b-y${i}`) * 0.18) * island.relief,
        scale: 0.48 + idHash2(island.id, `b-s${i}`) * 0.7,
        kind: kindRoll > 0.52 ? 'palm' : kindRoll > 0.26 ? 'broadleaf' : 'shrub',
        tint: shiftColor(canopy, {
          lightness: (idHash2(island.id, `b-l${i}`) - 0.5) * 0.12,
          hueShift: (idHash2(island.id, `b-hh${i}`) - 0.5) * 0.05
        })
      };
    });
  }, [island, canopy]);

  const rocks = useMemo(() => {
    const count = 3 + Math.round(idHash2(island.id, 'rocks') * 3);
    return Array.from({ length: count }, (_, i) => {
      const a = idHash2(island.id, `rk-a${i}`) * Math.PI * 2;
      const d = island.radius * (0.8 + idHash2(island.id, `rk-d${i}`) * 0.28);
      return {
        x: Math.cos(a) * d,
        z: Math.sin(a) * d,
        r: 0.09 + idHash2(island.id, `rk-r${i}`) * 0.14,
        spin: idHash2(island.id, `rk-s${i}`) * Math.PI
      };
    });
  }, [island]);

  const hillTop = islandCrestY(island);
  const labelY = hillTop + ISLAND_LABEL_CLEARANCE;

  return (
    <group position={island.position}>
      {/* Underwater rock shelf — mostly hidden so it doesn't read as a dark pad */}
      <mesh position={[0, -0.16, 0]} scale={[1.3, 0.16, 1.24]}>
        <icosahedronGeometry args={[island.radius * 1.04, 1]} />
        <meshStandardMaterial color={cliff} flatShading roughness={0.97} />
      </mesh>
      {/* Tropical sand beach — the main shoreline cue */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[island.radius * 1.1, 36]} />
        <meshStandardMaterial color={sand} roughness={1} />
      </mesh>
      {/* Green grass plateau inset from the beach */}
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[island.radius * 0.82, 32]} />
        <meshStandardMaterial color={grass} roughness={0.92} />
      </mesh>
      <mesh position={[0, 0.055, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry
          args={[island.radius * (0.55 + idHash2(island.id, 'inner-grass') * 0.18), 24]}
        />
        <meshStandardMaterial color={shiftColor(grass, { lightness: 0.06 })} roughness={0.9} />
      </mesh>
      {/* Soft low hills */}
      {lobes.map((lobe, i) => (
        <mesh
          key={`lobe-${i}`}
          position={[lobe.x, lobe.h * 0.18, lobe.z]}
          scale={[1.08, lobe.squash, 1.08]}
        >
          <icosahedronGeometry args={[lobe.r, 1]} />
          <meshStandardMaterial
            color={i === 0 ? grass : shiftColor(grass, { lightness: i % 2 === 0 ? 0.05 : -0.04 })}
            flatShading
            roughness={0.9}
          />
        </mesh>
      ))}
      {/* Leafy canopy pillows — flatter and wider than before */}
      {lobes.map((lobe, i) => (
        <mesh
          key={`canopy-${i}`}
          position={[lobe.x * 0.65, lobe.h * (0.32 + island.relief * 0.1), lobe.z * 0.65]}
          scale={[1.25, 0.32, 1.25]}
        >
          <icosahedronGeometry args={[lobe.r * 0.58, 0]} />
          <meshStandardMaterial
            color={shiftColor(canopy, { lightness: (i % 2) * 0.04 })}
            flatShading
            roughness={0.78}
          />
        </mesh>
      ))}
      <ShoreFoam radius={island.radius * 1.04} idSeed={island.id} />
      {rocks.map((rk, i) => (
        <mesh
          key={`rock-${i}`}
          position={[rk.x, 0.05, rk.z]}
          rotation={[0.12, rk.spin, 0.06]}
          scale={[1.15, 0.5, 1.25]}
        >
          <icosahedronGeometry args={[rk.r, 0]} />
          <meshStandardMaterial
            color={shiftColor(cliff, { lightness: 0.12 })}
            flatShading
            roughness={0.95}
          />
        </mesh>
      ))}
      {bushes.map((b, i) => (
        <group key={`bush-${i}`} position={[b.x, b.y, b.z]}>
          <IslandTree kind={b.kind} trunkColor={trunkColor} leafColor={b.tint} scale={b.scale} />
        </group>
      ))}
      {item.glyph ? (
        <Billboard position={[0, labelY, 0]}>
          <group scale={0.85}>
            <Glyph kind={item.glyph} theme={theme} />
          </group>
        </Billboard>
      ) : null}
      <ItemLabel
        text={item.label}
        position={[0, labelY + (item.glyph ? 0.85 : 0), 0]}
        fontSize={0.58}
        color={theme.labelColor}
        outlineColor={theme.labelOutline}
      />
    </group>
  );
}

/**
 * Soft chain-name plaque floating above each island group.
 *
 * Placement is the layout's (`labelOffset` / `labelLift`), not the scene's: it
 * stands above the tallest island NAME in the chain and steps off that island's
 * own shoulder, which is the answer `assignSiteLabelPlacement` reached for a
 * fused site. A chain circle is a poor lateral anchor — the chains overlap and
 * their centres cluster near the world centre — so the earlier near-edge move
 * that fixed the city districts and the garden beds put one placard in a corner
 * and the other off-canvas at 717x512. Going up is a fact about the chain rather
 * than about the camera, and the camera fit prunes text by material, so the lift
 * costs the islands no room.
 *
 * `pinned` because a territory's name has no second copy anywhere in the scene:
 * the chain is what the legend's own axis is phrased in, and this was the only
 * group placard in any kind the declutter pass was allowed to drop outright.
 */
function ChainLabel({ chain, theme }) {
  if (!chain.name || chain.name === 'Open sea' || chain.namedByMember) return null;
  const offset = chain.labelOffset ?? [0, 0, 0];
  return (
    <ItemLabel
      text={chain.name}
      role="group"
      pinned
      position={[chain.center[0] + offset[0], chain.labelLift ?? 0.35, chain.center[2] + offset[2]]}
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
      map.set(isle.id, [isle.position[0], islandCrestY(isle) + 0.9, isle.position[2]]);
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
        hazeColor={theme.skyHorizonColor ?? theme.background ?? null}
        idSeed="arch-birds"
      />
      <MetaphorGroundShadow theme={theme} y={-0.12} scale={oceanR * 1.6} />
      <MetaphorAccents items={dsl.items} anchors={anchors} theme={theme} />
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
