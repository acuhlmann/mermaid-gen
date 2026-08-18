import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { HoverableItem, ItemLabel, MetaphorGroundShadow } from './MetaphorSceneChrome.jsx';
import { MetaphorAccents } from './MetaphorAccents.jsx';
import { useMetaphorClock } from './metaphorClock.js';
import { planFusedCompositeWorld } from './fusedCompositePlanner.js';
import { idHash2, samplePolyline, shiftColor } from './sceneUtils.js';
import { resolveDistrictColor } from '../../utils/metaphorThemePresets.js';
import { DaylightPollen, SoaringBirds } from './MetaphorSceneDecorations.jsx';
import {
  IslandPrimitive,
  PlatformPrimitive,
  PrimitiveBody,
  SemanticMotion,
  TopicGlyph,
  WorldGround
} from './fusedCompositePrimitives.jsx';

function PlannedNode({ entity, theme, emphasized, onActiveIdChange, lod, layerLabel }) {
  const labelY = entity.role === 'accent' ? entity.radius + 0.8 : entity.height + 0.9;
  const labelPosition = [
    entity.labelOffset?.[0] ?? 0,
    labelY + (entity.item.glyph ? 0.55 : 0),
    entity.labelOffset?.[2] ?? 0
  ];
  return (
    <group position={entity.position}>
      <HoverableItem
        item={entity.item}
        metaphor={entity.kind}
        layerLabel={layerLabel}
        onActiveIdChange={onActiveIdChange}
      >
        <PrimitiveBody entity={entity} theme={theme} emphasized={emphasized} lod={lod} />
        <TopicGlyph item={entity.item} theme={theme} position={[0, labelY - 0.3, 0]} scale={0.68} />
        <ItemLabel
          text={entity.item.label}
          position={labelPosition}
          fontSize={0.46}
          color={theme.labelColor}
          outlineColor={theme.labelOutline}
          importance={entity.height + entity.radius}
        />
      </HoverableItem>
    </group>
  );
}

function AffinityGroups({ groups, theme }) {
  return groups.map((group) => {
    const color = resolveDistrictColor(theme, group.colorIndex);
    const plaqueColor = shiftColor(color, { lightness: -0.06, satScale: 0.85 });
    return (
      <group key={group.id} position={group.center}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
          <circleGeometry args={[group.radius * 0.72, 48]} />
          <meshBasicMaterial color={color} transparent opacity={0.1} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
          <ringGeometry args={[group.radius * 0.72, group.radius, 48]} />
          <meshBasicMaterial color={color} transparent opacity={0.2} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, 0]}>
          <ringGeometry args={[group.radius, group.radius + 0.07, 48]} />
          <meshBasicMaterial color={theme.labelColor} transparent opacity={0.22} />
        </mesh>
        {group.display ? (
          <group position={[0, 0, group.radius * 0.86]}>
            <mesh position={[0, 0.16, 0]}>
              <boxGeometry args={[Math.min(group.radius * 1.25, 4.4), 0.12, 0.46]} />
              <meshStandardMaterial color={plaqueColor} roughness={0.62} metalness={0.18} />
            </mesh>
            <mesh position={[0, 0.23, 0.2]}>
              <boxGeometry args={[0.34, 0.08, 0.08]} />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={0.35}
                toneMapped={false}
              />
            </mesh>
            <ItemLabel
              text={group.display}
              position={[0, 0.62, 0]}
              fontSize={0.5}
              color={theme.labelColor}
              outlineColor={theme.labelOutline}
              pinned
            />
          </group>
        ) : null}
      </group>
    );
  });
}

function TreeConnectors({ connectors, theme, activeId }) {
  return connectors.map((connector) => {
    const related = activeId === connector.from || activeId === connector.to;
    const from = connector.fromAnchor;
    const to = connector.toAnchor;
    const mid = [
      (from[0] + to[0]) / 2,
      Math.max(from[1], to[1]) * 0.55 + 0.4,
      (from[2] + to[2]) / 2
    ];
    return (
      <Line
        key={connector.id}
        points={[from, mid, to]}
        color={theme.treeTrunkColor ?? '#7c4a1e'}
        lineWidth={related ? 2 : 1.2}
        transparent
        opacity={activeId ? (related ? 0.9 : 0.16) : 0.55}
      />
    );
  });
}

function FlowMotes({ curve, motion, color, count, moteSpeed }) {
  const ref = useRef(null);
  const { getTime, animated, intensity } = useMetaphorClock();
  const motes = useMemo(
    () =>
      Array.from({ length: count }, (_, index) => ({
        phase: idHash2(`fused-flow-${index}`, motion.phase),
        speed: moteSpeed * (0.85 + idHash2(`fused-flow-${index}`, 'speed') * 0.45)
      })),
    [count, moteSpeed, motion.phase]
  );
  useFrame(() => {
    if (!ref.current) return;
    const time = animated ? getTime() : 0;
    ref.current.children.forEach((child, index) => {
      const mote = motes[index];
      const progress = (mote.phase + time * mote.speed * (0.35 + intensity)) % 1;
      const point = curve.getPoint(progress);
      child.position.copy(point);
    });
  });
  return (
    <group ref={ref}>
      {motes.map((mote, index) => (
        <mesh key={index}>
          <sphereGeometry args={[0.11 + (index % 3) * 0.025, 8, 8]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function HazardFoam({ point, hazard, theme }) {
  const { getTime, animated, intensity } = useMetaphorClock();
  const ref = useRef(null);
  const flakes = useMemo(() => {
    const count = Math.round(3 + hazard * 5);
    return Array.from({ length: count }, (_, index) => ({
      phase: idHash2(`hazard-${index}`, point[0]),
      radius: 0.06 + idHash2(`hazard-r-${index}`, point[2]) * 0.08 * (0.5 + hazard),
      orbit: 0.18 + idHash2(`hazard-o-${index}`, point[1]) * 0.22
    }));
  }, [hazard, point]);
  useFrame(() => {
    if (!ref.current) return;
    const time = animated ? getTime() : 0;
    ref.current.children.forEach((child, index) => {
      const flake = flakes[index];
      const angle = flake.phase + time * (0.8 + intensity);
      child.position.set(
        Math.cos(angle) * flake.orbit,
        0.2 + Math.abs(Math.sin(angle * 1.4)) * 0.18 * hazard,
        Math.sin(angle) * flake.orbit
      );
    });
  });
  return (
    <group ref={ref} position={point}>
      {flakes.map((flake, index) => (
        <mesh key={index}>
          <sphereGeometry args={[flake.radius, 6, 6]} />
          <meshBasicMaterial color={theme.labelColor ?? '#e0f2fe'} transparent opacity={0.7} />
        </mesh>
      ))}
    </group>
  );
}

function PathStationMarker({ pathKind, hazard, emphasized, theme }) {
  const isCrossing = pathKind === 'bridge';
  const warn = hazard > 0.35;
  const color = warn
    ? (theme.gardenRiskColor ?? '#f97316')
    : isCrossing
      ? (theme.bridgeDeckColor ?? '#a1724f')
      : (theme.slabTrimColor ?? '#fbbf24');
  if (isCrossing) {
    return (
      <group>
        <mesh position={[0, 0.7, 0]}>
          <boxGeometry args={[0.28, 1.4, 0.28]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={emphasized ? 0.4 : 0.08 + hazard * 0.2}
            roughness={0.55}
            metalness={0.18}
          />
        </mesh>
        <mesh position={[0, 1.45, 0]}>
          <boxGeometry args={[0.7, 0.12, 0.22]} />
          <meshStandardMaterial
            color={theme.bridgeCableColor ?? '#64748b'}
            roughness={0.4}
            metalness={0.4}
          />
        </mesh>
      </group>
    );
  }
  return (
    <mesh position={[0, 0.35, 0]}>
      <cylinderGeometry args={[0.3, 0.42, 0.7, 10]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={emphasized ? 0.5 : 0.16 + hazard * 0.25}
      />
    </mesh>
  );
}

function pathStationMetaphor(kind) {
  if (kind === 'subway') return 'subway';
  if (kind === 'bridge') return 'bridge';
  return 'river';
}

function FusedPath({ path, theme, activeId, onActiveIdChange, lod, layerLabel }) {
  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3(
        path.points.map((point) => new THREE.Vector3(point[0], point[1], point[2])),
        false,
        'catmullrom',
        0.45
      ),
    [path.points]
  );
  const isCrossing = path.kind === 'bridge';
  const color = isCrossing
    ? (theme.bridgeDeckColor ?? '#a1724f')
    : (theme.waterColor ?? theme.binaryGlowColor ?? '#38bdf8');
  const moteCount = lod === 'low' ? 4 : lod === 'medium' ? 6 : 8;
  return (
    <group>
      <mesh scale={isCrossing ? [1, 0.45, 1] : [1, 1, 1]}>
        <tubeGeometry args={[curve, 72, isCrossing ? path.width * 1.7 : path.width, 8, false]} />
        <meshStandardMaterial
          color={color}
          emissive={isCrossing ? '#000000' : (theme.riverDeepColor ?? color)}
          emissiveIntensity={isCrossing ? 0 : 0.16 + (path.hazard ?? 0) * 0.12}
          roughness={isCrossing ? 0.82 : 0.24}
          metalness={isCrossing ? 0.05 : 0.14}
        />
      </mesh>
      {isCrossing ? null : (
        <FlowMotes
          curve={curve}
          motion={path.motion}
          color="#e0f2fe"
          count={moteCount}
          moteSpeed={path.moteSpeed ?? 0.05}
        />
      )}
      {path.stations.map((station) => {
        const emphasized = activeId === station.id;
        const hazard = station.presentation?.hazard ?? 0;
        return (
          <group key={station.id} position={station.point}>
            <HoverableItem
              item={station.item}
              metaphor={pathStationMetaphor(path.kind)}
              layerLabel={layerLabel}
              onActiveIdChange={onActiveIdChange}
            >
              <SemanticMotion motion={station.motion} emphasized={emphasized}>
                <PathStationMarker
                  pathKind={path.kind}
                  hazard={hazard}
                  emphasized={emphasized}
                  theme={theme}
                />
              </SemanticMotion>
              <TopicGlyph item={station.item} theme={theme} position={[0, 1.15, 0]} scale={0.6} />
              <ItemLabel
                text={station.item.label}
                position={[
                  station.labelOffset?.[0] ?? 0,
                  station.item.glyph ? 2 : 1.35,
                  station.labelOffset?.[2] ?? 0
                ]}
                fontSize={0.41}
                color={theme.labelColor}
                outlineColor={theme.labelOutline}
              />
            </HoverableItem>
          </group>
        );
      })}
      {lod !== 'low'
        ? path.stations
            .filter((station) => (station.presentation?.hazard ?? 0) > 0.2)
            .map((station) => (
              <HazardFoam
                key={`foam-${station.id}`}
                point={station.point}
                hazard={station.presentation.hazard}
                theme={theme}
              />
            ))
        : null}
    </group>
  );
}

function FusedLinkPulse({ points, seed, color }) {
  const ref = useRef(null);
  const { getTime, animated, intensity } = useMetaphorClock();
  useFrame(() => {
    if (!ref.current) return;
    const progress = (seed + (animated ? getTime() * 0.12 * (0.35 + intensity) : 0)) % 1;
    ref.current.position.set(...samplePolyline(points, progress));
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.13, 9, 9]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  );
}

function FusedLinks({ links, theme, activeId, lod }) {
  return links.map((link, index) => {
    const related = activeId === link.from || activeId === link.to;
    const from = link.fromAnchor;
    const to = link.toAnchor;
    const distance = Math.hypot(to[0] - from[0], to[2] - from[2]);
    const mid = [
      (from[0] + to[0]) / 2,
      Math.max(from[1], to[1]) + 0.8 + distance * 0.13,
      (from[2] + to[2]) / 2
    ];
    const points = [from, mid, to];
    const color =
      link.kind === 'ownership'
        ? (theme.treeAccentColor ?? '#f59e0b')
        : (theme.binaryGlowColor ?? theme.linkColor ?? '#60a5fa');
    const showPulse = lod !== 'low' && (link.kind === 'flow' || !link.kind);
    return (
      <group key={`${link.from}-${link.to}-${index}`}>
        <Line
          points={points}
          color={color}
          lineWidth={related ? 2.2 : 1}
          transparent
          opacity={activeId ? (related ? 0.96 : 0.18) : 0.66}
        />
        {showPulse ? (
          <FusedLinkPulse
            points={points}
            seed={idHash2(`${link.from}-${link.to}`, 'fused-link')}
            color={color}
          />
        ) : null}
        {link.label ? (
          <ItemLabel
            text={link.label}
            position={[mid[0], mid[1] + 0.35, mid[2]]}
            fontSize={0.34}
            color={theme.labelColor}
            outlineColor={theme.labelOutline}
          />
        ) : null}
      </group>
    );
  });
}

export function FusedCompositeScene({ dsl, theme }) {
  const plan = useMemo(() => planFusedCompositeWorld(dsl), [dsl]);
  const [activeId, setActiveId] = useState(null);
  const accentItems = useMemo(
    () => (Array.isArray(dsl.layers) ? dsl.layers : []).flatMap((layer) => layer.items ?? []),
    [dsl.layers]
  );
  const layerLabels = useMemo(() => {
    const map = new Map();
    for (const layer of Array.isArray(dsl.layers) ? dsl.layers : []) {
      if (!layer?.id) continue;
      const label =
        typeof layer.label === 'string' && layer.label.trim() ? layer.label.trim() : layer.as;
      map.set(layer.id, label);
    }
    return map;
  }, [dsl.layers]);
  const relatedIds = useMemo(() => {
    if (!activeId) return new Set();
    const ids = new Set([activeId]);
    for (const link of plan.links) {
      if (link.from === activeId) ids.add(link.to);
      if (link.to === activeId) ids.add(link.from);
    }
    for (const connector of plan.connectors ?? []) {
      if (connector.from === activeId) ids.add(connector.to);
      if (connector.to === activeId) ids.add(connector.from);
    }
    return ids;
  }, [activeId, plan.links, plan.connectors]);
  const hasIslands = plan.sites.some((site) => site.item);
  const lod = plan.lod ?? 'high';
  const oceanR = plan.groundRadius ?? plan.worldRadius;

  return (
    <group>
      <WorldGround plan={plan} theme={theme} hasIslands={hasIslands} />
      {lod !== 'low' ? <AffinityGroups groups={plan.groups ?? []} theme={theme} /> : null}
      {plan.sites.map((site) => (
        <group key={site.id} position={site.position}>
          {site.item ? (
            <HoverableItem
              item={site.item}
              metaphor="archipelago"
              layerLabel={layerLabels.get(site.layerId)}
              onActiveIdChange={setActiveId}
            >
              <IslandPrimitive
                entity={site}
                theme={theme}
                emphasized={relatedIds.has(site.item.id)}
                lod={lod}
              />
            </HoverableItem>
          ) : (
            <PlatformPrimitive entity={site} theme={theme} />
          )}
        </group>
      ))}
      {plan.nodes.map((node) => (
        <PlannedNode
          key={node.id}
          entity={node}
          theme={theme}
          emphasized={relatedIds.has(node.id)}
          onActiveIdChange={setActiveId}
          lod={lod}
          layerLabel={layerLabels.get(node.layerId)}
        />
      ))}
      {plan.paths.map((path) => (
        <FusedPath
          key={path.id}
          path={path}
          theme={theme}
          activeId={activeId}
          onActiveIdChange={setActiveId}
          lod={lod}
          layerLabel={layerLabels.get(path.layerId)}
        />
      ))}
      <TreeConnectors connectors={plan.connectors ?? []} theme={theme} activeId={activeId} />
      <FusedLinks links={plan.links} theme={theme} activeId={activeId} lod={lod} />
      {hasIslands && lod !== 'low' ? (
        <>
          <DaylightPollen
            radius={oceanR * 0.95}
            count={lod === 'medium' ? 10 : 16}
            idSeed="fused-pollen"
          />
          <SoaringBirds
            radius={oceanR * 0.95}
            height={6.2}
            count={3}
            color={theme.labelColor ?? '#1f2937'}
            idSeed="fused-birds"
          />
        </>
      ) : null}
      <MetaphorAccents items={accentItems} anchors={plan.anchors} theme={theme} />
      <MetaphorGroundShadow
        theme={theme}
        y={-0.31}
        scale={(plan.groundRadius ?? plan.worldRadius) * 2.3}
      />
    </group>
  );
}
