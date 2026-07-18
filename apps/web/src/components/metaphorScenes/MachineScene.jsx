/**
 * Machine metaphor scene — tightly-coupled systems as interlocking gears on a
 * shared brass plate. `size` drives gear radius, `speed` drives spin rate,
 * `axle` clusters subsystems, optional `torque` heats a gear under strain, and
 * `mesh` pulls coupled gears into visible contact (counter-rotating).
 */
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import { machineGearLayout } from '../../utils/metaphorLayouts/machineGearLayout.js';
import { Glyph } from '../metaphorGlyphs/index.jsx';
import {
  GradientSkySphere,
  HoverableItem,
  ItemLabel,
  MetaphorGroundShadow,
  MetaphorLinks
} from './MetaphorSceneChrome.jsx';
import { useMetaphorClock } from './metaphorClock.js';
import { idHash2, shiftColor } from './sceneUtils.js';

function axleTint(theme, index) {
  const palette = theme.machineAxlePalette ??
    theme.districtPalette ?? ['#c4a574', '#9a7b4f', '#d4b896', '#8b6914'];
  return palette[index % palette.length];
}

function MachinePlate({ radius, theme }) {
  const plate = theme.machinePlateColor ?? '#3d4454';
  const rim = theme.machineRimColor ?? '#8b7355';
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.12, 0]}>
        <circleGeometry args={[radius * 1.08, 72]} />
        <meshStandardMaterial color={shiftColor(plate, { lightness: -0.08 })} roughness={0.92} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
        <circleGeometry args={[radius, 72]} />
        <meshStandardMaterial color={plate} roughness={0.78} metalness={0.35} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]}>
        <ringGeometry args={[radius * 0.94, radius * 0.995, 72]} />
        <meshStandardMaterial color={rim} roughness={0.55} metalness={0.55} />
      </mesh>
      {/* Rivets around the plate rim. */}
      {Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2;
        return (
          <mesh
            key={`rivet-${i}`}
            position={[Math.cos(a) * radius * 0.97, 0.02, Math.sin(a) * radius * 0.97]}
          >
            <sphereGeometry args={[0.08, 8, 8]} />
            <meshStandardMaterial color={rim} metalness={0.7} roughness={0.35} />
          </mesh>
        );
      })}
    </group>
  );
}

function AxleBed({ axle, theme, index }) {
  const tint = axleTint(theme, index);
  return (
    <group position={[axle.center[0], 0, axle.center[2]]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <circleGeometry args={[axle.radius * 0.92, 48]} />
        <meshStandardMaterial
          color={shiftColor(tint, { lightness: -0.18, satScale: 0.55 })}
          roughness={0.85}
          metalness={0.25}
          transparent
          opacity={0.55}
          depthWrite={false}
        />
      </mesh>
      <ItemLabel
        text={axle.name}
        position={[0, 0.22, -axle.radius * 0.78]}
        fontSize={0.42}
        color={theme.labelColor}
        outlineColor={theme.labelOutline}
      />
    </group>
  );
}

/** Procedural gear: hub + rim + teeth. Spins at speed-proportional rate. */
function GearBody({ gear, item, theme, color }) {
  const groupRef = useRef(null);
  const { getTime, animated } = useMetaphorClock();
  const teeth = Math.max(8, Math.min(18, Math.round(6 + gear.radius * 4)));
  const toothDepth = gear.radius * 0.16;
  const hubR = gear.radius * 0.28;
  const brass = color;
  const steel = shiftColor(brass, { lightness: 0.12, satScale: 0.7 });
  const hot = gear.torque > 0.35;
  const emissive = hot ? '#f97316' : brass;
  const emissiveIntensity = hot ? 0.25 + gear.torque * 0.7 : 0.05;

  const toothMeshes = useMemo(() => {
    return Array.from({ length: teeth }, (_, i) => {
      const angle = (i / teeth) * Math.PI * 2;
      return {
        x: Math.cos(angle) * (gear.radius - toothDepth * 0.15),
        z: Math.sin(angle) * (gear.radius - toothDepth * 0.15),
        rot: -angle
      };
    });
  }, [teeth, gear.radius, toothDepth]);

  useFrame(() => {
    if (!groupRef.current) return;
    const t = animated ? getTime() : 0;
    const rpm = 0.35 + gear.speed * 0.55;
    groupRef.current.rotation.y = t * rpm * gear.spinSign;
  });

  return (
    <group position={gear.position}>
      <group ref={groupRef}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
          <cylinderGeometry args={[gear.radius * 0.88, gear.radius * 0.88, 0.22, 32]} />
          <meshStandardMaterial
            color={brass}
            roughness={0.4}
            metalness={0.72}
            emissive={emissive}
            emissiveIntensity={emissiveIntensity}
          />
        </mesh>
        {toothMeshes.map((tooth, i) => (
          <mesh
            key={`tooth-${i}`}
            position={[tooth.x, 0.08, tooth.z]}
            rotation={[0, tooth.rot, 0]}
          >
            <boxGeometry args={[toothDepth * 1.1, 0.2, gear.radius * 0.22]} />
            <meshStandardMaterial color={steel} roughness={0.45} metalness={0.65} />
          </mesh>
        ))}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.2, 0]}>
          <cylinderGeometry args={[hubR, hubR * 1.1, 0.28, 16]} />
          <meshStandardMaterial color={steel} roughness={0.35} metalness={0.8} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.36, 0]}>
          <cylinderGeometry args={[hubR * 0.35, hubR * 0.35, 0.18, 10]} />
          <meshStandardMaterial
            color={theme.machineRimColor ?? '#a78b5a'}
            roughness={0.3}
            metalness={0.85}
          />
        </mesh>
      </group>
      {hot ? (
        <mesh position={[0, 0.55, 0]}>
          <sphereGeometry args={[0.12 + gear.torque * 0.1, 10, 10]} />
          <meshBasicMaterial color="#fb923c" transparent opacity={0.45} depthWrite={false} />
        </mesh>
      ) : null}
      {item.glyph ? (
        <Billboard position={[0, gear.radius * 0.55 + 1.15, 0]}>
          <group scale={0.85}>
            <Glyph kind={item.glyph} theme={theme} />
          </group>
        </Billboard>
      ) : null}
      <ItemLabel
        text={item.label}
        position={[0, gear.radius * 0.55 + (item.glyph ? 1.85 : 1.15), 0]}
        fontSize={Math.max(0.38, Math.min(0.7, gear.radius * 0.55))}
        color={theme.labelColor}
        outlineColor={theme.labelOutline}
      />
    </group>
  );
}

function MeshCoupling({ from, to, theme }) {
  if (!from || !to) return null;
  const mid = [
    (from.position[0] + to.position[0]) / 2,
    0.55,
    (from.position[2] + to.position[2]) / 2
  ];
  return (
    <mesh position={mid}>
      <sphereGeometry args={[0.08, 8, 8]} />
      <meshBasicMaterial
        color={theme.slabTrimColor ?? '#fbbf24'}
        transparent
        opacity={0.55}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

function FloatingSparks({ radius, theme }) {
  const groupRef = useRef(null);
  const { getTime, animated } = useMetaphorClock();
  const sparks = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        x: (idHash2('spark', `x${i}`) - 0.5) * radius * 1.6,
        z: (idHash2('spark', `z${i}`) - 0.5) * radius * 1.6,
        y: 0.4 + idHash2('spark', `y${i}`) * 2.2,
        phase: idHash2('spark', `p${i}`) * Math.PI * 2,
        speed: 0.6 + idHash2('spark', `s${i}`) * 1.2
      })),
    [radius]
  );
  useFrame(() => {
    if (!animated || !groupRef.current) return;
    const t = getTime();
    groupRef.current.children.forEach((child, i) => {
      const s = sparks[i];
      if (!s) return;
      child.position.y = s.y + Math.sin(t * s.speed + s.phase) * 0.25;
      if (child.material) {
        child.material.opacity = 0.15 + 0.25 * Math.abs(Math.sin(t * s.speed * 1.4 + s.phase));
      }
    });
  });
  const color = theme.machineSparkColor ?? '#fbbf24';
  return (
    <group ref={groupRef}>
      {sparks.map((s, i) => (
        <mesh key={`spark-${i}`} position={[s.x, s.y, s.z]}>
          <sphereGeometry args={[0.045, 6, 6]} />
          <meshBasicMaterial color={color} transparent opacity={0.3} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

export function MachineScene({ dsl, theme }) {
  const layout = useMemo(() => machineGearLayout(dsl.items), [dsl.items]);
  const itemById = useMemo(() => new Map(dsl.items.map((item) => [item.id, item])), [dsl.items]);
  const gearById = useMemo(() => new Map(layout.gears.map((g) => [g.id, g])), [layout.gears]);

  const anchors = useMemo(() => {
    const map = new Map();
    for (const gear of layout.gears) {
      map.set(gear.id, [gear.position[0], gear.radius + 1.2, gear.position[2]]);
    }
    return map;
  }, [layout.gears]);

  const plateR = Math.max(7, layout.bounds.radius * 0.95);

  return (
    <group>
      <MachinePlate radius={plateR} theme={theme} />
      {layout.axles.map((axle, idx) => (
        <AxleBed key={axle.name} axle={axle} theme={theme} index={idx} />
      ))}
      {layout.gears.map((gear) => {
        const item = itemById.get(gear.id);
        if (!item) return null;
        const color = shiftColor(axleTint(theme, gear.axleIndex), {
          lightness: (idHash2(gear.id, 'tint') - 0.5) * 0.1,
          satScale: 0.9
        });
        return (
          <HoverableItem key={gear.id} item={item} metaphor="machine">
            <GearBody gear={gear} item={item} theme={theme} color={color} />
          </HoverableItem>
        );
      })}
      {layout.gears.map((gear) =>
        gear.mesh ? (
          <MeshCoupling
            key={`mesh-${gear.id}`}
            from={gear}
            to={gearById.get(gear.mesh)}
            theme={theme}
          />
        ) : null
      )}
      <FloatingSparks radius={plateR * 0.7} theme={theme} />
      <MetaphorGroundShadow theme={theme} y={-0.14} scale={plateR * 2.1} />
      <MetaphorLinks links={dsl.links} anchors={anchors} theme={theme} variant="arc" />
    </group>
  );
}

export function MachineSky({ theme }) {
  return (
    <GradientSkySphere
      topColor={theme.skyTopColor ?? '#1a2233'}
      horizonColor={theme.skyHorizonColor ?? '#3d4454'}
    />
  );
}
