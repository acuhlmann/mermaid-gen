/**
 * Iceberg metaphor scene — what people see against what actually carries it.
 *
 * Everything here serves one line: the waterline at y = 0. Blocks above it are
 * lit, crisp and saturated; blocks below it are drawn through a translucent sea
 * plane, desaturated and cooled by depth, so "the visible tip" and "the hidden
 * nine-tenths" are legible before a single label is read. A high-`peril` block
 * below the line glows cold red — the hidden thing most likely to sink the
 * visible one.
 *
 * The sea itself is a single transparent plane rather than per-block trickery:
 * one surface at exactly y = 0 is what makes the boundary read as a boundary,
 * and it lets the submerged geometry stay physically continuous with the tip
 * above it (an iceberg drawn as two separate objects stops being an iceberg).
 */
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import {
  ICEBERG_VERTICAL_SCALE,
  icebergBlockRadius,
  icebergLayout
} from '../../utils/metaphorLayouts/icebergLayout.js';
import { Glyph } from '../metaphorGlyphs/index.jsx';
import {
  GradientSkySphere,
  HoverableItem,
  ItemLabel,
  MetaphorLinks
} from './MetaphorSceneChrome.jsx';
import { MetaphorAccents } from './MetaphorAccents.jsx';
import { SkySunGlow, SoaringBirds } from './MetaphorSceneDecorations.jsx';
import { useMetaphorClock } from './metaphorClock.js';
import { idHash2, shiftColor } from './sceneUtils.js';
import { FRAME_IGNORE_DATA } from './sceneFraming.js';

function blendHex(base, target, amount) {
  return `#${new THREE.Color(base).lerp(new THREE.Color(target), amount).getHexString()}`;
}

const ABOVE_ICE = '#f2f8fd';
const BELOW_ICE = '#2f7fa8';
const PERIL_ICE = '#c2564f';

/**
 * A block of ice. Above the line it is bright and faceted; below it is cooled
 * toward deep blue in proportion to how far down it sits, which is what gives
 * the submerged mass its sense of depth without any fog trickery.
 */
function IceBlock({ item, position, theme, berg, fanIndex, fanCount }) {
  const depth = typeof item.depth === 'number' ? item.depth : 0.4;
  const mass = typeof item.mass === 'number' ? item.mass : 5;
  const peril = typeof item.peril === 'number' ? item.peril : 0;
  const radius = icebergBlockRadius(mass);
  const submerged = depth < 0;

  const color = useMemo(() => {
    if (!submerged) return shiftColor(ABOVE_ICE, { lightness: -0.03 + depth * 0.04 });
    // Deeper = darker and bluer; `depth` is already −1…0 here. Peril warms that
    // blue toward red rather than replacing it — a solid red block stops
    // reading as ice, and peril is a property OF the hidden mass, not a
    // different substance.
    const cold = shiftColor(BELOW_ICE, { lightness: depth * 0.2, satScale: 1 + -depth * 0.2 });
    return peril > 0.15 ? blendHex(cold, PERIL_ICE, Math.min(0.75, peril * 0.8)) : cold;
  }, [submerged, peril, depth]);

  // Irregular faceting: a scaled icosahedron reads as a fractured block where a
  // box reads as a crate, and it costs one geometry.
  const detail = radius > 2 ? 1 : 0;
  const squash = submerged ? 0.85 : 1.1;

  // Fan the labels around the berg by stacking order so two blocks never send
  // their leaders to the same patch of water.
  const leaderAngle =
    Math.atan2(berg?.center?.[2] ?? 0, berg?.center?.[0] ?? 0) +
    ((fanIndex - (fanCount - 1) / 2) / Math.max(1, fanCount)) * 1.5;
  const leaderLength = (berg?.radius ?? radius) + radius * 0.4 + 1.9;
  const leader = [Math.cos(leaderAngle) * leaderLength, 0, Math.sin(leaderAngle) * leaderLength];

  return (
    <group position={position}>
      <mesh
        scale={[radius, radius * squash, radius * 0.92]}
        rotation={[
          idHash2(item.id, 'tilt-x') * 0.5,
          idHash2(item.id, 'tilt-y') * Math.PI,
          idHash2(item.id, 'tilt-z') * 0.4
        ]}
      >
        <icosahedronGeometry args={[1, detail]} />
        <meshStandardMaterial
          color={color}
          flatShading
          roughness={submerged ? 0.55 : 0.32}
          metalness={0.08}
          emissive={color}
          emissiveIntensity={submerged && peril > 0.35 ? 0.1 + peril * 0.14 : 0.05}
        />
      </mesh>
      {item.glyph ? (
        <group position={[leader[0] * 0.55, radius * squash * 0.4, leader[2] * 0.55]} scale={0.5}>
          <Glyph kind={item.glyph} theme={theme} />
        </group>
      ) : null}
      {/* Leader from the block out to its name, so a label beside the berg is
          still unambiguously attached to the block it names. */}
      <mesh position={[leader[0] / 2, 0, leader[2] / 2]} rotation={[0, -leaderAngle, 0]}>
        <boxGeometry args={[leaderLength, 0.035, 0.035]} />
        <meshBasicMaterial color={theme.labelColor ?? '#0f172a'} transparent opacity={0.4} />
      </mesh>
      <ItemLabel
        text={item.label}
        position={leader}
        fontSize={0.42}
        color={theme.labelColor}
        outlineColor={theme.labelOutline}
        // Above the line is the part the audience already knows about; the
        // hidden mass is the insight, so it outranks the tip for label space.
        importance={(submerged ? 12 : 6) + mass}
      />
    </group>
  );
}

/**
 * The sea. One transparent plane at exactly y = 0, plus a brighter scumble ring
 * around each berg where the ice breaks the surface, so the waterline crossing
 * is visible instead of implied.
 */
function SeaSurface({ radius, bergs, theme }) {
  const matRef = useRef(null);
  const { getTime, animated } = useMetaphorClock();
  const water = theme.waterColor ?? '#27afe2';
  useFrame(() => {
    if (!animated || !matRef.current) return;
    matRef.current.emissiveIntensity = 0.1 + 0.05 * Math.sin(getTime() * 0.7);
  });
  return (
    <group>
      {/* Open water reaching past the bergs is scaffolding, not subject — the
          same rule the ground-shadow catcher and the fused ocean disc follow.
          Left in the camera fit this 1.22x disc was the binding constraint on
          every iceberg: measured, the bergs rendered at 43% of the frame height
          with the above-water tip pushed under the reading strip, which is the
          one thing the kind exists to show. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        renderOrder={4}
        userData={FRAME_IGNORE_DATA}
      >
        <circleGeometry args={[radius * 1.22, 96]} />
        <meshStandardMaterial
          ref={matRef}
          color={water}
          emissive={theme.riverDeepColor ?? water}
          emissiveIntensity={0.12}
          transparent
          opacity={0.72}
          roughness={0.18}
          metalness={0.25}
          // Depth-write off so the submerged ice stays visible through it;
          // writing depth here would clip the whole hidden half away, which is
          // the only half the metaphor exists to show.
          depthWrite={false}
        />
      </mesh>
      {bergs.map((berg) => (
        <mesh
          key={`foam-${berg.name}`}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[berg.center[0], 0.012, berg.center[2]]}
        >
          <ringGeometry args={[berg.radius * 0.95, berg.radius * 1.3, 40]} />
          <meshBasicMaterial color="#eaf6ff" transparent opacity={0.34} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * The berg's body: a tapered core from its highest point to its deepest, drawn
 * behind the blocks. Without it the blocks read as unrelated boulders hanging
 * in the water — the mass has to be continuous for "nine-tenths of it is below
 * the line" to land.
 */
function BergCore({ berg }) {
  const top = berg.above + 0.4;
  const bottom = berg.below - 0.4;
  const height = Math.max(1, top - bottom);
  return (
    <mesh position={[berg.center[0], (top + bottom) / 2, berg.center[2]]}>
      <cylinderGeometry args={[berg.radius * 0.5, berg.radius * 0.34, height, 7]} />
      <meshStandardMaterial
        color={shiftColor(BELOW_ICE, { lightness: -0.06 })}
        flatShading
        roughness={0.62}
      />
    </mesh>
  );
}

/** Berg name, set on the water beside its mass rather than floating overhead. */
function BergLabel({ berg, theme }) {
  return (
    <ItemLabel
      text={berg.name}
      position={[berg.center[0], 0.35, berg.center[2] + berg.radius + 0.9]}
      fontSize={0.5}
      color={theme.labelColor}
      outlineColor={theme.labelOutline}
      pinned
    />
  );
}

export function IcebergScene({ dsl, theme }) {
  const layout = useMemo(() => icebergLayout(dsl.items), [dsl.items]);
  const radius = Math.max(6, layout.bounds.radius);

  const bergOf = useMemo(() => {
    const byName = new Map(layout.bergs.map((berg) => [berg.name, berg]));
    const map = new Map();
    for (const item of dsl.items) {
      const name =
        typeof item.berg === 'string' && item.berg.trim() ? item.berg.trim() : 'The berg';
      const berg = byName.get(name);
      if (berg) map.set(item.id, berg);
    }
    return map;
  }, [dsl.items, layout.bergs]);

  // Deepest-first within each berg, so the fan of labels reads top to bottom in
  // the same order as the ice it names.
  const stackOrder = useMemo(() => {
    const map = new Map();
    for (const item of dsl.items) {
      const berg = bergOf.get(item.id);
      if (!berg) continue;
      if (!map.has(berg.name)) map.set(berg.name, []);
      map.get(berg.name).push(item.id);
    }
    for (const [, ids] of map) {
      ids.sort((a, b) => (layout.positions.get(b)?.[1] ?? 0) - (layout.positions.get(a)?.[1] ?? 0));
    }
    return map;
  }, [dsl.items, bergOf, layout.positions]);

  const anchors = useMemo(() => {
    const map = new Map();
    for (const item of dsl.items) {
      const position = layout.positions.get(item.id);
      if (!position) continue;
      map.set(item.id, [
        position[0],
        position[1] + icebergBlockRadius(item.mass) + 0.4,
        position[2]
      ]);
    }
    return map;
  }, [dsl.items, layout.positions]);

  return (
    <group>
      <SeaSurface radius={radius} bergs={layout.bergs} theme={theme} />
      {layout.bergs.map((berg) => (
        <BergCore key={`core-${berg.name}`} berg={berg} />
      ))}
      {layout.bergs.map((berg) => (
        <BergLabel key={`berg-${berg.name}`} berg={berg} theme={theme} />
      ))}
      {dsl.items.map((item) => {
        const position = layout.positions.get(item.id);
        if (!position) return null;
        const berg = bergOf.get(item.id);
        const stack = berg ? (stackOrder.get(berg.name) ?? []) : [];
        return (
          <HoverableItem key={item.id} item={item} metaphor="iceberg">
            <IceBlock
              item={item}
              position={position}
              theme={theme}
              berg={berg}
              fanIndex={Math.max(0, stack.indexOf(item.id))}
              fanCount={Math.max(1, stack.length)}
            />
          </HoverableItem>
        );
      })}
      <SoaringBirds
        radius={radius * 0.85}
        height={ICEBERG_VERTICAL_SCALE * 0.9 + 2}
        count={3}
        color={theme.labelColor ?? '#1f2937'}
        idSeed="iceberg-birds"
      />
      <MetaphorAccents items={dsl.items} anchors={anchors} theme={theme} />
      <MetaphorLinks links={dsl.links} anchors={anchors} theme={theme} variant="arc" />
    </group>
  );
}

/** Cold polar daylight — a pale sky so the white tips still read against it. */
export function IcebergSky({ theme }) {
  return (
    <group>
      <GradientSkySphere
        topColor={shiftColor(theme.skyTopColor ?? '#7fa8cc', { satScale: 0.8 })}
        horizonColor={shiftColor(theme.skyHorizonColor ?? '#cfe0ee', { lightness: -0.04 })}
      />
      <SkySunGlow color="#e8f2ff" />
    </group>
  );
}
