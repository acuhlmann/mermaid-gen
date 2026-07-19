/**
 * Bridge metaphor scene — an integration or migration as a suspension bridge
 * across a chasm. Items are pylons ordered by `span` (near shore → far shore);
 * `load` sets pylon height, `side` tints pylons by the shore/system they serve,
 * and `strain` sags the deck and cracks the pylon. The deck hangs from a main
 * cable draped pylon-top to pylon-top, with suspenders down to the road; water
 * glints far below. Ambient birds keep the crossing alive.
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import { Billboard, Line } from '@react-three/drei';
import {
  BRIDGE_CHASM_FLOOR_Y,
  BRIDGE_DECK_Y,
  bridgeSpanLayout
} from '../../utils/metaphorLayouts/bridgeSpanLayout.js';
import { Glyph } from '../metaphorGlyphs/index.jsx';
import {
  GradientSkySphere,
  HoverableItem,
  ItemLabel,
  MetaphorGroundShadow,
  MetaphorLinks
} from './MetaphorSceneChrome.jsx';
import { SkySunGlow, SoaringBirds } from './MetaphorSceneDecorations.jsx';
import { idHash2, shiftColor } from './sceneUtils.js';

function sideTint(theme, index) {
  const palette = theme.districtPalette ?? ['#60a5fa', '#f59e0b', '#34d399', '#f472b6'];
  return palette[((index % palette.length) + palette.length) % palette.length];
}

/** Rock mesas at both shores with flat tops; the chasm drops to water below. */
function BridgeShores({ spanLength, theme }) {
  const rock = theme.bridgeRockColor ?? '#7a6a58';
  const rockDark = useMemo(() => shiftColor(rock, { lightness: -0.1 }), [rock]);
  const half = spanLength / 2;
  const shoreW = 7;
  const depth = 8.5;
  return (
    <group>
      {[-1, 1].map((sign) => (
        <group key={`shore-${sign}`} position={[sign * (half + shoreW / 2 - 0.6), 0, 0]}>
          <mesh position={[0, BRIDGE_CHASM_FLOOR_Y / 2 - 0.4, 0]}>
            <boxGeometry args={[shoreW, -BRIDGE_CHASM_FLOOR_Y + 0.8, depth]} />
            <meshStandardMaterial color={rock} roughness={0.95} flatShading />
          </mesh>
          <mesh position={[0, 0.08, 0]}>
            <boxGeometry args={[shoreW + 0.4, 0.24, depth + 0.4]} />
            <meshStandardMaterial color={rockDark} roughness={0.9} flatShading />
          </mesh>
          {/* Rocky outcrops on the rim. */}
          {[0, 1, 2].map((i) => {
            const seed = `shore-${sign}-${i}`;
            return (
              <mesh
                key={seed}
                position={[
                  (idHash2(seed, 'x') - 0.5) * shoreW * 0.7,
                  0.3,
                  (idHash2(seed, 'z') - 0.5) * depth * 0.7
                ]}
                scale={[1, 0.6 + idHash2(seed, 's') * 0.5, 1]}
              >
                <icosahedronGeometry args={[0.5 + idHash2(seed, 'r') * 0.6, 0]} />
                <meshStandardMaterial color={rockDark} roughness={0.95} flatShading />
              </mesh>
            );
          })}
        </group>
      ))}
      {/* Water far below the span. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, BRIDGE_CHASM_FLOOR_Y, 0]}
        scale={[1, 0.55, 1]}
      >
        <circleGeometry args={[spanLength * 0.62, 48]} />
        <meshStandardMaterial
          color={theme.waterColor ?? '#38bdf8'}
          roughness={0.3}
          metalness={0.2}
          emissive={theme.riverDeepColor ?? '#168fc7'}
          emissiveIntensity={0.12}
        />
      </mesh>
    </group>
  );
}

/** Road deck ribbon following the (possibly sagging) deck samples. */
function BridgeDeck({ deckSamples, theme }) {
  const geom = useMemo(() => {
    const width = 1.05;
    const count = deckSamples.length;
    const positions = new Float32Array(count * 2 * 3);
    for (let i = 0; i < count; i += 1) {
      const s = deckSamples[i];
      positions[i * 6] = s.x;
      positions[i * 6 + 1] = s.y;
      positions[i * 6 + 2] = -width;
      positions[i * 6 + 3] = s.x;
      positions[i * 6 + 4] = s.y;
      positions[i * 6 + 5] = width;
    }
    const indices = [];
    for (let i = 0; i < count - 1; i += 1) {
      const a = i * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }, [deckSamples]);
  const posts = useMemo(() => deckSamples.filter((_, i) => i % 6 === 0), [deckSamples]);
  return (
    <group>
      <mesh geometry={geom}>
        <meshStandardMaterial
          color={theme.bridgeDeckColor ?? '#a1724f'}
          roughness={0.85}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Guard rails: short posts + a continuous hand line on both sides. */}
      {[-1.05, 1.05].map((z) => (
        <group key={`rail-${z}`}>
          {posts.map((s, i) => (
            <mesh key={`post-${z}-${i}`} position={[s.x, s.y + 0.16, z]}>
              <boxGeometry args={[0.06, 0.32, 0.06]} />
              <meshStandardMaterial color={theme.bridgeCableColor ?? '#64748b'} roughness={0.6} />
            </mesh>
          ))}
          <Line
            points={deckSamples.map((s) => [s.x, s.y + 0.32, z])}
            color={theme.bridgeCableColor ?? '#64748b'}
            lineWidth={0.8}
          />
        </group>
      ))}
    </group>
  );
}

/** Main cable spans between pylon tops + thin suspenders down to the deck. */
function BridgeCables({ cableSpans, deckSamples, theme }) {
  const cableColor = theme.bridgeCableColor ?? '#64748b';
  const deckYAt = useMemo(() => {
    return (x) => {
      if (deckSamples.length < 2) return BRIDGE_DECK_Y;
      const half = Math.abs(deckSamples[deckSamples.length - 1].x - deckSamples[0].x) / 2;
      const t = THREE.MathUtils.clamp((x + half) / (half * 2), 0, 1);
      const f = t * (deckSamples.length - 1);
      const i = Math.min(deckSamples.length - 2, Math.floor(f));
      const frac = f - i;
      return deckSamples[i].y + (deckSamples[i + 1].y - deckSamples[i].y) * frac;
    };
  }, [deckSamples]);
  const suspenders = useMemo(() => {
    const out = [];
    cableSpans.forEach((points) => {
      for (let i = 1; i < points.length - 1; i += 2) {
        const [x, y] = points[i];
        const deckY = deckYAt(x);
        if (y - deckY > 0.35) out.push({ x, top: y, bottom: deckY });
      }
    });
    return out;
  }, [cableSpans, deckYAt]);
  return (
    <group>
      {cableSpans.map((points, i) => (
        <Line key={`cable-${i}`} points={points} color={cableColor} lineWidth={1.6} />
      ))}
      {suspenders.map((s, i) => (
        <Line
          key={`susp-${i}`}
          points={[
            [s.x, s.top, 0],
            [s.x, s.bottom, 0]
          ]}
          color={cableColor}
          lineWidth={0.6}
          transparent
          opacity={0.75}
        />
      ))}
    </group>
  );
}

/** Portal-frame pylon per item: twin columns, crossbeam, strain cracks. */
function BridgeTower({ tower, item, theme }) {
  const tint =
    tower.sideIndex >= 0 ? sideTint(theme, tower.sideIndex) : (theme.bridgeCableColor ?? '#64748b');
  const column = useMemo(() => shiftColor(tint, { lightness: -0.04, satScale: 0.8 }), [tint]);
  const strained = tower.strain > 0.35;
  const deckAtTower = BRIDGE_DECK_Y - 0.3; // close enough for pylon footing visuals
  const legTop = tower.topY;
  const legBottom = BRIDGE_CHASM_FLOOR_Y + 0.5;
  const legHeight = legTop - legBottom;
  const legGap = 0.85;
  return (
    <group position={tower.position}>
      {[-legGap, legGap].map((z) => (
        <mesh key={`leg-${z}`} position={[0, legBottom + legHeight / 2, z]}>
          <boxGeometry args={[0.34, legHeight, 0.34]} />
          <meshStandardMaterial
            color={column}
            roughness={0.6}
            metalness={0.3}
            emissive={strained ? '#f97316' : column}
            emissiveIntensity={strained ? 0.12 + tower.strain * 0.3 : 0.02}
          />
        </mesh>
      ))}
      {/* Crossbeams: one at the top, one just above the deck. */}
      <mesh position={[0, legTop - 0.25, 0]}>
        <boxGeometry args={[0.4, 0.34, legGap * 2 + 0.34]} />
        <meshStandardMaterial color={column} roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh position={[0, deckAtTower + 0.75, 0]}>
        <boxGeometry args={[0.3, 0.26, legGap * 2 + 0.3]} />
        <meshStandardMaterial color={column} roughness={0.6} metalness={0.3} />
      </mesh>
      {strained ? (
        <group>
          {[0, 1].map((i) => (
            <mesh
              key={`crack-${i}`}
              position={[0.18, deckAtTower + 1.1 + i * 0.8, 0.2 - i * 0.4]}
              rotation={[0, 0, 0.5 - i * 0.35]}
            >
              <boxGeometry args={[0.05, 0.7, 0.3]} />
              <meshStandardMaterial color={theme.crackColor ?? '#1f2937'} roughness={0.9} />
            </mesh>
          ))}
          <mesh position={[0, tower.topY + 0.25, 0]}>
            <sphereGeometry args={[0.14 + tower.strain * 0.12, 10, 10]} />
            <meshBasicMaterial
              color="#fb923c"
              transparent
              opacity={0.5}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </mesh>
        </group>
      ) : null}
      {item.glyph ? (
        <Billboard position={[0, tower.topY + 0.75, 0]}>
          <group scale={0.9}>
            <Glyph kind={item.glyph} theme={theme} />
          </group>
        </Billboard>
      ) : null}
      <ItemLabel
        text={item.label}
        position={[0, tower.topY + (item.glyph ? 1.45 : 0.75), 0]}
        fontSize={0.58}
        color={theme.labelColor}
        outlineColor={theme.labelOutline}
      />
    </group>
  );
}

export function BridgeScene({ dsl, theme }) {
  const layout = useMemo(() => bridgeSpanLayout(dsl.items), [dsl.items]);
  const itemById = useMemo(() => new Map(dsl.items.map((item) => [item.id, item])), [dsl.items]);

  const anchors = useMemo(() => {
    const map = new Map();
    for (const tower of layout.towers) {
      map.set(tower.id, [tower.position[0], tower.topY + 0.6, tower.position[2]]);
    }
    return map;
  }, [layout.towers]);

  const groundScale = layout.spanLength * 1.35;

  return (
    <group>
      <BridgeShores spanLength={layout.spanLength} theme={theme} />
      <BridgeDeck deckSamples={layout.deckSamples} theme={theme} />
      <BridgeCables cableSpans={layout.cableSpans} deckSamples={layout.deckSamples} theme={theme} />
      {layout.towers.map((tower) => {
        const item = itemById.get(tower.id);
        if (!item) return null;
        return (
          <HoverableItem key={tower.id} item={item} metaphor="bridge">
            <BridgeTower tower={tower} item={item} theme={theme} />
          </HoverableItem>
        );
      })}
      <SoaringBirds
        radius={layout.spanLength * 0.55}
        height={8}
        count={3}
        color={theme.labelColor ?? '#1f2937'}
        idSeed="bridge-birds"
      />
      <MetaphorGroundShadow theme={theme} y={BRIDGE_CHASM_FLOOR_Y - 0.04} scale={groundScale} />
      <MetaphorLinks links={dsl.links} anchors={anchors} theme={theme} variant="arc" />
    </group>
  );
}

/** Open daylight sky over the chasm, with a warm sun halo. */
export function BridgeSky({ theme }) {
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
