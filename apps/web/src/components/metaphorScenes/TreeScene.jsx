/**
 * Tree metaphor scene — a stylized tree (or grove, one trunk per root): visible
 * tapered trunks with root flares rising from a soil mound, upward-sweeping
 * tapered branch limbs that lighten toward the tips, multi-tone low-poly
 * foliage with occasional fruit, and a circular meadow footing dressed with
 * grass tufts, rocks, and fallen fruit. Layout comes from treeRadialLayout
 * (roots are lifted to trunk height there). Extracted from MetaphorRenderer.jsx
 * per the ADR-0005 sibling-module pattern.
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import { treeRadialLayout } from '../../utils/metaphorLayouts/treeRadialLayout.js';
import { Glyph } from '../metaphorGlyphs/index.jsx';
import {
  HoverableItem,
  ItemLabel,
  MetaphorGroundShadow,
  MetaphorLinks
} from './MetaphorSceneChrome.jsx';
import { idHash, idHash2, shiftColor } from './sceneUtils.js';

/**
 * TubeGeometry along a curve with a linearly tapering radius — three's stock
 * TubeGeometry is constant-radius, which makes limbs read as pipes. Same ring
 * construction as upstream TubeGeometry, with radius lerped bottom→top.
 */
function taperedTubeGeometry(curve, tubularSegments, radiusBottom, radiusTop, radialSegments) {
  const frames = curve.computeFrenetFrames(tubularSegments, false);
  const vertices = [];
  const normals = [];
  const indices = [];
  for (let i = 0; i <= tubularSegments; i += 1) {
    const t = i / tubularSegments;
    const point = curve.getPointAt(t);
    const radius = radiusBottom + (radiusTop - radiusBottom) * t;
    const N = frames.normals[i];
    const B = frames.binormals[i];
    for (let j = 0; j <= radialSegments; j += 1) {
      const v = (j / radialSegments) * Math.PI * 2;
      const sin = Math.sin(v);
      const cos = -Math.cos(v);
      const nx = cos * N.x + sin * B.x;
      const ny = cos * N.y + sin * B.y;
      const nz = cos * N.z + sin * B.z;
      normals.push(nx, ny, nz);
      vertices.push(point.x + radius * nx, point.y + radius * ny, point.z + radius * nz);
    }
  }
  for (let i = 0; i < tubularSegments; i += 1) {
    for (let j = 0; j < radialSegments; j += 1) {
      const a = (radialSegments + 1) * i + j;
      const b = (radialSegments + 1) * (i + 1) + j;
      const c = b + 1;
      const d = a + 1;
      indices.push(a, b, d, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return geometry;
}

function TreeBranchSegment({ id, from, to, thicknessTop, thicknessBottom, color }) {
  const geometry = useMemo(() => {
    const fromVec = new THREE.Vector3(from[0], from[1], from[2]);
    const toVec = new THREE.Vector3(to[0], to[1], to[2]);
    const length = fromVec.distanceTo(toVec);
    if (length < 0.0001) return null;
    // Control point biased toward the parent joint and lifted, so limbs leave
    // the joint steeply and flatten out toward the tip like real branches.
    const mid = fromVec.clone().lerp(toVec, 0.42);
    mid.y += 0.3 + length * 0.22 + idHash(id) * 0.3;
    const curve = new THREE.QuadraticBezierCurve3(fromVec, mid, toVec);
    return taperedTubeGeometry(curve, 10, thicknessBottom, thicknessTop, 7);
  }, [from, to, thicknessTop, thicknessBottom, id]);
  if (!geometry) return null;
  return (
    <group>
      {/* Knuckle sphere hides the radius step where children meet the parent limb. */}
      <mesh position={from}>
        <sphereGeometry args={[thicknessBottom * 1.05, 10, 10]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      <mesh geometry={geometry}>
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
    </group>
  );
}

/** World-scale of a leaf canopy for a given weight (shared with label/glyph lift). */
function leafClusterScale(weight) {
  return 1.05 + Math.min(weight ?? 3, 8) * 0.09;
}

function TreeLeafCluster({ position, theme, id, weight }) {
  const leafColor = theme.treeLeafColor ?? '#4ade80';
  const accentColor = theme.treeAccentColor ?? '#f43f5e';
  const templateSeed = idHash(id ?? 'leaf');
  const fruitSeed = idHash2(id ?? 'leaf', 'fruit');
  const scale = leafClusterScale(weight);
  const { blobs, blobColors } = useMemo(() => {
    let shapes;
    if (templateSeed < 0.34) {
      shapes = [
        { pos: [0, 0, 0], r: 0.7 },
        { pos: [0.45, 0.1, 0.2], r: 0.45 },
        { pos: [-0.4, -0.05, -0.25], r: 0.4 }
      ];
    } else if (templateSeed < 0.67) {
      shapes = [{ pos: [0, 0, 0], r: 0.85 }];
    } else {
      shapes = [
        { pos: [0, 0.1, 0], r: 0.55 },
        { pos: [0.45, 0.05, 0.1], r: 0.42 },
        { pos: [-0.45, -0.05, -0.1], r: 0.42 },
        { pos: [0.1, 0.25, -0.4], r: 0.4 },
        { pos: [-0.05, -0.2, 0.45], r: 0.38 }
      ];
    }
    // Per-blob green variation so a canopy reads as layered foliage, not one
    // uniform blob of paint.
    const colors = shapes.map((_, i) =>
      shiftColor(leafColor, {
        lightness: (idHash2(id ?? 'leaf', `blob-l${i}`) - 0.5) * 0.16,
        hueShift: (idHash2(id ?? 'leaf', `blob-h${i}`) - 0.5) * 0.05,
        satScale: 0.94 + idHash2(id ?? 'leaf', `blob-s${i}`) * 0.12
      })
    );
    return { blobs: shapes, blobColors: colors };
  }, [templateSeed, leafColor, id]);
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
          <meshStandardMaterial
            color={blobColors[i]}
            emissive={blobColors[i]}
            emissiveIntensity={0.06}
            flatShading
            roughness={0.8}
          />
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

/** Small inner-canopy tuft at branch joints so internal nodes aren't bare sticks. */
function BranchFoliage({ position, theme, id, weight }) {
  const leafColor = theme.treeLeafColor ?? '#4ade80';
  const color = useMemo(
    () =>
      shiftColor(leafColor, {
        lightness: -0.05 + (idHash2(id ?? 'branch', 'tuft') - 0.5) * 0.08,
        satScale: 0.92
      }),
    [leafColor, id]
  );
  const radius = 0.5 + Math.min(weight ?? 3, 8) * 0.04;
  return (
    <mesh position={[position[0], position[1] + 0.3, position[2]]}>
      <icosahedronGeometry args={[radius, 0]} />
      <meshStandardMaterial color={color} flatShading roughness={0.8} />
    </mesh>
  );
}

/** Tapered trunk from the ground up to the root node, with root flares and a soil mound. */
function TreeTrunk({ root, theme }) {
  const barkColor = theme.treeTrunkColor ?? '#8b5a2b';
  const soilColor = theme.treeSoilColor ?? '#5b4226';
  const [x, topY, z] = root.position;
  const height = Math.max(0.5, topY);
  const radiusBottom = root.radius;
  const radiusTop = Math.max(0.12, root.radius * 0.6);
  const flares = useMemo(() => {
    const count = 5;
    const out = [];
    for (let i = 0; i < count; i += 1) {
      const angle = ((i + idHash2(root.id, 'flare-spin')) / count) * Math.PI * 2;
      const length = radiusBottom * (1.5 + idHash2(root.id, `flare-l${i}`) * 1.1);
      out.push({ angle, length });
    }
    return out;
  }, [root.id, radiusBottom]);
  return (
    <group position={[x, 0, z]}>
      {/* Lifted clear of the meadow discs and the contact-shadow plane (y=0.01). */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.022, 0]}>
        <circleGeometry args={[radiusBottom * 2.6, 24]} />
        <meshStandardMaterial color={soilColor} />
      </mesh>
      <mesh position={[0, height / 2, 0]}>
        <cylinderGeometry args={[radiusTop, radiusBottom, height, 10]} />
        <meshStandardMaterial color={barkColor} roughness={0.9} />
      </mesh>
      {flares.map((f, i) => (
        <mesh
          key={`flare-${i}`}
          position={[Math.cos(f.angle) * f.length * 0.45, 0.05, Math.sin(f.angle) * f.length * 0.45]}
          rotation={[0, -f.angle, 0]}
          scale={[f.length, radiusBottom * 0.55, radiusBottom * 0.5]}
        >
          <sphereGeometry args={[0.5, 8, 6]} />
          <meshStandardMaterial color={barkColor} roughness={0.95} />
        </mesh>
      ))}
    </group>
  );
}

/** Circular meadow footing: grass disc with a contrasting rim and a lighter sunlit centre. */
function TreeMeadow({ theme, radius }) {
  const meadowColor = theme.treeMeadowColor ?? theme.groundColor ?? '#2e4a2e';
  // Rim contrast flips direction on dark themes — a fixed darken would clamp
  // to pure black and read as a harsh ring.
  const rimColor = useMemo(() => {
    const hsl = { h: 0, s: 0, l: 0 };
    new THREE.Color(meadowColor).getHSL(hsl);
    return shiftColor(meadowColor, { lightness: hsl.l < 0.2 ? 0.06 : -0.08 });
  }, [meadowColor]);
  const innerColor = useMemo(
    () => shiftColor(meadowColor, { lightness: 0.05, satScale: 1.05 }),
    [meadowColor]
  );
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
        <circleGeometry args={[radius, 64]} />
        <meshStandardMaterial color={rimColor} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.025, 0]}>
        <circleGeometry args={[radius * 0.92, 64]} />
        <meshStandardMaterial color={meadowColor} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.008, 0]}>
        <circleGeometry args={[radius * 0.55, 48]} />
        <meshStandardMaterial color={innerColor} transparent opacity={0.55} />
      </mesh>
    </group>
  );
}

/** Grass tufts, small rocks, and fallen fruit scattered around each trunk. */
function MeadowDetails({ roots, theme, radius }) {
  const leafColor = theme.treeLeafColor ?? '#4ade80';
  const accentColor = theme.treeAccentColor ?? '#f43f5e';
  const soilColor = theme.treeSoilColor ?? '#5b4226';
  const { tufts, rocks, drops, tuftColors, rockColor } = useMemo(() => {
    const tuftPalette = [
      shiftColor(leafColor, {}),
      shiftColor(leafColor, { lightness: 0.08 }),
      shiftColor(leafColor, { lightness: -0.06, hueShift: 0.02 })
    ];
    const stone = shiftColor(soilColor, { lightness: 0.22, satScale: 0.35 });
    const tuftList = [];
    const rockList = [];
    const dropList = [];
    const maxSpread = radius * 0.78;
    for (const root of roots) {
      for (let i = 0; i < 12; i += 1) {
        const angle = idHash2(root.id, `tuft-a${i}`) * Math.PI * 2;
        const dist = root.radius + 0.5 + idHash2(root.id, `tuft-d${i}`) * maxSpread;
        tuftList.push({
          position: [
            root.position[0] + Math.cos(angle) * dist,
            0.08,
            root.position[2] + Math.sin(angle) * dist
          ],
          height: 0.22 + idHash2(root.id, `tuft-h${i}`) * 0.3,
          colorIndex: Math.floor(idHash2(root.id, `tuft-c${i}`) * tuftPalette.length)
        });
      }
      for (let i = 0; i < 2; i += 1) {
        const angle = idHash2(root.id, `rock-a${i}`) * Math.PI * 2;
        const dist = root.radius + 0.8 + idHash2(root.id, `rock-d${i}`) * maxSpread;
        rockList.push({
          position: [
            root.position[0] + Math.cos(angle) * dist,
            0.06,
            root.position[2] + Math.sin(angle) * dist
          ],
          radius: 0.16 + idHash2(root.id, `rock-r${i}`) * 0.18
        });
      }
      for (let i = 0; i < 2; i += 1) {
        const angle = idHash2(root.id, `drop-a${i}`) * Math.PI * 2;
        const dist = root.radius + 1.1 + idHash2(root.id, `drop-d${i}`) * 1.6;
        dropList.push({
          position: [
            root.position[0] + Math.cos(angle) * dist,
            0.07,
            root.position[2] + Math.sin(angle) * dist
          ]
        });
      }
    }
    return {
      tufts: tuftList,
      rocks: rockList,
      drops: dropList,
      tuftColors: tuftPalette,
      rockColor: stone
    };
  }, [roots, leafColor, soilColor, radius]);
  return (
    <group>
      {tufts.map((tuft, i) => (
        <mesh key={`tuft-${i}`} position={tuft.position}>
          <coneGeometry args={[0.13, tuft.height, 5]} />
          <meshStandardMaterial color={tuftColors[tuft.colorIndex]} flatShading />
        </mesh>
      ))}
      {rocks.map((rock, i) => (
        <mesh key={`rock-${i}`} position={rock.position} scale={[1, 0.7, 1]}>
          <icosahedronGeometry args={[rock.radius, 0]} />
          <meshStandardMaterial color={rockColor} flatShading roughness={0.95} />
        </mesh>
      ))}
      {drops.map((drop, i) => (
        <mesh key={`drop-${i}`} position={drop.position}>
          <sphereGeometry args={[0.07, 8, 8]} />
          <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={0.2} />
        </mesh>
      ))}
    </group>
  );
}

export function TreeScene({ dsl, theme }) {
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
    const trunkColor = theme.treeTrunkColor ?? '#8b5a2b';
    const branchColor = theme.treeBranchColor ?? '#a47148';
    const segments = [];
    for (const item of dsl.items) {
      const info = layout.nodeInfo.get(item.id);
      const position = layout.positions.get(item.id);
      // Roots are rendered as trunks (TreeTrunk), not branch segments.
      if (!info || !position || info.parentId === null) continue;
      const fromPosition = layout.positions.get(info.parentId);
      if (!fromPosition) continue;
      // Weight drives limb girth (the legend axis); depth thins limbs toward
      // the crown and lightens the bark so tips read younger than the bough.
      const weightTerm = 0.15 + Math.min(info.weight, 12) * 0.05;
      const depthScale = 1 / (1 + Math.max(0, info.depth - 1) * 0.22);
      const thicknessBottom = Math.max(0.07, weightTerm * depthScale);
      const thicknessTop = info.kind === 'leaf' ? thicknessBottom * 0.38 : thicknessBottom * 0.66;
      segments.push({
        key: item.id,
        from: fromPosition,
        to: position,
        thicknessTop,
        thicknessBottom,
        color:
          info.depth <= 1
            ? trunkColor
            : shiftColor(branchColor, { lightness: Math.min(0.12, (info.depth - 1) * 0.04) })
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
      const radius = 0.42 + Math.min(info.weight, 12) * 0.07;
      out.push({ id: item.id, position, radius });
    }
    return out;
  }, [dsl.items, layout]);

  const meadowRadius = Math.max(6, (layout.bounds?.radius ?? 5) * 1.02 + 1.1);

  return (
    <group>
      <TreeMeadow theme={theme} radius={meadowRadius} />
      {trunkRoots.map((root) => (
        <TreeTrunk key={`trunk-${root.id}`} root={root} theme={theme} />
      ))}
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
      <MeadowDetails roots={trunkRoots} theme={theme} radius={meadowRadius} />
      {dsl.items.map((item) => {
        const position = layout.positions.get(item.id);
        const info = layout.nodeInfo.get(item.id);
        if (!position || !info) return null;
        const isLeaf = info.kind === 'leaf';
        // Leaf glyphs ride above the canopy (instead of buried inside it), with
        // the label lifted further so the two never overlap.
        const canopyTop = isLeaf ? leafClusterScale(info.weight) * 0.7 : 0;
        const labelPos = [
          position[0],
          position[1] + (isLeaf ? canopyTop + (item.glyph ? 1.5 : 0.85) : 1.1),
          position[2]
        ];
        const glyphScale = isLeaf ? 0.55 + Math.min(info.weight, 8) * 0.04 : 0.75;
        const glyphPos = isLeaf
          ? [position[0], position[1] + canopyTop + 0.6, position[2]]
          : [position[0] + 0.7, position[1] + 1.1, position[2]];
        return (
          <HoverableItem key={item.id} item={item} metaphor="tree">
            <group>
              {isLeaf ? (
                <TreeLeafCluster
                  position={position}
                  theme={theme}
                  id={item.id}
                  weight={info.weight}
                />
              ) : null}
              {info.kind === 'branch' ? (
                <BranchFoliage position={position} theme={theme} id={item.id} weight={info.weight} />
              ) : null}
              {item.glyph ? (
                <group position={glyphPos} scale={glyphScale}>
                  <Glyph kind={item.glyph} theme={theme} />
                </group>
              ) : null}
              <ItemLabel
                text={item.label}
                position={labelPos}
                fontSize={isLeaf ? 0.42 : 0.55}
                color={theme.labelColor}
                outlineColor={theme.labelOutline}
              />
            </group>
          </HoverableItem>
        );
      })}
      {/* Kept inside the meadow disc so the blur tail never paints a dark halo
          on the backdrop around it. */}
      <MetaphorGroundShadow theme={theme} scale={meadowRadius * 1.7} />
      <MetaphorLinks links={dsl.links} anchors={anchors} theme={theme} variant="arc" />
    </group>
  );
}
