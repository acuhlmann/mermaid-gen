/**
 * The static room: floor plate, tile grid, zone plates and labels, and the two
 * back walls. One SVG behind every positioned prop and person, because none of
 * it is interactive and none of it ever needs to interleave with the cast —
 * the room is always behind everyone standing in it.
 */

import {
  FLOOR_BOUNDS,
  FLOOR_ZONES,
  GRID_H,
  GRID_W,
  STAGE_H,
  STAGE_W,
  WALL_H,
  projectIso,
  zoneCentre,
  zonePolygon
} from '../../utils/officeFloorPlan.js';

const ZONE_FILL = {
  neutral: 'rgba(148, 163, 184, 0.16)',
  glass: 'rgba(125, 211, 252, 0.2)',
  kitchen: 'rgba(251, 191, 36, 0.16)',
  pod: 'rgba(59, 130, 246, 0.13)'
};

function poly(points) {
  return points.map((p) => `${p.left.toFixed(1)},${p.top.toFixed(1)}`).join(' ');
}

/** A point on a back wall: `t` tiles along it, `h` px up from the floor. */
function wallPoint(axis, t, h) {
  const base =
    axis === 'ne'
      ? projectIso(FLOOR_BOUNDS.minX + t, FLOOR_BOUNDS.minY)
      : projectIso(FLOOR_BOUNDS.minX, FLOOR_BOUNDS.minY + t);
  return { left: base.left, top: base.top - h };
}

/**
 * @param {{ youTile?: { x: number, y: number } | null }} props
 */
export function FloorRoom({ youTile = null }) {
  const n = projectIso(FLOOR_BOUNDS.minX, FLOOR_BOUNDS.minY);
  const e = projectIso(FLOOR_BOUNDS.maxX, FLOOR_BOUNDS.minY);
  const s = projectIso(FLOOR_BOUNDS.maxX, FLOOR_BOUNDS.maxY);
  const w = projectIso(FLOOR_BOUNDS.minX, FLOOR_BOUNDS.maxY);

  const gridLines = [];
  for (let i = 0; i <= GRID_W; i += 1) {
    const x = FLOOR_BOUNDS.minX + i;
    gridLines.push({ a: projectIso(x, FLOOR_BOUNDS.minY), b: projectIso(x, FLOOR_BOUNDS.maxY) });
  }
  for (let i = 0; i <= GRID_H; i += 1) {
    const y = FLOOR_BOUNDS.minY + i;
    gridLines.push({ a: projectIso(FLOOR_BOUNDS.minX, y), b: projectIso(FLOOR_BOUNDS.maxX, y) });
  }

  // Three windows along the north-east wall. The view is the car park.
  const windows = [1.4, 4.4, 7.4].map((t0) => [
    wallPoint('ne', t0, 92),
    wallPoint('ne', t0 + 2.2, 92),
    wallPoint('ne', t0 + 2.2, 34),
    wallPoint('ne', t0, 34)
  ]);

  return (
    <svg
      className="office-floor-room"
      width={STAGE_W}
      height={STAGE_H}
      viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
      aria-hidden="true"
      focusable="false"
    >
      {/* Back walls, drawn before the floor so the floor's edge sits over them. */}
      <polygon
        points={poly([n, e, wallPoint('ne', GRID_W, WALL_H), wallPoint('ne', 0, WALL_H)])}
        fill="#dfe6f1"
      />
      <polygon
        points={poly([n, w, wallPoint('nw', GRID_H, WALL_H), wallPoint('nw', 0, WALL_H)])}
        fill="#cdd7e6"
      />
      {/* The fill is a CSS variable rather than a literal so the office day can
          move it (slice 20): the hour lands on `data-day-phase` at the floor
          root and the light is a stylesheet's business, not a prop's. The
          fallback keeps the pane painted for any mount outside that root. */}
      {windows.map((pointsForWindow, i) => (
        <polygon
          key={i}
          className="office-floor-window"
          points={poly(pointsForWindow)}
          fill="var(--office-window-tint, #bfe4fb)"
          opacity="0.9"
        />
      ))}

      <polygon points={poly([n, e, s, w])} fill="#eef2f8" />

      {FLOOR_ZONES.map((zone) => (
        <polygon key={zone.id} points={poly(zonePolygon(zone.rect))} fill={ZONE_FILL[zone.tone]} />
      ))}

      <g stroke="rgba(15, 23, 42, 0.07)" strokeWidth="1">
        {gridLines.map((line, i) => (
          <line key={i} x1={line.a.left} y1={line.a.top} x2={line.b.left} y2={line.b.top} />
        ))}
      </g>

      <polygon
        points={poly([n, e, s, w])}
        fill="none"
        stroke="rgba(15, 23, 42, 0.18)"
        strokeWidth="2"
      />

      {youTile ? (
        <polygon
          className="office-floor-you-tile"
          points={poly([
            projectIso(youTile.x - 0.5, youTile.y - 0.5),
            projectIso(youTile.x + 0.5, youTile.y - 0.5),
            projectIso(youTile.x + 0.5, youTile.y + 0.5),
            projectIso(youTile.x - 0.5, youTile.y + 0.5)
          ])}
        />
      ) : null}
    </svg>
  );
}

/**
 * Zone signage, on its own layer *above* the props.
 *
 * Painted into the room SVG these read as markings on the carpet, which is
 * physically right and practically useless: a desk standing on a zone hides
 * most of its label. Signage floats, with a halo so it stays legible over
 * anything, and never moves when the furniture does.
 *
 * @param {{ zoneLabels?: Record<string, string> }} props
 */
export function FloorZoneLabels({ zoneLabels = {} }) {
  return (
    <svg
      className="office-floor-signage"
      width={STAGE_W}
      height={STAGE_H}
      viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
      aria-hidden="true"
      focusable="false"
    >
      {FLOOR_ZONES.map((zone) => {
        const label = zoneLabels[zone.id];
        if (!label) return null;
        const centre = zoneCentre(zone.rect);
        return (
          <text
            key={zone.id}
            className="office-floor-zone-label"
            x={centre.left}
            y={centre.top}
            textAnchor="middle"
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}

export default FloorRoom;
