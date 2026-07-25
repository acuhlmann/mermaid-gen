/**
 * Isometric art primitives + the office prop bench (ADR-0011).
 *
 * Everything on the floor is built from two primitives — a cuboid (`IsoBox`)
 * and a vertical plane (`IsoPanel`) — rather than hand-drawn artwork, for the
 * same reason `PersonaFace` is parametric: a new prop costs a component made of
 * boxes, not an asset pipeline. Faces are shaded from one base colour via
 * `color-mix`, so props inherit the app palette instead of hard-coding a look.
 *
 * All geometry is anchored at (0, 0) = the centre of the prop's floor tile, so
 * a prop's SVG can be positioned by `projectIso` alone.
 */

import { TILE_H, TILE_W } from '../../utils/officeFloorPlan.js';

/** Half-tile screen deltas: one tile along +x is (UX, UY), along +y is (−UX, UY). */
const UX = TILE_W / 2;
const UY = TILE_H / 2;

/**
 * Three face shades from one base colour. Top catches the light, the left face
 * (turned away) is darkest — the whole reason a flat palette reads as 3D.
 *
 * @param {string} color
 */
function shades(color) {
  return {
    top: `color-mix(in srgb, ${color} 76%, #ffffff)`,
    right: color,
    left: `color-mix(in srgb, ${color} 82%, #000000)`
  };
}

/**
 * Corner of a box's floor rectangle, in stage px relative to the anchor.
 *
 * @param {number} cx @param {number} cy @param {number} dx @param {number} dy
 */
function corner(cx, cy, dx, dy) {
  return [cx + (dx - dy) * UX, cy + (dx + dy) * UY];
}

function pts(...points) {
  return points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
}

/**
 * A cuboid standing on the floor.
 *
 * @param {{
 *   w: number, d: number, h: number, color: string,
 *   x?: number, y?: number, lift?: number, opacity?: number,
 *   topClass?: string
 * }} props `w`/`d` are tile fractions, `h`/`lift` are stage px.
 */
export function IsoBox({ w, d, h, color, x = 0, y = 0, lift = 0, opacity = 1, topClass }) {
  const cx = (x - y) * UX;
  const cy = (x + y) * UY - lift;
  const hx = w / 2;
  const hy = d / 2;

  const A = corner(cx, cy, -hx, -hy); // back
  const B = corner(cx, cy, hx, -hy); // right
  const C = corner(cx, cy, hx, hy); // front
  const D = corner(cx, cy, -hx, hy); // left
  const up = ([px, py]) => [px, py - h];
  const face = shades(color);

  return (
    <g opacity={opacity}>
      {/* Left and right walls first, then the lid — no z-fighting to manage. */}
      <polygon points={pts(D, C, up(C), up(D))} fill={face.left} />
      <polygon points={pts(C, B, up(B), up(C))} fill={face.right} />
      <polygon
        points={pts(up(A), up(B), up(C), up(D))}
        fill={face.top}
        className={topClass || undefined}
      />
    </g>
  );
}

/**
 * A vertical plane — glass partitions and the meeting-room walls.
 *
 * @param {{
 *   span: number, axis?: 'x' | 'y', h: number, color: string,
 *   x?: number, y?: number, opacity?: number
 * }} props
 */
export function IsoPanel({ span, axis = 'x', h, color, x = 0, y = 0, opacity = 0.32 }) {
  const cx = (x - y) * UX;
  const cy = (x + y) * UY;
  const half = span / 2;
  const start = axis === 'x' ? corner(cx, cy, -half, 0) : corner(cx, cy, 0, -half);
  const end = axis === 'x' ? corner(cx, cy, half, 0) : corner(cx, cy, 0, half);
  const up = ([px, py]) => [px, py - h];

  return (
    <g>
      <polygon points={pts(start, end, up(end), up(start))} fill={color} opacity={opacity} />
      {/* Frame: without the edges, glass reads as fog rather than a wall. */}
      <polyline
        points={pts(start, up(start), up(end), end)}
        fill="none"
        stroke={color}
        strokeOpacity="0.75"
        strokeWidth="2"
      />
    </g>
  );
}

const WOOD = '#c8a887';
const GREY = '#b6bfcb';
const DARK = '#5b6472';
const WHITE = '#e8edf3';
const SCREEN = '#2b3a55';

/** Where a desk's top surface sits, in tiles, relative to the seat's anchor. */
const DESK_X = 0.12;
const DESK_Y = 0.12;
const DESK_H = 26;

/**
 * A desk with its chair — the seat's furniture, drawn around the occupant.
 * `part: 'chair'` renders behind the person, `'desk'` in front of them, which
 * is what makes them read as *sitting* rather than standing in a desk.
 *
 * @param {{ part: 'chair' | 'desk', you?: boolean }} props
 */
export function DeskFurniture({ part, you = false }) {
  if (part === 'chair') {
    return (
      <g>
        <IsoBox w={0.34} d={0.34} h={16} color={DARK} x={-0.28} y={-0.28} />
        <IsoBox w={0.32} d={0.06} h={22} color={DARK} x={-0.42} y={-0.42} lift={16} />
      </g>
    );
  }
  return (
    <g>
      <IsoBox w={0.94} d={0.66} h={DESK_H} color={you ? '#d8c3a5' : WOOD} x={DESK_X} y={DESK_Y} />
      {/*
        The monitor sits to the screen-left of the desk, not centred on it: an
        equal shift along -x and +y moves a prop sideways in screen space
        without moving it up or down. Centred, a 26 px-wide monitor eclipses the
        34 px head of whoever is sitting behind it — the occupant vanishes.
      */}
      <IsoBox
        w={0.4}
        d={0.06}
        h={26}
        color={DARK}
        x={DESK_X - 0.34}
        y={DESK_Y + 0.26}
        lift={DESK_H}
      />
      <g className={you ? 'floor-screen floor-screen--you' : 'floor-screen'}>
        <IsoBox
          w={0.32}
          d={0.04}
          h={19}
          color={you ? '#3b82f6' : SCREEN}
          x={DESK_X - 0.34}
          y={DESK_Y + 0.3}
          lift={DESK_H + 4}
        />
      </g>
      <IsoBox
        w={0.3}
        d={0.14}
        h={3}
        color={WHITE}
        x={DESK_X + 0.2}
        y={DESK_Y - 0.1}
        lift={DESK_H}
      />
    </g>
  );
}

/**
 * The environment bench, as a lookup rather than a switch so adding a prop is
 * one entry and never touches control flow. Every prop is boxes; the comedy is
 * in the labels, not the polygons.
 *
 * @type {Record<string, (opts: { span: number, axis: 'x' | 'y' }) => import('react').ReactNode>}
 */
const PROP_ART = {
  receptionDesk: () => (
    <g>
      <IsoBox w={1.5} d={0.8} h={30} color={WOOD} />
      <IsoBox w={1.6} d={0.9} h={6} color={WHITE} lift={30} />
    </g>
  ),
  printer: () => (
    <g>
      <IsoBox w={0.62} d={0.52} h={22} color={GREY} />
      <IsoBox w={0.5} d={0.4} h={6} color={WHITE} lift={22} />
      <IsoBox w={0.42} d={0.06} h={2} color="#f8fafc" lift={20} y={0.24} />
    </g>
  ),
  whiteboard: () => (
    <g>
      <IsoBox w={0.1} d={1.5} h={12} color={DARK} />
      <IsoPanel span={1.5} axis="y" h={62} color="#f8fafc" opacity={0.95} />
      <IsoPanel span={1.5} axis="y" h={62} color={DARK} opacity={0.08} />
    </g>
  ),
  serverRack: () => (
    <g>
      <IsoBox w={0.62} d={0.7} h={74} color="#39424f" />
      {[0, 1, 2, 3, 4].map((i) => (
        <IsoBox
          key={i}
          w={0.5}
          d={0.02}
          h={4}
          color={i % 2 ? '#22d3ee' : '#4ade80'}
          y={-0.36}
          lift={16 + i * 12}
          opacity={0.9}
        />
      ))}
    </g>
  ),
  fridge: () => (
    <g>
      <IsoBox w={0.7} d={0.66} h={62} color={WHITE} />
      <IsoBox w={0.06} d={0.3} h={3} color={DARK} x={0.3} y={0.1} lift={38} />
    </g>
  ),
  coffeeMachine: () => (
    <g>
      <IsoBox w={1.1} d={0.6} h={26} color={GREY} />
      <IsoBox w={0.44} d={0.4} h={30} color="#4b5563" x={-0.2} lift={26} />
      <IsoBox w={0.2} d={0.18} h={8} color="#f97316" x={0.24} lift={26} />
    </g>
  ),
  waterCooler: () => (
    <g>
      <IsoBox w={0.36} d={0.36} h={30} color={WHITE} />
      <IsoBox w={0.32} d={0.32} h={26} color="#7dd3fc" lift={30} opacity={0.85} />
    </g>
  ),
  meetingTable: () => (
    <g>
      <IsoBox w={1.9} d={1.1} h={24} color={WOOD} />
      <IsoBox w={0.3} d={0.24} h={5} color={SCREEN} lift={24} />
    </g>
  ),
  plant: () => (
    <g>
      <IsoBox w={0.32} d={0.32} h={18} color="#b45309" />
      <circle cx="0" cy="-34" r="16" fill="#2f9e5f" />
      <circle cx="-11" cy="-26" r="11" fill="#37b06c" />
      <circle cx="12" cy="-27" r="10" fill="#268a52" />
    </g>
  ),
  glassPanel: ({ span, axis }) => (
    <IsoPanel span={span} axis={axis} h={78} color="#7dd3fc" opacity={0.26} />
  )
};

/**
 * @param {{ kind: string, span?: number, axis?: 'x' | 'y' }} props
 */
export function FloorPropArt({ kind, span = 2, axis = 'x' }) {
  return PROP_ART[kind]?.({ span, axis }) ?? null;
}
