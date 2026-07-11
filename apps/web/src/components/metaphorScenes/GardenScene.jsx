/**
 * Garden metaphor scene — portfolios, roadmaps, and capabilities as living
 * plants. Maturity drives stem height/bloom stage, impact drives bloom scale,
 * health drives posture/colour, and named beds preserve domain groupings.
 */
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard, Line } from '@react-three/drei';
import { gardenBedLayout } from '../../utils/metaphorLayouts/gardenBedLayout.js';
import { Glyph } from '../metaphorGlyphs/index.jsx';
import {
  GradientSkySphere,
  HoverableItem,
  ItemLabel,
  MetaphorGroundShadow,
  MetaphorLinks
} from './MetaphorSceneChrome.jsx';
import {
  DaylightPollen,
  SkySunGlow,
  SoaringBirds,
  SwayGroup
} from './MetaphorSceneDecorations.jsx';
import { useMetaphorClock } from './metaphorClock.js';
import { idHash2, shiftColor } from './sceneUtils.js';

const HEALTH_POSTURE = {
  thriving: { bend: 0, saturation: 1.08 },
  steady: { bend: 0.06, saturation: 0.92 },
  'at-risk': { bend: 0.32, saturation: 0.58 }
};

function bedColor(theme, index) {
  const palette = theme.districtPalette ?? theme.clusterPalette ?? ['#8bcf74'];
  return palette[index % palette.length];
}

function GardenBed({ bed, theme, index }) {
  const soil = theme.gardenSoilColor ?? '#795438';
  const edging = shiftColor(bedColor(theme, index), { lightness: 0.12, satScale: 0.75 });
  return (
    <group position={[bed.center[0], 0, bed.center[2]]}>
      <mesh position={[0, -0.02, 0]}>
        <boxGeometry args={[bed.size[0] + 0.45, 0.18, bed.size[1] + 0.45]} />
        <meshStandardMaterial color={edging} roughness={0.88} />
      </mesh>
      <mesh position={[0, 0.08, 0]}>
        <boxGeometry args={[bed.size[0], 0.16, bed.size[1]]} />
        <meshStandardMaterial color={soil} roughness={1} />
      </mesh>
      <ItemLabel
        text={bed.name}
        position={[0, 0.36, -bed.size[1] / 2 - 0.42]}
        fontSize={0.46}
        color={theme.labelColor}
        outlineColor={theme.labelOutline}
      />
    </group>
  );
}

function Leaf({ position, rotation, scale, color }) {
  return (
    <mesh position={position} rotation={rotation} scale={scale}>
      <sphereGeometry args={[0.34, 10, 8]} />
      <meshStandardMaterial color={color} roughness={0.78} />
    </mesh>
  );
}

function FlowerHead({ radius, color, maturity, health, idSeed }) {
  const petalCount = 7 + Math.round(idHash2(idSeed, 'petals') * 3);
  const open = THREE.MathUtils.smoothstep(maturity, 0.28, 0.72);
  const petalLength = radius * (0.62 + open * 0.38);
  const petalColor = health === 'at-risk' ? shiftColor(color, { satScale: 0.55 }) : color;
  const centerColor = health === 'at-risk' ? '#a16207' : '#facc15';
  return (
    <group rotation={[health === 'at-risk' ? 0.45 : 0, 0, 0]} scale={0.55 + open * 0.45}>
      {Array.from({ length: petalCount }, (_, i) => {
        const angle = (i / petalCount) * Math.PI * 2;
        return (
          <mesh
            key={`petal-${i}`}
            position={[Math.cos(angle) * radius * 0.58, 0, Math.sin(angle) * radius * 0.58]}
            rotation={[0, -angle, Math.PI / 2]}
            scale={[petalLength, radius * 0.34, radius * 0.18]}
          >
            <sphereGeometry args={[0.52, 12, 8]} />
            <meshStandardMaterial color={petalColor} roughness={0.52} />
          </mesh>
        );
      })}
      <mesh position={[0, 0.05, 0]}>
        <sphereGeometry args={[radius * 0.42, 16, 12]} />
        <meshStandardMaterial
          color={centerColor}
          emissive={centerColor}
          emissiveIntensity={0.12}
          roughness={0.72}
        />
      </mesh>
    </group>
  );
}

function GardenPlant({ item, position, theme, bloomColor }) {
  const maturity = THREE.MathUtils.clamp(item.maturity ?? 0.5, 0, 1);
  const impact = THREE.MathUtils.clamp(item.impact ?? 3, 0.1, 10);
  const health = item.health ?? 'steady';
  const posture = HEALTH_POSTURE[health] ?? HEALTH_POSTURE.steady;
  const stemHeight = 0.65 + maturity * 4.2;
  const bloomRadius = 0.36 + Math.sqrt(impact) * 0.18;
  const stemColor =
    health === 'thriving'
      ? theme.gardenThrivingColor
      : health === 'at-risk'
        ? theme.gardenRiskColor
        : theme.gardenSteadyColor;
  const leafColor = shiftColor(stemColor ?? '#65a30d', {
    lightness: 0.05,
    satScale: posture.saturation
  });
  const bend = posture.bend * (idHash2(item.id, 'bend') > 0.5 ? 1 : -1);
  const top = [Math.sin(bend) * stemHeight * 0.25, stemHeight, 0];
  const stem = useMemo(() => {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(top[0] * 0.35, stemHeight * 0.55, 0),
      new THREE.Vector3(...top)
    );
    return new THREE.TubeGeometry(curve, 12, 0.07 + Math.sqrt(impact) * 0.025, 7, false);
  }, [impact, stemHeight, top]);

  return (
    <group position={position}>
      <SwayGroup
        seed={idHash2(item.id, 'sway')}
        amplitude={health === 'at-risk' ? 0.012 : 0.022}
        speed={0.35}
      >
        <mesh geometry={stem}>
          <meshStandardMaterial color={stemColor ?? '#65a30d'} roughness={0.78} />
        </mesh>
        <Leaf
          position={[top[0] * 0.2 + 0.28, stemHeight * 0.42, 0]}
          rotation={[0, 0, -0.55]}
          scale={[0.95, 0.24, 0.52]}
          color={leafColor}
        />
        <Leaf
          position={[top[0] * 0.45 - 0.3, stemHeight * 0.66, 0.04]}
          rotation={[0, Math.PI, 0.55]}
          scale={[0.82, 0.22, 0.46]}
          color={leafColor}
        />
        {maturity < 0.24 ? (
          <mesh position={top}>
            <sphereGeometry args={[bloomRadius * 0.38, 12, 10]} />
            <meshStandardMaterial color={leafColor} roughness={0.72} />
          </mesh>
        ) : (
          <group position={top}>
            <FlowerHead
              radius={bloomRadius}
              color={bloomColor}
              maturity={maturity}
              health={health}
              idSeed={item.id}
            />
          </group>
        )}
        {item.glyph ? (
          <Billboard position={[top[0], stemHeight + bloomRadius + 0.78, 0]}>
            <group scale={0.82}>
              <Glyph kind={item.glyph} theme={theme} />
            </group>
          </Billboard>
        ) : null}
      </SwayGroup>
      <ItemLabel
        text={item.label}
        position={[top[0], stemHeight + bloomRadius + (item.glyph ? 1.65 : 0.7), 0]}
        fontSize={0.5 + Math.min(0.2, impact * 0.02)}
        color={theme.labelColor}
        outlineColor={theme.labelOutline}
      />
    </group>
  );
}

function GardenPaths({ beds, theme }) {
  if (beds.length < 2) return null;
  const pathColor = theme.gardenPathColor ?? '#e9d6aa';
  const hub = [0, 0.205, 0];
  return (
    <group>
      {beds.map((bed) => (
        <Line
          key={`path-${bed.name}`}
          points={[hub, [bed.center[0], 0.205, bed.center[2]]]}
          color={pathColor}
          lineWidth={5}
          transparent
          opacity={0.8}
        />
      ))}
      <mesh position={hub} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.8, 32]} />
        <meshStandardMaterial color={pathColor} roughness={0.92} />
      </mesh>
    </group>
  );
}

function GardenButterflies({ radius, palette }) {
  const groupRef = useRef(null);
  const { getTime, animated } = useMetaphorClock();
  const butterflies = useMemo(
    () =>
      Array.from({ length: 5 }, (_, i) => ({
        phase: idHash2('garden-butterfly', `p${i}`) * Math.PI * 2,
        radius: radius * (0.25 + idHash2('garden-butterfly', `r${i}`) * 0.55),
        speed: 0.18 + idHash2('garden-butterfly', `s${i}`) * 0.15,
        height: 1.2 + idHash2('garden-butterfly', `h${i}`) * 2.4,
        color: palette[i % palette.length]
      })),
    [palette, radius]
  );
  useFrame(() => {
    if (!animated || !groupRef.current) return;
    const t = getTime();
    groupRef.current.children.forEach((child, i) => {
      const b = butterflies[i];
      if (!b) return;
      const angle = b.phase + t * b.speed;
      child.position.set(
        Math.cos(angle) * b.radius,
        b.height + Math.sin(t * 1.8 + b.phase) * 0.35,
        Math.sin(angle * 1.3) * b.radius * 0.7
      );
      child.rotation.y = -angle;
      const flap = 0.25 + Math.abs(Math.sin(t * 7 + b.phase)) * 0.65;
      child.children[0].rotation.y = flap;
      child.children[1].rotation.y = -flap;
    });
  });
  return (
    <group ref={groupRef}>
      {butterflies.map((b, i) => (
        <group key={`butterfly-${i}`} position={[b.radius, b.height, 0]} scale={0.55}>
          <mesh position={[-0.1, 0, 0]}>
            <circleGeometry args={[0.18, 10]} />
            <meshStandardMaterial color={b.color} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0.1, 0, 0]}>
            <circleGeometry args={[0.18, 10]} />
            <meshStandardMaterial color={b.color} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function GardenScene({ dsl, theme }) {
  const layout = useMemo(() => gardenBedLayout(dsl.items), [dsl.items]);
  const itemById = useMemo(() => new Map(dsl.items.map((item) => [item.id, item])), [dsl.items]);
  const palette = theme.gardenBloomPalette ?? ['#f472b6', '#fbbf24', '#a78bfa', '#fb7185'];
  const radius = Math.max(7, (layout.bounds.radius ?? 0) + 4.5);
  const anchors = useMemo(() => {
    const map = new Map();
    for (const [id, position] of layout.positions) {
      const item = itemById.get(id);
      const height = 0.65 + (item?.maturity ?? 0.5) * 4.2;
      map.set(id, [position[0], height, position[2]]);
    }
    return map;
  }, [itemById, layout.positions]);

  return (
    <group>
      <mesh position={[0, -0.15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[radius, 96]} />
        <meshStandardMaterial color={theme.treeMeadowColor ?? '#71c96b'} roughness={0.92} />
      </mesh>
      <GardenPaths beds={layout.beds} theme={theme} />
      {layout.beds.map((bed, index) => (
        <GardenBed key={bed.name} bed={bed} theme={theme} index={index} />
      ))}
      {dsl.items.map((item, index) => {
        const position = layout.positions.get(item.id);
        if (!position) return null;
        return (
          <HoverableItem key={item.id} item={item} metaphor="garden">
            <GardenPlant
              item={item}
              position={[position[0], 0.18, position[2]]}
              theme={theme}
              bloomColor={palette[index % palette.length]}
            />
          </HoverableItem>
        );
      })}
      <GardenButterflies radius={radius} palette={palette} />
      <DaylightPollen radius={radius} count={24} idSeed="garden-pollen" />
      <SoaringBirds radius={radius} height={7} count={3} color="#294936" idSeed="garden-birds" />
      <MetaphorGroundShadow theme={theme} y={-0.13} scale={radius * 2.15} />
      <MetaphorLinks links={dsl.links} anchors={anchors} theme={theme} variant="arc" />
    </group>
  );
}

export function GardenSky({ theme }) {
  return (
    <group>
      <GradientSkySphere
        topColor={theme.skyTopColor ?? '#58b8f5'}
        horizonColor={theme.skyHorizonColor ?? '#f5fbdf'}
      />
      <SkySunGlow color="#fff0ad" />
    </group>
  );
}
