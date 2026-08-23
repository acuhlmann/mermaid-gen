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

/**
 * Trim lead-in / mouth tips so spring stones and the delta lagoon never share
 * triangles with the animated water ribbon (the main source of end flicker).
 */
function channelSpan(samples, normals) {
  const n = samples.length;
  if (n < 8) return { samples, normals, start: 0 };
  const start = Math.min(8, Math.floor(n * 0.07));
  const end = Math.max(start + 4, n - Math.min(8, Math.floor(n * 0.07)));
  return {
    samples: samples.slice(start, end),
    normals: normals.slice(start, end),
    start
  };
}

/** Water surface + sandy bed + soft foam lines along both edges. */
function RiverChannel({ samples, normals, theme }) {
  const waterColor = theme.waterColor ?? '#38bdf8';
  const sandColor = useMemo(
    () => shiftColor(theme.treeSoilColor ?? '#8a6f47', { lightness: 0.16, satScale: 0.7 }),
    [theme.treeSoilColor]
  );
  const meshRef = useRef(null);
  const matRef = useRef(null);
  const basePositionsRef = useRef(null);
  const waveScaleRef = useRef(null);
  const { getTime, animated } = useMetaphorClock();

  const span = useMemo(() => channelSpan(samples, normals), [samples, normals]);

  const { waterGeom, bedGeom, edges } = useMemo(() => {
    const deep = new THREE.Color(theme.riverDeepColor ?? '#168fc7');
    const light = new THREE.Color(waterColor).lerp(new THREE.Color('#ffffff'), 0.26);
    const water = buildRibbonGeometry(span.samples, span.normals, {
      // Keep water clearly above the bed so ribbons never z-fight.
      y: 0.09,
      widthScale: 1,
      pad: 0,
      colorFor: (s) => {
        // Wider reaches read deeper.
        const t = Math.min(1, s.width / 4.5);
        return light.clone().lerp(deep, 0.45 + t * 0.5);
      }
    });
    const bed = buildRibbonGeometry(span.samples, span.normals, {
      y: 0,
      widthScale: 1.15,
      pad: 0.5
    });
    // Foam only on the stable mid-channel — tips still flicker when lines cross
    // transparent spring/lagoon discs.
    const foamLo = Math.floor(span.samples.length * 0.08);
    const foamHi = Math.ceil(span.samples.length * 0.92);
    const mid = span.samples.slice(foamLo, foamHi);
    const midN = span.normals.slice(foamLo, foamHi);
    const left = mid.map((s, i) => [
      s.x + midN[i][0] * s.width * 0.96,
      0.115,
      s.z + midN[i][1] * s.width * 0.96
    ]);
    const right = mid.map((s, i) => [
      s.x - midN[i][0] * s.width * 0.96,
      0.115,
      s.z - midN[i][1] * s.width * 0.96
    ]);
    return { waterGeom: water, bedGeom: bed, edges: [left, right] };
  }, [span, waterColor, theme.riverDeepColor]);

  useEffect(() => {
    const positions = waterGeom.attributes.position.array;
    basePositionsRef.current = Float32Array.from(positions);
    // Per-vertex wave envelope: zero at ribbon ends so ripples never poke into
    // the spring/lagoon overlap zone even if sample trim is imperfect.
    const count = positions.length / 3;
    const sampleCount = span.samples.length;
    const scales = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      const sampleIdx = Math.floor(i / 2);
      const u = sampleCount <= 1 ? 0.5 : sampleIdx / (sampleCount - 1);
      const edge = Math.min(u, 1 - u);
      scales[i] = THREE.MathUtils.smoothstep(edge, 0.04, 0.14);
    }
    waveScaleRef.current = scales;
    return () => {
      waterGeom.dispose();
      bedGeom.dispose();
    };
  }, [waterGeom, bedGeom, span.samples.length]);

  useFrame(() => {
    if (!animated || !meshRef.current || !matRef.current || !basePositionsRef.current) return;
    const t = getTime();
    // Opaque water + fixed emissive — no alpha/emissive pulses (those re-sort
    // transparent stacks at the source and mouth every frame).
    matRef.current.opacity = 1;
    matRef.current.emissiveIntensity = 0.1;
    const pos = meshRef.current.geometry.attributes.position;
    const base = basePositionsRef.current;
    const scales = waveScaleRef.current;
    const count = pos.count;
    for (let i = 0; i < count; i += 1) {
      const bx = base[i * 3];
      const by = base[i * 3 + 1];
      const bz = base[i * 3 + 2];
      const amp = scales ? scales[i] : 1;
      // Gentle travelling ripples — amplitude stays tiny so framing stays stable.
      const wave =
        (Math.sin(bx * 0.55 + t * 2.2) * 0.016 + Math.sin(bz * 0.7 + t * 1.6) * 0.01) * amp;
      pos.setY(i, by + wave);
    }
    pos.needsUpdate = true;
  });

  return (
    <group>
      <mesh geometry={bedGeom} position={[0, 0.02, 0]} renderOrder={0}>
        <meshStandardMaterial
          color={sandColor}
          roughness={0.95}
          side={THREE.FrontSide}
          depthWrite
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>
      <mesh ref={meshRef} geometry={waterGeom} renderOrder={2}>
        <meshStandardMaterial
          ref={matRef}
          vertexColors
          transparent={false}
          opacity={1}
          roughness={0.2}
          metalness={0.16}
          emissive={theme.riverDeepColor ?? '#168fc7'}
          emissiveIntensity={0.1}
          side={THREE.FrontSide}
          depthWrite
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>
      {edges.map((pts, i) =>
        pts.length >= 2 ? (
          <Line
            key={`foam-${i}`}
            points={pts}
            color="#ffffff"
            lineWidth={0.9}
            transparent
            opacity={0.2}
            depthWrite={false}
            renderOrder={3}
          />
        ) : null
      )}
    </group>
  );
}

/** Glowing motes riding the current downstream — makes flow direction legible. */
function CurrentMotes({ samples, normals, theme }) {
  const groupRef = useRef(null);
  const { getTime, animated } = useMetaphorClock();
  const lanes = useMemo(() => {
    // Stay well inside the trimmed channel so motes never graze spring/lagoon.
    const lo = Math.floor(samples.length * 0.12);
    const hi = Math.max(lo + 2, Math.ceil(samples.length * 0.88));
    const slice = samples.slice(lo, hi);
    const nSlice = normals.slice(lo, hi);
    const build = (lateral) =>
      slice.map((s, i) => [
        s.x + nSlice[i][0] * s.width * lateral,
        0.2,
        s.z + nSlice[i][1] * s.width * lateral
      ]);
    return [build(-0.38), build(0), build(0.38)];
  }, [samples, normals]);
  const motes = useMemo(
    () =>
      Array.from({ length: 11 }, (_, i) => ({
        lane: i % 3,
        phase: idHash2('river-mote', `p${i}`),
        speed: 0.045 + idHash2('river-mote', `s${i}`) * 0.028,
        radius: 0.07 + idHash2('river-mote', `r${i}`) * 0.05
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
      if (!lane?.length) return;
      // Interpolate between samples for smoother travel (no discrete jumps).
      const f = progress * (lane.length - 1);
      const idx = Math.min(lane.length - 2, Math.floor(f));
      const frac = f - idx;
      const a = lane[idx];
      const b = lane[idx + 1] ?? a;
      child.position.set(
        a[0] + (b[0] - a[0]) * frac,
        a[1] + (b[1] - a[1]) * frac,
        a[2] + (b[2] - a[2]) * frac
      );
      // Wide fade at both ends so wrap-around teleport is invisible.
      const edge = Math.min(progress, 1 - progress);
      const fade = THREE.MathUtils.smoothstep(edge, 0, 0.15);
      if (child.material) child.material.opacity = 0.78 * fade;
    });
  });
  const moteColor = theme.binaryGlowColor ?? '#e0f2fe';
  return (
    <group ref={groupRef} renderOrder={4}>
      {motes.map((m, i) => (
        <mesh key={`mote-${i}`}>
          <sphereGeometry args={[m.radius, 8, 8]} />
          {/* Start invisible — useFrame fades motes in along their lane, so
              they never flash as a clump at the origin on the first frame. */}
          <meshBasicMaterial
            color={moteColor}
            toneMapped={false}
            transparent
            opacity={0}
            depthWrite={false}
            depthTest
          />
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
  const flow =
    typeof item.flow === 'number' && Number.isFinite(item.flow)
      ? Math.round(item.flow * 10) / 10
      : null;
  const hazard = typeof item.hazard === 'number' ? item.hazard : 0;
  return (
    <group>
      {planks.map((p, i) => (
        <mesh key={`plank-${i}`} position={[p.x, 0.16, p.z]} rotation={[0, toWater.angle, 0]}>
          <boxGeometry args={[0.72, 0.07, 0.42]} />
          <meshStandardMaterial color={plankColor} roughness={0.9} />
        </mesh>
      ))}
      {/* Pilings under the dock for a more solid riverside read. */}
      {planks.map((p, i) => (
        <mesh key={`pile-${i}`} position={[p.x, 0.05, p.z]}>
          <cylinderGeometry args={[0.05, 0.06, 0.28, 6]} />
          <meshStandardMaterial
            color={shiftColor(woodColor, { lightness: -0.12 })}
            roughness={0.95}
          />
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
            color={hazard > 0.4 ? '#f97316' : (theme.slabTrimColor ?? '#fbbf24')}
            emissive={hazard > 0.4 ? '#f97316' : (theme.slabTrimColor ?? '#fbbf24')}
            emissiveIntensity={hazard > 0.4 ? 0.85 : 0.5}
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
        {flow != null ? (
          <Billboard position={[0.85, 1.35, 0]}>
            <mesh>
              <planeGeometry args={[1.05, 0.38]} />
              <meshBasicMaterial
                color={theme.labelOutline ?? '#f8fafc'}
                transparent
                opacity={0.88}
                depthWrite={false}
              />
            </mesh>
            <ItemLabel
              text={`▽ ${flow}`}
              position={[0, 0, 0.02]}
              fontSize={0.28}
              color={theme.labelColor}
              outlineColor={theme.labelOutline}
            />
          </Billboard>
        ) : null}
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
  const head = samples[0];
  const mouth = samples.length > 0 ? samples[samples.length - 1] : null;
  const next = samples[Math.min(3, Math.max(0, samples.length - 1))];
  const headDx = head && next ? next.x - head.x : 0;
  const headDz = head && next ? next.z - head.z : 0;
  const headLen = Math.hypot(headDx, headDz) || 1;
  // Nudge the spring slightly upstream of the first sample.
  const springX = head ? head.x - (headDx / headLen) * 1.1 : 0;
  const springZ = head ? head.z - (headDz / headLen) * 1.1 : 0;
  const mist = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => ({
        x: springX + (idHash2('mist', `x${i}`) - 0.5) * 0.9,
        z: springZ + (idHash2('mist', `z${i}`) - 0.5) * 0.9,
        y: 0.35 + idHash2('mist', `y${i}`) * 0.55,
        r: 0.12 + idHash2('mist', `r${i}`) * 0.1
      })),
    [springX, springZ]
  );
  if (samples.length < 2 || !head || !mouth) return null;
  const stones = [0, 1, 2, 3, 4, 5].map((i) => ({
    x: springX + (idHash2('spring', `x${i}`) - 0.5) * 1.5,
    z: springZ + (idHash2('spring', `z${i}`) - 0.5) * 1.5,
    r: 0.16 + idHash2('spring', `r${i}`) * 0.22,
    y: 0.08 + idHash2('spring', `y${i}`) * 0.06
  }));
  const lagoonR = Math.min(4.4, Math.max(2.6, mouth.width * 1.45));
  return (
    <group>
      {stones.map((s, i) => (
        <mesh key={`spring-${i}`} position={[s.x, s.y, s.z]} scale={[1, 0.72, 1]} renderOrder={1}>
          <icosahedronGeometry args={[s.r, 0]} />
          <meshStandardMaterial color={stoneColor} flatShading roughness={0.95} depthWrite />
        </mesh>
      ))}
      {/* Opaque spring pool — no transparent glow disc (those z-fought the channel). */}
      <mesh position={[springX, 0.06, springZ]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
        <circleGeometry args={[Math.max(0.85, head.width * 0.55), 28]} />
        <meshStandardMaterial
          color={shiftColor(theme.waterColor ?? '#38bdf8', { lightness: 0.12 })}
          roughness={0.35}
          metalness={0.12}
          emissive={theme.riverDeepColor ?? '#168fc7'}
          emissiveIntensity={0.18}
          depthWrite
        />
      </mesh>
      {mist.map((m, i) => (
        <mesh key={`mist-${i}`} position={[m.x, m.y, m.z]}>
          <sphereGeometry args={[m.r, 8, 8]} />
          {/* Additive blending is commutative, so overlapping mist never flips
              draw order — that re-sort was the visible source-end flicker. */}
          <meshBasicMaterial
            color="#f0f9ff"
            transparent
            opacity={0.22}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      ))}
      {/* Opaque lagoon basin below the channel tip — no alpha sorting against water. */}
      <mesh position={[mouth.x, 0.02, mouth.z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
        <circleGeometry args={[lagoonR, 48]} />
        <meshStandardMaterial
          color={theme.waterColor ?? '#38bdf8'}
          roughness={0.32}
          metalness={0.18}
          emissive={theme.riverDeepColor ?? '#168fc7'}
          emissiveIntensity={0.14}
          depthWrite
        />
      </mesh>
      <mesh position={[mouth.x, 0.045, mouth.z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
        <ringGeometry args={[lagoonR * 0.62, lagoonR * 0.98, 48]} />
        <meshStandardMaterial
          color={shiftColor(theme.waterColor ?? '#38bdf8', { lightness: 0.18 })}
          roughness={0.4}
          metalness={0.1}
          depthWrite
        />
      </mesh>
      {[0.72, 0.88].map((scale, i) => (
        <mesh
          key={`lagoon-ring-${i}`}
          position={[mouth.x, 0.055 + i * 0.008, mouth.z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          {/* Additive shimmer — order-independent, so the mouth rings stop
              flickering against each other and the water. */}
          <ringGeometry args={[lagoonR * scale, lagoonR * (scale + 0.045), 48]} />
          <meshBasicMaterial
            color="#e0f2fe"
            transparent
            opacity={0.14 - i * 0.04}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
      ))}
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
    // Out of the camera fit — the course and its stations are the subject, the
    // meadow is the land it runs through. See the note in sceneFraming.js.
    <group userData={FRAME_IGNORE_DATA}>
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

  // Fewer than 2 samples (early streaming) — show the empty meadow instead of
  // unmounting the whole scene, so the canvas doesn't flash blank each time a
  // partial DSL drops below renderable size.
  if (layout.samples.length < 2) {
    return (
      <group>
        <RiverMeadow theme={theme} radiusX={8} radiusZ={8} />
        <MetaphorGroundShadow theme={theme} y={-0.02} scale={16} />
      </group>
    );
  }

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
        hazeColor={theme.skyHorizonColor ?? theme.background ?? null}
        idSeed="river-birds"
      />
      <MetaphorGroundShadow theme={theme} y={-0.02} scale={meadowX * 1.7} />
      <MetaphorAccents items={dsl.items} anchors={anchors} theme={theme} />
      <MetaphorLinks links={dsl.links} anchors={anchors} theme={theme} variant="arc" />
    </group>
  );
}

/** Clear daylight sky over the river, with a warm sun halo. */
export function RiverSky({ theme }) {
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
