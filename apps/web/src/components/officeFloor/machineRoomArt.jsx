/**
 * Art for the Machine Room (floor B1): the room shell and its furniture.
 *
 * Same conventions as `isoArt.jsx` — every piece is drawn in `PROP_VIEW`
 * space with (0, 0) at the centre of its floor tile, so `MachineRoom` places
 * it with `projectIso` and nothing else — and built from the same `IsoBox`.
 *
 * A rack's lights are the one piece of state in here, and they come from the
 * Night Shift's own column (`nightShiftCards`), never from a second reading of
 * the ledgers: green and blinking for a night that shipped, amber for a run
 * that merged nothing, dark with one red lamp for a no-show, dim violet for a
 * parked automation.
 */

import { IsoBox } from './isoArt.jsx';
import {
  FLOOR_BOUNDS,
  GRID_H,
  GRID_W,
  STAGE_H,
  STAGE_W,
  TILE_H,
  TILE_W,
  WALL_H,
  projectIso,
  wallPoint
} from '../../utils/officeFloorPlan.js';

const UX = TILE_W / 2;
const UY = TILE_H / 2;

/** Rack footprint, in tile fractions, and height in stage px. */
const RACK = Object.freeze({ w: 0.78, d: 0.7, h: 104 });

/** LED strips per rack, bottom to top. */
const LED_ROWS = 6;

/**
 * Colour per strip, per column. Index 0 is the bottom strip.
 *
 * @type {Record<string, (row: number) => string>}
 */
const LED_INK = {
  shipped: (row) => (row % 2 ? '#22d3ee' : '#4ade80'),
  checked: (row) => (row % 3 === 0 ? '#fbbf24' : '#a16207'),
  noShow: (row) => (row === LED_ROWS - 1 ? '#ef4444' : '#1f2937'),
  onLeave: () => '#6d5fb5'
};

function pts(points) {
  return points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
}

/**
 * A point on a box's +y face (the one turned to the viewer's left), `dx` tiles
 * along it from the face's centre and `z` stage px up from the floor.
 *
 * @param {number} dx @param {number} z @param {number} hy half the box depth
 * @returns {[number, number]}
 */
function leftFace(dx, z, hy) {
  return [(dx - hy) * UX, (dx + hy) * UY - z];
}

/**
 * One server rack, lit by what its crew member did last night.
 *
 * @param {{ column?: string, emoji?: string, name?: string }} props
 */
export function RackArt({ column = 'noShow', emoji = '', name = '' }) {
  const hy = RACK.d / 2 + 0.005;
  const ink = LED_INK[column] ?? LED_INK.noShow;
  const strips = Array.from({ length: LED_ROWS }, (_, row) => {
    const z = 16 + row * 12;
    return (
      <polygon
        key={row}
        className="machine-room-led"
        style={{ animationDelay: `${(row * 173) % 900}ms` }}
        points={pts([
          leftFace(-0.27, z, hy),
          leftFace(0.12, z, hy),
          leftFace(0.12, z + 4, hy),
          leftFace(-0.27, z + 4, hy)
        ])}
        fill={ink(row)}
      />
    );
  });
  // The label plate, drawn flat in the face's own plane: one tile along the
  // face is (+UX, +UY) on screen, so the face's x-axis has slope UY / UX.
  const [px, py] = leftFace(-0.31, RACK.h - 10, hy);
  return (
    <g className={`machine-room-rack-art is-${column}`}>
      <IsoBox w={RACK.w} d={RACK.d} h={RACK.h} color="#2a313d" />
      {strips}
      <g transform={`matrix(1 ${UY / UX} 0 1 ${px.toFixed(1)} ${py.toFixed(1)})`}>
        <rect x="0" y="-9" width="40" height="12" rx="1.5" fill="#0f141c" />
        <text x="3" y="0.5" fontSize="8" fill="#e5e7eb">
          {emoji}
        </text>
        <text x="13" y="0" fontSize="5.4" fontWeight="700" fill="#cbd5e1">
          {name.slice(0, 9).toUpperCase()}
        </text>
      </g>
      {column === 'shipped' ? (
        <circle className="machine-room-beacon" cx="0" cy={-RACK.h - 6} r="3.4" fill="#4ade80" />
      ) : null}
    </g>
  );
}

/** The legacy box: two tape reels and a label nobody is allowed to act on. */
export function MainframeArt() {
  const hy = 0.6;
  const reel = (dx) => {
    const [cx, cy] = leftFace(dx, 58, hy + 0.01);
    return (
      <g key={dx}>
        <ellipse
          cx={cx}
          cy={cy}
          rx="9"
          ry="11"
          fill="#1f2937"
          transform={`rotate(-26 ${cx} ${cy})`}
        />
        <ellipse
          cx={cx}
          cy={cy}
          rx="3"
          ry="3.6"
          fill="#9ca3af"
          transform={`rotate(-26 ${cx} ${cy})`}
        />
      </g>
    );
  };
  const [lx, ly] = leftFace(-0.5, 26, hy + 0.01);
  return (
    <g>
      <IsoBox w={1.5} d={1.2} h={92} color="#c8bfa8" />
      {reel(-0.35)}
      {reel(0.05)}
      <g transform={`matrix(1 ${UY / UX} 0 1 ${lx.toFixed(1)} ${ly.toFixed(1)})`}>
        <rect x="0" y="-8" width="62" height="11" fill="#fde047" />
        <text x="3" y="0.5" fontSize="6" fontWeight="800" fill="#1f2937">
          DO NOT UNPLUG
        </text>
      </g>
    </g>
  );
}

/** Computer-room air conditioning: a tall white cabinet with a grille. */
export function CracArt() {
  const hy = 0.55;
  const slats = Array.from({ length: 6 }, (_, i) => {
    const z = 22 + i * 7;
    return (
      <polyline
        key={i}
        points={pts([leftFace(-0.38, z, hy + 0.01), leftFace(0.38, z, hy + 0.01)])}
        stroke="#94a3b8"
        strokeWidth="1.4"
      />
    );
  });
  return (
    <g>
      <IsoBox w={1.2} d={1.1} h={78} color="#e5e7eb" />
      {slats}
    </g>
  );
}

/** The on-call cot: canvas, a pillow, a blanket nobody folded. */
export function CotArt() {
  return (
    <g>
      <IsoBox w={1.6} d={0.62} h={12} color="#4d7c4f" />
      <IsoBox w={0.34} d={0.5} h={5} color="#f1f5f9" x={-0.56} lift={12} />
      <IsoBox w={0.7} d={0.56} h={2} color="#7f1d1d" x={0.3} lift={12} />
    </g>
  );
}

/** @type {Record<string, () => import('react').ReactNode>} */
export const MACHINE_ROOM_PROP_ART = {
  mainframe: MainframeArt,
  crac: CracArt,
  cot: CotArt
};

/**
 * The room itself: concrete walls, a raised floor, a cable tray and a sign.
 * One SVG behind everything, for the same reason `FloorRoom` is one.
 *
 * @param {{ signage: string }} props
 */
export function MachineRoomShell({ signage }) {
  const n = projectIso(FLOOR_BOUNDS.minX, FLOOR_BOUNDS.minY);
  const e = projectIso(FLOOR_BOUNDS.maxX, FLOOR_BOUNDS.minY);
  const s = projectIso(FLOOR_BOUNDS.maxX, FLOOR_BOUNDS.maxY);
  const w = projectIso(FLOOR_BOUNDS.minX, FLOOR_BOUNDS.maxY);

  const grid = [];
  for (let i = 0; i <= GRID_W; i += 1) {
    const x = FLOOR_BOUNDS.minX + i;
    grid.push([projectIso(x, FLOOR_BOUNDS.minY), projectIso(x, FLOOR_BOUNDS.maxY)]);
  }
  for (let i = 0; i <= GRID_H; i += 1) {
    const y = FLOOR_BOUNDS.minY + i;
    grid.push([projectIso(FLOOR_BOUNDS.minX, y), projectIso(FLOOR_BOUNDS.maxX, y)]);
  }

  // Perforated cold-aisle tiles: the aisle in front of each rack row.
  const perforated = [];
  for (let x = 3; x <= 8; x += 1) perforated.push([x, 2], [x, 6]);

  const tray = [wallPoint('ne', 0.4, WALL_H - 14), wallPoint('ne', GRID_W - 0.4, WALL_H - 14)];
  const sign = wallPoint('ne', 4.2, 104);

  return (
    <svg
      className="office-floor-room machine-room-shell"
      width={STAGE_W}
      height={STAGE_H}
      viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
      aria-hidden="true"
      focusable="false"
    >
      <polygon
        points={pts([
          [n.left, n.top],
          [e.left, e.top],
          [wallPoint('ne', GRID_W, WALL_H).left, wallPoint('ne', GRID_W, WALL_H).top],
          [wallPoint('ne', 0, WALL_H).left, wallPoint('ne', 0, WALL_H).top]
        ])}
        fill="#2b3240"
      />
      <polygon
        points={pts([
          [n.left, n.top],
          [w.left, w.top],
          [wallPoint('nw', GRID_H, WALL_H).left, wallPoint('nw', GRID_H, WALL_H).top],
          [wallPoint('nw', 0, WALL_H).left, wallPoint('nw', 0, WALL_H).top]
        ])}
        fill="#222936"
      />
      <polyline
        points={pts(tray.map((p) => [p.left, p.top]))}
        stroke="#4b5563"
        strokeWidth="5"
        fill="none"
      />
      <polyline
        points={pts(tray.map((p) => [p.left, p.top - 3]))}
        stroke="#f59e0b"
        strokeWidth="1.2"
        strokeDasharray="6 9"
        fill="none"
      />
      <g transform={`matrix(1 ${UY / UX} 0 1 ${sign.left.toFixed(1)} ${sign.top.toFixed(1)})`}>
        <rect x="0" y="0" width="150" height="18" rx="2" fill="#facc15" />
        <rect x="2" y="2" width="146" height="14" rx="1.5" fill="#111827" />
        <text x="75" y="12.5" fontSize="8.2" fontWeight="800" fill="#facc15" textAnchor="middle">
          {signage.toUpperCase()}
        </text>
      </g>

      <polygon
        points={pts([
          [n.left, n.top],
          [e.left, e.top],
          [s.left, s.top],
          [w.left, w.top]
        ])}
        fill="#3a4352"
      />
      {perforated.map(([x, y]) => {
        const c = projectIso(x, y);
        return (
          <polygon
            key={`${x},${y}`}
            points={pts([
              [c.left, c.top - UY * 0.8],
              [c.left + UX * 0.8, c.top],
              [c.left, c.top + UY * 0.8],
              [c.left - UX * 0.8, c.top]
            ])}
            fill="#455063"
            stroke="#56637a"
            strokeDasharray="1.5 2.5"
          />
        );
      })}
      <g stroke="rgba(148, 163, 184, 0.16)" strokeWidth="1">
        {grid.map(([a, b], i) => (
          <line key={i} x1={a.left} y1={a.top} x2={b.left} y2={b.top} />
        ))}
      </g>
      <polygon
        points={pts([
          [n.left, n.top],
          [e.left, e.top],
          [s.left, s.top],
          [w.left, w.top]
        ])}
        fill="none"
        stroke="rgba(15, 23, 42, 0.6)"
        strokeWidth="2"
      />
    </svg>
  );
}
