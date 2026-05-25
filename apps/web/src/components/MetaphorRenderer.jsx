import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Billboard, Bounds, Center, Text, Environment, Line } from '@react-three/drei';
import {
  parsePartialMetaphorDsl,
  partialToRenderableMetaphorDsl,
  sanitizeMetaphorDsl
} from '@archislop/shared';
import {
  resolveMetaphorThemePreset,
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

const STREAMING_RENDER_THROTTLE_MS = 90;

const ISOMETRIC_CAMERA = { position: [22, 22, 22], fov: 35 };
const ORBIT_CAMERA = { position: [18, 14, 18], fov: 45 };

const CUTAWAY_THETA = (330 / 360) * Math.PI * 2;

function truncateLabel(text, maxLen = 14) {
  if (!text || text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 1)}…`;
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

const LIGHTING_BOOST = { lit: 0.55, dim: 0.18, dark: 0 };
const CONDITION_TILT = { new: 0, aging: 0.06, crumbling: 0.16 };

function CityBuilding({ item, position, theme, accentGlow }) {
  const height = Math.max(0.5, item.height ?? 4);
  const footprint = Math.max(0.5, item.footprint ?? 2);
  const roofHeight = Math.max(0.15, height * 0.1);
  const accentEmissive = accentGlow ? theme.accentGlow * accentGlow : 0;
  const lightingBoost = LIGHTING_BOOST[item.lighting] ?? 0;
  const emissiveIntensity = accentEmissive + lightingBoost;
  const conditionTilt = CONDITION_TILT[item.condition] ?? 0;
  const wallOpacity = item.lighting === 'dark' ? 0.85 : 1;

  return (
    <group position={position}>
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
      <mesh
        position={[0, height + roofHeight / 2, 0]}
        rotation={[conditionTilt, 0, conditionTilt * 0.7]}
      >
        <boxGeometry args={[footprint * 0.92, roofHeight, footprint * 0.92]} />
        <meshStandardMaterial color={theme.buildingRoofColor ?? theme.buildingColor} />
      </mesh>
      <ItemLabel
        text={item.label}
        position={[0, height + roofHeight + 0.5, 0]}
        fontSize={Math.max(0.45, Math.min(0.95, footprint * 0.42))}
        color={theme.labelColor}
        outlineColor={theme.labelOutline}
      />
    </group>
  );
}

function DistrictPatch({ district, theme, index }) {
  const color = resolveDistrictColor(theme, index);
  return (
    <group position={[district.center[0], 0.01, district.center[2]]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={district.size} />
        <meshStandardMaterial color={color} transparent opacity={0.35} />
      </mesh>
      <ItemLabel
        text={district.name}
        position={[0, 0.2, 0]}
        fontSize={0.5}
        color={theme.labelColor}
        outlineColor={theme.labelOutline}
      />
    </group>
  );
}

function ComponentChip({ label, position, yBase, theme }) {
  return (
    <group position={[position[0], yBase + position[1] + 0.15, position[2]]}>
      <mesh>
        <boxGeometry args={[0.55, 0.18, 0.35]} />
        <meshStandardMaterial color={theme.componentChipColor ?? theme.slabColor} />
      </mesh>
      <ItemLabel
        text={truncateLabel(label, 10)}
        position={[0, 0.35, 0]}
        fontSize={0.28}
        color={theme.labelColor}
        outlineColor={theme.labelOutline}
      />
    </group>
  );
}

function CrackDecals({ radius, thickness, cracks, theme }) {
  if (!(cracks > 0)) return null;
  const count = Math.round(2 + cracks * 4);
  const decals = [];
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2 + cracks * 0.7;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const width = 0.05 + cracks * 0.08;
    const height = Math.max(0.1, thickness * (0.4 + cracks * 0.5));
    decals.push(
      <mesh
        key={`crack-${i}`}
        position={[x, 0, z]}
        rotation={[0, -angle + Math.PI / 2, 0]}
      >
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial color={theme.labelOutline ?? '#000'} opacity={0.55} transparent />
      </mesh>
    );
  }
  return <group>{decals}</group>;
}

function LayerSlab({ item, yOffset, theme, showCutaway }) {
  const thickness = Math.max(0.2, item.thickness ?? 1);
  const radius = layercakeSlabRadius(item);
  const components = layercakeComponentPositions(radius, item.components ?? []);
  const thetaLength = showCutaway ? CUTAWAY_THETA : Math.PI * 2;
  const tiltRad = ((item.tilt ?? 0) * Math.PI) / 180;
  const cracks = typeof item.cracks === 'number' ? item.cracks : 0;

  return (
    <group rotation={[0, 0, tiltRad]}>
      <mesh position={[0, yOffset + thickness / 2, 0]}>
        <cylinderGeometry args={[radius, radius, thickness, 32, 1, false, 0, thetaLength]} />
        <meshStandardMaterial color={theme.slabColor} />
      </mesh>
      {cracks > 0 ? (
        <group position={[0, yOffset + thickness / 2, 0]}>
          <CrackDecals radius={radius + 0.01} thickness={thickness} cracks={cracks} theme={theme} />
        </group>
      ) : null}
      <ItemLabel
        text={item.label}
        position={[radius + 0.6, yOffset + thickness / 2, 0]}
        fontSize={Math.max(0.55, Math.min(0.95, thickness * 0.55))}
        color={theme.labelColor}
        outlineColor={theme.labelOutline}
      />
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

function GalaxyStar({ item, position, theme, clusterIndex }) {
  const magnitude = Math.max(0.3, (item.magnitude ?? 5) * 0.15);
  const starColor = resolveClusterColor(theme, clusterIndex);
  const haloScale = 1 + magnitude * 0.35;

  return (
    <group position={position}>
      <mesh scale={haloScale}>
        <sphereGeometry args={[magnitude, 16, 16]} />
        <meshStandardMaterial
          emissive={starColor}
          emissiveIntensity={0.35 + magnitude * 0.12}
          color={starColor}
          transparent
          opacity={0.25}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[magnitude, 16, 16]} />
        <meshStandardMaterial
          emissive={starColor}
          emissiveIntensity={0.8}
          color={starColor}
        />
      </mesh>
      <ItemLabel
        text={item.label}
        position={[0, magnitude + 0.5, 0]}
        fontSize={0.45}
        color={theme.labelColor}
        outlineColor={theme.labelOutline}
      />
    </group>
  );
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

        return (
          <group key={`${link.from}-${link.to}-${idx}`}>
            <Line
              points={points}
              color={theme.linkColor ?? '#64748b'}
              lineWidth={1}
              transparent
              opacity={theme.linkOpacity ?? 0.75}
            />
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
          <CityBuilding
            key={item.id}
            item={item}
            theme={theme}
            position={position}
            accentGlow={accentGlow}
          />
        );
      })}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color={theme.groundColor} />
      </mesh>
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
          <LayerSlab
            key={item.id}
            item={item}
            theme={theme}
            yOffset={yOffset}
            showCutaway={showCutaway}
          />
        );
      })}
      <MetaphorLinks links={dsl.links} anchors={anchors} theme={theme} />
    </group>
  );
}

function NebulaCloud({ cloud, theme, index }) {
  const color = cloud.color ?? resolveNebulaColor(theme, index);
  const radius = Math.max(1, cloud.radius ?? 6);
  return (
    <mesh position={cloud.center}>
      <sphereGeometry args={[radius, 24, 24]} />
      <meshBasicMaterial color={color} transparent opacity={0.12} depthWrite={false} />
    </mesh>
  );
}

function BinaryConnector({ from, to, theme }) {
  return (
    <Line
      points={[from, to]}
      color={theme.binaryGlowColor ?? theme.starColor}
      lineWidth={2.5}
      transparent
      opacity={0.85}
    />
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

  return (
    <group>
      {nebula.map((cloud, idx) => (
        <NebulaCloud key={`nebula-${idx}`} cloud={cloud} theme={theme} index={idx} />
      ))}
      {dsl.items.map((item) => {
        const position = layout.positions.get(item.id);
        if (!position) return null;
        const clusterName =
          typeof item.cluster === 'string' && item.cluster.trim() ? item.cluster.trim() : 'main';
        const clusterIndex = clusterIndexByName.get(clusterName) ?? 0;
        return (
          <GalaxyStar
            key={item.id}
            item={item}
            theme={theme}
            position={position}
            clusterIndex={clusterIndex}
          />
        );
      })}
      {binaryPairs.map((pair) => (
        <BinaryConnector key={pair.key} from={pair.from} to={pair.to} theme={theme} />
      ))}
      <MetaphorLinks links={dsl.links} anchors={anchors} theme={theme} />
    </group>
  );
}

const Y_AXIS = new THREE.Vector3(0, 1, 0);

function branchRotation(from, to) {
  const dir = new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
  const length = dir.length();
  if (length < 0.0001) return { rotation: [0, 0, 0], length: 0.0001 };
  const quat = new THREE.Quaternion().setFromUnitVectors(Y_AXIS, dir.clone().normalize());
  const euler = new THREE.Euler().setFromQuaternion(quat);
  return { rotation: [euler.x, euler.y, euler.z], length };
}

function TreeBranchSegment({ from, to, thicknessTop, thicknessBottom, color }) {
  const mid = useMemo(
    () => [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2],
    [from, to]
  );
  const { rotation, length } = useMemo(() => branchRotation(from, to), [from, to]);
  return (
    <mesh position={mid} rotation={rotation}>
      <cylinderGeometry args={[thicknessTop, thicknessBottom, length, 10]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

function TreeLeafCluster({ position, theme }) {
  return (
    <group position={position}>
      <mesh>
        <icosahedronGeometry args={[0.7, 0]} />
        <meshStandardMaterial color={theme.treeLeafColor ?? '#4ade80'} />
      </mesh>
      <mesh position={[0.45, 0.1, 0.2]}>
        <icosahedronGeometry args={[0.45, 0]} />
        <meshStandardMaterial color={theme.treeLeafColor ?? '#4ade80'} />
      </mesh>
      <mesh position={[-0.4, -0.05, -0.25]}>
        <icosahedronGeometry args={[0.4, 0]} />
        <meshStandardMaterial color={theme.treeLeafColor ?? '#4ade80'} />
      </mesh>
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

  return (
    <group>
      {branches.map((seg) => (
        <TreeBranchSegment
          key={seg.key}
          from={seg.from}
          to={seg.to}
          thicknessTop={seg.thicknessTop}
          thicknessBottom={seg.thicknessBottom}
          color={seg.color}
        />
      ))}
      {dsl.items.map((item) => {
        const position = layout.positions.get(item.id);
        const info = layout.nodeInfo.get(item.id);
        if (!position || !info) return null;
        const labelPos = [position[0], position[1] + 1.1, position[2]];
        return (
          <group key={item.id}>
            {info.kind === 'leaf' ? (
              <TreeLeafCluster position={position} theme={theme} />
            ) : null}
            <ItemLabel
              text={item.label}
              position={labelPos}
              fontSize={info.kind === 'leaf' ? 0.42 : 0.55}
              color={theme.labelColor}
              outlineColor={theme.labelOutline}
            />
          </group>
        );
      })}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color={theme.groundColor} />
      </mesh>
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
    for (let i = 0; i < heightmap.vertices.length; i += 3) {
      const h = heightmap.vertices[i + 1];
      const [r, g, b] = heightColor(h, heightmap.bounds);
      colors[i] = r;
      colors[i + 1] = g;
      colors[i + 2] = b;
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

function TerrainPin({ position, label, elevation, theme }) {
  const pinHeight = 0.9;
  const labelHeight = pinHeight + 0.55;
  const accent = elevation > 0 ? '#ef4444' : '#3b82f6';
  return (
    <group position={position}>
      <mesh position={[0, pinHeight / 2, 0]}>
        <cylinderGeometry args={[0.05, 0.05, pinHeight, 6]} />
        <meshStandardMaterial color={theme.labelColor ?? '#0f172a'} />
      </mesh>
      <mesh position={[0, pinHeight + 0.18, 0]}>
        <sphereGeometry args={[0.22, 12, 12]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={0.6}
        />
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

  return (
    <group>
      <TerrainSurface heightmap={heightmap} />
      {dsl.items.map((item) => {
        const position = heightmap.itemPositions.get(item.id);
        if (!position) return null;
        return (
          <TerrainPin
            key={item.id}
            position={position}
            label={item.label}
            elevation={item.elevation ?? 3}
            theme={theme}
          />
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
  const dslCamera = dsl?.scene?.camera ?? 'orbit';
  const cameraMode = cameraModeProp ?? localCameraMode ?? dslCamera;
  const useOrbit = cameraMode !== 'isometric';
  const sceneTitle = dsl?.scene?.title?.trim() ?? '';

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
      {sceneTitle ? (
        <div className="metaphor-scene-title" role="doc-subtitle">
          {sceneTitle}
        </div>
      ) : null}
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
          <Bounds fit clip observe margin={1.25}>
            <Center disableY>
              <MetaphorScene dsl={dsl} theme={theme} />
            </Center>
          </Bounds>
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
        </Canvas>
      ) : null}
    </div>
  );
}

const MetaphorRenderer = forwardRef(MetaphorRendererImpl);
export default MetaphorRenderer;
