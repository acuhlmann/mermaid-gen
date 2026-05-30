import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  OrbitControls,
  Billboard,
  Bounds,
  Center,
  Text,
  Environment,
  Line,
  ContactShadows
} from '@react-three/drei';
import {
  parsePartialMetaphorDsl,
  partialToRenderableMetaphorDsl,
  sanitizeMetaphorDsl
} from '@archislop/shared';
import {
  resolveMetaphorThemePreset,
  resolveMetaphorPostfx,
  resolveDistrictColor,
  resolveClusterColor,
  resolveNebulaColor
} from '../utils/metaphorThemePresets.js';
import { cityDistrictLayout } from '../utils/metaphorLayouts/cityDistrictLayout.js';
import { galaxyClusterLayout } from '../utils/metaphorLayouts/galaxyClusterLayout.js';
import {
  layercakeComponentPositions,
  layercakeSlabRadius,
  layercakeStackLayout
} from '../utils/metaphorLayouts/layercakeComponentsLayout.js';
import { treeRadialLayout } from '../utils/metaphorLayouts/treeRadialLayout.js';
import { terrainHeightmap, heightColor } from '../utils/metaphorLayouts/terrainHeightmap.js';
import { Glyph } from './metaphorGlyphs/index.jsx';
import {
  MetaphorTitleOverlay,
  MetaphorLegendOverlay,
  MetaphorCameraToggle,
  MetaphorHoverTooltip
} from './MetaphorOverlays.jsx';
import { MetaphorEffects } from './MetaphorEffects.jsx';
import { MetaphorHoverContext, useMetaphorHover, createMetaphorHoverStore } from './metaphorHover.js';

const STREAMING_RENDER_THROTTLE_MS = 90;

const ISOMETRIC_CAMERA = { position: [22, 22, 22], fov: 35 };
const ORBIT_CAMERA = { position: [18, 14, 18], fov: 45 };

const CUTAWAY_THETA = (330 / 360) * Math.PI * 2;

function truncateLabel(text, maxLen = 14) {
  if (!text || text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 1)}…`;
}

function idHash(id) {
  const str = String(id ?? '');
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1_000_000) / 1_000_000;
}

function idHash2(id, salt) {
  return idHash(`${salt}::${id}`);
}

const MetaphorClockContext = createContext({ getTime: () => 0, animated: false });

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

function useMetaphorClock() {
  return useContext(MetaphorClockContext);
}

function ItemLabel({ text, position, fontSize = 0.55, color = '#0f172a', outlineColor = '#ffffff' }) {
  if (!text) return null;
  return (
    <Billboard position={position}>
      <Text
        fontSize={fontSize}
        color={color}
        anchorX="center"
        anchorY="middle"
        maxWidth={fontSize * 16}
        outlineWidth={fontSize * 0.08}
        outlineColor={outlineColor}
        outlineOpacity={0.95}
      >
        {text}
      </Text>
    </Billboard>
  );
}

/** Soft grounded contact shadow — used by the flat-ground scenes (city, tree). */
function MetaphorGroundShadow({ theme, y = 0.01, scale }) {
  const sfx = theme.postfx ?? {};
  return (
    <ContactShadows
      position={[0, y, 0]}
      scale={scale ?? sfx.shadowScale ?? 44}
      opacity={sfx.shadowOpacity ?? 0.35}
      blur={sfx.shadowBlur ?? 2.6}
      color={sfx.shadowColor ?? '#0a0f1e'}
      far={50}
      resolution={512}
    />
  );
}

/**
 * Wraps a per-item group with pointer handlers that drive the hover tooltip.
 * Writes only to the external hover store (no scene re-render) and stops event
 * propagation so it coexists with OrbitControls (drag still rotates the view).
 * No-ops when hover is disabled (store is null during streaming).
 */
function HoverableItem({ item, metaphor, children }) {
  const store = useMetaphorHover();
  const update = (event) => {
    if (!store) return;
    event.stopPropagation();
    store.set({ item, metaphor, x: event.clientX, y: event.clientY });
  };
  const handleOver = (event) => {
    if (!store) return;
    update(event);
    if (typeof document !== 'undefined') document.body.style.cursor = 'pointer';
  };
  const handleOut = (event) => {
    if (!store) return;
    event.stopPropagation();
    store.set(null);
    if (typeof document !== 'undefined') document.body.style.cursor = '';
  };
  return (
    <group onPointerOver={handleOver} onPointerMove={update} onPointerOut={handleOut}>
      {children}
    </group>
  );
}

const LIGHTING_BOOST = { lit: 0.55, dim: 0.18, dark: 0 };
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
  const baseEmissive = isDark ? 0.25 : 0.95;

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
      <group
        position={[0, height, 0]}
        rotation={[conditionTilt, 0, conditionTilt * 0.7]}
      >
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
      <group
        position={[0, height, 0]}
        rotation={[conditionTilt, 0, conditionTilt * 0.7]}
      >
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
      <group
        position={[0, height, 0]}
        rotation={[conditionTilt, 0, conditionTilt * 0.7]}
      >
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
  const accentEmissive = accentGlow ? theme.accentGlow * accentGlow : 0;
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
      {roofStyle !== 'spire' ? (
        <RooftopFixtures id={item.id} footprint={footprint} height={height} theme={theme} />
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
      segs.push([[x, 0.02, -halfH], [x, 0.02, halfH]]);
    }
    for (let z = -halfH; z <= halfH + 0.001; z += step) {
      segs.push([[-halfW, 0.02, z], [halfW, 0.02, z]]);
    }
    return segs;
  }, [w, h]);
  return (
    <group>
      {lines.map((pts, idx) => (
        <Line key={`grid-${idx}`} points={pts} color={color} lineWidth={0.8} transparent opacity={0.4} />
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
        <mesh
          key={`crack-${i}`}
          position={[w.x, 0, w.z]}
          rotation={[0, -w.angle + Math.PI / 2, 0]}
        >
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
        <Line key={`streak-${i}`} points={pts} color={color} lineWidth={1.2} transparent opacity={0.7} />
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
        <mesh
          key={`ridge-${i}`}
          position={[r.x, 0, r.z]}
          rotation={[0, -r.angle + Math.PI / 2, 0]}
        >
          <boxGeometry args={[0.04, thickness * 0.85, 0.04]} />
          <meshStandardMaterial color={color} transparent opacity={0.6} />
        </mesh>
      ))}
    </group>
  );
}

function LayerSlab({ item, yOffset, theme, showCutaway }) {
  const thickness = Math.max(0.2, item.thickness ?? 1);
  const radius = layercakeSlabRadius(item);
  const components = layercakeComponentPositions(radius, item.components ?? []);
  const thetaLength = showCutaway ? CUTAWAY_THETA : Math.PI * 2;
  const tiltRad = ((item.tilt ?? 0) * Math.PI) / 180;
  const cracks = typeof item.cracks === 'number' ? item.cracks : 0;
  const slabColor = theme.slabColor;
  const trimColor = theme.slabTrimColor ?? slabColor;
  const bevelThickness = Math.min(0.08, thickness * 0.18);
  const bodyThickness = Math.max(0.05, thickness - bevelThickness * 2);
  const showRidges = cracks > 0 && idHash(item.id) > 0.5;
  const slabCenterY = yOffset + thickness / 2;

  return (
    <group rotation={[0, 0, tiltRad]}>
      <mesh position={[0, yOffset + bevelThickness / 2, 0]}>
        <cylinderGeometry
          args={[radius * 0.96, radius * 0.98, bevelThickness, 32, 1, false, 0, thetaLength]}
        />
        <meshStandardMaterial color={trimColor} />
      </mesh>
      <mesh position={[0, yOffset + bevelThickness + bodyThickness / 2, 0]}>
        <cylinderGeometry args={[radius, radius, bodyThickness, 32, 1, false, 0, thetaLength]} />
        <meshStandardMaterial color={slabColor} />
      </mesh>
      <mesh position={[0, yOffset + thickness - bevelThickness / 2, 0]}>
        <cylinderGeometry
          args={[radius * 0.98, radius * 0.96, bevelThickness, 32, 1, false, 0, thetaLength]}
        />
        <meshStandardMaterial color={trimColor} />
      </mesh>
      <mesh position={[0, yOffset + thickness + 0.005, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius * 0.99, 0.04, 8, 48, thetaLength]} />
        <meshStandardMaterial color={trimColor} emissive={trimColor} emissiveIntensity={0.18} />
      </mesh>
      {cracks > 0 ? (
        <group position={[0, slabCenterY, 0]}>
          <CrackDecals
            radius={radius - 0.01}
            thickness={thickness}
            cracks={cracks}
            theme={theme}
            idSeed={item.id}
          />
        </group>
      ) : null}
      {cracks > 0.5 ? (
        <group position={[0, yOffset + thickness + 0.01, 0]}>
          <CrackStreaks radius={radius} cracks={cracks} theme={theme} idSeed={item.id} />
        </group>
      ) : null}
      {showRidges ? (
        <group position={[0, slabCenterY, 0]}>
          <SlabSideRidges radius={radius - 0.02} thickness={thickness} theme={theme} />
        </group>
      ) : null}
      <ItemLabel
        text={item.label}
        position={[radius + 0.6, slabCenterY, 0]}
        fontSize={Math.max(0.55, Math.min(0.95, thickness * 0.55))}
        color={theme.labelColor}
        outlineColor={theme.labelOutline}
      />
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
  );
}

function StarTwinkle({ children, id, baseIntensity, magnitude }) {
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

function DiffractionSpikes({ size, color }) {
  const length = Math.max(0.6, size * 4.5);
  const width = Math.max(0.05, size * 0.35);
  return (
    <Billboard>
      <mesh>
        <planeGeometry args={[length, width]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.55}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <planeGeometry args={[length, width]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.55}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </Billboard>
  );
}

function StarHaloBillboard({ size, color }) {
  return (
    <Billboard>
      <mesh>
        <planeGeometry args={[size * 5, size * 5]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.18}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </Billboard>
  );
}

function GalaxyStar({ item, position, theme, clusterIndex, showGlyph }) {
  const magnitude = Math.max(0.3, (item.magnitude ?? 5) * 0.15);
  const starColor = resolveClusterColor(theme, clusterIndex);
  const baseIntensity = 0.8 + magnitude * 0.12;

  return (
    <group position={position}>
      <StarHaloBillboard size={magnitude} color={starColor} />
      <DiffractionSpikes size={magnitude} color={starColor} />
      <StarTwinkle id={item.id} baseIntensity={baseIntensity} magnitude={magnitude}>
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

/** Sample a polyline (array of [x,y,z] points) at t in [0,1], piecewise-linear. */
function samplePolyline(points, t) {
  const segments = points.length - 1;
  const clamped = t <= 0 ? 0 : t >= 1 ? 0.999999 : t;
  const ft = clamped * segments;
  const i = Math.floor(ft);
  const f = ft - i;
  const a = points[i];
  const b = points[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

/** A glowing dot that travels from→to along a link, conveying flow direction. */
function LinkFlowPulse({ points, color, seed }) {
  const ref = useRef(null);
  const { getTime, animated } = useMetaphorClock();
  useFrame(() => {
    if (!ref.current) return;
    const t = animated ? (getTime() * 0.16 + seed) % 1 : seed;
    const p = samplePolyline(points, t);
    ref.current.position.set(p[0], p[1], p[2]);
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.13, 10, 10]} />
      <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.92} />
    </mesh>
  );
}

/** Map a link's semantic `kind` to its line colour, pulse colour, and whether a
 *  travelling flow pulse animates. Undefined kind keeps the default (line + pulse). */
function resolveLinkAppearance(kind, theme) {
  const baseColor = theme.linkColor ?? '#64748b';
  const glow = theme.binaryGlowColor ?? baseColor;
  if (kind === 'flow') return { lineColor: glow, pulseColor: glow, showPulse: true };
  if (kind === 'ownership') {
    const accent = theme.treeAccentColor ?? glow;
    return { lineColor: accent, pulseColor: accent, showPulse: false };
  }
  if (kind === 'dependency') return { lineColor: baseColor, pulseColor: glow, showPulse: false };
  return { lineColor: baseColor, pulseColor: glow, showPulse: true };
}

function MetaphorLinks({ links, anchors, theme }) {
  if (!links?.length) return null;

  return (
    <group>
      {links.map((link, idx) => {
        const from = anchors.get(link.from);
        const to = anchors.get(link.to);
        if (!from || !to) return null;

        const midY = Math.max(from[1], to[1]) + 1.5;
        const points = [from, [from[0], midY, from[2]], [to[0], midY, to[2]], to];
        const midpoint = [
          (from[0] + to[0]) / 2,
          midY + 0.3,
          (from[2] + to[2]) / 2
        ];

        const appearance = resolveLinkAppearance(link.kind, theme);
        return (
          <group key={`${link.from}-${link.to}-${idx}`}>
            <Line
              points={points}
              color={appearance.lineColor}
              lineWidth={1}
              transparent
              opacity={theme.linkOpacity ?? 0.75}
            />
            {appearance.showPulse ? (
              <LinkFlowPulse
                points={points}
                color={appearance.pulseColor}
                seed={idHash2(`${link.from}-${link.to}`, 'flow')}
              />
            ) : null}
            {link.label ? (
              <ItemLabel
                text={link.label}
                position={midpoint}
                fontSize={0.35}
                color={theme.labelColor}
                outlineColor={theme.labelOutline}
              />
            ) : null}
          </group>
        );
      })}
    </group>
  );
}

function CityScene({ dsl, theme }) {
  const layout = useMemo(() => cityDistrictLayout(dsl.items), [dsl.items]);
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
            <CityBuilding
              item={item}
              theme={theme}
              position={position}
              accentGlow={accentGlow}
            />
          </HoverableItem>
        );
      })}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color={theme.groundColor} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <ringGeometry args={[18, 24, 48]} />
        <meshStandardMaterial
          color={theme.districtGridColor ?? theme.groundColor}
          transparent
          opacity={0.18}
        />
      </mesh>
      <MetaphorGroundShadow theme={theme} />
      <MetaphorLinks links={dsl.links} anchors={anchors} theme={theme} />
    </group>
  );
}

function LayercakeScene({ dsl, theme }) {
  const { yOffsets } = useMemo(() => layercakeStackLayout(dsl.items), [dsl.items]);
  const showCutaway = dsl.items.length > 3;

  const anchors = useMemo(() => {
    const map = new Map();
    for (const item of dsl.items) {
      const y = yOffsets.get(item.id) ?? 0;
      const thickness = Math.max(0.2, item.thickness ?? 1);
      map.set(item.id, [0, y + thickness / 2, 0]);
    }
    return map;
  }, [dsl.items, yOffsets]);

  return (
    <group>
      {dsl.items.map((item) => {
        const yOffset = yOffsets.get(item.id) ?? 0;
        return (
          <HoverableItem key={item.id} item={item} metaphor="layercake">
            <LayerSlab item={item} theme={theme} yOffset={yOffset} showCutaway={showCutaway} />
          </HoverableItem>
        );
      })}
      <MetaphorLinks links={dsl.links} anchors={anchors} theme={theme} />
    </group>
  );
}

function NebulaCloud({ cloud, theme, index }) {
  const color = cloud.color ?? resolveNebulaColor(theme, index);
  const radius = Math.max(1, cloud.radius ?? 6);
  const idSeed = `nebula-${index}`;
  const layers = useMemo(() => {
    const offsets = [
      { scale: 1.0, opacity: 0.14, offset: [0, 0, 0] },
      {
        scale: 0.72,
        opacity: 0.18,
        offset: [
          (idHash2(idSeed, 'ox1') - 0.5) * radius * 0.4,
          (idHash2(idSeed, 'oy1') - 0.5) * radius * 0.3,
          (idHash2(idSeed, 'oz1') - 0.5) * radius * 0.4
        ]
      },
      {
        scale: 0.42,
        opacity: 0.24,
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

function SpiralArmDust({ cluster, theme }) {
  const motes = useMemo(() => {
    const seed = idHash(`spiral-${cluster.name ?? 'main'}`);
    const armCount = 2;
    const motesPerArm = 20;
    const out = [];
    for (let arm = 0; arm < armCount; arm += 1) {
      const armOffset = (arm / armCount) * Math.PI * 2;
      for (let i = 0; i < motesPerArm; i += 1) {
        const t = (i + 1) / motesPerArm;
        const radius = 3 + t * 14;
        const angle = armOffset + seed * Math.PI * 2 + t * Math.PI * 2.2;
        const jitterX = (idHash2(cluster.name ?? 'main', `jx${arm}${i}`) - 0.5) * 1.4;
        const jitterY = (idHash2(cluster.name ?? 'main', `jy${arm}${i}`) - 0.5) * 1.4;
        const jitterZ = (idHash2(cluster.name ?? 'main', `jz${arm}${i}`) - 0.5) * 1.4;
        out.push({
          position: [
            Math.cos(angle) * radius + jitterX,
            jitterY * 0.6,
            Math.sin(angle) * radius + jitterZ
          ],
          size: 0.5 + idHash2(cluster.name ?? 'main', `s${arm}${i}`) * 0.6
        });
      }
    }
    return out;
  }, [cluster.name]);
  const dustColor = theme.nebulaDustColor ?? resolveNebulaColor(theme, 0);
  return (
    <group>
      {motes.map((m, i) => (
        <Billboard key={`mote-${i}`} position={m.position}>
          <mesh>
            <planeGeometry args={[m.size, m.size]} />
            <meshBasicMaterial
              color={dustColor}
              transparent
              opacity={0.35}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </mesh>
        </Billboard>
      ))}
    </group>
  );
}

function GalaxyScene({ dsl, theme }) {
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

  const nebula = Array.isArray(dsl.scene?.nebula) ? dsl.scene.nebula : [];

  const magnitudeMedian = useMemo(() => {
    const mags = dsl.items.map((it) => it.magnitude ?? 5).sort((a, b) => a - b);
    if (!mags.length) return 0;
    const mid = Math.floor(mags.length / 2);
    return mags.length % 2 === 0 ? (mags[mid - 1] + mags[mid]) / 2 : mags[mid];
  }, [dsl.items]);

  const largestCluster = useMemo(() => {
    if (!layout.clusters?.length) return null;
    let best = null;
    for (const c of layout.clusters) {
      const size = c.size ?? c.count ?? c.items?.length ?? 0;
      if (!best || size > (best.size ?? best.count ?? best.items?.length ?? 0)) best = c;
    }
    return best;
  }, [layout.clusters]);

  return (
    <group>
      {nebula.map((cloud, idx) => (
        <NebulaCloud key={`nebula-${idx}`} cloud={cloud} theme={theme} index={idx} />
      ))}
      {largestCluster ? <SpiralArmDust cluster={largestCluster} theme={theme} /> : null}
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
              theme={theme}
              position={position}
              clusterIndex={clusterIndex}
              showGlyph={showGlyph}
            />
          </HoverableItem>
        );
      })}
      {binaryPairs.map((pair) => (
        <BinaryConnector key={pair.key} from={pair.from} to={pair.to} theme={theme} />
      ))}
      <MetaphorLinks links={dsl.links} anchors={anchors} theme={theme} />
    </group>
  );
}

function TreeBranchSegment({ id, from, to, thicknessTop, thicknessBottom, color }) {
  const geometry = useMemo(() => {
    const fromVec = new THREE.Vector3(from[0], from[1], from[2]);
    const toVec = new THREE.Vector3(to[0], to[1], to[2]);
    const length = fromVec.distanceTo(toVec);
    if (length < 0.0001) return null;
    const lift = 0.3 + 0.2 * idHash(id);
    const mid = fromVec.clone().add(toVec).multiplyScalar(0.5);
    mid.y += lift;
    const curve = new THREE.QuadraticBezierCurve3(fromVec, mid, toVec);
    const tubeRadius = (thicknessTop + thicknessBottom) / 2;
    return new THREE.TubeGeometry(curve, 8, tubeRadius, 6, false);
  }, [from, to, thicknessTop, thicknessBottom, id]);
  if (!geometry) return null;
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

function TreeLeafCluster({ position, theme, id, weight }) {
  const leafColor = theme.treeLeafColor ?? '#4ade80';
  const accentColor = theme.treeAccentColor ?? '#f43f5e';
  const templateSeed = idHash(id ?? 'leaf');
  const fruitSeed = idHash2(id ?? 'leaf', 'fruit');
  const scale = 0.8 + Math.min(weight ?? 3, 8) * 0.05;
  let blobs;
  if (templateSeed < 0.34) {
    blobs = [
      { pos: [0, 0, 0], r: 0.7 },
      { pos: [0.45, 0.1, 0.2], r: 0.45 },
      { pos: [-0.4, -0.05, -0.25], r: 0.4 }
    ];
  } else if (templateSeed < 0.67) {
    blobs = [{ pos: [0, 0, 0], r: 0.85 }];
  } else {
    blobs = [
      { pos: [0, 0.1, 0], r: 0.55 },
      { pos: [0.45, 0.05, 0.1], r: 0.42 },
      { pos: [-0.45, -0.05, -0.1], r: 0.42 },
      { pos: [0.1, 0.25, -0.4], r: 0.4 },
      { pos: [-0.05, -0.2, 0.45], r: 0.38 }
    ];
  }
  const fruits = useMemo(() => {
    if (fruitSeed < 0.8) return [];
    const out = [];
    const count = 2 + Math.floor(idHash2(id ?? 'leaf', 'fruit-count') * 2);
    for (let i = 0; i < count; i += 1) {
      out.push({
        pos: [
          (idHash2(id ?? 'leaf', `fx${i}`) - 0.5) * 1.1,
          (idHash2(id ?? 'leaf', `fy${i}`) - 0.5) * 0.7,
          (idHash2(id ?? 'leaf', `fz${i}`) - 0.5) * 1.1
        ]
      });
    }
    return out;
  }, [id, fruitSeed]);
  return (
    <group position={position} scale={scale}>
      {blobs.map((b, i) => (
        <mesh key={`leaf-${i}`} position={b.pos}>
          <icosahedronGeometry args={[b.r, 0]} />
          <meshStandardMaterial color={leafColor} />
        </mesh>
      ))}
      {fruits.map((f, i) => (
        <mesh key={`fruit-${i}`} position={f.pos}>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={0.25} />
        </mesh>
      ))}
    </group>
  );
}

function TreeScene({ dsl, theme }) {
  const layout = useMemo(() => treeRadialLayout(dsl.items), [dsl.items]);

  const anchors = useMemo(() => {
    const map = new Map();
    for (const item of dsl.items) {
      const pos = layout.positions.get(item.id);
      if (!pos) continue;
      map.set(item.id, [pos[0], pos[1] + 0.6, pos[2]]);
    }
    return map;
  }, [dsl.items, layout.positions]);

  const branches = useMemo(() => {
    const segments = [];
    for (const item of dsl.items) {
      const info = layout.nodeInfo.get(item.id);
      const position = layout.positions.get(item.id);
      if (!info || !position) continue;
      const parentId = info.parentId;
      let fromPosition;
      if (parentId === null) {
        fromPosition = [position[0], 0, position[2]];
      } else {
        fromPosition = layout.positions.get(parentId);
        if (!fromPosition) continue;
      }
      const thicknessBottom = 0.18 + Math.min(info.weight, 12) * 0.06;
      const thicknessTop = info.kind === 'leaf' ? thicknessBottom * 0.45 : thicknessBottom * 0.75;
      segments.push({
        key: item.id,
        from: fromPosition,
        to: position,
        thicknessTop,
        thicknessBottom,
        color:
          info.kind === 'trunk'
            ? theme.treeTrunkColor ?? '#8b5a2b'
            : theme.treeBranchColor ?? '#a47148'
      });
    }
    return segments;
  }, [dsl.items, layout, theme.treeTrunkColor, theme.treeBranchColor]);

  const trunkRoots = useMemo(() => {
    const out = [];
    for (const item of dsl.items) {
      const info = layout.nodeInfo.get(item.id);
      const position = layout.positions.get(item.id);
      if (!info || !position || info.parentId !== null) continue;
      const radius = 0.4 + Math.min(info.weight, 12) * 0.07;
      out.push({ id: item.id, position, radius });
    }
    return out;
  }, [dsl.items, layout]);

  const grassTufts = useMemo(() => {
    if (!trunkRoots.length) return [];
    const out = [];
    for (const root of trunkRoots) {
      const count = 6;
      for (let i = 0; i < count; i += 1) {
        const angle = idHash2(root.id, `gt-a${i}`) * Math.PI * 2;
        const dist = root.radius + 0.3 + idHash2(root.id, `gt-d${i}`) * 1.2;
        out.push({
          position: [
            root.position[0] + Math.cos(angle) * dist,
            0.05,
            root.position[2] + Math.sin(angle) * dist
          ]
        });
      }
    }
    return out;
  }, [trunkRoots]);

  return (
    <group>
      {branches.map((seg) => (
        <TreeBranchSegment
          key={seg.key}
          id={seg.key}
          from={seg.from}
          to={seg.to}
          thicknessTop={seg.thicknessTop}
          thicknessBottom={seg.thicknessBottom}
          color={seg.color}
        />
      ))}
      {trunkRoots.map((root) => (
        <mesh key={`flare-${root.id}`} position={[root.position[0], 0.04, root.position[2]]}>
          <cylinderGeometry args={[root.radius, root.radius * 0.55, 0.18, 12]} />
          <meshStandardMaterial color={theme.treeTrunkColor ?? '#8b5a2b'} />
        </mesh>
      ))}
      {grassTufts.map((tuft, i) => (
        <mesh key={`tuft-${i}`} position={tuft.position}>
          <coneGeometry args={[0.08, 0.22, 5]} />
          <meshStandardMaterial color={theme.treeLeafColor ?? '#4ade80'} />
        </mesh>
      ))}
      {dsl.items.map((item) => {
        const position = layout.positions.get(item.id);
        const info = layout.nodeInfo.get(item.id);
        if (!position || !info) return null;
        const labelPos = [position[0], position[1] + 1.1, position[2]];
        const glyphScale = info.kind === 'leaf' ? 0.55 + Math.min(info.weight, 8) * 0.04 : 0.75;
        const glyphPos =
          info.kind === 'leaf'
            ? [position[0], position[1] + 0.1, position[2]]
            : [position[0] + 0.7, position[1] + 1.1, position[2]];
        return (
          <HoverableItem key={item.id} item={item} metaphor="tree">
            <group>
              {info.kind === 'leaf' ? (
                <TreeLeafCluster
                  position={position}
                  theme={theme}
                  id={item.id}
                  weight={info.weight}
                />
              ) : null}
              {item.glyph ? (
                <group position={glyphPos} scale={glyphScale}>
                  <Glyph kind={item.glyph} theme={theme} />
                </group>
              ) : null}
              <ItemLabel
                text={item.label}
                position={labelPos}
                fontSize={info.kind === 'leaf' ? 0.42 : 0.55}
                color={theme.labelColor}
                outlineColor={theme.labelOutline}
              />
            </group>
          </HoverableItem>
        );
      })}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color={theme.groundColor} />
      </mesh>
      <MetaphorGroundShadow theme={theme} />
      <MetaphorLinks links={dsl.links} anchors={anchors} theme={theme} />
    </group>
  );
}

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
        const mix = Math.min(1, (h - snowThreshold) / snowSpan);
        colors[i] = r + (1 - r) * mix;
        colors[i + 1] = g + (1 - g) * mix;
        colors[i + 2] = b + (1 - b) * mix;
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
    matRef.current.opacity = 0.4 + 0.05 * Math.sin(t * 0.8);
  });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
      <planeGeometry args={[halfExtent * 2.2, halfExtent * 2.2]} />
      <meshStandardMaterial
        ref={matRef}
        color={theme.waterColor ?? '#7dd3fc'}
        transparent
        opacity={0.4}
        roughness={0.3}
        metalness={0.2}
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

function TerrainPin({ position, label, elevation, idSeed, theme, glyph }) {
  const pinHeight = 0.95;
  const labelHeight = pinHeight + 0.7;
  const accent = elevation > 0 ? '#ef4444' : '#3b82f6';
  const flagSway = (idHash(idSeed ?? label ?? '') - 0.5) * 0.15;
  return (
    <group position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[0.32, 18]} />
        <meshStandardMaterial color={theme.labelColor ?? '#0f172a'} transparent opacity={0.3} />
      </mesh>
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
        <mesh position={[0.22, pinHeight - 0.18, 0]} rotation={[0, flagSway, 0]}>
          <planeGeometry args={[0.42, 0.28]} />
          <meshStandardMaterial
            color={accent}
            emissive={accent}
            emissiveIntensity={0.45}
            side={THREE.DoubleSide}
          />
        </mesh>
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

function TerrainScene({ dsl, theme }) {
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

  return (
    <group>
      <TerrainSurface heightmap={heightmap} />
      {showWater ? <TerrainWaterPlane halfExtent={heightmap.halfExtent} theme={theme} /> : null}
      <TerrainContourRings heightmap={heightmap} theme={theme} />
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
  return null;
}

function CameraRig({ cameraMode }) {
  const { camera } = useThree();
  useEffect(() => {
    const preset = cameraMode === 'isometric' ? ISOMETRIC_CAMERA : ORBIT_CAMERA;
    camera.position.set(...preset.position);
    camera.fov = preset.fov;
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera, cameraMode]);
  return null;
}

const CINEMATIC_AUTO_ROTATE_SPEED = 0.45;

/**
 * One-shot cinematic reveal: a brief auto-rotate that eases to rest the first
 * time a scene appears. Skipped for cinematic mode (already auto-rotating),
 * reduced-motion, isometric (no controls), and streaming. Only toggles
 * OrbitControls.autoRotate(Speed), so it never fights Bounds or blocks dragging.
 */
function MetaphorIntro({ cameraMode, streamingPreview }) {
  const controls = useThree((state) => state.controls);
  const elapsedRef = useRef(0);
  const doneRef = useRef(false);
  const reducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  useFrame((_, delta) => {
    if (doneRef.current || !controls) return;
    if (streamingPreview || cameraMode === 'cinematic' || reducedMotion) {
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
  { diagramSource, streamingPreview = false, cameraMode: cameraModeProp = null },
  ref
) {
  const containerRef = useRef(null);
  const lastSourceRef = useRef('');
  const lastGoodDslRef = useRef(null);
  const streamingFrameRef = useRef(0);
  const streamingTimeoutRef = useRef(0);
  const lastStreamingRenderRef = useRef(0);
  const [streamDsl, setStreamDsl] = useState(null);
  const [localCameraMode, setLocalCameraMode] = useState(null);
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

  const dsl = streamingPreview ? streamDsl ?? lastGoodDslRef.current : finalResolved.dsl;
  const hasSource = Boolean(diagramSource?.trim());
  const renderError =
    !streamingPreview && hasSource && !dsl ? finalResolved.renderError : '';

  const themeId = dsl?.scene?.theme ?? 'whiteboard';
  const theme = resolveMetaphorThemePreset(themeId);
  const postfx = resolveMetaphorPostfx(theme);
  const dslCamera = dsl?.scene?.camera ?? 'orbit';
  const cameraMode = cameraModeProp ?? localCameraMode ?? dslCamera;
  const useOrbit = cameraMode !== 'isometric';

  useEffect(() => {
    if (cameraModeProp == null && dsl?.scene?.camera) {
      setLocalCameraMode(null);
    }
  }, [cameraModeProp, dsl?.scene?.camera]);

  return (
    <div
      ref={containerRef}
      className={`metaphor-output${streamingPreview ? ' is-streaming-preview' : ''}`}
      style={{ position: 'absolute', inset: 0 }}
    >
      {renderError ? <p className="diagram-error">{renderError}</p> : null}
      {dsl ? (
        <Canvas
          camera={useOrbit ? ORBIT_CAMERA : ISOMETRIC_CAMERA}
          style={{ width: '100%', height: '100%' }}
        >
          <color attach="background" args={[theme.background]} />
          <ambientLight intensity={theme.ambientIntensity} />
          <hemisphereLight args={theme.hemisphere} />
          <directionalLight
            position={theme.directional.position}
            intensity={theme.directional.intensity}
          />
          {theme.environment ? <Environment preset={theme.environment} /> : null}
          <CameraRig cameraMode={cameraMode} />
          <MetaphorClockProvider enabled={!streamingPreview}>
            <MetaphorHoverContext.Provider value={streamingPreview ? null : hoverStore}>
              <Bounds fit clip observe margin={1.25}>
                <Center disableY>
                  <MetaphorScene dsl={dsl} theme={theme} />
                </Center>
              </Bounds>
            </MetaphorHoverContext.Provider>
          </MetaphorClockProvider>
          {useOrbit ? (
            <OrbitControls
              enableDamping
              makeDefault
              autoRotate={cameraMode === 'cinematic'}
              autoRotateSpeed={CINEMATIC_AUTO_ROTATE_SPEED}
              enableRotate={cameraMode !== 'cinematic'}
              enableZoom={cameraMode !== 'cinematic'}
              enablePan={cameraMode !== 'cinematic'}
            />
          ) : null}
          <MetaphorIntro cameraMode={cameraMode} streamingPreview={streamingPreview} />
          {!streamingPreview && postfx.enabled ? <MetaphorEffects postfx={postfx} /> : null}
        </Canvas>
      ) : null}
      {dsl && !streamingPreview ? (
        <>
          <MetaphorTitleOverlay scene={dsl.scene} />
          <MetaphorLegendOverlay metaphor={dsl.metaphor} legend={dsl.scene?.legend} />
          <MetaphorCameraToggle value={cameraMode} onChange={setLocalCameraMode} />
          <MetaphorHoverTooltip store={hoverStore} legend={dsl.scene?.legend} />
        </>
      ) : null}
    </div>
  );
}

const MetaphorRenderer = forwardRef(MetaphorRendererImpl);
export default MetaphorRenderer;
