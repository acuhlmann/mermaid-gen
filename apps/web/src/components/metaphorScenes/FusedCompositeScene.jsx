import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import {
  HoverableItem,
  ItemLabel,
  LinkArrowhead,
  MetaphorGroundShadow
} from './MetaphorSceneChrome.jsx';
import { LINK_LABEL_TARGET_PX } from './metaphorScreenScale.js';
import { FRAME_IGNORE_DATA } from './sceneFraming.js';
import {
  LINK_CASING_OPACITY,
  arrowFromRoute,
  fusedLinkPresentation,
  linkInk,
  linkMetricsFor
} from './linkRoutes.js';
import { MetaphorAccents } from './MetaphorAccents.jsx';
import { useMetaphorClock } from './metaphorClock.js';
import { fusedLabelImportance, planFusedCompositeWorld } from './fusedCompositePlanner.js';
import { useMetaphorLayerFocusId } from '../metaphorLayerFocus.js';
import { idHash2, recedeTheme, samplePolyline, shiftColor } from './sceneUtils.js';
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

function fusedLayerLabelsFor(layers) {
  const map = new Map();
  for (const layer of Array.isArray(layers) ? layers : []) {
    if (!layer?.id) continue;
    const label =
      typeof layer.label === 'string' && layer.label.trim() ? layer.label.trim() : layer.as;
    map.set(layer.id, label);
  }
  return map;
}

function PlannedNode({ entity, theme, emphasized, onActiveIdChange, lod, layerLabel, muted }) {
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
        {/* A receded layer keeps its bodies and loses its names. Dimming the
            label instead would leave it competing for the same screen space in
            the declutter pass, which is the space the focused layer's own names
            need most. The body stays pickable either way. */}
        {muted ? null : (
          <>
            <TopicGlyph
              item={entity.item}
              theme={theme}
              position={[0, labelY - 0.3, 0]}
              scale={0.68}
            />
            <ItemLabel
              text={entity.item.label}
              position={labelPosition}
              fontSize={0.46}
              color={theme.labelColor}
              outlineColor={theme.labelOutline}
              // Ranked against its own layer, not against the other grammars'
              // world sizes — see `assignLabelRanks`.
              importance={fusedLabelImportance(entity.labelRank)}
              layerKey={entity.layerId}
            />
          </>
        )}
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
        {group.display && !group.namedByMember ? (
          <group position={[0, group.surfaceY ?? 0, group.radius * 0.86]}>
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
              role="group"
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

function TreeConnectors({ connectors, theme, mutedTheme, activeId, isLinkMuted }) {
  return connectors.map((connector) => {
    const related = activeId === connector.from || activeId === connector.to;
    const muted = isLinkMuted(connector);
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
        color={(muted ? mutedTheme : theme).treeTrunkColor ?? '#7c4a1e'}
        lineWidth={related ? 2 : 1.2}
        transparent
        opacity={muted ? 0.2 : activeId ? (related ? 0.9 : 0.16) : 0.55}
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

/**
 * Everything the scene needs to draw one layer in front of the others, derived
 * once per focus change.
 *
 * Kept out of the component because the alternative is four closures over the
 * same three variables inline in a render body that is already the densest in
 * the module — and because "which layer is this, and does that mute it" is a
 * question about the document, not about React.
 *
 * @param {object} dsl — the composite document
 * @param {string | null} focusedLayerId — the pressed layer, or null for all
 * @param {object} theme — the scene's own theme
 * @param {object} mutedTheme — the same theme receded into the horizon
 */
function resolveLayerFocus(dsl, focusedLayerId, theme, mutedTheme) {
  const layers = Array.isArray(dsl?.layers) ? dsl.layers : [];
  const layerOfItem = new Map();
  for (const layer of layers) {
    for (const item of layer?.items ?? []) {
      if (item?.id) layerOfItem.set(item.id, layer.id);
    }
  }
  const isMuted = (layerId) => Boolean(focusedLayerId) && layerId !== focusedLayerId;
  return {
    isMuted,
    themeFor: (layerId) => (isMuted(layerId) ? mutedTheme : theme),
    // A link that touches the focused layer survives: what a layer is wired to
    // is most of what reading that layer means, and a composite's cross-layer
    // links are the one thing only the fused view can show.
    isLinkMuted: (link) =>
      Boolean(focusedLayerId) &&
      layerOfItem.get(link.from) !== focusedLayerId &&
      layerOfItem.get(link.to) !== focusedLayerId,
    // The accent marker is depth-test-free and captioned — it is the loudest
    // annotation in the scene, so it belongs to the layer being read. Leaving a
    // glowing pin over a receded tower states the thesis about a layer the
    // viewer has just stepped away from.
    accentItems: (focusedLayerId
      ? layers.filter((layer) => layer?.id === focusedLayerId)
      : layers
    ).flatMap((layer) => layer.items ?? [])
  };
}

function pathStationMetaphor(kind) {
  if (kind === 'subway') return 'subway';
  if (kind === 'bridge') return 'bridge';
  return 'river';
}

function FusedPath({ path, theme, activeId, onActiveIdChange, lod, layerLabel, muted }) {
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
      {/* Motes are the loudest thing a receded layer owns — they are additive,
          animated, and unaffected by the theme substitution that quiets
          everything else, so a muted river would still be the first thing the
          eye lands on. */}
      {isCrossing || muted ? null : (
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
              {muted ? null : (
                <>
                  <TopicGlyph
                    item={station.item}
                    theme={theme}
                    position={[0, 1.15, 0]}
                    scale={0.6}
                  />
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
                    // A station carried no importance at all before this, so
                    // every path layer's names tied with the link captions at
                    // the bottom of the ranking and a crowded canvas dropped
                    // the whole journey. See `assignLabelRanks`.
                    importance={fusedLabelImportance(station.labelRank)}
                    layerKey={path.layerId}
                  />
                </>
              )}
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

/**
 * The fused world's cross-layer relations — what an island's service owes a
 * river stage, which is the one thing a composite says that no single-kind scene
 * can. They got the same treatment the base scenes' links did (`linkRoutes.js`:
 * a casing that carries its own contrast, plus an arrowhead, because `from`→`to`
 * is a claim and a hairline states neither half of it).
 *
 * The muted/dimmed states the base version has no equivalent of are decided in
 * `fusedLinkPresentation`; the reasoning lives with the rule.
 */
function FusedLinks({ links, theme, mutedTheme, activeId, lod, isLinkMuted }) {
  const metrics = linkMetricsFor(links.length);
  const casingColor = theme.labelOutline ?? '#ffffff';
  return links.map((link, index) => {
    const related = activeId === link.from || activeId === link.to;
    const muted = isLinkMuted(link);
    const { cased, emphasis, opacity } = fusedLinkPresentation({ related, muted, activeId });
    const linkTheme = muted ? mutedTheme : theme;
    const from = link.fromAnchor;
    const to = link.toAnchor;
    const distance = Math.hypot(to[0] - from[0], to[2] - from[2]);
    const mid = [
      (from[0] + to[0]) / 2,
      Math.max(from[1], to[1]) + 0.8 + distance * 0.13,
      (from[2] + to[2]) / 2
    ];
    const points = [from, mid, to];
    const rawColor =
      link.kind === 'ownership'
        ? (linkTheme.treeAccentColor ?? '#f59e0b')
        : (linkTheme.binaryGlowColor ?? linkTheme.linkColor ?? '#60a5fa');
    const color = muted ? rawColor : linkInk(rawColor, casingColor);
    const arrow = cased ? arrowFromRoute(points) : null;
    // The pulse is additive and animated, like the river's motes — a muted link
    // keeps its line and loses its traffic.
    const showPulse = lod !== 'low' && !muted && (link.kind === 'flow' || !link.kind);
    return (
      <group key={`${link.from}-${link.to}-${index}`} userData={FRAME_IGNORE_DATA}>
        {cased ? (
          <Line
            points={points}
            color={casingColor}
            lineWidth={metrics.casingPx * emphasis}
            transparent
            opacity={LINK_CASING_OPACITY}
            depthWrite={false}
            renderOrder={-1}
          />
        ) : null}
        <Line
          points={points}
          color={color}
          lineWidth={metrics.corePx * emphasis}
          transparent
          opacity={opacity}
        />
        {arrow ? (
          <LinkArrowhead
            position={arrow.position}
            direction={arrow.direction}
            color={color}
            casingColor={casingColor}
            opacity={opacity}
            targetPx={metrics.arrowPx * emphasis}
          />
        ) : null}
        {showPulse ? (
          <FusedLinkPulse
            points={points}
            seed={idHash2(`${link.from}-${link.to}`, 'fused-link')}
            color={rawColor}
          />
        ) : null}
        {link.label && !muted ? (
          <ItemLabel
            text={link.label}
            position={[mid[0], mid[1] + 0.35, mid[2]]}
            fontSize={0.34}
            role="link"
            targetPx={LINK_LABEL_TARGET_PX}
            color={theme.labelColor}
            outlineColor={theme.labelOutline}
          />
        ) : null}
      </group>
    );
  });
}

function FusedSite({ site, layerLabels, relatedIds, onActiveIdChange, lod, isMuted, themeFor }) {
  if (!site.item) {
    return <PlatformPrimitive entity={site} theme={themeFor(site.layerId)} />;
  }
  return (
    <HoverableItem
      item={site.item}
      metaphor="archipelago"
      layerLabel={layerLabels.get(site.layerId)}
      onActiveIdChange={onActiveIdChange}
    >
      <IslandPrimitive
        entity={site}
        theme={themeFor(site.layerId)}
        emphasized={relatedIds.has(site.item.id)}
        lod={lod}
        muted={isMuted(site.layerId)}
      />
    </HoverableItem>
  );
}

function FusedAmbience({ oceanR, lod, theme }) {
  return (
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
        hazeColor={theme.skyHorizonColor ?? theme.background ?? null}
        idSeed="fused-birds"
      />
    </>
  );
}

export function FusedCompositeScene({ dsl, theme }) {
  const plan = useMemo(() => planFusedCompositeWorld(dsl), [dsl]);
  const [activeId, setActiveId] = useState(null);
  // Subscribed rather than lifted into MetaphorRenderer: a layer press must
  // re-render this scene and nothing above it, the same reason hover and the
  // pick are external stores.
  const focusedLayerId = useMetaphorLayerFocusId();
  const mutedTheme = useMemo(() => recedeTheme(theme), [theme]);
  const focus = useMemo(
    () => resolveLayerFocus(dsl, focusedLayerId, theme, mutedTheme),
    [dsl, focusedLayerId, theme, mutedTheme]
  );
  const { isMuted, themeFor, isLinkMuted, accentItems } = focus;
  const layerLabels = useMemo(() => fusedLayerLabelsFor(dsl.layers), [dsl.layers]);
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
          <FusedSite
            site={site}
            layerLabels={layerLabels}
            relatedIds={relatedIds}
            onActiveIdChange={setActiveId}
            lod={lod}
            isMuted={isMuted}
            themeFor={themeFor}
          />
        </group>
      ))}
      {plan.nodes.map((node) => (
        <PlannedNode
          key={node.id}
          entity={node}
          theme={themeFor(node.layerId)}
          emphasized={relatedIds.has(node.id)}
          onActiveIdChange={setActiveId}
          lod={lod}
          layerLabel={layerLabels.get(node.layerId)}
          muted={isMuted(node.layerId)}
        />
      ))}
      {plan.paths.map((path) => (
        <FusedPath
          key={path.id}
          path={path}
          theme={themeFor(path.layerId)}
          activeId={activeId}
          onActiveIdChange={setActiveId}
          lod={lod}
          layerLabel={layerLabels.get(path.layerId)}
          muted={isMuted(path.layerId)}
        />
      ))}
      <TreeConnectors
        connectors={plan.connectors ?? []}
        theme={theme}
        mutedTheme={mutedTheme}
        activeId={activeId}
        isLinkMuted={isLinkMuted}
      />
      <FusedLinks
        links={plan.links}
        theme={theme}
        mutedTheme={mutedTheme}
        activeId={activeId}
        lod={lod}
        isLinkMuted={isLinkMuted}
      />
      {hasIslands && lod !== 'low' ? (
        <FusedAmbience oceanR={oceanR} lod={lod} theme={theme} />
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
