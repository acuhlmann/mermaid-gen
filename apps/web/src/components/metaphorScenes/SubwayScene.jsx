/**
 * Subway metaphor scene — many named routes threading shared interchanges,
 * drawn as a transit map lifted just off its plate.
 *
 * Everything sits at ONE height. Stacking each route on its own level was the
 * first attempt, on the theory that crossings needed to resolve as over/under;
 * that turned out to be solving a problem the lane layout had already removed.
 * Routes in that layout only ever coincide AT a shared station — a point, never
 * a shared segment — so a flat map has nothing to disambiguate, and flat is
 * both the cheaper scene and the one that reads instantly as a transit diagram.
 * What the stacked version actually produced was thin threads at three
 * near-identical heights with their station discs floating between them.
 *
 * The interchange is what the metaphor is FOR, so it is the one thing given
 * extra weight: a wider pill, a dark rim, and a lantern above it.
 */
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { subwayNetworkLayout } from '../../utils/metaphorLayouts/subwayNetworkLayout.js';
import { resolveClusterColor } from '../../utils/metaphorThemePresets.js';
import { Glyph } from '../metaphorGlyphs/index.jsx';
import {
  GradientSkySphere,
  HoverableItem,
  ItemLabel,
  MetaphorGroundShadow,
  MetaphorLinks
} from './MetaphorSceneChrome.jsx';
import { MetaphorAccents } from './MetaphorAccents.jsx';
import { useMetaphorClock } from './metaphorClock.js';
import { idHash2, shiftColor } from './sceneUtils.js';
import { FRAME_IGNORE_DATA } from './sceneFraming.js';

/** Height of the whole network above its plate. */
const TRACK_Y = 0.42;
/** Track thickness. Chunky on purpose — a transit line is a stroke, not a wire. */
const TRACK_RADIUS = 0.26;

function lineColor(theme, index) {
  return resolveClusterColor(theme, index);
}

function routeCurve(stops) {
  const points = stops.map(
    (stop) => new THREE.Vector3(stop.position[0], TRACK_Y, stop.position[2])
  );
  if (points.length === 0) return null;
  if (points.length === 1) {
    // A one-stop route still deserves a stub of track, or the legend claims a
    // line that renders as nothing at all.
    const [p] = points;
    return new THREE.CatmullRomCurve3([
      new THREE.Vector3(p.x - 1.4, TRACK_Y, p.z),
      p,
      new THREE.Vector3(p.x + 1.4, TRACK_Y, p.z)
    ]);
  }
  return new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.4);
}

/** One route: a coloured ribbon through its stops, named at its far end. */
function SubwayLine({ line, theme }) {
  const color = lineColor(theme, line.index);
  const curve = useMemo(() => routeCurve(line.stops), [line.stops]);
  if (!curve) return null;
  const sign = line.sign;
  return (
    <group>
      <mesh>
        <tubeGeometry
          args={[curve, Math.max(28, line.stops.length * 14), TRACK_RADIUS, 12, false]}
        />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.18}
          roughness={0.42}
          metalness={0.12}
        />
      </mesh>
      {/* Signed PAST the terminus, along the direction the route was travelling
          when it got there — where a real platform sign stands. A label at the
          midpoint lands on top of whatever crosses there, and one AT the
          terminus (`getPoint(1)`, which this was) lands on that station's own
          name: a pinned route placard drawn into a pinned interchange name,
          with neither able to yield. `subwayRouteSign` owns the geometry so
          the sign and the platform disc cannot disagree about where the
          platform ends. */}
      {sign ? (
        <ItemLabel
          text={line.name}
          role="group"
          // Lower than the 1.7 this label used to sit at, and deliberately so.
          // Raising it clears the terminus platform's FACE on a flat foldable
          // cover — but the sign is pinned and a station name is not, so the
          // higher sign wins the declutter pass against the very names it just
          // stopped colliding with: measured on 717x512, 1.7 cleared the discs
          // and cost Deliver and Resolve, 5/6 station names down to 3/6. The
          // lateral standoff is what fixes the collision; height only trades.
          position={[sign[0], TRACK_Y + 1.15, sign[2]]}
          fontSize={0.46}
          color={color}
          outlineColor={theme.labelOutline}
          pinned
        />
      ) : null}
    </group>
  );
}

/** A service running the route — the pulse that makes the map read as live. */
function SubwayTrain({ line, theme }) {
  const ref = useRef(null);
  const color = shiftColor(lineColor(theme, line.index), { lightness: 0.2 });
  const curve = useMemo(() => routeCurve(line.stops), [line.stops]);
  const { getTime, animated } = useMetaphorClock();
  const phase = idHash2(line.name, 'train');

  useFrame(() => {
    if (!ref.current || !curve) return;
    const t = animated ? (getTime() * 0.055 + phase) % 1 : phase;
    ref.current.position.copy(curve.getPointAt(t));
    ref.current.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      curve.getTangentAt(t).normalize()
    );
  });

  if (!curve || line.stops.length < 2) return null;
  return (
    <mesh ref={ref}>
      <capsuleGeometry args={[0.22, 0.62, 4, 10]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.55} />
    </mesh>
  );
}

/**
 * A station disc on the track. An interchange gets a wider pill, a dark rim and
 * a lantern, because "these routes are the same place" is the whole claim the
 * subway grammar exists to make.
 */
function SubwayStation({ station, theme, isInterchange }) {
  // From the layout, not recomputed here: the route sign stands off this exact
  // rim, so two definitions of "where the platform ends" would drift apart.
  const radius = station.platformRadius;
  const rim = theme.labelColor ?? '#0f172a';
  const lantern = theme.slabTrimColor ?? '#fbbf24';
  return (
    <group position={[station.position[0], 0, station.position[2]]}>
      <mesh position={[0, TRACK_Y, 0]}>
        <cylinderGeometry args={[radius, radius, TRACK_RADIUS * 2.35, 24]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.45} metalness={0.05} />
      </mesh>
      <mesh position={[0, TRACK_Y + TRACK_RADIUS * 1.18, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 0.66, radius * 0.88, 26]} />
        <meshBasicMaterial color={rim} transparent opacity={isInterchange ? 0.9 : 0.45} />
      </mesh>
      {isInterchange ? (
        <mesh position={[0, TRACK_Y + 0.85, 0]}>
          <octahedronGeometry args={[0.26, 0]} />
          <meshStandardMaterial
            color={lantern}
            emissive={lantern}
            emissiveIntensity={0.9}
            toneMapped={false}
          />
        </mesh>
      ) : null}
    </group>
  );
}

export function SubwayScene({ dsl, theme }) {
  const layout = useMemo(() => subwayNetworkLayout(dsl.items), [dsl.items]);
  const stationById = useMemo(
    () => new Map(layout.stations.map((station) => [station.id, station])),
    [layout.stations]
  );

  const anchors = useMemo(() => {
    const map = new Map();
    for (const [id, position] of layout.positions) {
      map.set(id, [position[0], TRACK_Y + 0.6, position[2]]);
    }
    return map;
  }, [layout.positions]);

  const radius = Math.max(6, layout.bounds.radius);
  const plate = theme.cyclePaveColor ?? '#c9cdd6';

  return (
    <group>
      {/* Plain plate: the coloured routes own the scene's whole colour budget.
          Out of the camera fit — a network's lines and stations are the subject,
          the plate is the paper they are printed on. See sceneFraming.js. */}
      <group userData={FRAME_IGNORE_DATA}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
          <circleGeometry args={[radius, 72]} />
          <meshStandardMaterial color={shiftColor(plate, { lightness: -0.07 })} roughness={0.95} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]}>
          <circleGeometry args={[radius * 0.95, 72]} />
          <meshStandardMaterial color={plate} roughness={0.92} />
        </mesh>
      </group>

      {layout.lines.map((line) => (
        <SubwayLine key={`line-${line.name}`} line={line} theme={theme} />
      ))}
      {layout.stations.map((station) => (
        <SubwayStation
          key={`station-${station.id}`}
          station={station}
          theme={theme}
          isInterchange={station.lines.length > 1}
        />
      ))}
      {layout.lines.map((line) => (
        <SubwayTrain key={`train-${line.name}`} line={line} theme={theme} />
      ))}

      {dsl.items.map((item) => {
        const position = layout.positions.get(item.id);
        if (!position) return null;
        const station = stationById.get(layout.stationOf.get(item.id));
        const isInterchange = (station?.lines.length ?? 1) > 1;
        // At an interchange every member sits on the same platform, so only the
        // primary carries the name — otherwise the station prints its own label
        // two or three times into exactly the same pixels.
        const showsLabel = !station || station.primary === item.id;
        const traffic = typeof item.traffic === 'number' ? item.traffic : 5;
        return (
          <HoverableItem key={item.id} item={item} metaphor="subway">
            <group position={[position[0], 0, position[2]]}>
              {/* Every member keeps a hit target even when its label is
                  suppressed, so hovering still names each route's own stop. */}
              <mesh position={[0, TRACK_Y, 0]} visible={false}>
                <sphereGeometry args={[0.8, 6, 6]} />
                <meshBasicMaterial />
              </mesh>
              {showsLabel && item.glyph ? (
                <group position={[0, TRACK_Y + 1.0, 0]} scale={0.55}>
                  <Glyph kind={item.glyph} theme={theme} />
                </group>
              ) : null}
              {showsLabel ? (
                <ItemLabel
                  text={item.label}
                  position={[0, TRACK_Y + (item.glyph ? 1.95 : 0.95), 0]}
                  fontSize={0.42}
                  color={theme.labelColor}
                  outlineColor={theme.labelOutline}
                  // An interchange is the network's structural claim, so it
                  // keeps its name the way a district or bed label does.
                  pinned={isInterchange}
                  importance={traffic}
                />
              ) : null}
            </group>
          </HoverableItem>
        );
      })}

      <MetaphorAccents items={dsl.items} anchors={anchors} theme={theme} />
      <MetaphorGroundShadow theme={theme} y={-0.04} scale={radius * 2.1} />
      <MetaphorLinks links={dsl.links} anchors={anchors} theme={theme} variant="arc" />
    </group>
  );
}

export function SubwaySky({ theme }) {
  return (
    <GradientSkySphere
      topColor={theme.skyTopColor ?? '#b9cde4'}
      horizonColor={theme.skyHorizonColor ?? '#dde5ef'}
    />
  );
}
