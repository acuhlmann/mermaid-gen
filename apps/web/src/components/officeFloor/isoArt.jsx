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

import { BOARD_INK } from '../../utils/officeFloorBoard.js';
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

/**
 * Ink on a vertical plane — the whiteboard's miniature of your own diagram
 * (§ 5 slice 16).
 *
 * `IsoPanel` draws the surface; this draws *on* it, mapping panel fractions
 * (`u` along the span, `v` down from the top) onto the same parallelogram, so a
 * box in `boardFrom`'s 0…1 space lands where it would if the panel were a flat
 * rectangle you were looking at square on.
 *
 * @param {{
 *   span: number, axis?: 'x' | 'y', h: number,
 *   x?: number, y?: number,
 *   boxes: Array<{ x: number, y: number, w: number, h: number }>,
 *   edges?: Array<[number, number]>,
 *   boxColor: string, edgeColor: string
 * }} props
 */
export function IsoPanelInk({
  span,
  axis = 'x',
  h,
  x = 0,
  y = 0,
  boxes,
  edges = [],
  boxColor,
  edgeColor
}) {
  const cx = (x - y) * UX;
  const cy = (x + y) * UY;
  const half = span / 2;
  const start = axis === 'x' ? corner(cx, cy, -half, 0) : corner(cx, cy, 0, -half);
  const end = axis === 'x' ? corner(cx, cy, half, 0) : corner(cx, cy, 0, half);

  /** @param {number} u @param {number} v */
  const at = (u, v) => [
    start[0] + (end[0] - start[0]) * u,
    start[1] + (end[1] - start[1]) * u - h * (1 - v)
  ];
  const centre = (box) => at(box.x + box.w / 2, box.y + box.h / 2);

  return (
    <g>
      {/*
        Connectors first so a box always sits on top of the line reaching it —
        the same reason `DeskFurniture` paints the desk after the occupant.
      */}
      {edges.map(([from, to], index) => {
        const a = boxes[from];
        const b = boxes[to];
        if (!a || !b) return null;
        const [x1, y1] = centre(a);
        const [x2, y2] = centre(b);
        return (
          <line
            key={`e${index}`}
            x1={x1.toFixed(1)}
            y1={y1.toFixed(1)}
            x2={x2.toFixed(1)}
            y2={y2.toFixed(1)}
            stroke={edgeColor}
            strokeWidth="1.6"
            strokeLinecap="round"
            opacity="0.75"
          />
        );
      })}
      {boxes.map((box, index) => (
        <polygon
          key={`b${index}`}
          points={pts(
            at(box.x, box.y),
            at(box.x + box.w, box.y),
            at(box.x + box.w, box.y + box.h),
            at(box.x, box.y + box.h)
          )}
          fill={boxColor}
          fillOpacity="0.16"
          stroke={boxColor}
          strokeWidth="1.4"
        />
      ))}
    </g>
  );
}

/**
 * Ink on a horizontal face — the glass room's table screen (§ 5 slice 16).
 *
 * Sibling of `IsoPanelInk` and the same idea one plane over: `IsoBox` draws the
 * lid, this draws on it. The two exist separately because a vertical plane is
 * spanned by one tile axis and the up vector while a lid is spanned by both
 * tile axes, and collapsing them into one helper would take four vectors to
 * describe two shapes.
 *
 * @param {{
 *   w: number, d: number, x?: number, y?: number, lift?: number,
 *   bars: Array<{ x: number, y: number, w: number, h: number, c: string }>
 * }} props `lift` is the height of the face being drawn on, not of the box.
 */
export function IsoTopInk({ w, d, x = 0, y = 0, lift = 0, bars }) {
  const cx = (x - y) * UX;
  const cy = (x + y) * UY - lift;
  const hx = w / 2;
  const hy = d / 2;
  const A = corner(cx, cy, -hx, -hy);
  const B = corner(cx, cy, hx, -hy);
  const D = corner(cx, cy, -hx, hy);

  /** @param {number} u @param {number} v */
  const at = (u, v) => [
    A[0] + (B[0] - A[0]) * u + (D[0] - A[0]) * v,
    A[1] + (B[1] - A[1]) * u + (D[1] - A[1]) * v
  ];

  return (
    <g>
      {bars.map((bar, index) => (
        <polygon
          key={index}
          points={pts(
            at(bar.x, bar.y),
            at(bar.x + bar.w, bar.y),
            at(bar.x + bar.w, bar.y + bar.h),
            at(bar.x, bar.y + bar.h)
          )}
          fill={bar.c}
        />
      ))}
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

/** The monitor's screen face: 0.32 tiles wide, 19 px tall, on top of the stalk. */
const SCREEN_X = DESK_X - 0.34;
const SCREEN_Y = DESK_Y + 0.3;
const SCREEN_LIFT = DESK_H + 4;
const SCREEN_W = 0.32;
const SCREEN_H = 19;

/**
 * *Their own work*, as rectangles (docs/office-isometric-mode.md § 5 slice 6).
 *
 * A look is a background wash plus a handful of bars in screen-face fractions —
 * `x`/`w` across the panel, `y`/`h` down from its top. At 19 px tall on a stage
 * that scales below 1 on a phone, the wash is what actually reads; the bars are
 * texture. That is the intended fidelity (§ 3): a look costs a data row, not an
 * art asset, and nothing here implies the cast produced anything (ADR-0010).
 */
const SCREEN_LOOKS = {
  terminal: {
    bg: '#0b2b1d',
    bars: [
      { x: 0.08, y: 0.14, w: 0.56, h: 0.12, c: '#4ade80' },
      { x: 0.08, y: 0.36, w: 0.78, h: 0.12, c: '#4ade80' },
      { x: 0.08, y: 0.58, w: 0.34, h: 0.12, c: '#86efac' },
      { x: 0.08, y: 0.8, w: 0.14, h: 0.12, c: '#bbf7d0' }
    ]
  },
  tabs: {
    bg: '#dfe6ef',
    bars: [
      { x: 0.04, y: 0.06, w: 0.14, h: 0.16, c: '#94a3b8' },
      { x: 0.22, y: 0.06, w: 0.14, h: 0.16, c: '#cbd5e1' },
      { x: 0.4, y: 0.06, w: 0.14, h: 0.16, c: '#94a3b8' },
      { x: 0.58, y: 0.06, w: 0.14, h: 0.16, c: '#cbd5e1' },
      { x: 0.76, y: 0.06, w: 0.14, h: 0.16, c: '#94a3b8' },
      { x: 0.08, y: 0.36, w: 0.82, h: 0.52, c: '#f8fafc' }
    ]
  },
  spreadsheet: {
    bg: '#f1f5f9',
    bars: [
      { x: 0.06, y: 0.1, w: 0.88, h: 0.14, c: '#15803d' },
      { x: 0.06, y: 0.36, w: 0.4, h: 0.12, c: '#94a3b8' },
      { x: 0.54, y: 0.36, w: 0.4, h: 0.12, c: '#94a3b8' },
      { x: 0.06, y: 0.58, w: 0.4, h: 0.12, c: '#cbd5e1' },
      { x: 0.54, y: 0.58, w: 0.4, h: 0.12, c: '#cbd5e1' }
    ]
  },
  slides: {
    bg: '#1e3a8a',
    bars: [
      { x: 0.1, y: 0.14, w: 0.62, h: 0.16, c: '#f8fafc' },
      { x: 0.1, y: 0.42, w: 0.34, h: 0.42, c: '#38bdf8' },
      { x: 0.52, y: 0.5, w: 0.36, h: 0.1, c: '#bfdbfe' },
      { x: 0.52, y: 0.68, w: 0.28, h: 0.1, c: '#bfdbfe' }
    ]
  },
  tickets: {
    bg: '#fef6ec',
    bars: [
      { x: 0.06, y: 0.12, w: 0.12, h: 0.16, c: '#f97316' },
      { x: 0.24, y: 0.14, w: 0.68, h: 0.12, c: '#cbd5e1' },
      { x: 0.06, y: 0.42, w: 0.12, h: 0.16, c: '#f97316' },
      { x: 0.24, y: 0.44, w: 0.56, h: 0.12, c: '#cbd5e1' },
      { x: 0.06, y: 0.72, w: 0.12, h: 0.16, c: '#dc2626' },
      { x: 0.24, y: 0.74, w: 0.68, h: 0.12, c: '#cbd5e1' }
    ]
  },
  calendar: {
    bg: '#eef2ff',
    bars: [
      { x: 0.06, y: 0.08, w: 0.88, h: 0.1, c: '#6366f1' },
      { x: 0.06, y: 0.28, w: 0.4, h: 0.26, c: '#a5b4fc' },
      { x: 0.54, y: 0.28, w: 0.4, h: 0.26, c: '#c7d2fe' },
      { x: 0.06, y: 0.62, w: 0.4, h: 0.26, c: '#c7d2fe' },
      { x: 0.54, y: 0.62, w: 0.4, h: 0.26, c: '#a5b4fc' }
    ]
  }
};

/**
 * The monitor, with whatever that character is pretending to work on — or, at
 * your own desk, with what you are actually working on (§ 5 slice 16).
 *
 * Bars are drawn *after* the panel in the same group — SVG paint order does the
 * layering, so they need no depth trickery, only a hair of `+y` to sit proud of
 * the face they are on.
 *
 * The player's background stays `#3b82f6` whether the board is empty or not.
 * It is a landmark — the blue screen is how you pick your own desk out of
 * sixteen at a glance — so the board adds rows to it and never repaints it.
 * An empty slot therefore renders exactly what it always did.
 *
 * @param {{
 *   look?: string,
 *   you?: boolean,
 *   board?: import('../../utils/officeFloorBoard.js').BoardState | null
 * }} props
 */
export function MonitorScreen({ look, you = false, board = null }) {
  const art = you ? null : SCREEN_LOOKS[look];
  const bg = you ? '#3b82f6' : (art?.bg ?? SCREEN);
  const bars = you ? (board?.bars ?? []) : (art?.bars ?? []);

  return (
    <g className={you ? 'floor-screen floor-screen--you' : 'floor-screen'}>
      <IsoBox
        w={SCREEN_W}
        d={0.04}
        h={SCREEN_H}
        color={bg}
        x={SCREEN_X}
        y={SCREEN_Y}
        lift={SCREEN_LIFT}
      />
      {bars.map((bar, index) => (
        <IsoBox
          key={index}
          w={SCREEN_W * bar.w}
          d={0.012}
          h={SCREEN_H * bar.h}
          color={bar.c}
          x={SCREEN_X - SCREEN_W / 2 + SCREEN_W * (bar.x + bar.w / 2)}
          y={SCREEN_Y + 0.02}
          lift={SCREEN_LIFT + SCREEN_H * (1 - bar.y - bar.h)}
        />
      ))}
    </g>
  );
}

/**
 * A desk with its chair — the seat's furniture, drawn around the occupant.
 * `part: 'chair'` renders behind the person, `'desk'` in front of them, which
 * is what makes them read as *sitting* rather than standing in a desk.
 *
 * @param {{
 *   part: 'chair' | 'desk',
 *   you?: boolean,
 *   look?: string,
 *   board?: import('../../utils/officeFloorBoard.js').BoardState | null
 * }} props `board` reaches only the player's monitor — a colleague's screen
 *   shows their own fiction, and always will (ADR-0010).
 */
export function DeskFurniture({ part, you = false, look, board = null }) {
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
      <MonitorScreen look={look} you={you} board={board} />
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
 * `board` is what *you* are working on, and reaches exactly the two props that
 * can honestly show it: the whiteboard and the glass room's table. Every other
 * entry ignores it, which is why it rides the same options object rather than
 * becoming a second parameter.
 *
 * @type {Record<string, (opts: {
 *   span: number,
 *   axis: 'x' | 'y',
 *   board: import('../../utils/officeFloorBoard.js').BoardState | null
 * }) => import('react').ReactNode>}
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
  /*
   * The board carries *your* diagram when you have one, and the architecture
   * from two re-orgs ago when you do not (§ 5 slice 16). The ink goes on last,
   * over the shading wash rather than under it: a 8% dark wash across a 1.4 px
   * stroke is the difference between a diagram and a smudge.
   */
  whiteboard: ({ board }) => (
    <g>
      <IsoBox w={0.1} d={1.5} h={12} color={DARK} />
      <IsoPanel span={1.5} axis="y" h={62} color="#f8fafc" opacity={0.95} />
      <IsoPanel span={1.5} axis="y" h={62} color={DARK} opacity={0.08} />
      {board?.mini?.nodes?.length ? (
        <IsoPanelInk
          span={1.5}
          axis="y"
          h={62}
          boxes={board.mini.nodes}
          edges={board.mini.edges}
          boxColor={BOARD_INK.box}
          edgeColor={BOARD_INK.edge}
        />
      ) : null}
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
  /*
   * The laptop on the table shows what the meeting is about — which, since the
   * only thing this office ever meets about is your diagram, is your diagram.
   */
  meetingTable: ({ board }) => (
    <g>
      <IsoBox w={1.9} d={1.1} h={24} color={WOOD} />
      <IsoBox w={0.3} d={0.24} h={5} color={SCREEN} lift={24} />
      {board?.bars?.length ? <IsoTopInk w={0.3} d={0.24} lift={29} bars={board.bars} /> : null}
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
 * @param {{
 *   kind: string,
 *   span?: number,
 *   axis?: 'x' | 'y',
 *   board?: import('../../utils/officeFloorBoard.js').BoardState | null
 * }} props
 */
export function FloorPropArt({ kind, span = 2, axis = 'x', board = null }) {
  return PROP_ART[kind]?.({ span, axis, board }) ?? null;
}
