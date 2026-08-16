/**
 * Terrain metaphor scene — items as Gaussian peaks on a shared heightmap
 * (elevation = the scene metric, intensity = peak spread), rendered as an
 * alpine landscape: a multi-stop color ramp with blended snow caps, water in
 * the basins, contour rings, drifting clouds, conifers and boulders scattered
 * by altitude, mist pooling in the valleys, soaring birds, waving summit
 * flags on cairned survey pins, and a light beacon marking the highest peak.
 * Extracted from MetaphorRenderer.jsx per the ADR-0005 sibling-module pattern.
 */
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard, Line } from '@react-three/drei';
import {
  heightColor,
  sampleTerrainHeight,
  terrainHeightmap
} from '../../utils/metaphorLayouts/terrainHeightmap.js';
import { Glyph } from '../metaphorGlyphs/index.jsx';
import { GlowSprite, HoverableItem, ItemLabel, MetaphorLinks } from './MetaphorSceneChrome.jsx';
import { MetaphorAccents } from './MetaphorAccents.jsx';
import { SoaringBirds, TerrainClouds } from './MetaphorSceneDecorations.jsx';
import { useMetaphorClock } from './metaphorClock.js';
import { idHash, idHash2, shiftColor } from './sceneUtils.js';

/** Cool off-white for snow caps — see the blend below. */
const SNOW_RGB = [0.88, 0.91, 0.96];

function TerrainSurface({ heightmap }) {
  const geometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(heightmap.vertices, 3));
    geom.setIndex(new THREE.BufferAttribute(heightmap.indices, 1));

    const colors = new Float32Array(heightmap.vertices.length);
    const snowThreshold = heightmap.bounds.maxHeight * 0.75;
    const snowSpan = Math.max(0.0001, heightmap.bounds.maxHeight - snowThreshold);
    for (let i = 0; i < heightmap.vertices.length; i += 3) {
      const h = heightmap.vertices[i + 1];
      const [r, g, b] = heightColor(h, heightmap.bounds);
      if (h > snowThreshold) {
        // Capped, and toward a cool off-white rather than #ffffff: blending the
        // summits to pure white erased them against a bright sky.
        const mix = Math.min(0.82, (h - snowThreshold) / snowSpan);
        colors[i] = r + (SNOW_RGB[0] - r) * mix;
        colors[i + 1] = g + (SNOW_RGB[1] - g) * mix;
        colors[i + 2] = b + (SNOW_RGB[2] - b) * mix;
      } else {
        colors[i] = r;
        colors[i + 1] = g;
        colors[i + 2] = b;
      }
    }
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geom.computeVertexNormals();
    return geom;
  }, [heightmap]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial vertexColors flatShading roughness={0.85} metalness={0.05} />
    </mesh>
  );
}

function TerrainWaterPlane({ halfExtent, theme }) {
  const matRef = useRef(null);
  const { getTime, animated } = useMetaphorClock();
  useFrame(() => {
    if (!animated || !matRef.current) return;
    const t = getTime();
    // Prefer emissive shimmer over opacity pulse — alpha flicker fights the
    // heightmap shoreline where water and terrain share a near-zero Y.
    matRef.current.emissiveIntensity = 0.08 + 0.05 * Math.sin(t * 0.8);
  });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
      <planeGeometry args={[halfExtent * 2.2, halfExtent * 2.2]} />
      <meshStandardMaterial
        ref={matRef}
        color={theme.waterColor ?? '#7dd3fc'}
        transparent
        opacity={0.42}
        roughness={0.28}
        metalness={0.22}
        emissive={theme.waterColor ?? '#7dd3fc'}
        emissiveIntensity={0.1}
        depthWrite={false}
      />
    </mesh>
  );
}

function TerrainContourRings({ heightmap, theme }) {
  const rings = useMemo(() => {
    const { maxHeight } = heightmap.bounds;
    if (maxHeight <= 0.5) return [];
    const halfExtent = heightmap.halfExtent;
    const segments = 64;
    const levels = [0.33, 0.66, 1.0];
    const out = [];
    for (const fraction of levels) {
      const y = maxHeight * fraction + 0.05;
      const radius = halfExtent * (1.05 - fraction * 0.55);
      const pts = [];
      for (let i = 0; i <= segments; i += 1) {
        const angle = (i / segments) * Math.PI * 2;
        pts.push([Math.cos(angle) * radius, y, Math.sin(angle) * radius]);
      }
      out.push(pts);
    }
    return out;
  }, [heightmap]);
  if (!rings.length) return null;
  const color = theme.labelOutline ?? '#ffffff';
  return (
    <group>
      {rings.map((pts, i) => (
        <Line
          key={`contour-${i}`}
          points={pts}
          color={color}
          lineWidth={0.8}
          transparent
          opacity={0.35}
        />
      ))}
    </group>
  );
}

/**
 * Conifers on the lower slopes and boulders above the treeline, sampled off
 * the heightmap and kept clear of water, snow, and the labelled survey pins.
 */
function TerrainFlora({ heightmap, itemPositions, theme }) {
  const leafColor = theme.treeLeafColor ?? '#2d6a4f';
  const trunkColor = '#6b4423';
  const rockColor = useMemo(
    () => shiftColor('#8a7f72', { lightness: (idHash('rock-tint') - 0.5) * 0.06 }),
    []
  );
  const scatter = useMemo(() => {
    const { maxHeight } = heightmap.bounds;
    if (maxHeight <= 0.4) return [];
    const pins = [...itemPositions.values()];
    const spread = heightmap.halfExtent * 0.94;
    const out = [];
    const count = 46;
    for (let i = 0; i < count; i += 1) {
      const x = (idHash2('flora', `x${i}`) - 0.5) * 2 * spread;
      const z = (idHash2('flora', `z${i}`) - 0.5) * 2 * spread;
      const h = sampleTerrainHeight(heightmap, x, z);
      // Stay out of the water, off the snow caps, and clear of the pins.
      if (h < 0.25) continue;
      if (h > maxHeight * 0.7) {
        if (h > maxHeight * 0.85) continue;
        const tooClose = pins.some((p) => Math.hypot(p[0] - x, p[2] - z) < 1.7);
        if (tooClose) continue;
        out.push({ kind: 'rock', x, z, h, scale: 0.5 + idHash2('flora', `rs${i}`) * 0.8 });
        continue;
      }
      const tooClose = pins.some((p) => Math.hypot(p[0] - x, p[2] - z) < 1.7);
      if (tooClose) continue;
      out.push({
        kind: 'tree',
        x,
        z,
        h,
        scale: 0.45 + idHash2('flora', `ts${i}`) * 0.55,
        tint: shiftColor(leafColor, {
          lightness: (idHash2('flora', `tl${i}`) - 0.5) * 0.12,
          hueShift: (idHash2('flora', `th${i}`) - 0.5) * 0.04
        })
      });
    }
    return out;
  }, [heightmap, itemPositions, leafColor]);
  return (
    <group>
      {scatter.map((s, i) =>
        s.kind === 'tree' ? (
          <group key={`flora-${i}`} position={[s.x, s.h, s.z]} scale={s.scale}>
            <mesh position={[0, 0.22, 0]}>
              <cylinderGeometry args={[0.07, 0.1, 0.44, 6]} />
              <meshStandardMaterial color={trunkColor} roughness={0.9} />
            </mesh>
            <mesh position={[0, 0.85, 0]}>
              <coneGeometry args={[0.5, 1.05, 7]} />
              <meshStandardMaterial color={s.tint} flatShading roughness={0.85} />
            </mesh>
            <mesh position={[0, 1.45, 0]}>
              <coneGeometry args={[0.34, 0.75, 7]} />
              <meshStandardMaterial color={s.tint} flatShading roughness={0.85} />
            </mesh>
          </group>
        ) : (
          <mesh
            key={`flora-${i}`}
            position={[s.x, s.h + 0.08, s.z]}
            scale={[s.scale, s.scale * 0.7, s.scale]}
          >
            <icosahedronGeometry args={[0.34, 0]} />
            <meshStandardMaterial color={rockColor} flatShading roughness={0.95} />
          </mesh>
        )
      )}
    </group>
  );
}

/** Soft white haze pooling in the low basins between the peaks. */
function ValleyMist({ heightmap }) {
  const puffs = useMemo(() => {
    const { maxHeight } = heightmap.bounds;
    const spread = heightmap.halfExtent * 0.85;
    const out = [];
    for (let i = 0; i < 12 && out.length < 5; i += 1) {
      const x = (idHash2('mist', `x${i}`) - 0.5) * 2 * spread;
      const z = (idHash2('mist', `z${i}`) - 0.5) * 2 * spread;
      const h = sampleTerrainHeight(heightmap, x, z);
      if (h > Math.max(0.6, maxHeight * 0.3)) continue;
      out.push({ x, y: h + 0.8, z, size: 4 + idHash2('mist', `s${i}`) * 3 });
    }
    return out;
  }, [heightmap]);
  return (
    <group>
      {puffs.map((p, i) => (
        <group key={`mist-${i}`} position={[p.x, p.y, p.z]}>
          <GlowSprite size={p.size} color="#ffffff" opacity={0.1} />
        </group>
      ))}
    </group>
  );
}

/** Pulsing shaft of light marking the summit of the highest peak. */
function PeakBeacon({ position, color }) {
  const matRef = useRef(null);
  const { getTime, animated } = useMetaphorClock();
  useFrame(() => {
    if (!animated || !matRef.current) return;
    matRef.current.opacity = 0.1 + 0.05 * Math.sin(getTime() * 1.2);
  });
  const shaftHeight = 5;
  return (
    <group position={position}>
      <mesh position={[0, shaftHeight / 2, 0]}>
        <cylinderGeometry args={[0.32, 0.8, shaftHeight, 14, 1, true]} />
        <meshBasicMaterial
          ref={matRef}
          color={color}
          transparent
          opacity={0.12}
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <GlowSprite size={2.6} color={color} opacity={0.3} />
    </group>
  );
}

/** Gentle breeze flutter for the summit flags. */
function FlagFlutter({ seed, children }) {
  const ref = useRef(null);
  const { getTime, animated } = useMetaphorClock();
  useFrame(() => {
    if (!animated || !ref.current) return;
    const t = getTime();
    ref.current.rotation.y = Math.sin(t * 2.2 + seed * Math.PI * 2) * 0.28;
  });
  return <group ref={ref}>{children}</group>;
}

function TerrainPin({ position, label, elevation, idSeed, theme, glyph }) {
  const pinHeight = 1.1;
  const labelHeight = pinHeight + 0.7;
  const accent = elevation > 0 ? '#ef4444' : '#3b82f6';
  const stoneColor = useMemo(() => shiftColor('#8a7f72', { lightness: -0.08 }), []);
  const cairn = useMemo(
    () =>
      [0.22, 0.16, 0.11].map((r, i) => ({
        r,
        y: 0.07 + i * 0.16,
        dx: (idHash2(idSeed ?? 'pin', `cx${i}`) - 0.5) * 0.08,
        dz: (idHash2(idSeed ?? 'pin', `cz${i}`) - 0.5) * 0.08
      })),
    [idSeed]
  );
  return (
    <group position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[0.32, 18]} />
        <meshStandardMaterial color={theme.labelColor ?? '#0f172a'} transparent opacity={0.3} />
      </mesh>
      {cairn.map((c, i) => (
        <mesh key={`cairn-${i}`} position={[c.dx, c.y, c.dz]} scale={[1, 0.6, 1]}>
          <icosahedronGeometry args={[c.r, 0]} />
          <meshStandardMaterial color={stoneColor} flatShading roughness={0.95} />
        </mesh>
      ))}
      <mesh position={[0, pinHeight / 2, 0]}>
        <cylinderGeometry args={[0.04, 0.04, pinHeight, 6]} />
        <meshStandardMaterial color={theme.labelColor ?? '#0f172a'} />
      </mesh>
      {glyph ? (
        <Billboard position={[0.32, pinHeight - 0.1, 0]}>
          <group scale={0.6}>
            <Glyph kind={glyph} theme={theme} />
          </group>
        </Billboard>
      ) : (
        <FlagFlutter seed={idHash(idSeed ?? label ?? '')}>
          <mesh position={[0.24, pinHeight - 0.18, 0]}>
            <planeGeometry args={[0.46, 0.3]} />
            <meshStandardMaterial
              color={accent}
              emissive={accent}
              emissiveIntensity={0.45}
              side={THREE.DoubleSide}
            />
          </mesh>
        </FlagFlutter>
      )}
      <mesh position={[0, pinHeight + 0.02, 0]}>
        <sphereGeometry args={[0.07, 10, 10]} />
        <meshStandardMaterial color={theme.labelColor ?? '#0f172a'} />
      </mesh>
      <ItemLabel
        text={label}
        position={[0, labelHeight, 0]}
        fontSize={0.4}
        color={theme.labelColor}
        outlineColor={theme.labelOutline}
      />
    </group>
  );
}

export function TerrainScene({ dsl, theme }) {
  const heightmap = useMemo(() => terrainHeightmap(dsl.items, dsl.scene), [dsl.items, dsl.scene]);

  const anchors = useMemo(() => {
    const map = new Map();
    for (const [id, pos] of heightmap.itemPositions.entries()) {
      map.set(id, [pos[0], pos[1] + 1.5, pos[2]]);
    }
    return map;
  }, [heightmap.itemPositions]);

  const metricLabel = dsl.scene?.surface?.metric;
  const showWater = heightmap.bounds.minHeight < 0;

  const summitId = useMemo(() => {
    let best = null;
    for (const item of dsl.items) {
      const elevation = item.elevation ?? 3;
      if (!best || elevation > best.elevation) best = { id: item.id, elevation };
    }
    return best && best.elevation > 0 ? best.id : null;
  }, [dsl.items]);
  const summitPos = summitId ? heightmap.itemPositions.get(summitId) : null;

  return (
    <group>
      <TerrainSurface heightmap={heightmap} />
      {showWater ? <TerrainWaterPlane halfExtent={heightmap.halfExtent} theme={theme} /> : null}
      <TerrainContourRings heightmap={heightmap} theme={theme} />
      <TerrainFlora heightmap={heightmap} itemPositions={heightmap.itemPositions} theme={theme} />
      <ValleyMist heightmap={heightmap} />
      <TerrainClouds halfExtent={heightmap.halfExtent} maxHeight={heightmap.bounds.maxHeight} />
      <SoaringBirds
        radius={heightmap.halfExtent * 0.7}
        height={heightmap.bounds.maxHeight + 3}
        count={3}
        color={theme.labelColor ?? '#1f2937'}
        idSeed="terrain-birds"
      />
      {summitPos ? (
        <PeakBeacon
          position={summitPos}
          color={theme.binaryGlowColor ?? theme.starColor ?? '#fef08a'}
        />
      ) : null}
      {dsl.items.map((item) => {
        const position = heightmap.itemPositions.get(item.id);
        if (!position) return null;
        return (
          <HoverableItem key={item.id} item={item} metaphor="terrain">
            <TerrainPin
              idSeed={item.id}
              position={position}
              label={item.label}
              elevation={item.elevation ?? 3}
              theme={theme}
              glyph={item.glyph}
            />
          </HoverableItem>
        );
      })}
      {metricLabel ? (
        <ItemLabel
          text={metricLabel}
          position={[0, heightmap.bounds.maxHeight + 3.5, -heightmap.halfExtent + 1]}
          fontSize={0.7}
          color={theme.labelColor}
          outlineColor={theme.labelOutline}
        />
      ) : null}
      <MetaphorAccents items={dsl.items} anchors={anchors} theme={theme} />
      <MetaphorLinks links={dsl.links} anchors={anchors} theme={theme} />
    </group>
  );
}
