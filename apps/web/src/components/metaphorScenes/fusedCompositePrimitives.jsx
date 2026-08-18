/**
 * Fused-composite primitives — the bodies the planner places on sites.
 *
 * Extracted from FusedCompositeScene so the scene file stays a compositor
 * (ground, affinity, paths, links) while these meshes can grow the visual
 * craft the fused world was missing: sandy shores, set-back towers, ice
 * bergs, cycle gondolas. LOD drops vegetation and window grids first.
 */
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import { Glyph } from '../metaphorGlyphs/index.jsx';
import { GlowSprite, ItemLabel } from './MetaphorSceneChrome.jsx';
import { useMetaphorClock } from './metaphorClock.js';
import { resolveCompositeMotionTransform } from './fusedCompositePlanner.js';
import { FRAME_IGNORE_DATA } from './sceneFraming.js';
import { idHash2, shiftColor } from './sceneUtils.js';

export function SemanticMotion({ motion, children, emphasized = false }) {
  const ref = useRef(null);
  const { getTime, animated, intensity } = useMetaphorClock();
  useFrame(() => {
    if (!ref.current) return;
    const transform = resolveCompositeMotionTransform(motion, getTime(), intensity, animated);
    ref.current.position.set(...transform.offset);
    ref.current.rotation.set(...transform.rotation);
    const emphasis = emphasized ? 1.1 : 1;
    ref.current.scale.setScalar(transform.scale * emphasis);
  });
  return <group ref={ref}>{children}</group>;
}

export function TopicGlyph({ item, theme, position, scale = 0.7 }) {
  if (!item?.glyph) return null;
  return (
    <Billboard position={position}>
      <group scale={scale}>
        <Glyph kind={item.glyph} theme={theme} />
      </group>
    </Billboard>
  );
}

function ShoreFoam({ radius, idSeed }) {
  const groupRef = useRef(null);
  const { getTime, animated } = useMetaphorClock();
  const rings = useMemo(
    () =>
      [0.94, 1.1, 1.24].map((scale, i) => ({
        scale,
        phase: idHash2(idSeed, `foam${i}`) * Math.PI * 2,
        opacity: 0.24 - i * 0.06
      })),
    [idSeed]
  );
  useFrame(() => {
    if (!animated || !groupRef.current) return;
    const t = getTime();
    groupRef.current.children.forEach((child, i) => {
      const ring = rings[i];
      if (!ring || !child.material) return;
      child.material.opacity = ring.opacity * (0.75 + 0.25 * Math.sin(t * 1.25 + ring.phase));
      const breathe = 1 + 0.016 * Math.sin(t * 0.9 + ring.phase);
      child.scale.set(breathe, breathe, 1);
    });
  });
  return (
    <group
      ref={groupRef}
      position={[0, 0.03, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      userData={FRAME_IGNORE_DATA}
    >
      {rings.map((ring, i) => (
        <mesh key={`foam-${i}`}>
          <ringGeometry args={[radius * ring.scale, radius * (ring.scale + 0.07), 32]} />
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

function IslandShrub({ kind, trunkColor, leafColor, scale = 1 }) {
  if (kind === 'palm') {
    return (
      <group scale={scale}>
        <mesh position={[0, 0.42, 0]}>
          <cylinderGeometry args={[0.03, 0.05, 0.84, 6]} />
          <meshStandardMaterial color={trunkColor} roughness={0.92} />
        </mesh>
        {[0, 1, 2, 3].map((i) => {
          const a = (i / 4) * Math.PI * 2;
          return (
            <mesh
              key={`frond-${i}`}
              position={[Math.cos(a) * 0.16, 0.82, Math.sin(a) * 0.16]}
              rotation={[0.5, -a, 0.12]}
              scale={[0.42, 0.1, 0.18]}
            >
              <sphereGeometry args={[0.42, 6, 5]} />
              <meshStandardMaterial color={leafColor} flatShading roughness={0.78} />
            </mesh>
          );
        })}
      </group>
    );
  }
  return (
    <group scale={scale * 0.85}>
      <mesh position={[0, 0.18, 0]}>
        <icosahedronGeometry args={[0.22, 0]} />
        <meshStandardMaterial color={leafColor} flatShading roughness={0.85} />
      </mesh>
      <mesh position={[0.1, 0.24, 0.06]}>
        <icosahedronGeometry args={[0.14, 0]} />
        <meshStandardMaterial
          color={shiftColor(leafColor, { lightness: 0.08 })}
          flatShading
          roughness={0.85}
        />
      </mesh>
    </group>
  );
}

export function IslandPrimitive({ entity, theme, emphasized, lod = 'high' }) {
  const land = theme.treeLeafColor ?? '#3d9a4a';
  const soil = theme.treeSoilColor ?? '#806443';
  const relief = entity.presentation?.relief ?? 0.5;
  const grass = useMemo(
    () => shiftColor(land, { lightness: emphasized ? 0.08 : 0, satScale: 1.08 }),
    [land, emphasized]
  );
  const sand = useMemo(
    () => shiftColor('#edd9a6', { lightness: (idHash2(entity.id, 'sand') - 0.5) * 0.05 }),
    [entity.id]
  );
  const shrubs = useMemo(() => {
    if (lod === 'low') return [];
    const count = lod === 'medium' ? 3 : Math.max(4, Math.min(8, Math.round(entity.radius * 1.6)));
    return Array.from({ length: count }, (_, i) => {
      const a = idHash2(entity.id, `sh-a${i}`) * Math.PI * 2;
      const d = entity.radius * (0.18 + idHash2(entity.id, `sh-d${i}`) * 0.55);
      return {
        x: Math.cos(a) * d,
        z: Math.sin(a) * d,
        y: entity.height * (0.12 + relief * 0.1),
        scale: 0.55 + idHash2(entity.id, `sh-s${i}`) * 0.55,
        kind: idHash2(entity.id, `sh-k${i}`) > 0.55 ? 'palm' : 'shrub',
        tint: shiftColor(grass, { lightness: (idHash2(entity.id, `sh-l${i}`) - 0.5) * 0.1 })
      };
    });
  }, [entity.id, entity.radius, entity.height, grass, lod, relief]);

  return (
    <SemanticMotion motion={entity.motion} emphasized={emphasized}>
      <mesh position={[0, -0.12, 0]} scale={[1.18, 0.18, 1.14]}>
        <icosahedronGeometry args={[entity.radius, 1]} />
        <meshStandardMaterial color={soil} roughness={0.96} flatShading />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[entity.radius * 1.08, 32]} />
        <meshStandardMaterial color={sand} roughness={1} />
      </mesh>
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[entity.radius * 0.82, 28]} />
        <meshStandardMaterial color={grass} roughness={0.9} />
      </mesh>
      <mesh position={[0, entity.height * 0.22, 0]} scale={[1, 0.26 + relief * 0.12, 1]}>
        <icosahedronGeometry args={[entity.radius * 0.72, 1]} />
        <meshStandardMaterial
          color={emphasized ? shiftColor(grass, { lightness: 0.08 }) : grass}
          emissive={grass}
          emissiveIntensity={emphasized ? 0.16 : 0.03}
          roughness={0.88}
          flatShading
        />
      </mesh>
      {lod !== 'low' ? <ShoreFoam radius={entity.radius} idSeed={entity.id} /> : null}
      {shrubs.map((shrub, index) => (
        <group key={`shrub-${index}`} position={[shrub.x, shrub.y, shrub.z]}>
          <IslandShrub
            kind={shrub.kind}
            trunkColor={theme.treeTrunkColor ?? '#6b4423'}
            leafColor={shrub.tint}
            scale={shrub.scale}
          />
        </group>
      ))}
      {entity.item ? (
        <>
          <TopicGlyph item={entity.item} theme={theme} position={[0, entity.height + 0.45, 0]} />
          <ItemLabel
            text={entity.item.label}
            position={[0, entity.height + (entity.item.glyph ? 1.3 : 0.75), 0]}
            fontSize={0.52}
            color={theme.labelColor}
            outlineColor={theme.labelOutline}
            importance={entity.radius * 3}
          />
        </>
      ) : null}
    </SemanticMotion>
  );
}

export function PlatformPrimitive({ entity, theme }) {
  const color = theme.groundColor ?? '#334155';
  return (
    <SemanticMotion motion={entity.motion}>
      <mesh position={[0, entity.height / 2 - 0.12, 0]}>
        <cylinderGeometry args={[entity.radius * 0.86, entity.radius, entity.height, 28]} />
        <meshStandardMaterial color={color} roughness={0.76} metalness={0.1} />
      </mesh>
      <mesh position={[0, entity.height - 0.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[entity.radius * 0.82, 0.08, 8, 36]} />
        <meshStandardMaterial
          color={theme.binaryGlowColor ?? theme.labelColor}
          emissive={theme.binaryGlowColor ?? theme.labelColor}
          emissiveIntensity={0.24}
        />
      </mesh>
    </SemanticMotion>
  );
}

function towerMaterialParams(presentation, theme, emphasized) {
  const color = theme.buildingColor ?? '#64748b';
  const roof = theme.buildingRoofColor ?? theme.binaryGlowColor ?? '#94a3b8';
  const lighting = presentation?.lighting ?? 'lit';
  const condition = presentation?.condition ?? 'new';
  const lightingBoost = lighting === 'lit' ? 0.14 : lighting === 'dim' ? 0.04 : 0;
  const conditionRoughness = condition === 'new' ? 0.42 : condition === 'aging' ? 0.62 : 0.82;
  const bodyColor =
    condition === 'crumbling' ? shiftColor(color, { lightness: -0.12, satScale: 0.7 }) : color;
  return {
    color: bodyColor,
    roof,
    lighting,
    emissiveIntensity: (emphasized ? 0.32 : lightingBoost) + (emphasized ? 0.08 : 0),
    roughness: conditionRoughness
  };
}

const TOWER_WINDOW_PROB = { lit: 0.5, dim: 0.22, dark: 0.05 };

function TowerWindows({ id, width, height, lighting, theme }) {
  const cells = useMemo(() => {
    const prob = TOWER_WINDOW_PROB[lighting ?? 'lit'] ?? TOWER_WINDOW_PROB.lit;
    const cols = Math.max(2, Math.min(4, Math.floor(width / 0.42)));
    const rows = Math.max(2, Math.min(7, Math.floor(height / 0.62)));
    const colStep = width / (cols + 1);
    const rowStep = height / (rows + 1);
    const half = width / 2 + 0.006;
    const out = [];
    for (const face of [0, 1]) {
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          if (idHash2(`${id}|c${face}|${r}|${c}`, 'fused-window') > prob) continue;
          const along = (c + 1) * colStep - width / 2;
          const y = (r + 1) * rowStep;
          out.push({
            position: face === 0 ? [along, y, half] : [half, y, along],
            rotY: face === 0 ? 0 : Math.PI / 2
          });
        }
      }
    }
    return out;
  }, [id, width, height, lighting]);

  if (!cells.length) return null;
  const windowColor = theme.windowEmissiveColor ?? theme.windowColor ?? '#fef3c7';
  const glow = lighting === 'dark' ? 0.14 : 0.62;
  return (
    <group>
      {cells.map((cell, index) => (
        <mesh key={`fw-${index}`} position={cell.position} rotation={[0, cell.rotY, 0]}>
          <planeGeometry args={[0.16, 0.16]} />
          <meshStandardMaterial
            color={windowColor}
            emissive={windowColor}
            emissiveIntensity={glow}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

export function TowerPrimitive({ entity, theme, emphasized, lod = 'high' }) {
  const params = towerMaterialParams(entity.presentation, theme, emphasized);
  const width = entity.radius * 1.45;
  const setback = width * 0.78;
  return (
    <SemanticMotion motion={entity.motion} emphasized={emphasized}>
      <mesh position={[0, 0.07, 0]}>
        <boxGeometry args={[width * 1.18, 0.16, width * 1.18]} />
        <meshStandardMaterial
          color={shiftColor(params.roof, { lightness: -0.12 })}
          roughness={0.74}
        />
      </mesh>
      <mesh position={[0, entity.height * 0.38, 0]}>
        <boxGeometry args={[width, entity.height * 0.76, width]} />
        <meshStandardMaterial
          color={params.color}
          emissive={emphasized ? params.roof : params.color}
          emissiveIntensity={params.emissiveIntensity}
          roughness={params.roughness}
          metalness={0.08}
        />
      </mesh>
      <mesh position={[0, entity.height * 0.82, 0]}>
        <boxGeometry args={[setback, entity.height * 0.28, setback]} />
        <meshStandardMaterial
          color={shiftColor(params.color, { lightness: 0.04 })}
          roughness={params.roughness}
          metalness={0.1}
        />
      </mesh>
      {lod !== 'low' ? (
        <TowerWindows
          id={entity.id}
          width={width}
          height={entity.height * 0.76}
          lighting={params.lighting}
          theme={theme}
        />
      ) : null}
      <mesh position={[0, entity.height + 0.08, 0]}>
        <boxGeometry args={[setback * 1.08, 0.16, setback * 1.08]} />
        <meshStandardMaterial color={params.roof} roughness={0.48} metalness={0.14} />
      </mesh>
      <mesh position={[0, entity.height + 0.52, 0]}>
        <coneGeometry args={[entity.radius * 0.62, 0.72, 5]} />
        <meshStandardMaterial color={params.roof} roughness={0.42} metalness={0.16} />
      </mesh>
    </SemanticMotion>
  );
}

export function TerracePrimitive({ entity, theme, emphasized, lod }) {
  const color = theme.slabColor ?? '#f59e0b';
  const tiers = lod === 'low' ? 2 : 3;
  const tiltRad = ((entity.tilt ?? entity.presentation?.tilt ?? 0) * Math.PI) / 180;
  const cracks = entity.cracks ?? entity.presentation?.cracks ?? 0;
  return (
    <SemanticMotion motion={entity.motion} emphasized={emphasized}>
      <group rotation={[0, 0, tiltRad * 0.35]}>
        {Array.from({ length: tiers }, (_, index) => {
          const tierHeight = entity.height / tiers;
          const radius = entity.radius * (1 - index * 0.16);
          return (
            <mesh key={index} position={[0, tierHeight * (index + 0.5), 0]}>
              <cylinderGeometry args={[radius, radius, tierHeight * 0.86, 28]} />
              <meshStandardMaterial
                color={shiftColor(color, { lightness: index * 0.055 - cracks * 0.08 })}
                emissive={color}
                emissiveIntensity={emphasized ? 0.2 : 0.035}
                roughness={0.52 + cracks * 0.28}
              />
            </mesh>
          );
        })}
      </group>
    </SemanticMotion>
  );
}

export function TreePrimitive({ entity, theme, emphasized }) {
  const leaves = theme.treeLeafColor ?? '#4ade80';
  return (
    <SemanticMotion motion={entity.motion} emphasized={emphasized}>
      <mesh position={[0, entity.height * 0.42, 0]}>
        <cylinderGeometry
          args={[entity.radius * 0.13, entity.radius * 0.22, entity.height * 0.84, 8]}
        />
        <meshStandardMaterial color={theme.treeTrunkColor ?? '#7c4a1e'} roughness={0.9} />
      </mesh>
      <mesh position={[0, entity.height * 0.87, 0]} scale={[1, 0.85, 1]}>
        <icosahedronGeometry args={[entity.radius, 1]} />
        <meshStandardMaterial
          color={leaves}
          emissive={leaves}
          emissiveIntensity={emphasized ? 0.22 : 0.025}
          flatShading
          roughness={0.82}
        />
      </mesh>
      <mesh
        position={[entity.radius * 0.28, entity.height * 0.98, entity.radius * 0.12]}
        scale={[0.7, 0.55, 0.7]}
      >
        <icosahedronGeometry args={[entity.radius * 0.55, 0]} />
        <meshStandardMaterial
          color={shiftColor(leaves, { lightness: 0.08 })}
          flatShading
          roughness={0.8}
        />
      </mesh>
    </SemanticMotion>
  );
}

export function GearPrimitive({ entity, theme, emphasized }) {
  const brass = theme.machineRimColor ?? '#8b7355';
  const steel = theme.machinePlateColor ?? '#3d4454';
  const teeth = Math.max(8, Math.min(14, Math.round(6 + entity.radius * 3)));
  const toothDepth = entity.radius * 0.18;
  const torque = entity.presentation?.torque ?? 0;
  return (
    <SemanticMotion motion={entity.motion} emphasized={emphasized}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, entity.height * 0.25, 0]}>
        <cylinderGeometry
          args={[entity.radius * 0.82, entity.radius * 0.82, entity.height * 0.35, 24]}
        />
        <meshStandardMaterial
          color={brass}
          roughness={0.38}
          metalness={0.74}
          emissive={torque > 0.4 ? '#f97316' : brass}
          emissiveIntensity={torque > 0.4 ? 0.35 : emphasized ? 0.15 : 0.04}
        />
      </mesh>
      <mesh position={[0, entity.height * 0.25, 0]}>
        <cylinderGeometry
          args={[entity.radius * 0.22, entity.radius * 0.22, entity.height * 0.5, 12]}
        />
        <meshStandardMaterial color={steel} roughness={0.35} metalness={0.7} />
      </mesh>
      {Array.from({ length: teeth }, (_, i) => {
        const angle = (i / teeth) * Math.PI * 2;
        return (
          <mesh
            key={`tooth-${i}`}
            position={[
              Math.cos(angle) * entity.radius * 0.9,
              entity.height * 0.25,
              Math.sin(angle) * entity.radius * 0.9
            ]}
            rotation={[0, -angle, 0]}
          >
            <boxGeometry args={[toothDepth, entity.height * 0.28, entity.radius * 0.2]} />
            <meshStandardMaterial color={steel} roughness={0.45} metalness={0.65} />
          </mesh>
        );
      })}
    </SemanticMotion>
  );
}

export function MoundPrimitive({ entity, theme, emphasized }) {
  const color = theme.terrainHighColor ?? theme.treeLeafColor ?? '#65a30d';
  return (
    <SemanticMotion motion={entity.motion} emphasized={emphasized}>
      <mesh position={[0, entity.height * 0.2, 0]} scale={[1, entity.height / entity.radius, 1]}>
        <icosahedronGeometry args={[entity.radius, 2]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emphasized ? 0.18 : 0.02}
          flatShading
          roughness={0.88}
        />
      </mesh>
    </SemanticMotion>
  );
}

function bloomColors(theme, health) {
  const bloom = theme.treeAccentColor ?? '#f472b6';
  if (health === 'thriving') {
    return {
      bloom: shiftColor(bloom, { lightness: 0.08 }),
      stem: theme.treeLeafColor ?? '#22c55e',
      center: '#fbbf24',
      emissive: 0.16
    };
  }
  if (health === 'at-risk') {
    return {
      bloom: shiftColor(bloom, { satScale: 0.45, lightness: -0.08 }),
      stem: theme.gardenRiskColor ?? '#a16207',
      center: '#a16207',
      emissive: 0.04
    };
  }
  return {
    bloom,
    stem: theme.treeLeafColor ?? '#22c55e',
    center: '#fbbf24',
    emissive: 0.1
  };
}

export function BloomPrimitive({ entity, theme, emphasized }) {
  const health = entity.presentation?.health ?? 'steady';
  const colors = bloomColors(theme, health);
  const bend = health === 'at-risk' ? 0.28 : 0;
  const petals = health === 'at-risk' ? 4 : 6;
  return (
    <SemanticMotion motion={entity.motion} emphasized={emphasized}>
      <group rotation={[bend, 0, bend * 0.4]}>
        <mesh position={[0, entity.height * 0.45, 0]}>
          <cylinderGeometry args={[0.08, 0.13, entity.height * 0.9, 8]} />
          <meshStandardMaterial color={colors.stem} roughness={0.82} />
        </mesh>
        {Array.from({ length: petals }, (_, index) => {
          const angle = (index / petals) * Math.PI * 2;
          return (
            <mesh
              key={index}
              position={[
                Math.cos(angle) * entity.radius * 0.55,
                entity.height,
                Math.sin(angle) * entity.radius * 0.55
              ]}
              scale={[1, 0.38, 0.72]}
              rotation={[0.35, -angle, 0]}
            >
              <sphereGeometry args={[entity.radius * 0.52, 10, 8]} />
              <meshStandardMaterial
                color={colors.bloom}
                emissive={colors.bloom}
                emissiveIntensity={emphasized ? 0.32 : colors.emissive}
                roughness={0.48}
              />
            </mesh>
          );
        })}
        <mesh position={[0, entity.height, 0]}>
          <sphereGeometry args={[entity.radius * 0.34, 12, 10]} />
          <meshStandardMaterial
            color={colors.center}
            emissive={colors.center}
            emissiveIntensity={0.28}
          />
        </mesh>
      </group>
    </SemanticMotion>
  );
}

export function OrbPrimitive({ entity, theme, emphasized, star, lod }) {
  const color = star
    ? (theme.starColor ?? '#fef3c7')
    : (theme.binaryGlowColor ?? theme.treeAccentColor ?? '#60a5fa');
  const showGlow = lod !== 'low';
  return (
    <SemanticMotion motion={entity.motion} emphasized={emphasized}>
      <mesh>
        {star ? (
          <icosahedronGeometry args={[entity.radius, 1]} />
        ) : (
          <sphereGeometry args={[entity.radius, 18, 14]} />
        )}
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emphasized ? 0.9 : 0.45}
          toneMapped={false}
          roughness={0.32}
        />
      </mesh>
      {showGlow ? (
        <GlowSprite size={entity.radius * 3.5} color={color} opacity={emphasized ? 0.38 : 0.2} />
      ) : null}
      {!star ? (
        <mesh rotation={[Math.PI / 2.8, 0.2, 0]}>
          <torusGeometry args={[entity.radius * 1.45, 0.035, 6, 28]} />
          <meshBasicMaterial color={color} transparent opacity={0.52} />
        </mesh>
      ) : null}
    </SemanticMotion>
  );
}

export function PodPrimitive({ entity, theme, emphasized }) {
  const color = theme.cycleLampColor ?? theme.clusterPalette?.[0] ?? '#fbbf24';
  const friction = entity.presentation?.friction ?? 0;
  const hot = friction > 0.45 ? (theme.gardenRiskColor ?? '#f97316') : color;
  return (
    <SemanticMotion motion={entity.motion} emphasized={emphasized}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <capsuleGeometry args={[entity.radius * 0.55, entity.radius * 0.7, 6, 12]} />
        <meshStandardMaterial
          color={hot}
          emissive={hot}
          emissiveIntensity={emphasized ? 0.45 : 0.12 + friction * 0.35}
          roughness={0.42}
          metalness={0.22}
        />
      </mesh>
      <mesh position={[0, entity.radius * 0.55, 0]}>
        <sphereGeometry args={[entity.radius * 0.22, 10, 8]} />
        <meshStandardMaterial
          color="#f8fafc"
          emissive={hot}
          emissiveIntensity={0.2}
          roughness={0.3}
        />
      </mesh>
    </SemanticMotion>
  );
}

export function BergPrimitive({ entity, theme, emphasized }) {
  const ice = theme.waterColor ?? '#bae6fd';
  const peril = entity.presentation?.peril ?? 0;
  const color = peril > 0.4 ? shiftColor(ice, { hueShift: 0.04, satScale: 1.2 }) : ice;
  return (
    <SemanticMotion motion={entity.motion} emphasized={emphasized}>
      <mesh position={[0, entity.height * 0.32, 0]} scale={[1, 1.15, 0.86]}>
        <icosahedronGeometry args={[entity.radius, 1]} />
        <meshStandardMaterial
          color={color}
          emissive={peril > 0.4 ? '#f97316' : color}
          emissiveIntensity={emphasized ? 0.28 : peril > 0.4 ? 0.18 : 0.06}
          roughness={0.28}
          metalness={0.12}
          flatShading
        />
      </mesh>
      <mesh position={[0, entity.height * 0.72, 0]} scale={[0.55, 0.7, 0.5]}>
        <icosahedronGeometry args={[entity.radius * 0.7, 0]} />
        <meshStandardMaterial
          color={shiftColor(color, { lightness: 0.1 })}
          flatShading
          roughness={0.22}
        />
      </mesh>
    </SemanticMotion>
  );
}

export function PrimitiveBody({ entity, theme, emphasized, lod }) {
  if (entity.primitive === 'tower') {
    return <TowerPrimitive entity={entity} theme={theme} emphasized={emphasized} lod={lod} />;
  }
  if (entity.primitive === 'terrace') {
    return <TerracePrimitive entity={entity} theme={theme} emphasized={emphasized} lod={lod} />;
  }
  if (entity.primitive === 'tree') {
    return <TreePrimitive entity={entity} theme={theme} emphasized={emphasized} />;
  }
  if (entity.primitive === 'gear') {
    return <GearPrimitive entity={entity} theme={theme} emphasized={emphasized} />;
  }
  if (entity.primitive === 'mound') {
    return <MoundPrimitive entity={entity} theme={theme} emphasized={emphasized} />;
  }
  if (entity.primitive === 'bloom') {
    return <BloomPrimitive entity={entity} theme={theme} emphasized={emphasized} />;
  }
  if (entity.primitive === 'pod') {
    return <PodPrimitive entity={entity} theme={theme} emphasized={emphasized} />;
  }
  if (entity.primitive === 'berg') {
    return <BergPrimitive entity={entity} theme={theme} emphasized={emphasized} />;
  }
  return (
    <OrbPrimitive
      entity={entity}
      theme={theme}
      emphasized={emphasized}
      star={entity.primitive === 'star'}
      lod={lod}
    />
  );
}

export function WorldGround({ plan, theme, hasIslands }) {
  const matRef = useRef(null);
  const { getTime, animated } = useMetaphorClock();
  const color = hasIslands ? (theme.waterColor ?? '#27afe2') : (theme.groundColor ?? '#1e293b');
  const rim = hasIslands
    ? (theme.riverDeepColor ?? '#087fb8')
    : (theme.binaryGlowColor ?? '#64748b');
  const radius = plan.groundRadius ?? plan.worldRadius;
  useFrame(() => {
    if (!animated || !matRef.current || !hasIslands) return;
    matRef.current.emissiveIntensity = 0.08 + 0.05 * Math.sin(getTime() * 0.7);
  });
  return (
    <group userData={FRAME_IGNORE_DATA}>
      {/* Ocean / plaza disc is scaffolding for the islands and landmarks. A
          circleGeometry's bounding box is a square, so leaving this in the
          camera fit lets phantom diagonal corners push the subject to ~40% of
          the frame — the same trap the city footing and ground-shadow catcher
          hit. Size from the planner radius; flag the disc, not the nodes. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.28, 0]}>
        <circleGeometry args={[radius * 1.05, 72]} />
        <meshStandardMaterial color={rim} roughness={0.68} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.22, 0]}>
        <circleGeometry args={[radius, 72]} />
        <meshStandardMaterial
          ref={matRef}
          color={color}
          emissive={rim}
          emissiveIntensity={hasIslands ? 0.1 : 0.025}
          roughness={hasIslands ? 0.28 : 0.76}
          metalness={hasIslands ? 0.22 : 0.04}
        />
      </mesh>
      {hasIslands
        ? [0.55, 0.78, 0.96].map((scale) => (
            <mesh key={scale} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]}>
              <ringGeometry args={[radius * scale, radius * scale + 0.05, 64]} />
              <meshBasicMaterial color="#e0f2fe" transparent opacity={0.08} />
            </mesh>
          ))
        : [0.42, 0.72, 0.96].map((scale) => (
            <mesh key={scale} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]}>
              <ringGeometry args={[radius * scale, radius * scale + 0.055, 64]} />
              <meshBasicMaterial color={theme.labelColor} transparent opacity={0.11} />
            </mesh>
          ))}
    </group>
  );
}
