/**
 * Cycle metaphor scene — a recurring process as a ferris wheel on a plaza.
 * Items are gondola pods placed around the rim by `phase` (0–100 in procession
 * order); `size` scales the pod, and `friction` heats the pod that slows the
 * loop. The wheel turns slowly while gondolas counter-rotate to stay upright —
 * "it never ends, it iterates" is legible at a glance. Links ride the wheel so
 * hand-offs stay attached to their pods.
 */
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import { cycleWheelLayout } from '../../utils/metaphorLayouts/cycleWheelLayout.js';
import { Glyph } from '../metaphorGlyphs/index.jsx';
import {
  GlowSprite,
  GradientSkySphere,
  HoverableItem,
  ItemLabel,
  MetaphorGroundShadow,
  MetaphorLinks
} from './MetaphorSceneChrome.jsx';
import { MetaphorAccents } from './MetaphorAccents.jsx';
import { SkySunGlow } from './MetaphorSceneDecorations.jsx';
import { useMetaphorClock } from './metaphorClock.js';
import { idHash2, shiftColor } from './sceneUtils.js';

function podTint(theme, index) {
  const palette = theme.clusterPalette ?? ['#ffd166', '#4cc9f0', '#ff6bcb', '#06d6a0'];
  return palette[index % palette.length];
}

/** Plaza: grass disc, paved ring under the wheel, lamp posts with warm glows. */
function CyclePlaza({ radius, theme }) {
  const grass = theme.treeMeadowColor ?? '#53b95e';
  const pave = theme.cyclePaveColor ?? '#c9cdd6';
  const lamp = theme.cycleLampColor ?? '#ffd166';
  const lamps = useMemo(
    () =>
      Array.from({ length: 4 }, (_, i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        return { x: Math.cos(a) * radius * 0.92, z: Math.sin(a) * radius * 0.92 };
      }),
    [radius]
  );
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
        <circleGeometry args={[radius, 64]} />
        <meshStandardMaterial color={grass} roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <ringGeometry args={[radius * 0.42, radius * 0.62, 64]} />
        <meshStandardMaterial color={pave} roughness={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <circleGeometry args={[radius * 0.16, 32]} />
        <meshStandardMaterial color={pave} roughness={0.9} />
      </mesh>
      {lamps.map((l, i) => (
        <group key={`lamp-${i}`} position={[l.x, 0, l.z]}>
          <mesh position={[0, 1.05, 0]}>
            <cylinderGeometry args={[0.05, 0.07, 2.1, 8]} />
            <meshStandardMaterial color={theme.cycleFrameColor ?? '#475569'} roughness={0.6} />
          </mesh>
          <mesh position={[0, 2.2, 0]}>
            <sphereGeometry args={[0.14, 10, 10]} />
            <meshStandardMaterial
              color={lamp}
              emissive={lamp}
              emissiveIntensity={0.9}
              toneMapped={false}
            />
          </mesh>
          <GlowSprite size={0.8} color={lamp} opacity={0.3} />
        </group>
      ))}
    </group>
  );
}

/** Gondola cabin hanging below its rim mount — counter-rotated to stay upright. */
function CyclePod({ pod, item, theme, tint, uprightRef }) {
  const hot = pod.friction > 0.35;
  const s = pod.scale;
  return (
    <group position={pod.position}>
      {/* Hanger arm from the rim down to the cabin. */}
      <mesh position={[0, -0.32 * s, 0]}>
        <cylinderGeometry args={[0.045, 0.045, 0.64 * s, 8]} />
        <meshStandardMaterial color={theme.cycleFrameColor ?? '#475569'} roughness={0.5} />
      </mesh>
      <group ref={uprightRef} position={[0, -0.64 * s, 0]}>
        <mesh position={[0, -0.28 * s, 0]}>
          <boxGeometry args={[1.05 * s, 0.62 * s, 0.78 * s]} />
          <meshStandardMaterial
            color={tint}
            roughness={0.45}
            metalness={0.15}
            emissive={hot ? '#f97316' : tint}
            emissiveIntensity={hot ? 0.25 + pod.friction * 0.5 : 0.06}
          />
        </mesh>
        <mesh position={[0, 0.08 * s, 0]}>
          <coneGeometry args={[0.72 * s, 0.4 * s, 4]} />
          <meshStandardMaterial color={shiftColor(tint, { lightness: -0.08 })} roughness={0.55} />
        </mesh>
        {/* Little window band so the cabin reads as a gondola. */}
        <mesh position={[0, -0.26 * s, 0]}>
          <boxGeometry args={[1.08 * s, 0.16 * s, 0.8 * s]} />
          <meshStandardMaterial
            color={theme.windowColor ?? '#fef3c7'}
            emissive={theme.windowEmissiveColor ?? '#fef3c7'}
            emissiveIntensity={0.45}
            roughness={0.3}
          />
        </mesh>
        {hot ? <GlowSprite size={1.6 * s} color="#fb923c" opacity={0.4} /> : null}
        {item.glyph ? (
          <Billboard position={[0, 0.62 * s + 0.35, 0]}>
            <group scale={0.8}>
              <Glyph kind={item.glyph} theme={theme} />
            </group>
          </Billboard>
        ) : null}
        <ItemLabel
          text={item.label}
          position={[0, -0.78 * s - 0.35, 0]}
          fontSize={0.5}
          color={theme.labelColor}
          outlineColor={theme.labelOutline}
        />
      </group>
    </group>
  );
}

export function CycleScene({ dsl, theme }) {
  const layout = useMemo(() => cycleWheelLayout(dsl.items), [dsl.items]);
  const itemById = useMemo(() => new Map(dsl.items.map((item) => [item.id, item])), [dsl.items]);
  const wheelRef = useRef(null);
  const podUprightsRef = useRef([]);
  const { getTime, animated } = useMetaphorClock();
  // Frozen scenes (streaming / reduced motion) keep a deterministic pose.
  const startAngle = useMemo(() => idHash2('cycle-wheel', 'start') * Math.PI * 2, []);

  const frame = theme.cycleFrameColor ?? '#475569';
  const spokes = 12;

  // Links ride the wheel (hub-relative anchors) so hand-offs stay attached.
  const anchors = useMemo(() => {
    const map = new Map();
    for (const pod of layout.pods) {
      map.set(pod.id, [pod.position[0], pod.position[1] - layout.hubY, pod.position[2]]);
    }
    return map;
  }, [layout.pods, layout.hubY]);

  useFrame(() => {
    if (!wheelRef.current) return;
    const t = animated ? getTime() : 0;
    const rotation = startAngle - t * 0.14;
    wheelRef.current.rotation.z = rotation;
    for (const upright of podUprightsRef.current) {
      if (upright) upright.rotation.z = -rotation;
    }
  });

  // Proportional, not a flat +4: on the smallest wheel (radius 4.6) a fixed
  // margin nearly doubled the plaza and the wheel read as a toy on a field.
  const plazaRadius = layout.wheelRadius * 1.22 + 0.8;

  return (
    <group>
      <CyclePlaza radius={plazaRadius} theme={theme} />
      {/* Support A-frames rising to the hub. */}
      {[-0.95, 0.95].map((z) =>
        [-0.75, 0.75].map((x) => (
          <mesh
            key={`frame-${z}-${x}`}
            position={[x * 0.45, layout.hubY / 2, z]}
            rotation={[0, 0, x > 0 ? -0.09 : 0.09]}
          >
            <cylinderGeometry args={[0.09, 0.13, layout.hubY + 0.4, 8]} />
            <meshStandardMaterial color={frame} roughness={0.5} metalness={0.4} />
          </mesh>
        ))
      )}
      <group position={[0, layout.hubY, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.34, 0.34, 2.3, 16]} />
          <meshStandardMaterial color={frame} roughness={0.4} metalness={0.55} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.16, 0.16, 2.5, 12]} />
          <meshStandardMaterial
            color={theme.cycleLampColor ?? '#ffd166'}
            roughness={0.35}
            metalness={0.5}
          />
        </mesh>
        <group ref={wheelRef} rotation={[0, 0, startAngle]}>
          <mesh>
            <torusGeometry args={[layout.wheelRadius, 0.11, 10, 72]} />
            <meshStandardMaterial color={frame} roughness={0.45} metalness={0.45} />
          </mesh>
          {Array.from({ length: spokes }, (_, i) => {
            const a = (i / spokes) * Math.PI * 2;
            return (
              <mesh
                key={`spoke-${i}`}
                position={[
                  Math.cos(a) * layout.wheelRadius * 0.5,
                  Math.sin(a) * layout.wheelRadius * 0.5,
                  0
                ]}
                rotation={[0, 0, a - Math.PI / 2]}
              >
                <cylinderGeometry args={[0.045, 0.045, layout.wheelRadius, 6]} />
                <meshStandardMaterial color={frame} roughness={0.5} metalness={0.4} />
              </mesh>
            );
          })}
          {layout.pods.map((pod, index) => {
            const item = itemById.get(pod.id);
            if (!item) return null;
            return (
              <HoverableItem key={pod.id} item={item} metaphor="cycle">
                <CyclePod
                  pod={{ ...pod, position: anchors.get(pod.id) }}
                  item={item}
                  theme={theme}
                  tint={podTint(theme, index)}
                  uprightRef={(el) => {
                    podUprightsRef.current[index] = el;
                  }}
                />
              </HoverableItem>
            );
          })}
          <MetaphorAccents items={dsl.items} anchors={anchors} theme={theme} />
          <MetaphorLinks links={dsl.links} anchors={anchors} theme={theme} variant="arc" />
        </group>
      </group>
      <MetaphorGroundShadow theme={theme} y={-0.04} scale={plazaRadius * 2.2} />
    </group>
  );
}

/** Fair-weather sky over the plaza, with a warm sun halo. */
export function CycleSky({ theme }) {
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
