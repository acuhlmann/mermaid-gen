import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
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
  resolveClusterColor
} from '../utils/metaphorThemePresets.js';
import { cityDistrictLayout } from '../utils/metaphorLayouts/cityDistrictLayout.js';
import { galaxyClusterLayout } from '../utils/metaphorLayouts/galaxyClusterLayout.js';
import {
  layercakeComponentPositions,
  layercakeSlabRadius,
  layercakeStackLayout
} from '../utils/metaphorLayouts/layercakeComponentsLayout.js';

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

function CityBuilding({ item, position, theme, accentGlow }) {
  const height = Math.max(0.5, item.height ?? 4);
  const footprint = Math.max(0.5, item.footprint ?? 2);
  const roofHeight = Math.max(0.15, height * 0.1);
  const emissiveIntensity = accentGlow ? theme.accentGlow * accentGlow : 0;

  return (
    <group position={position}>
      <mesh position={[0, height / 2, 0]}>
        <boxGeometry args={[footprint, height, footprint]} />
        <meshStandardMaterial
          color={theme.buildingColor}
          emissive={theme.buildingColor}
          emissiveIntensity={emissiveIntensity}
        />
      </mesh>
      <mesh position={[0, height + roofHeight / 2, 0]}>
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

function LayerSlab({ item, yOffset, theme, showCutaway }) {
  const thickness = Math.max(0.2, item.thickness ?? 1);
  const radius = layercakeSlabRadius(item);
  const components = layercakeComponentPositions(radius, item.components ?? []);
  const thetaLength = showCutaway ? CUTAWAY_THETA : Math.PI * 2;

  return (
    <group>
      <mesh position={[0, yOffset + thickness / 2, 0]}>
        <cylinderGeometry args={[radius, radius, thickness, 32, 1, false, 0, thetaLength]} />
        <meshStandardMaterial color={theme.slabColor} />
      </mesh>
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

  return (
    <group>
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
      <MetaphorLinks links={dsl.links} anchors={anchors} theme={theme} />
    </group>
  );
}

function MetaphorScene({ dsl, theme }) {
  if (dsl.metaphor === 'city') return <CityScene dsl={dsl} theme={theme} />;
  if (dsl.metaphor === 'layercake') return <LayercakeScene dsl={dsl} theme={theme} />;
  if (dsl.metaphor === 'galaxy') return <GalaxyScene dsl={dsl} theme={theme} />;
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
          {useOrbit ? <OrbitControls enableDamping makeDefault /> : null}
        </Canvas>
      ) : null}
    </div>
  );
}

const MetaphorRenderer = forwardRef(MetaphorRendererImpl);
export default MetaphorRenderer;
