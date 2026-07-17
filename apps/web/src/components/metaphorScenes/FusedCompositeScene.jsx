import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard, Line } from '@react-three/drei';
import { Glyph } from '../metaphorGlyphs/index.jsx';
import {
  GlowSprite,
  HoverableItem,
  ItemLabel,
  MetaphorGroundShadow
} from './MetaphorSceneChrome.jsx';
import { useMetaphorClock } from './metaphorClock.js';
import {
  planFusedCompositeWorld,
  resolveCompositeMotionTransform
} from './fusedCompositePlanner.js';
import { idHash2, samplePolyline, shiftColor } from './sceneUtils.js';

function SemanticMotion({ motion, children, emphasized = false }) {
  const ref = useRef(null);
  const { getTime, animated, intensity } = useMetaphorClock();
  useFrame(() => {
    if (!ref.current) return;
    const transform = resolveCompositeMotionTransform(motion, getTime(), intensity, animated);
    ref.current.position.set(...transform.offset);
    ref.current.rotation.set(...transform.rotation);
    const emphasis = emphasized ? 1.1 : 1;
    ref.current.scale.setScalar(transform.scale * emphasis);
  });
  return <group ref={ref}>{children}</group>;
}

function TopicGlyph({ item, theme, position, scale = 0.7 }) {
  if (!item?.glyph) return null;
  return (
    <Billboard position={position}>
      <group scale={scale}>
        <Glyph kind={item.glyph} theme={theme} />
      </group>
    </Billboard>
  );
}

function IslandPrimitive({ entity, theme, emphasized }) {
  const land = theme.treeLeafColor ?? '#3d9a4a';
  const soil = theme.treeSoilColor ?? '#806443';
  return (
    <SemanticMotion motion={entity.motion} emphasized={emphasized}>
      <mesh position={[0, -0.05, 0]} scale={[1, 0.24, 1]}>
        <icosahedronGeometry args={[entity.radius, 1]} />
        <meshStandardMaterial color={soil} roughness={0.95} />
      </mesh>
      <mesh position={[0, entity.height * 0.18, 0]} scale={[1, 0.3, 1]}>
        <icosahedronGeometry args={[entity.radius * 0.84, 1]} />
        <meshStandardMaterial
          color={emphasized ? shiftColor(land, { lightness: 0.12 }) : land}
          emissive={land}
          emissiveIntensity={emphasized ? 0.18 : 0.03}
          roughness={0.86}
          flatShading
        />
      </mesh>
      {entity.item ? (
        <>
          <TopicGlyph item={entity.item} theme={theme} position={[0, entity.height + 0.45, 0]} />
          <ItemLabel
            text={entity.item.label}
            position={[0, entity.height + (entity.item.glyph ? 1.3 : 0.75), 0]}
            fontSize={0.52}
            color={theme.labelColor}
            outlineColor={theme.labelOutline}
          />
        </>
      ) : null}
    </SemanticMotion>
  );
}

function PlatformPrimitive({ entity, theme }) {
  const color = theme.groundColor ?? '#334155';
  return (
    <SemanticMotion motion={entity.motion}>
      <mesh position={[0, entity.height / 2 - 0.12, 0]}>
        <cylinderGeometry args={[entity.radius * 0.86, entity.radius, entity.height, 28]} />
        <meshStandardMaterial color={color} roughness={0.76} metalness={0.1} />
      </mesh>
      <mesh position={[0, entity.height - 0.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[entity.radius * 0.82, 0.08, 8, 36]} />
        <meshStandardMaterial
          color={theme.binaryGlowColor ?? theme.labelColor}
          emissive={theme.binaryGlowColor ?? theme.labelColor}
          emissiveIntensity={0.24}
        />
      </mesh>
    </SemanticMotion>
  );
}

function TowerPrimitive({ entity, theme, emphasized }) {
  const color = theme.buildingColor ?? '#64748b';
  const roof = theme.buildingRoofColor ?? theme.binaryGlowColor ?? '#94a3b8';
  return (
    <SemanticMotion motion={entity.motion} emphasized={emphasized}>
      <mesh position={[0, entity.height / 2, 0]}>
        <boxGeometry args={[entity.radius * 1.45, entity.height, entity.radius * 1.45]} />
        <meshStandardMaterial
          color={color}
          emissive={emphasized ? roof : color}
          emissiveIntensity={emphasized ? 0.32 : 0.04}
          roughness={0.5}
        />
      </mesh>
      <mesh position={[0, entity.height + 0.2, 0]}>
        <coneGeometry args={[entity.radius * 0.8, 0.7, 5]} />
        <meshStandardMaterial color={roof} roughness={0.45} />
      </mesh>
    </SemanticMotion>
  );
}

function TerracePrimitive({ entity, theme, emphasized }) {
  const color = theme.slabColor ?? '#f59e0b';
  const tiers = 3;
  return (
    <SemanticMotion motion={entity.motion} emphasized={emphasized}>
      {Array.from({ length: tiers }, (_, index) => {
        const tierHeight = entity.height / tiers;
        const radius = entity.radius * (1 - index * 0.16);
        return (
          <mesh key={index} position={[0, tierHeight * (index + 0.5), 0]}>
            <cylinderGeometry args={[radius, radius, tierHeight * 0.86, 28]} />
            <meshStandardMaterial
              color={shiftColor(color, { lightness: index * 0.055 })}
              emissive={color}
              emissiveIntensity={emphasized ? 0.2 : 0.035}
              roughness={0.52}
            />
          </mesh>
        );
      })}
    </SemanticMotion>
  );
}

function TreePrimitive({ entity, theme, emphasized }) {
  const leaves = theme.treeLeafColor ?? '#4ade80';
  return (
    <SemanticMotion motion={entity.motion} emphasized={emphasized}>
      <mesh position={[0, entity.height * 0.42, 0]}>
        <cylinderGeometry
          args={[entity.radius * 0.13, entity.radius * 0.22, entity.height * 0.84, 8]}
        />
        <meshStandardMaterial color={theme.treeTrunkColor ?? '#7c4a1e'} roughness={0.9} />
      </mesh>
      <mesh position={[0, entity.height * 0.87, 0]} scale={[1, 0.85, 1]}>
        <icosahedronGeometry args={[entity.radius, 1]} />
        <meshStandardMaterial
          color={leaves}
          emissive={leaves}
          emissiveIntensity={emphasized ? 0.22 : 0.025}
          flatShading
          roughness={0.82}
        />
      </mesh>
    </SemanticMotion>
  );
}

function MoundPrimitive({ entity, theme, emphasized }) {
  const color = theme.terrainHighColor ?? theme.treeLeafColor ?? '#65a30d';
  return (
    <SemanticMotion motion={entity.motion} emphasized={emphasized}>
      <mesh position={[0, entity.height * 0.2, 0]} scale={[1, entity.height / entity.radius, 1]}>
        <icosahedronGeometry args={[entity.radius, 2]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emphasized ? 0.18 : 0.02}
          flatShading
          roughness={0.88}
        />
      </mesh>
    </SemanticMotion>
  );
}

function BloomPrimitive({ entity, theme, emphasized }) {
  const bloom = theme.treeAccentColor ?? '#f472b6';
  return (
    <SemanticMotion motion={entity.motion} emphasized={emphasized}>
      <mesh position={[0, entity.height * 0.45, 0]}>
        <cylinderGeometry args={[0.08, 0.13, entity.height * 0.9, 8]} />
        <meshStandardMaterial color={theme.treeLeafColor ?? '#22c55e'} roughness={0.82} />
      </mesh>
      {Array.from({ length: 6 }, (_, index) => {
        const angle = (index / 6) * Math.PI * 2;
        return (
          <mesh
            key={index}
            position={[
              Math.cos(angle) * entity.radius * 0.55,
              entity.height,
              Math.sin(angle) * entity.radius * 0.55
            ]}
            scale={[1, 0.45, 1]}
          >
            <sphereGeometry args={[entity.radius * 0.58, 10, 8]} />
            <meshStandardMaterial
              color={bloom}
              emissive={bloom}
              emissiveIntensity={emphasized ? 0.32 : 0.1}
              roughness={0.52}
            />
          </mesh>
        );
      })}
      <mesh position={[0, entity.height, 0]}>
        <sphereGeometry args={[entity.radius * 0.38, 12, 10]} />
        <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.22} />
      </mesh>
    </SemanticMotion>
  );
}

function OrbPrimitive({ entity, theme, emphasized, star }) {
  const color = star
    ? (theme.starColor ?? '#fef3c7')
    : (theme.binaryGlowColor ?? theme.treeAccentColor ?? '#60a5fa');
  return (
    <SemanticMotion motion={entity.motion} emphasized={emphasized}>
      <mesh>
        {star ? (
          <icosahedronGeometry args={[entity.radius, 1]} />
        ) : (
          <sphereGeometry args={[entity.radius, 18, 14]} />
        )}
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emphasized ? 0.9 : 0.45}
          toneMapped={false}
          roughness={0.32}
        />
      </mesh>
      <GlowSprite size={entity.radius * 3.5} color={color} opacity={emphasized ? 0.38 : 0.2} />
      {!star ? (
        <mesh rotation={[Math.PI / 2.8, 0.2, 0]}>
          <torusGeometry args={[entity.radius * 1.45, 0.035, 6, 28]} />
          <meshBasicMaterial color={color} transparent opacity={0.52} />
        </mesh>
      ) : null}
    </SemanticMotion>
  );
}

function PrimitiveBody({ entity, theme, emphasized }) {
  if (entity.primitive === 'tower') {
    return <TowerPrimitive entity={entity} theme={theme} emphasized={emphasized} />;
  }
  if (entity.primitive === 'terrace') {
    return <TerracePrimitive entity={entity} theme={theme} emphasized={emphasized} />;
  }
  if (entity.primitive === 'tree') {
    return <TreePrimitive entity={entity} theme={theme} emphasized={emphasized} />;
  }
  if (entity.primitive === 'mound') {
    return <MoundPrimitive entity={entity} theme={theme} emphasized={emphasized} />;
  }
  if (entity.primitive === 'bloom') {
    return <BloomPrimitive entity={entity} theme={theme} emphasized={emphasized} />;
  }
  return (
    <OrbPrimitive
      entity={entity}
      theme={theme}
      emphasized={emphasized}
      star={entity.primitive === 'star'}
    />
  );
}

function PlannedNode({ entity, theme, emphasized, onActiveIdChange }) {
  const labelY = entity.role === 'accent' ? entity.radius + 0.8 : entity.height + 0.9;
  const labelPosition = [
    entity.labelOffset?.[0] ?? 0,
    labelY + (entity.item.glyph ? 0.55 : 0),
    entity.labelOffset?.[2] ?? 0
  ];
  return (
    <group position={entity.position}>
      <HoverableItem item={entity.item} metaphor={entity.kind} onActiveIdChange={onActiveIdChange}>
        <PrimitiveBody entity={entity} theme={theme} emphasized={emphasized} />
        <TopicGlyph item={entity.item} theme={theme} position={[0, labelY - 0.3, 0]} scale={0.68} />
        <ItemLabel
          text={entity.item.label}
          position={labelPosition}
          fontSize={0.46}
          color={theme.labelColor}
          outlineColor={theme.labelOutline}
        />
      </HoverableItem>
    </group>
  );
}

function WorldGround({ plan, theme, hasIslands }) {
  const color = hasIslands ? (theme.waterColor ?? '#27afe2') : (theme.groundColor ?? '#1e293b');
  const rim = hasIslands
    ? (theme.riverDeepColor ?? '#087fb8')
    : (theme.binaryGlowColor ?? '#64748b');
  const radius = plan.groundRadius ?? plan.worldRadius;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.28, 0]}>
        <circleGeometry args={[radius * 1.05, 72]} />
        <meshStandardMaterial color={rim} roughness={0.68} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.22, 0]}>
        <circleGeometry args={[radius, 72]} />
        <meshStandardMaterial
          color={color}
          emissive={rim}
          emissiveIntensity={hasIslands ? 0.08 : 0.025}
          roughness={hasIslands ? 0.32 : 0.76}
          metalness={hasIslands ? 0.15 : 0.04}
        />
      </mesh>
      {[0.42, 0.72, 0.96].map((scale) => (
        <mesh key={scale} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]}>
          <ringGeometry args={[radius * scale, radius * scale + 0.055, 64]} />
          <meshBasicMaterial color={theme.labelColor} transparent opacity={0.11} />
        </mesh>
      ))}
    </group>
  );
}

function FlowMotes({ curve, motion, color }) {
  const ref = useRef(null);
  const { getTime, animated, intensity } = useMetaphorClock();
  const motes = useMemo(
    () =>
      Array.from({ length: 8 }, (_, index) => ({
        phase: idHash2(`fused-flow-${index}`, motion.phase),
        speed: 0.045 + idHash2(`fused-flow-${index}`, 'speed') * 0.03
      })),
    [motion.phase]
  );
  useFrame(() => {
    if (!ref.current) return;
    const time = animated ? getTime() : 0;
    ref.current.children.forEach((child, index) => {
      const mote = motes[index];
      const progress = (mote.phase + time * mote.speed * (0.3 + intensity)) % 1;
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

function FusedPath({ path, theme, activeId, onActiveIdChange }) {
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
  const color = theme.waterColor ?? theme.binaryGlowColor ?? '#38bdf8';
  return (
    <group>
      <mesh>
        <tubeGeometry args={[curve, 72, path.width, 8, false]} />
        <meshStandardMaterial
          color={color}
          emissive={theme.riverDeepColor ?? color}
          emissiveIntensity={0.16}
          roughness={0.24}
          metalness={0.14}
        />
      </mesh>
      <FlowMotes curve={curve} motion={path.motion} color="#e0f2fe" />
      {path.stations.map((station) => {
        const emphasized = activeId === station.id;
        return (
          <group key={station.id} position={station.point}>
            <HoverableItem item={station.item} metaphor="river" onActiveIdChange={onActiveIdChange}>
              <SemanticMotion motion={station.motion} emphasized={emphasized}>
                <mesh position={[0, 0.35, 0]}>
                  <cylinderGeometry args={[0.3, 0.42, 0.7, 10]} />
                  <meshStandardMaterial
                    color={theme.slabTrimColor ?? '#fbbf24'}
                    emissive={theme.slabTrimColor ?? '#fbbf24'}
                    emissiveIntensity={emphasized ? 0.5 : 0.16}
                  />
                </mesh>
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

function FusedLinks({ links, theme, activeId }) {
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
    return (
      <group key={`${link.from}-${link.to}-${index}`}>
        <Line
          points={points}
          color={color}
          lineWidth={related ? 2.2 : 1}
          transparent
          opacity={activeId ? (related ? 0.96 : 0.18) : 0.66}
        />
        {link.kind === 'flow' || !link.kind ? (
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
  const relatedIds = useMemo(() => {
    if (!activeId) return new Set();
    const ids = new Set([activeId]);
    for (const link of plan.links) {
      if (link.from === activeId) ids.add(link.to);
      if (link.to === activeId) ids.add(link.from);
    }
    return ids;
  }, [activeId, plan.links]);
  const hasIslands = plan.sites.some((site) => site.item);

  return (
    <group>
      <WorldGround plan={plan} theme={theme} hasIslands={hasIslands} />
      {plan.sites.map((site) => (
        <group key={site.id} position={site.position}>
          {site.item ? (
            <HoverableItem item={site.item} metaphor="archipelago" onActiveIdChange={setActiveId}>
              <IslandPrimitive
                entity={site}
                theme={theme}
                emphasized={relatedIds.has(site.item.id)}
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
        />
      ))}
      {plan.paths.map((path) => (
        <FusedPath
          key={path.id}
          path={path}
          theme={theme}
          activeId={activeId}
          onActiveIdChange={setActiveId}
        />
      ))}
      <FusedLinks links={plan.links} theme={theme} activeId={activeId} />
      <MetaphorGroundShadow
        theme={theme}
        y={-0.31}
        scale={(plan.groundRadius ?? plan.worldRadius) * 2.3}
      />
    </group>
  );
}
