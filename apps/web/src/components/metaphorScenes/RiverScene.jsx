/**
 * River metaphor scene — the subject as a waterway flowing source → mouth:
 * stations ordered by `stage` sit on alternating banks as wooden docks, the
 * channel's width tracks each station's `flow` (volume), and `hazard` churns
 * the water into white rapids. Glowing motes ride the current downstream so
 * direction is legible at a glance; the mouth flares into a delta lagoon.
 * Ambient dressing (meadow, reeds, cattails, rocks, spring stones) keeps the
 * scene alive without stealing attention from the labelled stations.
 */
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard, Line } from '@react-three/drei';
import { riverPathLayout, riverWidthForFlow } from '../../utils/metaphorLayouts/riverPathLayout.js';
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

/** Perpendicular (left) of the centreline at each sample. */
function sampleNormals(samples) {
  return samples.map((s, i) => {
    const prev = samples[Math.max(0, i - 1)];
    const next = samples[Math.min(samples.length - 1, i + 1)];
    const dx = next.x - prev.x;
    const dz = next.z - prev.z;
    const len = Math.hypot(dx, dz) || 1;
    return [-dz / len, dx / len];
  });
}

/** Triangle-strip ribbon along the centreline; widthScale/pad shape the band. */
function buildRibbonGeometry(samples, normals, { y, widthScale, pad, colorFor }) {
  const count = samples.length;
  const positions = new Float32Array(count * 2 * 3);
  const colors = colorFor ? new Float32Array(count * 2 * 3) : null;
  for (let i = 0; i < count; i += 1) {
    const s = samples[i];
    const [nx, nz] = normals[i];
    const half = s.width * widthScale + pad;
    positions[i * 6] = s.x + nx * half;
    positions[i * 6 + 1] = y;
    positions[i * 6 + 2] = s.z + nz * half;
    positions[i * 6 + 3] = s.x - nx * half;
    positions[i * 6 + 4] = y;
    positions[i * 6 + 5] = s.z - nz * half;
    if (colors && colorFor) {
      const c = colorFor(s, i);
      colors[i * 6] = c.r;
      colors[i * 6 + 1] = c.g;
      colors[i * 6 + 2] = c.b;
      colors[i * 6 + 3] = c.r;
      colors[i * 6 + 4] = c.g;
      colors[i * 6 + 5] = c.b;
    }
  }
  // Winding chosen so face normals point +Y (up); materials still render
  // DoubleSide since a sharp bend can locally reverse the strip.
  const indices = [];
  for (let i = 0; i < count - 1; i += 1) {
    const a = i * 2;
    indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  if (colors) geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

/** Water surface + sandy bed + soft foam lines along both edges. */
function RiverChannel({ samples, normals, theme }) {
  const waterColor = theme.waterColor ?? '#38bdf8';
  const sandColor = useMemo(
    () => shiftColor(theme.treeSoilColor ?? '#8a6f47', { lightness: 0.16, satScale: 0.7 }),
    [theme.treeSoilColor]
  );
  const matRef = useRef(null);
  const { getTime, animated } = useMetaphorClock();
  useFrame(() => {
    if (!animated || !matRef.current) return;
    matRef.current.opacity = 0.82 + 0.06 * Math.sin(getTime() * 0.9);
  });

  const { waterGeom, bedGeom, edges } = useMemo(() => {
    const deep = new THREE.Color(theme.riverDeepColor ?? '#168fc7');
    const light = new THREE.Color(waterColor).lerp(new THREE.Color('#ffffff'), 0.26);
    const water = buildRibbonGeometry(samples, normals, {
      y: 0.06,
      widthScale: 1,
      pad: 0,
      colorFor: (s) => {
        // Wider reaches read deeper.
        const t = Math.min(1, s.width / 4.5);
        return light.clone().lerp(deep, 0.45 + t * 0.5);
      }
    });
    const bed = buildRibbonGeometry(samples, normals, { y: 0, widthScale: 1.15, pad: 0.5 });
    const left = samples.map((s, i) => [
      s.x + normals[i][0] * s.width * 0.96,
      0.085,
      s.z + normals[i][1] * s.width * 0.96
    ]);
    const right = samples.map((s, i) => [
      s.x - normals[i][0] * s.width * 0.96,
      0.085,
      s.z - normals[i][1] * s.width * 0.96
    ]);
    return { waterGeom: water, bedGeom: bed, edges: [left, right] };
  }, [samples, normals, waterColor, theme.riverDeepColor]);

  useEffect(
    () => () => {
      waterGeom.dispose();
      bedGeom.dispose();
    },
    [waterGeom, bedGeom]
  );

  return (
    <group>
      <mesh geometry={bedGeom} position={[0, 0.02, 0]}>
        <meshStandardMaterial color={sandColor} roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={waterGeom}>
        <meshStandardMaterial
          ref={matRef}
          vertexColors
          transparent
          opacity={0.9}
          roughness={0.25}
          metalness={0.15}
          side={THREE.DoubleSide}
        />
      </mesh>
      {edges.map((pts, i) => (
        <Line
          key={`foam-${i}`}
          points={pts}
          color="#ffffff"
          lineWidth={0.9}
          transparent
          opacity={0.22}
        />
      ))}
    </group>
  );
}

/** Glowing motes riding the current downstream — makes flow direction legible. */
function CurrentMotes({ samples, normals, theme }) {
  const groupRef = useRef(null);
  const { getTime, animated } = useMetaphorClock();
  const lanes = useMemo(() => {
    const build = (lateral) =>
      samples.map((s, i) => [
        s.x + normals[i][0] * s.width * lateral,
        0.16,
        s.z + normals[i][1] * s.width * lateral
      ]);
    return [build(-0.42), build(0), build(0.42)];
  }, [samples, normals]);
  const motes = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => ({
        lane: i % 3,
        phase: idHash2('river-mote', `p${i}`),
        speed: 0.05 + idHash2('river-mote', `s${i}`) * 0.03
      })),
    []
  );
  useFrame(() => {
    if (!groupRef.current) return;
    const t = animated ? getTime() : 0;
    groupRef.current.children.forEach((child, i) => {
      const mote = motes[i];
      if (!mote) return;
      const progress = (mote.phase + t * mote.speed) % 1;
      const lane = lanes[mote.lane];
      const idx = Math.min(lane.length - 1, Math.floor(progress * (lane.length - 1)));
      const p = lane[idx];
      child.position.set(p[0], p[1], p[2]);
    });
  });
  const moteColor = theme.binaryGlowColor ?? '#e0f2fe';
  return (
    <group ref={groupRef}>
      {motes.map((_, i) => (
        <mesh key={`mote-${i}`}>
          <sphereGeometry args={[0.09, 8, 8]} />
          <meshBasicMaterial color={moteColor} toneMapped={false} transparent opacity={0.85} />
        </mesh>
      ))}
    </group>
  );
}

/** Churning white water where a station carries hazard — bobbing foam balls. */
function RapidsFoam({ center, width, hazard, idSeed }) {
  const groupRef = useRef(null);
  const { getTime, animated } = useMetaphorClock();
  const foam = useMemo(() => {
    const count = Math.round(6 + hazard * 12);
    return Array.from({ length: count }, (_, i) => ({
      x: center[0] + (idHash2(idSeed, `fx${i}`) - 0.5) * width * 1.6,
      z: center[2] + (idHash2(idSeed, `fz${i}`) - 0.5) * width * 1.4,
      r: 0.08 + idHash2(idSeed, `fr${i}`) * 0.12 * (0.6 + hazard),
      phase: idHash2(idSeed, `fp${i}`) * Math.PI * 2,
      speed: 1.6 + idHash2(idSeed, `fs${i}`) * 2.2
    }));
  }, [center, width, hazard, idSeed]);
  useFrame(() => {
    if (!animated || !groupRef.current) return;
    const t = getTime();
    groupRef.current.children.forEach((child, i) => {
      const f = foam[i];
      if (!f) return;
      child.position.y = 0.12 + Math.abs(Math.sin(t * f.speed + f.phase)) * 0.14 * (0.5 + hazard);
    });
  });
  return (
    <group ref={groupRef}>
      {foam.map((f, i) => (
        <mesh key={`foam-${i}`} position={[f.x, 0.12, f.z]}>
          <icosahedronGeometry args={[f.r, 0]} />
          <meshStandardMaterial
            color="#f8fafc"
            emissive="#f8fafc"
            emissiveIntensity={0.25}
            roughness={0.6}
          />
        </mesh>
      ))}
    </group>
  );
}

/** Wooden dock jutting from the bank toward the water, with a labelled post. */
function StationDock({ station, item, theme }) {
  const woodColor = theme.treeTrunkColor ?? '#8b5a2b';
  const plankColor = useMemo(
    () => shiftColor(woodColor, { lightness: 0.12, satScale: 0.85 }),
    [woodColor]
  );
  const toWater = useMemo(() => {
    const dx = station.point[0] - station.bank[0];
    const dz = station.point[2] - station.bank[2];
    const len = Math.hypot(dx, dz) || 1;
    return { dir: [dx / len, dz / len], angle: Math.atan2(dx, dz) };
  }, [station.point, station.bank]);
  const planks = useMemo(
    () =>
      [0.35, 0.85, 1.35].map((d) => ({
        x: station.bank[0] + toWater.dir[0] * d,
        z: station.bank[2] + toWater.dir[1] * d
      })),
    [station.bank, toWater.dir]
  );
  return (
    <group>
      {planks.map((p, i) => (
        <mesh key={`plank-${i}`} position={[p.x, 0.16, p.z]} rotation={[0, toWater.angle, 0]}>
          <boxGeometry args={[0.72, 0.07, 0.42]} />
          <meshStandardMaterial color={plankColor} roughness={0.9} />
        </mesh>
      ))}
      <group position={station.bank}>
        <mesh position={[0, 0.95, 0]}>
          <cylinderGeometry args={[0.07, 0.1, 1.9, 8]} />
          <meshStandardMaterial color={woodColor} roughness={0.9} />
        </mesh>
        <mesh position={[0, 1.9, 0]}>
          <sphereGeometry args={[0.12, 10, 10]} />
          <meshStandardMaterial
            color={theme.slabTrimColor ?? '#fbbf24'}
            emissive={theme.slabTrimColor ?? '#fbbf24'}
            emissiveIntensity={0.5}
            toneMapped={false}
          />
        </mesh>
        {item.glyph ? (
          <Billboard position={[0, 2.55, 0]}>
            <group scale={0.95}>
              <Glyph kind={item.glyph} theme={theme} />
            </group>
          </Billboard>
        ) : null}
        <ItemLabel
          text={item.label}
          position={[0, item.glyph ? 3.35 : 2.6, 0]}
          fontSize={0.62}
          color={theme.labelColor}
          outlineColor={theme.labelOutline}
        />
      </group>
    </group>
  );
}

/** Grass tufts + cattails + rocks scattered along the banks. */
function BankDressing({ samples, normals, theme }) {
  const leafColor = theme.treeLeafColor ?? '#4ade80';
  const stoneColor = useMemo(
    () => shiftColor(theme.treeSoilColor ?? '#5b4226', { lightness: 0.2, satScale: 0.35 }),
    [theme.treeSoilColor]
  );
  const cattailColor = '#7c4a1e';
  const plants = useMemo(() => {
    const out = [];
    for (let i = 4; i < samples.length - 4; i += 5) {
      const roll = idHash2('bank', `roll${i}`);
      if (roll < 0.35) continue;
      const s = samples[i];
      const [nx, nz] = normals[i];
      const side = idHash2('bank', `side${i}`) > 0.5 ? 1 : -1;
      const dist = s.width + 0.6 + idHash2('bank', `d${i}`) * 1.6;
      const x = s.x + nx * dist * side;
      const z = s.z + nz * dist * side;
      const kind = roll > 0.85 ? 'rock' : roll > 0.62 ? 'cattail' : 'grass';
      out.push({
        x,
        z,
        kind,
        h: 0.3 + idHash2('bank', `h${i}`) * 0.45,
        spin: idHash2('bank', `r${i}`) * Math.PI,
        tint: shiftColor(leafColor, {
          lightness: (idHash2('bank', `l${i}`) - 0.5) * 0.14,
          hueShift: (idHash2('bank', `hh${i}`) - 0.5) * 0.05
        })
      });
    }
    return out;
  }, [samples, normals, leafColor]);
  return (
    <group>
      {plants.map((p, i) => (
        <group key={`plant-${i}`} position={[p.x, 0, p.z]} rotation={[0, p.spin, 0]}>
          {p.kind === 'grass'
            ? [-0.07, 0, 0.07].map((off, b) => (
                <mesh key={`b-${b}`} position={[off, p.h / 2, 0]} rotation={[0, 0, off * 3]}>
                  <coneGeometry args={[0.035, p.h, 4]} />
                  <meshStandardMaterial color={p.tint} flatShading />
                </mesh>
              ))
            : null}
          {p.kind === 'cattail' ? (
            <>
              <mesh position={[0, p.h * 0.9, 0]}>
                <cylinderGeometry args={[0.02, 0.025, p.h * 1.8, 6]} />
                <meshStandardMaterial color={p.tint} />
              </mesh>
              <mesh position={[0, p.h * 1.8, 0]}>
                <capsuleGeometry args={[0.055, 0.18, 3, 8]} />
                <meshStandardMaterial color={cattailColor} roughness={0.9} />
              </mesh>
            </>
          ) : null}
          {p.kind === 'rock' ? (
            <mesh position={[0, 0.08, 0]} scale={[1, 0.65, 1]}>
              <icosahedronGeometry args={[0.16 + p.h * 0.25, 0]} />
              <meshStandardMaterial color={stoneColor} flatShading roughness={0.95} />
            </mesh>
          ) : null}
        </group>
      ))}
    </group>
  );
}

/** Stone spring at the source and a widening lagoon at the mouth. */
function SourceAndMouth({ samples, theme }) {
  const stoneColor = useMemo(
    () => shiftColor(theme.treeSoilColor ?? '#5b4226', { lightness: 0.22, satScale: 0.3 }),
    [theme.treeSoilColor]
  );
  if (samples.length < 2) return null;
  const head = samples[0];
  const mouth = samples[samples.length - 1];
  const stones = [0, 1, 2, 3, 4].map((i) => ({
    x: head.x + (idHash2('spring', `x${i}`) - 0.5) * 1.6,
    z: head.z + (idHash2('spring', `z${i}`) - 0.5) * 1.6,
    r: 0.18 + idHash2('spring', `r${i}`) * 0.2
  }));
  return (
    <group>
      {stones.map((s, i) => (
        <mesh key={`spring-${i}`} position={[s.x, 0.1, s.z]} scale={[1, 0.7, 1]}>
          <icosahedronGeometry args={[s.r, 0]} />
          <meshStandardMaterial color={stoneColor} flatShading roughness={0.95} />
        </mesh>
      ))}
      <group position={[head.x, 0.5, head.z]}>
        <GlowSprite size={2.2} color="#ffffff" opacity={0.16} />
      </group>
      <mesh position={[mouth.x, 0.045, mouth.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[Math.min(4.2, Math.max(2.4, mouth.width * 1.4)), 48]} />
        <meshStandardMaterial
          color={theme.waterColor ?? '#38bdf8'}
          transparent
          opacity={0.55}
          roughness={0.3}
          metalness={0.15}
        />
      </mesh>
    </group>
  );
}

/** Soft elliptical meadow hugging the river's course (not a giant circle —
 *  the channel is long and shallow, so the footing follows that shape). */
function RiverMeadow({ theme, radiusX, radiusZ }) {
  const meadowColor = theme.treeMeadowColor ?? theme.groundColor ?? '#2e4a2e';
  const rimColor = useMemo(() => {
    const hsl = { h: 0, s: 0, l: 0 };
    new THREE.Color(meadowColor).getHSL(hsl);
    return shiftColor(meadowColor, { lightness: hsl.l < 0.2 ? 0.06 : -0.08 });
  }, [meadowColor]);
  // circleGeometry is drawn in local XY then rotated flat, so local Y maps to
  // world Z — scale Y to squash the disc into an ellipse along the course.
  const squash = radiusZ / radiusX;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, 0]} scale={[1, squash, 1]}>
        <circleGeometry args={[radiusX, 72]} />
        <meshStandardMaterial color={rimColor} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]} scale={[1, squash, 1]}>
        <circleGeometry args={[radiusX * 0.96, 72]} />
        <meshStandardMaterial color={meadowColor} />
      </mesh>
    </group>
  );
}

/** Ambient broadleaf/conifer trees on the meadow, clear of channel and docks. */
function MeadowTrees({ samples, stations, radiusX, radiusZ, theme }) {
  const leafColor = theme.treeLeafColor ?? '#4ade80';
  const trunkColor = theme.treeTrunkColor ?? '#8b5a2b';
  const trees = useMemo(() => {
    const out = [];
    for (let i = 0; i < 26 && out.length < 16; i += 1) {
      const x = (idHash2('meadow-tree', `x${i}`) - 0.5) * 2 * radiusX * 0.82;
      const z = (idHash2('meadow-tree', `z${i}`) - 0.5) * 2 * radiusZ * 0.78;
      if ((x / radiusX) ** 2 + (z / radiusZ) ** 2 > 0.82) continue;
      let blocked = false;
      for (let s = 0; s < samples.length; s += 6) {
        const sample = samples[s];
        if (Math.hypot(sample.x - x, sample.z - z) < sample.width + 2.4) {
          blocked = true;
          break;
        }
      }
      if (!blocked) {
        blocked = stations.some((st) => Math.hypot(st.bank[0] - x, st.bank[2] - z) < 2.6);
      }
      if (blocked) continue;
      out.push({
        x,
        z,
        conifer: idHash2('meadow-tree', `k${i}`) > 0.5,
        scale: 0.7 + idHash2('meadow-tree', `s${i}`) * 0.8,
        tint: shiftColor(leafColor, {
          lightness: (idHash2('meadow-tree', `l${i}`) - 0.5) * 0.14,
          hueShift: (idHash2('meadow-tree', `h${i}`) - 0.5) * 0.05
        })
      });
    }
    return out;
  }, [samples, stations, radiusX, radiusZ, leafColor]);
  return (
    <group>
      {trees.map((t, i) => (
        <group key={`mtree-${i}`} position={[t.x, 0, t.z]} scale={t.scale}>
          <mesh position={[0, 0.5, 0]}>
            <cylinderGeometry args={[0.1, 0.15, 1, 6]} />
            <meshStandardMaterial color={trunkColor} roughness={0.9} />
          </mesh>
          {t.conifer ? (
            <mesh position={[0, 1.35, 0]}>
              <coneGeometry args={[0.62, 1.5, 7]} />
              <meshStandardMaterial color={t.tint} flatShading roughness={0.85} />
            </mesh>
          ) : (
            <>
              <mesh position={[0, 1.35, 0]}>
                <icosahedronGeometry args={[0.72, 0]} />
                <meshStandardMaterial color={t.tint} flatShading roughness={0.85} />
              </mesh>
              <mesh position={[0.32, 1.72, 0.14]}>
                <icosahedronGeometry args={[0.42, 0]} />
                <meshStandardMaterial color={t.tint} flatShading roughness={0.85} />
              </mesh>
            </>
          )}
        </group>
      ))}
    </group>
  );
}

export function RiverScene({ dsl, theme }) {
  const layout = useMemo(() => riverPathLayout(dsl.items), [dsl.items]);
  const normals = useMemo(() => sampleNormals(layout.samples), [layout.samples]);

  const itemById = useMemo(() => new Map(dsl.items.map((item) => [item.id, item])), [dsl.items]);

  const anchors = useMemo(() => {
    const map = new Map();
    for (const station of layout.stations) {
      map.set(station.id, [station.bank[0], 2.0, station.bank[2]]);
    }
    return map;
  }, [layout.stations]);

  const meadowZ = useMemo(() => {
    let maxZ = 4;
    for (const s of layout.samples) maxZ = Math.max(maxZ, Math.abs(s.z) + s.width);
    return maxZ + 5.5;
  }, [layout.samples]);

  if (layout.samples.length < 2) return null;

  const meadowX = layout.bounds.halfExtent * 1.12;

  return (
    <group>
      <RiverMeadow theme={theme} radiusX={meadowX} radiusZ={meadowZ} />
      <RiverChannel samples={layout.samples} normals={normals} theme={theme} />
      <CurrentMotes samples={layout.samples} normals={normals} theme={theme} />
      <SourceAndMouth samples={layout.samples} theme={theme} />
      <BankDressing samples={layout.samples} normals={normals} theme={theme} />
      <MeadowTrees
        samples={layout.samples}
        stations={layout.stations}
        radiusX={meadowX}
        radiusZ={meadowZ}
        theme={theme}
      />
      {layout.stations.map((station) => {
        const item = itemById.get(station.id);
        if (!item) return null;
        const hazard = typeof item.hazard === 'number' ? item.hazard : 0;
        const width = riverWidthForFlow(
          typeof item.flow === 'number' && Number.isFinite(item.flow) ? item.flow : 5
        );
        return (
          <HoverableItem key={station.id} item={item} metaphor="river">
            <group>
              <StationDock station={station} item={item} theme={theme} />
              {hazard > 0.15 ? (
                <RapidsFoam
                  center={station.point}
                  width={width}
                  hazard={hazard}
                  idSeed={station.id}
                />
              ) : null}
            </group>
          </HoverableItem>
        );
      })}
      <DaylightPollen radius={meadowZ * 1.1} count={18} idSeed="river-pollen" />
      <SoaringBirds
        radius={meadowZ * 1.1}
        height={7}
        count={3}
        color={theme.labelColor ?? '#1f2937'}
        idSeed="river-birds"
      />
      <MetaphorGroundShadow theme={theme} y={-0.02} scale={meadowX * 1.7} />
      <MetaphorLinks links={dsl.links} anchors={anchors} theme={theme} variant="arc" />
    </group>
  );
}

/** Clear daylight sky over the river, with a warm sun halo. */
export function RiverSky({ theme }) {
  return (
    <group>
      <GradientSkySphere
        topColor={theme.skyTopColor ?? '#87ceeb'}
        horizonColor={theme.skyHorizonColor ?? '#e8f4e8'}
      />
      <SkySunGlow />
    </group>
  );
}
