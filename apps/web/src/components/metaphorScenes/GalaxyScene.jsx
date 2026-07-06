/**
 * Galaxy metaphor scene — each cluster is a small spiral galaxy: a phyllotaxis
 * star disc around a glowing core, wrapped in two tilted dust arms, with the
 * cluster name floating beneath. Stars twinkle with round halo sprites and
 * diffraction spikes (brightest stars gain a second diagonal pair). GalaxySky
 * (rendered outside <Bounds> by MetaphorRenderer) supplies the deep-space
 * gradient backdrop and a distant starfield. Extracted from
 * MetaphorRenderer.jsx per the ADR-0005 sibling-module pattern.
 */
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard, Line, Stars } from '@react-three/drei';
import { galaxyClusterLayout } from '../../utils/metaphorLayouts/galaxyClusterLayout.js';
import {
  resolveClusterColor,
  resolveGalaxyVividTheme,
  resolveNebulaColor
} from '../../utils/metaphorThemePresets.js';
import { Glyph } from '../metaphorGlyphs/index.jsx';
import {
  GradientSkySphere,
  HoverableItem,
  ItemLabel,
  MetaphorLinks
} from './MetaphorSceneChrome.jsx';
import { useMetaphorClock } from './metaphorClock.js';
import { getRadialSpriteTexture, idHash, idHash2, shiftColor } from './sceneUtils.js';

/** Billboarded additive glow using the soft radial sprite (round, not square). */
function GlowSprite({ size, color, opacity }) {
  const map = getRadialSpriteTexture();
  return (
    <Billboard>
      <mesh>
        <planeGeometry args={[size, size]} />
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
    </Billboard>
  );
}

function StarTwinkle({ children, id, baseIntensity }) {
  const groupRef = useRef(null);
  const matRef = useRef(null);
  const { getTime, animated } = useMetaphorClock();
  const phase = useMemo(() => idHash(id) * Math.PI * 2, [id]);
  useFrame(() => {
    if (!animated) return;
    const t = getTime();
    const pulse = 0.7 + 0.3 * Math.sin(t * 2 + phase);
    if (groupRef.current) {
      const s = 1 + 0.06 * Math.sin(t * 2.7 + phase * 1.3);
      groupRef.current.scale.set(s, s, s);
    }
    if (matRef.current) {
      matRef.current.emissiveIntensity = baseIntensity * pulse;
    }
  });
  return (
    <group ref={groupRef}>
      {typeof children === 'function' ? children({ matRef }) : children}
    </group>
  );
}

function DiffractionSpikes({ size, color, bright }) {
  const length = Math.max(0.6, size * 4.2);
  const width = Math.max(0.04, size * 0.16);
  const spikes = bright
    ? [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4]
    : [0, Math.PI / 2];
  return (
    <Billboard>
      {spikes.map((rot, i) => (
        <mesh key={`spike-${i}`} rotation={[0, 0, rot]}>
          <planeGeometry args={[i >= 2 ? length * 0.6 : length, width]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={i >= 2 ? 0.28 : 0.45}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      ))}
    </Billboard>
  );
}

function GalaxyStar({ item, position, theme, clusterIndex, showGlyph }) {
  const magnitude = Math.max(0.3, (item.magnitude ?? 5) * 0.15);
  const spectralSpread = theme.galaxySpectralSpread ?? 0.35;
  // Cluster colour carries the grouping; per-star spectral hue drift keeps the
  // cluster reading as many individual suns instead of clones.
  const starColor = useMemo(() => {
    const clusterBase = resolveClusterColor(theme, clusterIndex);
    const hueDrift = (idHash2(item.id, 'star-hue') - 0.5) * spectralSpread;
    return shiftColor(clusterBase, {
      lightness: (idHash2(item.id, 'star-tint') - 0.5) * 0.16,
      satScale: 0.95 + idHash2(item.id, 'star-sat') * 0.2,
      hueShift: hueDrift
    });
  }, [theme, clusterIndex, item.id, spectralSpread]);
  const baseIntensity = 0.95 + magnitude * 0.14;

  return (
    <group position={position}>
      <GlowSprite size={magnitude * 5.2} color={starColor} opacity={0.36} />
      <DiffractionSpikes size={magnitude} color={starColor} bright={magnitude >= 1.35} />
      <StarTwinkle id={item.id} baseIntensity={baseIntensity}>
        {({ matRef }) => (
          <mesh>
            <sphereGeometry args={[magnitude, 16, 16]} />
            <meshStandardMaterial
              ref={matRef}
              emissive={starColor}
              emissiveIntensity={baseIntensity}
              color={starColor}
              toneMapped={false}
            />
          </mesh>
        )}
      </StarTwinkle>
      {item.glyph && showGlyph ? (
        <Billboard>
          <group
            position={[magnitude + 0.9, 0, 0]}
            scale={Math.max(0.55, Math.min(1.3, magnitude * 0.9))}
          >
            <Glyph kind={item.glyph} theme={theme} />
          </group>
        </Billboard>
      ) : null}
      <ItemLabel
        text={item.label}
        position={[0, magnitude + 0.7, 0]}
        fontSize={0.45}
        color={theme.labelColor}
        outlineColor={theme.labelOutline}
      />
    </group>
  );
}

function NebulaCloud({ cloud, theme, index }) {
  const color = cloud.color ?? resolveNebulaColor(theme, index);
  const radius = Math.max(1, cloud.radius ?? 6);
  const idSeed = `nebula-${index}`;
  const layers = useMemo(() => {
    const offsets = [
      { scale: 1.0, opacity: 0.2, offset: [0, 0, 0] },
      {
        scale: 0.72,
        opacity: 0.25,
        offset: [
          (idHash2(idSeed, 'ox1') - 0.5) * radius * 0.4,
          (idHash2(idSeed, 'oy1') - 0.5) * radius * 0.3,
          (idHash2(idSeed, 'oz1') - 0.5) * radius * 0.4
        ]
      },
      {
        scale: 0.42,
        opacity: 0.34,
        offset: [
          (idHash2(idSeed, 'ox2') - 0.5) * radius * 0.6,
          (idHash2(idSeed, 'oy2') - 0.5) * radius * 0.5,
          (idHash2(idSeed, 'oz2') - 0.5) * radius * 0.6
        ]
      }
    ];
    return offsets;
  }, [idSeed, radius]);
  return (
    <group position={cloud.center}>
      {layers.map((layer, i) => (
        <mesh key={`neb-${i}`} position={layer.offset}>
          <sphereGeometry args={[radius * layer.scale, 24, 24]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={layer.opacity}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function BinaryConnector({ from, to, theme }) {
  const matRef = useRef(null);
  const { getTime, animated } = useMetaphorClock();
  const seed = useMemo(() => idHash(`${from?.join('|')}->${to?.join('|')}`), [from, to]);
  useFrame(() => {
    if (!animated || !matRef.current) return;
    const t = getTime();
    matRef.current.opacity = 0.7 + 0.15 * Math.sin(t * 2.5 + seed * Math.PI * 2);
  });
  return (
    <Line
      points={[from, to]}
      color={theme.binaryGlowColor ?? theme.starColor}
      lineWidth={2.5}
      transparent
      opacity={0.85}
      ref={(line) => {
        if (line && line.material) {
          matRef.current = Array.isArray(line.material) ? line.material[0] : line.material;
        }
      }}
    />
  );
}

/** Glowing galactic bulge at the cluster centre. */
function ClusterCore({ cluster, color }) {
  const radius = Math.max(1.6, cluster.radius ?? 2);
  const innerColor = useMemo(() => shiftColor(color, { lightness: 0.22, satScale: 0.85 }), [color]);
  return (
    <group position={cluster.center}>
      <GlowSprite size={radius * 3.8} color={color} opacity={0.3} />
      <GlowSprite size={radius * 1.65} color={innerColor} opacity={0.62} />
    </group>
  );
}

/** Two dust arms spiralling out of the cluster core, plus a faint disc ring; the
 *  whole group is tilted per-cluster so the galaxies don't sit on one plane. */
function ClusterArms({ cluster, theme, color }) {
  const name = cluster.name ?? 'main';
  const spread = Math.max(1.6, cluster.radius ?? 2);
  const motes = useMemo(() => {
    const armCount = 2;
    const perArm = Math.min(20, 8 + Math.ceil((cluster.count ?? 0) * 1.5));
    const spin = idHash(`spiral-${name}`) * Math.PI * 2;
    const out = [];
    for (let arm = 0; arm < armCount; arm += 1) {
      const armOffset = (arm / armCount) * Math.PI * 2;
      for (let i = 0; i < perArm; i += 1) {
        const t = (i + 1) / perArm;
        const radius = spread * (0.35 + t * 1.2);
        const angle = armOffset + spin + t * Math.PI * 2.1;
        out.push({
          position: [
            Math.cos(angle) * radius + (idHash2(name, `jx${arm}-${i}`) - 0.5) * 0.9,
            (idHash2(name, `jy${arm}-${i}`) - 0.5) * (1 - t * 0.6) * 1.1,
            Math.sin(angle) * radius + (idHash2(name, `jz${arm}-${i}`) - 0.5) * 0.9
          ],
          size: 0.5 + idHash2(name, `s${arm}-${i}`) * 0.7 + (1 - t) * 0.4,
          opacity: 0.48 * (1 - t * 0.55),
          dusty: (arm + i) % 2 === 0
        });
      }
    }
    return out;
  }, [name, spread, cluster.count]);
  const dustColor = theme.nebulaDustColor ?? resolveNebulaColor(theme, 0);
  const tilt = useMemo(
    () => [(idHash2(name, 'tilt-x') - 0.5) * 0.4, 0, (idHash2(name, 'tilt-z') - 0.5) * 0.4],
    [name]
  );
  return (
    <group position={cluster.center} rotation={tilt}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[spread * 1.02, spread * 1.55, 48]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.1}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {motes.map((m, i) => (
        <group key={`mote-${i}`} position={m.position}>
          <GlowSprite size={m.size} color={m.dusty ? dustColor : color} opacity={m.opacity} />
        </group>
      ))}
    </group>
  );
}

function ClusterLabel({ cluster, theme }) {
  const radius = Math.max(1.6, cluster.radius ?? 2);
  return (
    <ItemLabel
      text={cluster.name}
      position={[
        cluster.center[0],
        cluster.center[1] - radius * 0.4 - 1.3,
        cluster.center[2]
      ]}
      fontSize={0.6}
      color={theme.labelColor}
      outlineColor={theme.labelOutline}
    />
  );
}

/** Procedural nebula when the DSL omits scene.nebula — keeps galaxies colourful by default. */
const DEFAULT_NEBULA_CLOUDS = [
  { center: [-8, 2, -6], radius: 9, colorIndex: 0 },
  { center: [10, -1, 8], radius: 7, colorIndex: 1 },
  { center: [0, 4, -12], radius: 6, colorIndex: 2 }
];

export function GalaxyScene({ dsl, theme }) {
  const galaxyTheme = useMemo(() => resolveGalaxyVividTheme(theme), [theme]);
  const layout = useMemo(() => galaxyClusterLayout(dsl.items), [dsl.items]);
  const clusterIndexByName = useMemo(() => {
    const map = new Map();
    layout.clusters.forEach((c) => map.set(c.name, c.index));
    return map;
  }, [layout.clusters]);

  const anchors = useMemo(() => {
    const map = new Map();
    for (const item of dsl.items) {
      const pos = layout.positions.get(item.id);
      if (!pos) continue;
      map.set(item.id, [...pos]);
    }
    return map;
  }, [dsl.items, layout.positions]);

  const binaryPairs = useMemo(() => {
    const pairs = [];
    const seen = new Set();
    for (const item of dsl.items) {
      if (typeof item.binary !== 'string') continue;
      const a = item.id;
      const b = item.binary;
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      if (seen.has(key)) continue;
      const fromPos = anchors.get(a);
      const toPos = anchors.get(b);
      if (!fromPos || !toPos) continue;
      seen.add(key);
      pairs.push({ key, from: fromPos, to: toPos });
    }
    return pairs;
  }, [dsl.items, anchors]);

  const nebula = useMemo(() => {
    if (Array.isArray(dsl.scene?.nebula) && dsl.scene.nebula.length > 0) {
      return dsl.scene.nebula;
    }
    return DEFAULT_NEBULA_CLOUDS.map((cloud) => ({
      center: cloud.center,
      radius: cloud.radius,
      color: resolveNebulaColor(galaxyTheme, cloud.colorIndex)
    }));
  }, [dsl.scene, galaxyTheme]);

  const magnitudeMedian = useMemo(() => {
    const mags = dsl.items.map((it) => it.magnitude ?? 5).sort((a, b) => a - b);
    if (!mags.length) return 0;
    const mid = Math.floor(mags.length / 2);
    return mags.length % 2 === 0 ? (mags[mid - 1] + mags[mid]) / 2 : mags[mid];
  }, [dsl.items]);

  // The implicit single bucket ('main') isn't a meaningful grouping — only
  // label clusters when the author actually split the stars.
  const showClusterLabels = layout.clusters.length > 1;

  return (
    <group>
      {nebula.map((cloud, idx) => (
        <NebulaCloud key={`nebula-${idx}`} cloud={cloud} theme={galaxyTheme} index={idx} />
      ))}
      {layout.clusters.map((cluster) => {
        const color = resolveClusterColor(galaxyTheme, cluster.index);
        return (
          <group key={`cluster-${cluster.name}`}>
            <ClusterCore cluster={cluster} color={color} />
            <ClusterArms cluster={cluster} theme={galaxyTheme} color={color} />
            {showClusterLabels ? <ClusterLabel cluster={cluster} theme={theme} /> : null}
          </group>
        );
      })}
      {dsl.items.map((item) => {
        const position = layout.positions.get(item.id);
        if (!position) return null;
        const clusterName =
          typeof item.cluster === 'string' && item.cluster.trim() ? item.cluster.trim() : 'main';
        const clusterIndex = clusterIndexByName.get(clusterName) ?? 0;
        const showGlyph = (item.magnitude ?? 5) >= magnitudeMedian;
        return (
          <HoverableItem key={item.id} item={item} metaphor="galaxy">
            <GalaxyStar
              item={item}
              theme={galaxyTheme}
              position={position}
              clusterIndex={clusterIndex}
              showGlyph={showGlyph}
            />
          </HoverableItem>
        );
      })}
      {binaryPairs.map((pair) => (
        <BinaryConnector key={pair.key} from={pair.from} to={pair.to} theme={galaxyTheme} />
      ))}
      <MetaphorLinks links={dsl.links} anchors={anchors} theme={theme} variant="arc" />
    </group>
  );
}

/**
 * Deep-space backdrop for the galaxy scene: a near-black gradient sphere plus a
 * distant drei starfield. Rendered outside <Bounds> (like the city sky) so it
 * never enlarges the framed footprint. `animated` gates the starfield twinkle
 * during streaming, matching the scene clock.
 */
export function GalaxySky({ theme, animated = true }) {
  const galaxyTheme = resolveGalaxyVividTheme(theme);
  return (
    <group>
      <GradientSkySphere
        topColor={galaxyTheme.spaceTopColor ?? '#070b18'}
        horizonColor={galaxyTheme.spaceHorizonColor ?? '#2a1050'}
      />
      <Stars
        radius={130}
        depth={60}
        count={2400}
        factor={3}
        saturation={0.85}
        fade
        speed={animated ? 0.5 : 0}
      />
    </group>
  );
}
