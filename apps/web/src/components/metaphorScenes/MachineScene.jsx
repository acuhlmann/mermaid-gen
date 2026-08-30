/**
 * Machine metaphor scene — tightly-coupled systems as interlocking gears on a
 * shared brass plate. `size` drives gear radius, `speed` drives spin rate,
 * `axle` clusters subsystems, optional `torque` heats a gear under strain, and
 * `mesh` pulls coupled gears into visible contact (counter-rotating) with a
 * glowing coupling housing at the contact point. Each gear spins on a static
 * axle shaft capped by a bearing, each axle group sits on a raised plinth, and
 * the plate stands on a factory floor with etched seams, rim pipes, and steam
 * vents — so the scene reads as a running machine, not loose cogs in a void.
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
import { MetaphorAccents } from './MetaphorAccents.jsx';
import { useMetaphorClock } from './metaphorClock.js';
import { idHash2, shiftColor } from './sceneUtils.js';
import { FRAME_IGNORE_DATA } from './sceneFraming.js';

function axleTint(theme, index) {
  const palette = theme.machineAxlePalette ??
    theme.districtPalette ?? ['#c4a574', '#9a7b4f', '#d4b896', '#8b6914'];
  return palette[index % palette.length];
}

/**
 * Bedplate the gearing is bolted to. Out of the camera fit — the gears are the
 * subject, the plate is the bench. See the substrate note in sceneFraming.js.
 */
function MachinePlate({ radius, theme }) {
  const plate = theme.machinePlateColor ?? '#3d4454';
  const rim = theme.machineRimColor ?? '#8b7355';
  return (
    <group userData={FRAME_IGNORE_DATA}>
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
  const plinth = shiftColor(tint, { lightness: -0.14, satScale: 0.6 });
  const plinthTop = shiftColor(tint, { lightness: -0.05, satScale: 0.7 });
  return (
    <group position={[axle.center[0], 0, axle.center[2]]}>
      {/* Raised plinth under each axle group — subsystems read as mounted
          machinery, not a translucent sticker on the plate. */}
      <mesh position={[0, -0.02, 0]}>
        <cylinderGeometry args={[axle.radius * 0.98, axle.radius * 1.04, 0.1, 48]} />
        <meshStandardMaterial color={plinth} roughness={0.75} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.032, 0]}>
        <cylinderGeometry args={[axle.radius * 0.92, axle.radius * 0.95, 0.012, 48]} />
        <meshStandardMaterial color={plinthTop} roughness={0.6} metalness={0.45} />
      </mesh>
      <mesh position={[0, 0.045, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[axle.radius * 0.93, 0.022, 8, 48]} />
        <meshStandardMaterial
          color={theme.machineRimColor ?? '#a78b5a'}
          roughness={0.4}
          metalness={0.7}
        />
      </mesh>
      {/* On the bed's NEAR edge (+z) and OUTSIDE its outermost gear, from the
          layout. The old `-axle.radius * 0.78` was both the far edge and inside
          the bed, so every subsystem's name was written across its own gears —
          the same bug the city districts and garden beds were fixed for, and
          with three pinned placards holding the middle of the plate it was also
          why the gears' own names lost the declutter pass. `placard` is in the
          scene group's space, so it is applied outside this bed's group. */}
      <ItemLabel
        text={axle.name}
        role="group"
        position={[0, axle.placard[1], axle.placard[2] - axle.center[2]]}
        fontSize={0.42}
        color={theme.labelColor}
        outlineColor={theme.labelOutline}
        pinned
      />
    </group>
  );
}

/** Procedural gear: hub + rim + teeth. Spins at speed-proportional rate on a
 *  static axle shaft; a per-gear phase keeps frozen scenes (streaming, reduced
 *  motion) from snapping every gear to the same rotation. */
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
  const phase = useMemo(() => idHash2(gear.id, 'phase') * Math.PI * 2, [gear.id]);

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
    groupRef.current.rotation.y = phase + t * rpm * gear.spinSign;
  });

  return (
    <group position={gear.position}>
      <group ref={groupRef} rotation={[0, phase, 0]}>
        <mesh position={[0, 0.08, 0]}>
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
          <mesh key={`tooth-${i}`} position={[tooth.x, 0.08, tooth.z]} rotation={[0, tooth.rot, 0]}>
            <boxGeometry args={[toothDepth * 1.6, 0.22, gear.radius * 0.26]} />
            <meshStandardMaterial color={steel} roughness={0.45} metalness={0.65} />
          </mesh>
        ))}
        <mesh position={[0, 0.2, 0]}>
          <cylinderGeometry args={[hubR, hubR * 1.1, 0.28, 16]} />
          <meshStandardMaterial color={steel} roughness={0.35} metalness={0.8} />
        </mesh>
        <mesh position={[0, 0.36, 0]}>
          <cylinderGeometry args={[hubR * 0.35, hubR * 0.35, 0.18, 10]} />
          <meshStandardMaterial
            color={theme.machineRimColor ?? '#a78b5a'}
            roughness={0.3}
            metalness={0.85}
          />
        </mesh>
      </group>
      {/* Static axle shaft + bearing cap — the gear visibly spins ON a shaft,
          which is what the `axle` grouping vocabulary means. */}
      <mesh position={[0, 0.24, 0]}>
        <cylinderGeometry args={[hubR * 0.28, hubR * 0.34, 0.62, 10]} />
        <meshStandardMaterial
          color={shiftColor(steel, { lightness: -0.16, satScale: 0.6 })}
          roughness={0.3}
          metalness={0.85}
        />
      </mesh>
      <mesh position={[0, 0.6, 0]} scale={[1, 0.55, 1]}>
        <sphereGeometry args={[hubR * 0.5, 12, 10]} />
        <meshStandardMaterial
          color={theme.machineRimColor ?? '#a78b5a'}
          roughness={0.3}
          metalness={0.85}
        />
      </mesh>
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
        importance={gear.radius}
      />
    </group>
  );
}

/**
 * Coupling housing where two meshed gears touch: a bearing cylinder along the
 * pair axis with collar rings and a glow pulse sliding through it — the direct
 * sync coupling reads as a live mechanical joint, not a floating dot.
 */
function MeshCoupling({ from, to, theme }) {
  const pulseRef = useRef(null);
  const { getTime, animated } = useMetaphorClock();
  const dx = (to?.position?.[0] ?? 0) - (from?.position?.[0] ?? 0);
  const dz = (to?.position?.[2] ?? 0) - (from?.position?.[2] ?? 0);
  const angle = Math.atan2(dx, dz);

  useFrame(() => {
    if (!animated || !pulseRef.current) return;
    const t = getTime();
    const progress = (t * 0.6) % 1;
    pulseRef.current.position.z = -0.3 + progress * 0.6;
    if (pulseRef.current.material) {
      const edge = Math.min(progress, 1 - progress);
      pulseRef.current.material.opacity = 0.85 * THREE.MathUtils.smoothstep(edge, 0, 0.2);
    }
  });

  if (!from || !to) return null;
  const mid = [
    (from.position[0] + to.position[0]) / 2,
    0.19,
    (from.position[2] + to.position[2]) / 2
  ];
  const housing = shiftColor(theme.machinePlateColor ?? '#3d4454', { lightness: 0.1 });
  const glow = theme.machineSparkColor ?? '#fbbf24';
  return (
    <group position={mid} rotation={[0, angle, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.17, 0.17, 0.68, 14]} />
        <meshStandardMaterial color={housing} roughness={0.45} metalness={0.7} />
      </mesh>
      {[-0.3, 0.3].map((z) => (
        <mesh key={`collar-${z}`} position={[0, 0, z]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.18, 0.045, 8, 18]} />
          <meshStandardMaterial
            color={theme.machineRimColor ?? '#a78b5a'}
            roughness={0.35}
            metalness={0.8}
          />
        </mesh>
      ))}
      <mesh ref={pulseRef} position={[0, 0, 0]}>
        <sphereGeometry args={[0.075, 8, 8]} />
        <meshBasicMaterial
          color={glow}
          transparent
          opacity={0.85}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </group>
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
    <group ref={groupRef} userData={FRAME_IGNORE_DATA}>
      {sparks.map((s, i) => (
        <mesh key={`spark-${i}`} position={[s.x, s.y, s.z]}>
          <sphereGeometry args={[0.045, 6, 6]} />
          <meshBasicMaterial color={color} transparent opacity={0.3} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

/** Factory floor the plate stands on — dark disc with etched seams, so the
 *  machine reads as installed in a plant rather than floating in a void. */
function FactoryFloor({ radius, theme }) {
  const floor = shiftColor(theme.machinePlateColor ?? '#3d4454', {
    lightness: -0.12,
    satScale: 0.8
  });
  const seam = shiftColor(theme.machinePlateColor ?? '#3d4454', { lightness: 0.1, satScale: 0.6 });
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]}>
        <circleGeometry args={[radius * 1.18, 72]} />
        <meshStandardMaterial color={floor} roughness={0.95} metalness={0.15} />
      </mesh>
      {[0.72, 0.88].map((scale, i) => (
        <mesh
          key={`floor-ring-${i}`}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -0.19 + i * 0.004, 0]}
        >
          <ringGeometry args={[radius * 1.18 * scale - 0.05, radius * 1.18 * scale + 0.05, 72]} />
          <meshStandardMaterial color={seam} roughness={0.9} metalness={0.2} />
        </mesh>
      ))}
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        const len = radius * 1.14;
        return (
          <mesh
            key={`floor-seam-${i}`}
            position={[Math.cos(a) * len * 0.5, -0.19, Math.sin(a) * len * 0.5]}
            rotation={[0, -a + Math.PI / 2, 0]}
          >
            <boxGeometry args={[len, 0.008, 0.05]} />
            <meshStandardMaterial color={seam} roughness={0.9} metalness={0.2} />
          </mesh>
        );
      })}
    </group>
  );
}

/** Curved service pipes hugging the plate rim — industrial plumbing dressing. */
function RimPipes({ radius, theme }) {
  const pipe = shiftColor(theme.machineRimColor ?? '#a78b5a', { lightness: -0.06, satScale: 0.7 });
  const arcs = [
    { start: 0.35, arc: 1.1, y: 0.12 },
    { start: 2.2, arc: 0.85, y: 0.2 },
    { start: 4.1, arc: 1.25, y: 0.08 }
  ];
  return (
    <group>
      {arcs.map((p, i) => (
        <group key={`pipe-${i}`} rotation={[0, p.start, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, p.y, 0]}>
            <torusGeometry args={[radius * 0.99, 0.085, 8, 40, p.arc]} />
            <meshStandardMaterial color={pipe} roughness={0.5} metalness={0.65} />
          </mesh>
          {[0, p.arc].map((end) => (
            <mesh
              key={`pipe-joint-${i}-${end}`}
              position={[Math.sin(end) * radius * 0.99, p.y, Math.cos(end) * radius * 0.99]}
            >
              <sphereGeometry args={[0.13, 10, 10]} />
              <meshStandardMaterial
                color={theme.machineRimColor ?? '#a78b5a'}
                roughness={0.4}
                metalness={0.7}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/** Steam puffs rising from vents at the plate rim — the machine is running. */
function SteamVents({ radius, theme }) {
  const groupRef = useRef(null);
  const { getTime, animated } = useMetaphorClock();
  const vents = useMemo(
    () =>
      [0.9, 2.8, 4.9].map((angle, v) => ({
        x: Math.cos(angle) * radius * 0.9,
        z: Math.sin(angle) * radius * 0.9,
        puffs: Array.from({ length: 4 }, (_, p) => ({
          phase: idHash2('steam', `v${v}p${p}`),
          drift: (idHash2('steam', `v${v}d${p}`) - 0.5) * 0.5,
          size: 0.14 + idHash2('steam', `v${v}s${p}`) * 0.12
        }))
      })),
    [radius]
  );
  useFrame(() => {
    if (!animated || !groupRef.current) return;
    const t = getTime();
    let idx = 0;
    for (const vent of vents) {
      for (const puff of vent.puffs) {
        const child = groupRef.current.children[idx];
        idx += 1;
        if (!child) continue;
        const progress = (puff.phase + t * 0.24) % 1;
        child.position.set(
          vent.x + puff.drift * progress * 2,
          0.3 + progress * 2.4,
          vent.z + puff.drift * progress
        );
        child.scale.setScalar(puff.size * (0.7 + progress * 1.9));
        if (child.material) {
          const edge = Math.min(progress, 1 - progress);
          child.material.opacity = 0.16 * THREE.MathUtils.smoothstep(edge, 0, 0.22);
        }
      }
    }
  });
  const stackColor = shiftColor(theme.machinePlateColor ?? '#3d4454', { lightness: 0.14 });
  return (
    <group>
      {vents.map((vent, i) => (
        <mesh key={`vent-${i}`} position={[vent.x, 0.12, vent.z]}>
          <cylinderGeometry args={[0.12, 0.18, 0.34, 10]} />
          <meshStandardMaterial color={stackColor} roughness={0.5} metalness={0.6} />
        </mesh>
      ))}
      <group ref={groupRef} userData={FRAME_IGNORE_DATA}>
        {vents.flatMap((vent, v) =>
          vent.puffs.map((puff, p) => (
            <mesh key={`puff-${v}-${p}`} position={[vent.x, 0.4, vent.z]}>
              <sphereGeometry args={[1, 8, 8]} />
              {/* Additive: overlapping puffs never re-sort (flicker pattern). */}
              <meshBasicMaterial
                color="#e2e8f0"
                transparent
                opacity={0}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
                toneMapped={false}
              />
            </mesh>
          ))
        )}
      </group>
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

  const plateR = Math.max(5.5, layout.bounds.radius * 0.95);

  return (
    <group>
      <FactoryFloor radius={plateR} theme={theme} />
      <MachinePlate radius={plateR} theme={theme} />
      <RimPipes radius={plateR} theme={theme} />
      <SteamVents radius={plateR} theme={theme} />
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
      <MetaphorAccents items={dsl.items} anchors={anchors} theme={theme} />
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
