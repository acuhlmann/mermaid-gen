import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Bounds, Center, Environment, Line } from '@react-three/drei';
import {
  parsePartialMetaphorDsl,
  partialToRenderableMetaphorDsl,
  sanitizeMetaphorDsl
} from '@archislop/shared';
import {
  resolveMetaphorThemePreset,
  resolveMetaphorPostfx,
  resolveDistrictColor
} from '../utils/metaphorThemePresets.js';
import { cityDistrictLayout } from '../utils/metaphorLayouts/cityDistrictLayout.js';
import {
  layercakeComponentPositions,
  layercakeSlabRadius,
  layercakeStackLayout
} from '../utils/metaphorLayouts/layercakeComponentsLayout.js';
import { Glyph } from './metaphorGlyphs/index.jsx';
import {
  MetaphorTitleOverlay,
  MetaphorLegendOverlay,
  MetaphorKindSwitcher,
  MetaphorHoverTooltip
} from './MetaphorOverlays.jsx';
import { MetaphorEffects } from './MetaphorEffects.jsx';
import { MetaphorHoverContext, createMetaphorHoverStore } from './metaphorHover.js';
import { MetaphorClockContext } from './metaphorScenes/metaphorClock.js';
import { idHash, idHash2, shiftColor, truncateLabel } from './metaphorScenes/sceneUtils.js';
import {
  GradientSkySphere,
  HoverableItem,
  ItemLabel,
  MetaphorGroundShadow,
  MetaphorLinks
} from './metaphorScenes/MetaphorSceneChrome.jsx';
import MetaphorChangeHighlightProvider from './MetaphorChangeHighlightProvider.jsx';
import {
  CakeSprinkles,
  CityTraffic,
  FloorGlowDisc,
  IcingDrips,
  PenthouseGlowBand,
  RisingSparkles,
  SpireBeacon
} from './metaphorScenes/MetaphorSceneDecorations.jsx';
import { TerrainScene } from './metaphorScenes/TerrainScene.jsx';
import { TreeScene, TreeSky } from './metaphorScenes/TreeScene.jsx';
import { GalaxyScene, GalaxySky } from './metaphorScenes/GalaxyScene.jsx';
import { OrreryScene } from './metaphorScenes/OrreryScene.jsx';
import { RiverScene, RiverSky } from './metaphorScenes/RiverScene.jsx';

const STREAMING_RENDER_THROTTLE_MS = 90;

const ORBIT_CAMERA = { position: [18, 14, 18], fov: 45 };

const CUTAWAY_THETA = (330 / 360) * Math.PI * 2;

/** Advances the shared scene clock; gated off (frozen at 0) during streaming. */
function MetaphorClockProvider({ enabled, children }) {
  const timeRef = useRef(0);
  useFrame((_, delta) => {
    if (!enabled) return;
    timeRef.current += delta;
  });
  const value = useMemo(
    () => ({
      getTime: () => (enabled ? timeRef.current : 0),
      animated: enabled
    }),
    [enabled]
  );
  return <MetaphorClockContext.Provider value={value}>{children}</MetaphorClockContext.Provider>;
}

const LIGHTING_BOOST = { lit: 0.2, dim: 0.08, dark: 0 };
const CONDITION_TILT = { new: 0, aging: 0.06, crumbling: 0.16 };
const LIGHTING_WINDOW_PROB = { lit: 0.55, dim: 0.25, dark: 0.05 };
const ROOF_STYLES = ['flat', 'gable', 'hipped', 'spire'];

function pickRoofStyle(id, isTall) {
  const h = idHash(id);
  if (isTall && h > 0.35) return 'spire';
  const idx = Math.floor(h * ROOF_STYLES.length);
  return ROOF_STYLES[Math.min(idx, ROOF_STYLES.length - 1)];
}

function BuildingWindows({ footprint, height, lighting, idSeed, theme }) {
  const baseProb = LIGHTING_WINDOW_PROB[lighting ?? 'lit'] ?? LIGHTING_WINDOW_PROB.lit;
  const cellSize = 0.22;
  const colsRaw = Math.max(2, Math.floor(footprint / (cellSize * 1.8)));
  const rowsRaw = Math.max(2, Math.floor(height / (cellSize * 1.8)));
  const cols = Math.min(colsRaw, 5);
  const rows = Math.min(rowsRaw, 8);
  const facades = useMemo(() => {
    const layouts = [];
    const colStep = footprint / (cols + 1);
    const rowStep = height / (rows + 1);
    const half = footprint / 2 + 0.005;
    const facadeDefs = [
      { axis: 'z', sign: 1, rotY: 0 },
      { axis: 'z', sign: -1, rotY: Math.PI },
      { axis: 'x', sign: 1, rotY: Math.PI / 2 },
      { axis: 'x', sign: -1, rotY: -Math.PI / 2 }
    ];
    facadeDefs.forEach((face, faceIdx) => {
      const cells = [];
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          const seed = idHash2(`${idSeed}|f${faceIdx}|${r}|${c}`, 'window');
          if (seed > baseProb) continue;
          const localX = (c + 1) * colStep - footprint / 2;
          const y = (r + 1) * rowStep;
          const px = face.axis === 'x' ? face.sign * half : localX;
          const pz = face.axis === 'z' ? face.sign * half : localX;
          cells.push({ position: [px, y, pz], rotY: face.rotY, seed });
        }
      }
      layouts.push(cells);
    });
    return layouts;
  }, [footprint, height, baseProb, cols, rows, idSeed]);

  const windowColor = theme.windowColor ?? '#fef3c7';
  const emissiveColor = theme.windowEmissiveColor ?? windowColor;
  const isDark = lighting === 'dark';
  const baseEmissive = isDark ? 0.16 : 0.6;

  return (
    <group>
      {facades.flat().map((cell, idx) => (
        <mesh key={`win-${idx}`} position={cell.position} rotation={[0, cell.rotY, 0]}>
          <planeGeometry args={[cellSize, cellSize]} />
          <meshStandardMaterial
            color={windowColor}
            emissive={emissiveColor}
            emissiveIntensity={baseEmissive * (0.6 + cell.seed * 0.6)}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function CityRoof({ style, footprint, height, condition, theme }) {
  const conditionTilt = CONDITION_TILT[condition] ?? 0;
  const roofHeight = Math.max(0.18, height * 0.1);
  const color = theme.buildingRoofColor ?? theme.buildingColor;
  const spireColor = theme.spireColor ?? color;

  if (style === 'spire') {
    return (
      <group position={[0, height, 0]} rotation={[conditionTilt, 0, conditionTilt * 0.7]}>
        <mesh position={[0, roofHeight / 2, 0]}>
          <boxGeometry args={[footprint * 0.95, roofHeight, footprint * 0.95]} />
          <meshStandardMaterial color={color} />
        </mesh>
        <mesh position={[0, roofHeight + footprint * 0.5, 0]}>
          <coneGeometry args={[footprint * 0.35, footprint, 6]} />
          <meshStandardMaterial color={spireColor} />
        </mesh>
      </group>
    );
  }
  if (style === 'gable') {
    return (
      <group position={[0, height, 0]} rotation={[conditionTilt, 0, conditionTilt * 0.7]}>
        <mesh position={[0, roofHeight / 2, 0]}>
          <boxGeometry args={[footprint * 0.92, roofHeight * 0.5, footprint * 0.92]} />
          <meshStandardMaterial color={color} />
        </mesh>
        <mesh position={[0, roofHeight + 0.05, 0]} rotation={[0, Math.PI / 4, 0]}>
          <cylinderGeometry args={[footprint * 0.5, footprint * 0.5, roofHeight, 4]} />
          <meshStandardMaterial color={color} />
        </mesh>
      </group>
    );
  }
  if (style === 'hipped') {
    return (
      <group position={[0, height, 0]} rotation={[conditionTilt, 0, conditionTilt * 0.7]}>
        <mesh position={[0, roofHeight * 0.75, 0]}>
          <coneGeometry args={[footprint * 0.62, roofHeight * 1.5, 4]} />
          <meshStandardMaterial color={color} />
        </mesh>
      </group>
    );
  }
  return (
    <mesh
      position={[0, height + roofHeight / 2, 0]}
      rotation={[conditionTilt, 0, conditionTilt * 0.7]}
    >
      <boxGeometry args={[footprint * 0.92, roofHeight, footprint * 0.92]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

function RooftopFixtures({ id, footprint, height, theme }) {
  const seed = idHash2(id, 'roof');
  const fixtures = useMemo(() => {
    if (seed < 0.6) return [];
    const items = [];
    const count = 1 + Math.floor(idHash2(id, 'roof-count') * 3);
    for (let i = 0; i < count; i += 1) {
      const offsetX = (idHash2(id, `rx${i}`) - 0.5) * footprint * 0.6;
      const offsetZ = (idHash2(id, `rz${i}`) - 0.5) * footprint * 0.6;
      const tall = idHash2(id, `rt${i}`) > 0.55;
      items.push({ offsetX, offsetZ, tall });
    }
    return items;
  }, [id, footprint, seed]);
  if (!fixtures.length) return null;
  const fixtureColor = theme.spireColor ?? theme.buildingRoofColor;
  return (
    <group position={[0, height, 0]}>
      {fixtures.map((f, i) =>
        f.tall ? (
          <mesh key={`fx-${i}`} position={[f.offsetX, 0.35, f.offsetZ]}>
            <cylinderGeometry args={[0.04, 0.04, 0.7, 6]} />
            <meshStandardMaterial color={fixtureColor} />
          </mesh>
        ) : (
          <mesh key={`fx-${i}`} position={[f.offsetX, 0.12, f.offsetZ]}>
            <boxGeometry args={[0.22, 0.18, 0.22]} />
            <meshStandardMaterial color={fixtureColor} />
          </mesh>
        )
      )}
    </group>
  );
}

function CityBuilding({ item, position, theme, accentGlow }) {
  const height = Math.max(0.5, item.height ?? 4);
  const footprint = Math.max(0.5, item.footprint ?? 2);
  const roofHeight = Math.max(0.18, height * 0.1);
  const accentEmissive = accentGlow ? theme.accentGlow * accentGlow * 0.5 : 0;
  const lightingBoost = LIGHTING_BOOST[item.lighting] ?? 0;
  const emissiveIntensity = accentEmissive + lightingBoost;
  const wallOpacity = item.lighting === 'dark' ? 0.88 : 1;
  const roofStyle = pickRoofStyle(item.id, accentGlow ? true : false);
  const labelLift = roofStyle === 'spire' ? footprint + roofHeight + 0.6 : roofHeight + 0.6;

  return (
    <group position={position}>
      <mesh position={[0, 0.08, 0]}>
        <boxGeometry args={[footprint * 1.08, 0.16, footprint * 1.08]} />
        <meshStandardMaterial color={theme.buildingRoofColor ?? theme.buildingColor} />
      </mesh>
      <mesh position={[0, height / 2, 0]}>
        <boxGeometry args={[footprint, height, footprint]} />
        <meshStandardMaterial
          color={theme.buildingColor}
          emissive={theme.buildingColor}
          emissiveIntensity={emissiveIntensity}
          transparent={wallOpacity < 1}
          opacity={wallOpacity}
        />
      </mesh>
      <BuildingWindows
        footprint={footprint}
        height={height}
        lighting={item.lighting}
        idSeed={item.id}
        theme={theme}
      />
      <CityRoof
        style={roofStyle}
        footprint={footprint}
        height={height}
        condition={item.condition}
        theme={theme}
      />
      {roofStyle === 'spire' ? (
        <SpireBeacon
          position={[0, height + roofHeight + footprint + 0.12, 0]}
          color={theme.treeAccentColor ?? '#f87171'}
          seed={idHash(item.id)}
        />
      ) : (
        <RooftopFixtures id={item.id} footprint={footprint} height={height} theme={theme} />
      )}
      {accentGlow > 0 && item.lighting !== 'dark' ? (
        <PenthouseGlowBand
          footprint={footprint}
          y={height - 0.32}
          color={theme.windowEmissiveColor ?? theme.windowColor ?? '#fef3c7'}
        />
      ) : null}
      {item.glyph ? (
        <group
          position={[0, height + roofHeight + 0.55, 0]}
          scale={Math.max(0.7, Math.min(1.8, footprint * 0.42))}
        >
          <Glyph kind={item.glyph} theme={theme} />
        </group>
      ) : null}
      <ItemLabel
        text={item.label}
        position={[0, height + labelLift + (item.glyph ? 0.55 : 0), 0]}
        fontSize={Math.max(0.45, Math.min(0.95, footprint * 0.42))}
        color={theme.labelColor}
        outlineColor={theme.labelOutline}
      />
    </group>
  );
}

function DistrictGrid({ size, color }) {
  const [w, h] = size;
  const lines = useMemo(() => {
    const segs = [];
    const step = 2;
    const halfW = w / 2;
    const halfH = h / 2;
    for (let x = -halfW; x <= halfW + 0.001; x += step) {
      segs.push([
        [x, 0.02, -halfH],
        [x, 0.02, halfH]
      ]);
    }
    for (let z = -halfH; z <= halfH + 0.001; z += step) {
      segs.push([
        [-halfW, 0.02, z],
        [halfW, 0.02, z]
      ]);
    }
    return segs;
  }, [w, h]);
  return (
    <group>
      {lines.map((pts, idx) => (
        <Line
          key={`grid-${idx}`}
          points={pts}
          color={color}
          lineWidth={0.8}
          transparent
          opacity={0.4}
        />
      ))}
    </group>
  );
}

function DistrictPatch({ district, theme, index }) {
  const color = resolveDistrictColor(theme, index);
  const gridColor = theme.districtGridColor ?? theme.labelColor ?? '#cbd5e1';
  return (
    <group position={[district.center[0], 0.01, district.center[2]]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={district.size} />
        <meshStandardMaterial color={color} transparent opacity={0.4} />
      </mesh>
      <DistrictGrid size={district.size} color={gridColor} />
      <ItemLabel
        text={district.name}
        position={[0, 0.22, 0]}
        fontSize={0.5}
        color={theme.labelColor}
        outlineColor={theme.labelOutline}
      />
    </group>
  );
}

function ComponentChip({ label, position, yBase, theme }) {
  const chipColor = theme.componentChipColor ?? theme.slabColor;
  const trimColor = theme.slabTrimColor ?? chipColor;
  return (
    <group position={[position[0], yBase + position[1] + 0.18, position[2]]}>
      <mesh>
        <cylinderGeometry args={[0.22, 0.22, 0.16, 16]} />
        <meshStandardMaterial color={chipColor} />
      </mesh>
      <mesh position={[0, 0.085, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.22, 0.025, 8, 18]} />
        <meshStandardMaterial color={trimColor} emissive={trimColor} emissiveIntensity={0.25} />
      </mesh>
      <ItemLabel
        text={truncateLabel(label, 10)}
        position={[0, 0.4, 0]}
        fontSize={0.28}
        color={theme.labelColor}
        outlineColor={theme.labelOutline}
      />
    </group>
  );
}

function CrackDecals({ radius, thickness, cracks, theme, idSeed }) {
  const wedges = useMemo(() => {
    if (!(cracks > 0)) return [];
    const count = Math.round(2 + cracks * 4);
    const list = [];
    for (let i = 0; i < count; i += 1) {
      const jitter = idSeed ? idHash2(idSeed, `crack${i}`) * 0.6 : 0;
      const angle = (i / count) * Math.PI * 2 + cracks * 0.7 + jitter;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const width = 0.06 + cracks * 0.06;
      const depth = 0.16 + cracks * 0.18;
      const height = Math.max(0.12, thickness * (0.45 + cracks * 0.45));
      list.push({ angle, x, z, width, depth, height });
    }
    return list;
  }, [radius, thickness, cracks, idSeed]);
  if (!wedges.length) return null;
  return (
    <group>
      {wedges.map((w, i) => (
        <mesh key={`crack-${i}`} position={[w.x, 0, w.z]} rotation={[0, -w.angle + Math.PI / 2, 0]}>
          <boxGeometry args={[w.width, w.height, w.depth]} />
          <meshStandardMaterial
            color={theme.crackColor ?? theme.labelOutline ?? '#1f2937'}
            roughness={0.95}
          />
        </mesh>
      ))}
    </group>
  );
}

function CrackStreaks({ radius, cracks, theme, idSeed }) {
  const segments = useMemo(() => {
    if (!(cracks > 0.5)) return [];
    const count = 2 + Math.round((cracks - 0.5) * 4);
    const out = [];
    for (let i = 0; i < count; i += 1) {
      const baseAngle = idHash2(idSeed, `streak-a${i}`) * Math.PI * 2;
      const inset = radius * (0.2 + idHash2(idSeed, `streak-r${i}`) * 0.45);
      const tipR = radius * (0.7 + idHash2(idSeed, `streak-t${i}`) * 0.25);
      const startX = Math.cos(baseAngle) * inset;
      const startZ = Math.sin(baseAngle) * inset;
      const midAngle = baseAngle + 0.25;
      const midX = Math.cos(midAngle) * (inset + tipR) * 0.55;
      const midZ = Math.sin(midAngle) * (inset + tipR) * 0.55;
      const endX = Math.cos(baseAngle + 0.55) * tipR;
      const endZ = Math.sin(baseAngle + 0.55) * tipR;
      out.push([
        [startX, 0.001, startZ],
        [midX, 0.001, midZ],
        [endX, 0.001, endZ]
      ]);
    }
    return out;
  }, [radius, cracks, idSeed]);
  if (!segments.length) return null;
  const color = theme.crackColor ?? theme.labelOutline ?? '#1f2937';
  return (
    <group>
      {segments.map((pts, i) => (
        <Line
          key={`streak-${i}`}
          points={pts}
          color={color}
          lineWidth={1.2}
          transparent
          opacity={0.7}
        />
      ))}
    </group>
  );
}

function SlabSideRidges({ radius, thickness, theme }) {
  const ridges = useMemo(() => {
    const count = 10;
    const list = [];
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2;
      list.push({ angle, x: Math.cos(angle) * radius, z: Math.sin(angle) * radius });
    }
    return list;
  }, [radius]);
  const color = theme.crackColor ?? '#1f2937';
  return (
    <group>
      {ridges.map((r, i) => (
        <mesh key={`ridge-${i}`} position={[r.x, 0, r.z]} rotation={[0, -r.angle + Math.PI / 2, 0]}>
          <boxGeometry args={[0.04, thickness * 0.85, 0.04]} />
          <meshStandardMaterial color={color} transparent opacity={0.6} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Per-layer body colour so the stack reads as distinct, appetizing layers
 * instead of one monochrome column: each layer takes a hue from the theme's
 * cluster palette (blended over the base sponge colour to stay cohesive), with
 * a gentle vertical lightness ramp — richer at the base, lighter at the top.
 */
function layerSlabShade(theme, index, total) {
  const palette = theme.clusterPalette ?? [];
  const base = new THREE.Color(theme.slabColor);
  if (palette.length > 0) {
    base.lerp(new THREE.Color(palette[index % palette.length]), 0.55);
  }
  const tNorm = total > 1 ? index / (total - 1) : 0.5;
  return shiftColor(base, {
    lightness: -0.06 + tNorm * 0.14,
    satScale: 1.05 - tNorm * 0.08
  });
}

/**
 * Slab label that orbits to whichever side faces the camera, so it's always on
 * the near rim and never occluded by the cake as the user rotates the view.
 * Billboarded so the glyph-free text stays upright and screen-facing.
 */
function CameraFacingLabel({ centerY, radius, text, fontSize, color, outlineColor }) {
  const ref = useRef(null);
  useFrame((state) => {
    if (!ref.current) return;
    const { x, z } = state.camera.position;
    const angle = Math.atan2(z, x);
    const r = radius + 1;
    ref.current.position.set(Math.cos(angle) * r, centerY, Math.sin(angle) * r);
  });
  if (!text) return null;
  return (
    <group ref={ref}>
      <ItemLabel
        text={text}
        position={[0, 0, 0]}
        fontSize={fontSize}
        color={color}
        outlineColor={outlineColor}
      />
    </group>
  );
}

/**
 * The two flat radial walls that close the cutaway wedge so each slab reads as a
 * solid cake slice (a visible cross-section) instead of a hollow shell you can
 * see straight through. DoubleSide so the slice face shows from either approach.
 */
function CutawayFaces({ radius, thickness, color, thetaLength }) {
  return (
    <group>
      {[0, thetaLength].map((theta, i) => (
        <mesh
          key={`cut-${i}`}
          position={[Math.sin(theta) * radius * 0.5, 0, Math.cos(theta) * radius * 0.5]}
          rotation={[0, theta - Math.PI / 2, 0]}
        >
          <planeGeometry args={[radius, thickness]} />
          <meshStandardMaterial
            color={color}
            roughness={0.6}
            metalness={0}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

/** Crack pits, surface streaks, and side ridges for an aging/crumbling slab. */
function SlabDecorations({ idSeed, radius, thickness, yOffset, slabCenterY, cracks, theme }) {
  if (!(cracks > 0)) return null;
  const showRidges = idHash(idSeed) > 0.5;
  return (
    <group>
      <group position={[0, slabCenterY, 0]}>
        <CrackDecals
          radius={radius - 0.01}
          thickness={thickness}
          cracks={cracks}
          theme={theme}
          idSeed={idSeed}
        />
      </group>
      {cracks > 0.5 ? (
        <group position={[0, yOffset + thickness + 0.01, 0]}>
          <CrackStreaks radius={radius} cracks={cracks} theme={theme} idSeed={idSeed} />
        </group>
      ) : null}
      {showRidges ? (
        <group position={[0, slabCenterY, 0]}>
          <SlabSideRidges radius={radius - 0.02} thickness={thickness} theme={theme} />
        </group>
      ) : null}
    </group>
  );
}

/**
 * Classic cake stand under the stack — plate with a glowing rim, flared stem,
 * and a foot — so the cake sits on a deliberate pedestal instead of floating
 * in a void. Porcelain tone is derived from the theme's trim colour.
 */
function CakeStand({ radius, theme }) {
  const porcelain = useMemo(
    () => shiftColor(theme.slabTrimColor ?? theme.slabColor, { lightness: 0.18, satScale: 0.5 }),
    [theme.slabTrimColor, theme.slabColor]
  );
  const rimColor = theme.slabTrimColor ?? theme.slabColor;
  return (
    <group>
      <mesh position={[0, -0.09, 0]}>
        <cylinderGeometry args={[radius, radius * 0.96, 0.18, 64]} />
        <meshStandardMaterial color={porcelain} roughness={0.3} metalness={0.25} />
      </mesh>
      <mesh position={[0, -0.04, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius * 0.995, 0.05, 10, 72]} />
        <meshStandardMaterial
          color={rimColor}
          emissive={rimColor}
          emissiveIntensity={0.25}
          roughness={0.3}
          metalness={0.2}
        />
      </mesh>
      <mesh position={[0, -0.62, 0]}>
        <cylinderGeometry args={[0.55, 0.85, 0.88, 24]} />
        <meshStandardMaterial color={porcelain} roughness={0.35} metalness={0.25} />
      </mesh>
      <mesh position={[0, -1.13, 0]}>
        <cylinderGeometry args={[radius * 0.42, radius * 0.46, 0.14, 48]} />
        <meshStandardMaterial color={porcelain} roughness={0.35} metalness={0.25} />
      </mesh>
    </group>
  );
}

/**
 * Piped frosting dollops around the top layer's rim, plus a glossy cherry at
 * the centre when the glyph slot is free. Dollops skip the cutaway gap so no
 * frosting floats over the missing slice.
 */
function CakeTopping({ radius, topY, thetaLength, bodyColor, theme, showCherry }) {
  const cream = useMemo(
    () => shiftColor(bodyColor, { lightness: 0.24, satScale: 0.6 }),
    [bodyColor]
  );
  const cherryColor = theme.treeAccentColor ?? '#e63946';
  const dollops = useMemo(() => {
    const count = Math.max(10, Math.min(18, Math.round(radius * 2.4)));
    const fullCircle = Math.abs(thetaLength - Math.PI * 2) < 1e-6;
    const margin = 0.16;
    const out = [];
    for (let i = 0; i < count; i += 1) {
      const theta = fullCircle
        ? (i / count) * Math.PI * 2
        : margin + (i / (count - 1)) * (thetaLength - margin * 2);
      const r = radius - 0.35;
      // Cylinder theta convention: x = r·sin(θ), z = r·cos(θ).
      out.push([Math.sin(theta) * r, Math.cos(theta) * r]);
    }
    return out;
  }, [radius, thetaLength]);
  return (
    <group>
      {dollops.map(([x, z], i) => (
        <group key={`dollop-${i}`} position={[x, topY + 0.08, z]}>
          <mesh scale={[1, 0.72, 1]}>
            <sphereGeometry args={[0.19, 12, 10]} />
            <meshStandardMaterial color={cream} roughness={0.35} />
          </mesh>
          <mesh position={[0, 0.13, 0]}>
            <sphereGeometry args={[0.1, 10, 8]} />
            <meshStandardMaterial color={cream} roughness={0.35} />
          </mesh>
        </group>
      ))}
      {showCherry ? (
        <group position={[0, topY, 0]}>
          <mesh position={[0, 0.26, 0]}>
            <sphereGeometry args={[0.28, 16, 14]} />
            <meshStandardMaterial
              color={cherryColor}
              emissive={cherryColor}
              emissiveIntensity={0.25}
              roughness={0.2}
            />
          </mesh>
          <mesh position={[0, 0.62, 0]} rotation={[0, 0, 0.28]}>
            <cylinderGeometry args={[0.025, 0.035, 0.4, 6]} />
            <meshStandardMaterial color="#6b4423" roughness={0.8} />
          </mesh>
        </group>
      ) : null}
    </group>
  );
}

function LayerSlab({ item, yOffset, theme, showCutaway, index = 0, total = 1, isTop = false }) {
  const thickness = Math.max(0.2, item.thickness ?? 1);
  const radius = layercakeSlabRadius(item);
  const components = layercakeComponentPositions(radius, item.components ?? []);
  const thetaLength = showCutaway ? CUTAWAY_THETA : Math.PI * 2;
  const tiltRad = ((item.tilt ?? 0) * Math.PI) / 180;
  const cracks = typeof item.cracks === 'number' ? item.cracks : 0;
  const bodyColor = useMemo(() => layerSlabShade(theme, index, total), [theme, index, total]);
  // Lighter "cream filling" bands between layers, and a lighter cross-section
  // for the cutaway slice so it looks like the inside of the cake.
  const bevelColor = useMemo(
    () => shiftColor(bodyColor, { lightness: 0.16, satScale: 0.82 }),
    [bodyColor]
  );
  const cutColor = useMemo(
    () => shiftColor(bodyColor, { lightness: 0.1, satScale: 0.88 }),
    [bodyColor]
  );
  // Matches CakeTopping's cream so the top layer's drips read as the same glaze.
  const creamColor = useMemo(
    () => shiftColor(bodyColor, { lightness: 0.24, satScale: 0.6 }),
    [bodyColor]
  );
  const rimColor = theme.slabTrimColor ?? theme.slabColor;
  const bevelThickness = Math.min(0.08, thickness * 0.18);
  const bodyThickness = Math.max(0.05, thickness - bevelThickness * 2);
  const slabCenterY = yOffset + thickness / 2;
  const slabSide = showCutaway ? THREE.DoubleSide : THREE.FrontSide;

  return (
    <group>
      {/* Tilt pivots about the slab's own centre, so the stack stays vertically
          aligned (a leaning layer, not a leaning tower). */}
      <group position={[0, slabCenterY, 0]} rotation={[0, 0, tiltRad]}>
        <group position={[0, -slabCenterY, 0]}>
          <mesh position={[0, yOffset + bevelThickness / 2, 0]}>
            <cylinderGeometry
              args={[radius * 0.96, radius * 0.98, bevelThickness, 48, 1, false, 0, thetaLength]}
            />
            <meshStandardMaterial
              color={bevelColor}
              roughness={0.4}
              metalness={0}
              side={slabSide}
            />
          </mesh>
          <mesh position={[0, yOffset + bevelThickness + bodyThickness / 2, 0]}>
            <cylinderGeometry
              args={[radius, radius, bodyThickness, 48, 1, false, 0, thetaLength]}
            />
            <meshStandardMaterial
              color={bodyColor}
              emissive={bodyColor}
              emissiveIntensity={0.05}
              roughness={0.45}
              metalness={0}
              side={slabSide}
            />
          </mesh>
          <mesh position={[0, yOffset + thickness - bevelThickness / 2, 0]}>
            <cylinderGeometry
              args={[radius * 0.98, radius * 0.96, bevelThickness, 48, 1, false, 0, thetaLength]}
            />
            <meshStandardMaterial
              color={bevelColor}
              roughness={0.4}
              metalness={0}
              side={slabSide}
            />
          </mesh>
          <mesh position={[0, yOffset + thickness + 0.005, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[radius * 0.99, 0.045, 10, 64, thetaLength]} />
            <meshStandardMaterial
              color={rimColor}
              emissive={rimColor}
              emissiveIntensity={0.3}
              roughness={0.28}
            />
          </mesh>
          {showCutaway ? (
            <group position={[0, slabCenterY, 0]}>
              <CutawayFaces
                radius={radius}
                thickness={thickness}
                color={cutColor}
                thetaLength={thetaLength}
              />
            </group>
          ) : null}
          <SlabDecorations
            idSeed={item.id}
            radius={radius}
            thickness={thickness}
            yOffset={yOffset}
            slabCenterY={slabCenterY}
            cracks={cracks}
            theme={theme}
          />
          {isTop ? (
            <>
              <CakeTopping
                radius={radius}
                topY={yOffset + thickness}
                thetaLength={thetaLength}
                bodyColor={bodyColor}
                theme={theme}
                showCherry={!item.glyph}
              />
              {/* Same cream as the topping dollops so the drips read as one glaze. */}
              <IcingDrips
                radius={radius}
                topY={yOffset + thickness}
                thetaLength={thetaLength}
                color={creamColor}
                idSeed={item.id}
              />
              <CakeSprinkles
                radius={radius}
                topY={yOffset + thickness}
                thetaLength={thetaLength}
                palette={theme.clusterPalette}
                idSeed={item.id}
              />
            </>
          ) : null}
          {item.glyph ? (
            <group
              position={[0, yOffset + thickness + 0.4, 0]}
              scale={Math.max(0.7, Math.min(1.4, thickness * 0.9))}
            >
              <Glyph kind={item.glyph} theme={theme} />
            </group>
          ) : null}
          {components.map((chip) => (
            <ComponentChip
              key={`${item.id}-${chip.label}`}
              label={chip.label}
              position={chip.position}
              yBase={yOffset + thickness / 2}
              theme={theme}
            />
          ))}
        </group>
      </group>
      <CameraFacingLabel
        centerY={slabCenterY}
        radius={radius}
        text={item.label}
        fontSize={Math.max(0.55, Math.min(0.95, thickness * 0.55))}
        color={theme.labelColor}
        outlineColor={theme.labelOutline}
      />
    </group>
  );
}

/**
 * City sky — calm vertical gradient behind the skyline so the floating labels
 * read against it instead of fighting the lit windows and bloom (see
 * GradientSkySphere for why it renders outside <Bounds>).
 */
function CitySky({ theme }) {
  return (
    <GradientSkySphere
      topColor={theme.skyTopColor ?? theme.background ?? '#0b1020'}
      horizonColor={theme.skyHorizonColor ?? theme.background ?? '#1b2436'}
    />
  );
}

/**
 * Circular foundation the city stands on, sized to the layout footprint and
 * centred at the origin (where the layout is recentred). A dark base disc, a
 * slightly lifted + lighter plinth, a bright accent rim at the plinth edge, and
 * one faint concentric ring — so the buildings read as standing on a deliberate
 * platform rather than drifting on an open floor.
 */
function CityFooting({ theme, radius }) {
  const baseColor = theme.groundColor ?? '#1a1a2e';
  const plinthColor = useMemo(
    () => `#${new THREE.Color(baseColor).lerp(new THREE.Color('#ffffff'), 0.1).getHexString()}`,
    [baseColor]
  );
  const rimColor = theme.binaryGlowColor ?? theme.starColor ?? theme.districtGridColor ?? '#94a3b8';
  const gridColor = theme.districtGridColor ?? theme.labelColor ?? '#cbd5e1';
  const plinthR = radius * 0.94;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, 0]}>
        <circleGeometry args={[radius, 96]} />
        <meshStandardMaterial color={baseColor} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]}>
        <circleGeometry args={[plinthR, 96]} />
        <meshStandardMaterial color={plinthColor} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <ringGeometry args={[Math.max(0.1, plinthR - 0.22), plinthR, 96]} />
        <meshBasicMaterial color={rimColor} transparent opacity={0.4} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <ringGeometry args={[plinthR * 0.58, plinthR * 0.58 + 0.08, 96]} />
        <meshBasicMaterial color={gridColor} transparent opacity={0.14} />
      </mesh>
    </group>
  );
}

function CityScene({ dsl, theme }) {
  const layout = useMemo(() => cityDistrictLayout(dsl.items), [dsl.items]);
  const footingRadius = Math.max(6, (layout.bounds?.radius ?? 0) * 1.18 + 2.5);
  const heightThreshold = useMemo(() => {
    const heights = dsl.items.map((i) => i.height ?? 4).sort((a, b) => b - a);
    const topCount = Math.max(1, Math.ceil(heights.length * 0.2));
    return heights[topCount - 1] ?? 0;
  }, [dsl.items]);

  const anchors = useMemo(() => {
    const map = new Map();
    for (const item of dsl.items) {
      const pos = layout.positions.get(item.id);
      if (!pos) continue;
      const height = Math.max(0.5, item.height ?? 4);
      map.set(item.id, [pos[0], pos[1] + height, pos[2]]);
    }
    return map;
  }, [dsl.items, layout.positions]);

  return (
    <group>
      {layout.districts.map((district, idx) => (
        <DistrictPatch key={district.name} district={district} theme={theme} index={idx} />
      ))}
      {dsl.items.map((item) => {
        const position = layout.positions.get(item.id);
        if (!position) return null;
        const height = item.height ?? 4;
        const accentGlow = height >= heightThreshold ? 1 : 0;
        return (
          <HoverableItem key={item.id} item={item} metaphor="city">
            <CityBuilding item={item} theme={theme} position={position} accentGlow={accentGlow} />
          </HoverableItem>
        );
      })}
      <CityFooting theme={theme} radius={footingRadius} />
      <CityTraffic radius={footingRadius} theme={theme} />
      <MetaphorGroundShadow theme={theme} scale={footingRadius * 2.1} />
      <MetaphorLinks links={dsl.links} anchors={anchors} theme={theme} />
    </group>
  );
}

function LayercakeScene({ dsl, theme }) {
  const { yOffsets } = useMemo(() => layercakeStackLayout(dsl.items), [dsl.items]);
  const showCutaway = dsl.items.length > 3;

  const stackHeight = useMemo(() => {
    let top = 0;
    for (const item of dsl.items) {
      const y = yOffsets.get(item.id) ?? 0;
      top = Math.max(top, y + Math.max(0.2, item.thickness ?? 1));
    }
    return top;
  }, [dsl.items, yOffsets]);

  const anchors = useMemo(() => {
    const map = new Map();
    for (const item of dsl.items) {
      const y = yOffsets.get(item.id) ?? 0;
      const thickness = Math.max(0.2, item.thickness ?? 1);
      map.set(item.id, [0, y + thickness / 2, 0]);
    }
    return map;
  }, [dsl.items, yOffsets]);

  const maxRadius = useMemo(
    () => dsl.items.reduce((max, item) => Math.max(max, layercakeSlabRadius(item)), 4),
    [dsl.items]
  );

  return (
    <group>
      <CakeStand radius={maxRadius + 1.1} theme={theme} />
      {/* Soft spotlight pool under the stand + celebratory drifting sparkles. */}
      <FloorGlowDisc
        radius={maxRadius + 3}
        color={theme.slabTrimColor ?? theme.slabColor}
        opacity={0.16}
        y={-1.19}
      />
      <RisingSparkles
        radius={maxRadius + 1.6}
        height={stackHeight}
        palette={theme.clusterPalette}
      />
      {dsl.items.map((item, index) => {
        const yOffset = yOffsets.get(item.id) ?? 0;
        return (
          <HoverableItem key={item.id} item={item} metaphor="layercake">
            <LayerSlab
              item={item}
              theme={theme}
              yOffset={yOffset}
              showCutaway={showCutaway}
              index={index}
              total={dsl.items.length}
              isTop={index === dsl.items.length - 1}
            />
          </HoverableItem>
        );
      })}
      {/* Shadow plane sits just below the stand's foot (foot bottom is y=-1.2). */}
      <MetaphorGroundShadow theme={theme} y={-1.21} scale={(maxRadius + 3) * 2.6} />
      <MetaphorLinks links={dsl.links} anchors={anchors} theme={theme} />
    </group>
  );
}

function MetaphorScene({ dsl, theme }) {
  if (dsl.metaphor === 'city') return <CityScene dsl={dsl} theme={theme} />;
  if (dsl.metaphor === 'layercake') return <LayercakeScene dsl={dsl} theme={theme} />;
  if (dsl.metaphor === 'galaxy') return <GalaxyScene dsl={dsl} theme={theme} />;
  if (dsl.metaphor === 'tree') return <TreeScene dsl={dsl} theme={theme} />;
  if (dsl.metaphor === 'terrain') return <TerrainScene dsl={dsl} theme={theme} />;
  if (dsl.metaphor === 'orrery') return <OrreryScene dsl={dsl} theme={theme} />;
  if (dsl.metaphor === 'river') return <RiverScene dsl={dsl} theme={theme} />;
  return null;
}

/**
 * One-shot reveal: a brief auto-rotate that eases to rest the first time a scene
 * appears, then hands control back to the user. Skipped for reduced-motion and
 * streaming. Only toggles OrbitControls.autoRotate(Speed), so it never fights
 * Bounds or blocks dragging — a drag during the intro takes over immediately.
 */
function MetaphorIntro({ streamingPreview }) {
  const controls = useThree((state) => state.controls);
  const elapsedRef = useRef(0);
  const doneRef = useRef(false);
  const reducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  useFrame((_, delta) => {
    if (doneRef.current || !controls) return;
    if (streamingPreview || reducedMotion) {
      doneRef.current = true;
      return;
    }
    const DURATION = 1.4;
    elapsedRef.current += delta;
    const t = Math.min(1, elapsedRef.current / DURATION);
    const ease = (1 - t) * (1 - t);
    controls.autoRotate = true;
    controls.autoRotateSpeed = 3.2 * ease;
    if (t >= 1) {
      controls.autoRotate = false;
      doneRef.current = true;
    }
  });
  return null;
}

function resolveDslFromSource(diagramSource, streamingPreview) {
  const raw = (diagramSource ?? '').trim();
  if (!raw) return { dsl: null, renderError: '' };

  if (streamingPreview) {
    const partial = parsePartialMetaphorDsl(raw);
    const renderable = partial ? partialToRenderableMetaphorDsl(partial) : null;
    if (renderable) {
      const sanitized = sanitizeMetaphorDsl(JSON.stringify(renderable), {
        allowStructureRewrite: true
      });
      if (sanitized.dsl) return { dsl: sanitized.dsl, renderError: '' };
    }
    return { dsl: null, renderError: '' };
  }

  const sanitized = sanitizeMetaphorDsl(raw, { allowStructureRewrite: false });
  if (!sanitized.dsl) {
    return {
      dsl: null,
      renderError: 'Metaphor DSL did not parse. Edit the JSON or re-prompt.'
    };
  }
  return { dsl: sanitized.dsl, renderError: '' };
}

function MetaphorRendererImpl(
  {
    diagramSource,
    streamingPreview = false,
    changeHighlight = null,
    isFullscreen = false,
    onMetaphorKindChange = null,
    metaphorKindSwitchDisabled = false
  },
  ref
) {
  const containerRef = useRef(null);
  const lastSourceRef = useRef('');
  const lastGoodDslRef = useRef(null);
  const streamingFrameRef = useRef(0);
  const streamingTimeoutRef = useRef(0);
  const lastStreamingRenderRef = useRef(0);
  const [streamDsl, setStreamDsl] = useState(null);
  const hoverStoreRef = useRef(null);
  if (hoverStoreRef.current === null) hoverStoreRef.current = createMetaphorHoverStore();
  const hoverStore = hoverStoreRef.current;

  useImperativeHandle(ref, () => ({ getContainer: () => containerRef.current }), []);

  const finalResolved = useMemo(() => {
    if (streamingPreview) return { dsl: null, renderError: '' };
    return resolveDslFromSource(diagramSource, false);
  }, [diagramSource, streamingPreview]);

  useEffect(() => {
    if (!streamingPreview) {
      setStreamDsl(null);
      lastGoodDslRef.current = null;
      lastSourceRef.current = '';
      return undefined;
    }

    const raw = (diagramSource ?? '').trim();
    if (!raw || raw === lastSourceRef.current) return undefined;

    const renderPartial = () => {
      lastStreamingRenderRef.current = Date.now();
      const resolved = resolveDslFromSource(raw, true);
      if (resolved.dsl) {
        lastGoodDslRef.current = resolved.dsl;
        lastSourceRef.current = raw;
        setStreamDsl(resolved.dsl);
      }
    };

    cancelAnimationFrame(streamingFrameRef.current);
    clearTimeout(streamingTimeoutRef.current);
    const sinceLast = Date.now() - lastStreamingRenderRef.current;
    if (sinceLast >= STREAMING_RENDER_THROTTLE_MS) {
      streamingFrameRef.current = requestAnimationFrame(renderPartial);
    } else {
      streamingTimeoutRef.current = setTimeout(() => {
        streamingFrameRef.current = requestAnimationFrame(renderPartial);
      }, STREAMING_RENDER_THROTTLE_MS - sinceLast);
    }

    return () => {
      cancelAnimationFrame(streamingFrameRef.current);
      clearTimeout(streamingTimeoutRef.current);
    };
  }, [diagramSource, streamingPreview]);

  const dsl = streamingPreview ? (streamDsl ?? lastGoodDslRef.current) : finalResolved.dsl;
  const hasSource = Boolean(diagramSource?.trim());
  const renderError = !streamingPreview && hasSource && !dsl ? finalResolved.renderError : '';

  const themeId = dsl?.scene?.theme ?? 'whiteboard';
  const theme = resolveMetaphorThemePreset(themeId);
  const postfx = resolveMetaphorPostfx(theme);

  return (
    <div
      ref={containerRef}
      className={`metaphor-output${streamingPreview ? ' is-streaming-preview' : ''}`}
      style={{ position: 'absolute', inset: 0 }}
    >
      {renderError ? <p className="diagram-error">{renderError}</p> : null}
      {dsl ? (
        <Canvas camera={ORBIT_CAMERA} style={{ width: '100%', height: '100%' }}>
          <color attach="background" args={[theme.background]} />
          {/* Gentle depth fog gives the skyline an atmospheric horizon; kept
              far enough out that Bounds framing never greys the subject. */}
          {dsl.metaphor === 'city' ? (
            <fog attach="fog" args={[theme.skyHorizonColor ?? theme.background, 42, 150]} />
          ) : null}
          <ambientLight intensity={theme.ambientIntensity} />
          <hemisphereLight args={theme.hemisphere} />
          <directionalLight
            position={theme.directional.position}
            intensity={theme.directional.intensity}
          />
          {theme.environment ? <Environment preset={theme.environment} /> : null}
          {/* Layercake shares the city's calm gradient backdrop so the cake
              doesn't float against a flat void. */}
          {dsl.metaphor === 'city' || dsl.metaphor === 'layercake' ? (
            <CitySky theme={theme} />
          ) : null}
          {/* Orrery shares the galaxy's deep-space backdrop — same star-field
              vocabulary, different spatial story. */}
          {dsl.metaphor === 'galaxy' || dsl.metaphor === 'orrery' ? (
            <GalaxySky theme={theme} animated={!streamingPreview} />
          ) : null}
          {dsl.metaphor === 'tree' ? <TreeSky theme={theme} /> : null}
          {dsl.metaphor === 'river' ? <RiverSky theme={theme} /> : null}
          <MetaphorClockProvider enabled={!streamingPreview}>
            <MetaphorHoverContext.Provider value={streamingPreview ? null : hoverStore}>
              <MetaphorChangeHighlightProvider highlight={changeHighlight}>
                <Bounds fit clip observe margin={1.25}>
                  <Center disableY>
                    <MetaphorScene dsl={dsl} theme={theme} />
                  </Center>
                </Bounds>
              </MetaphorChangeHighlightProvider>
            </MetaphorHoverContext.Provider>
          </MetaphorClockProvider>
          <OrbitControls enableDamping makeDefault />
          <MetaphorIntro streamingPreview={streamingPreview} />
          {!streamingPreview && postfx.enabled ? <MetaphorEffects postfx={postfx} /> : null}
        </Canvas>
      ) : null}
      {dsl && !streamingPreview ? (
        <>
          {/* Title (top-left) + legend (bottom-left) collide with the app's logo
              and corner controls in the inline view, so surface them only in
              fullscreen — where that chrome isn't painted. */}
          {isFullscreen ? (
            <>
              <MetaphorKindSwitcher
                metaphor={dsl.metaphor}
                disabled={metaphorKindSwitchDisabled || !onMetaphorKindChange}
                onSelectKind={onMetaphorKindChange}
              />
              <MetaphorTitleOverlay scene={dsl.scene} />
              <MetaphorLegendOverlay metaphor={dsl.metaphor} legend={dsl.scene?.legend} />
            </>
          ) : null}
          <MetaphorHoverTooltip store={hoverStore} legend={dsl.scene?.legend} />
        </>
      ) : null}
    </div>
  );
}

const MetaphorRenderer = forwardRef(MetaphorRendererImpl);
export default MetaphorRenderer;
