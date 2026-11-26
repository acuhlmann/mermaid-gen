/**
 * The Night Shift kanban, hung on the north-west wall
 * (`features/nightShift/`).
 *
 * The standup is a moment; this is the record of it. It shows the shape of the
 * night from across the room — one sticky note per crew member, in the column
 * the ledgers put them in — and pressing it opens the board card, where the
 * words live. Same split as the whiteboard and the **Look closer** card: the
 * room carries shape, the card carries text (`officeFloorBoard.js` header).
 *
 * **Drawn in the wall's own plane.** Everything is laid out in a flat local
 * frame (u across, v down) and one SVG matrix maps that frame onto the wall:
 * along the north-west wall, one tile is (+½ TILE_W, −½ TILE_H) on screen when
 * read left to right, so the frame's x-axis is `(1, −TILE_H / TILE_W)` and its
 * y-axis is straight down. The clock is the one wall art drawn flat, because a
 * 26 px dial has nothing to skew; a 112 px board does, and a flat one would
 * read as a sticker on the glass rather than a thing on the wall.
 *
 * **Its own layer, not a `FLOOR_PROPS` row.** A prop row is furniture: it is an
 * obstacle, a sight-line blocker and a standable-tile veto, and adding one
 * re-derives every peek mark on the floor. A wall board is none of those.
 */

import { useState, useSyncExternalStore } from 'react';
import {
  hasUnseenNightShift,
  nightShiftCounts
} from '../../features/nightShift/nightShiftBoard.js';
import { NIGHT_SHIFT_COPY } from '../../features/nightShift/nightShiftCopy.js';
import { getNightShiftManifest } from '../../features/nightShift/nightShiftManifest.js';
import {
  getNightShiftSnapshot,
  openNightShiftBoard,
  subscribeNightShift
} from '../../features/nightShift/nightShiftStore.js';
import {
  FLOOR_NIGHT_SHIFT_BOARD,
  STAGE_H,
  STAGE_W,
  TILE_H,
  TILE_W,
  wallPoint
} from '../../utils/officeFloorPlan.js';
import '../../features/nightShift/NightShift.css';

/** Sticky-note colours, by column — the board card uses the same four. */
const COLUMN_INK = Object.freeze({
  shipped: '#7ee0a1',
  checked: '#f5d76e',
  noShow: '#ff9b8f',
  onLeave: '#b4a6f8'
});

/** The three columns drawn on the wall; "on leave" folds into the last one. */
const WALL_COLUMNS = Object.freeze(['shipped', 'checked', 'noShow']);

/** Most notes one column shows before it stacks the rest under a "+n". */
const MAX_NOTES = 3;

const SLOPE = -TILE_H / TILE_W;

/** Board geometry in its local frame, derived once from the plan constant. */
function boardFrame() {
  const { axis, t0, t1, h0, h1 } = FLOOR_NIGHT_SHIFT_BOARD;
  // Read left to right, the board starts at the far end of the wall (t1).
  const origin = wallPoint(axis, t1, h1);
  const width = (t1 - t0) * (TILE_W / 2);
  const height = h1 - h0;
  const corners = [
    origin,
    wallPoint(axis, t0, h1),
    wallPoint(axis, t0, h0),
    wallPoint(axis, t1, h0)
  ];
  const left = Math.min(...corners.map((p) => p.left));
  const right = Math.max(...corners.map((p) => p.left));
  const top = Math.min(...corners.map((p) => p.top));
  const bottom = Math.max(...corners.map((p) => p.top));
  // The hit box is the bounding rectangle, clipped back to the board's own
  // parallelogram so the two empty corners stay clickable floor.
  const clip = `polygon(${corners
    .map((p) => `${(p.left - left).toFixed(1)}px ${(p.top - top).toFixed(1)}px`)
    .join(', ')})`;
  return {
    origin,
    width,
    height,
    box: { left, top, width: right - left, height: bottom - top, clip }
  };
}

/**
 * Self-contained like the wall clock: it reads the baked manifest and the
 * Night Shift store itself, so the floor hands it only whether it may be
 * pressed. During the arrival ceremony, or from a glass-room chair, it is
 * scenery.
 *
 * @param {{ interactive?: boolean }} props
 */
export function FloorNightShiftBoard({ interactive = false }) {
  const { seenShiftDate } = useSyncExternalStore(
    subscribeNightShift,
    getNightShiftSnapshot,
    getNightShiftSnapshot
  );
  const [lit, setLit] = useState(false);
  const manifest = getNightShiftManifest();
  const counts = nightShiftCounts(manifest);
  const unseen = hasUnseenNightShift(manifest, seenShiftDate);
  const label = NIGHT_SHIFT_COPY.boardAria;
  const name = NIGHT_SHIFT_COPY.wallLabel;
  const { origin, width, height, box } = boardFrame();
  const pad = 5;
  const headerH = 13;
  const colGap = 4;
  const colW = (width - pad * 2 - colGap * (WALL_COLUMNS.length - 1)) / WALL_COLUMNS.length;
  const noteW = Math.min(18, colW - 6);
  const noteH = 11;
  const columnCount = (id) => (id === 'noShow' ? counts.noShow + counts.onLeave : counts[id]);

  return (
    <>
      <svg
        className="office-floor-night-shift-art"
        width={STAGE_W}
        height={STAGE_H}
        viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
        aria-hidden="true"
        focusable="false"
      >
        <g
          transform={`matrix(1 ${SLOPE} 0 1 ${origin.left} ${origin.top})`}
          data-testid="office-floor-night-shift-board"
          data-unseen={unseen ? 'true' : 'false'}
        >
          <rect
            width={width}
            height={height}
            rx="2"
            fill="#5a3d24"
            stroke={lit ? '#8ab4ff' : 'none'}
            strokeWidth="2.5"
          />
          <rect x="2" y="2" width={width - 4} height={height - 4} rx="1.5" fill="#1b2438" />
          <text
            x={pad}
            y={pad + 7}
            fill="#dbe4ff"
            fontSize="7.5"
            fontWeight="700"
            letterSpacing="0.6"
          >
            {name.toUpperCase()}
          </text>
          {unseen ? (
            <circle
              className="office-floor-night-shift-new"
              cx={width - pad - 3}
              cy={pad + 4}
              r="3"
              fill="#ff9b8f"
            />
          ) : null}
          {WALL_COLUMNS.map((id, index) => {
            const x = pad + index * (colW + colGap);
            const top = pad + headerH;
            const count = columnCount(id);
            const shown = Math.min(count, MAX_NOTES);
            return (
              <g key={id} data-column={id} data-count={count}>
                <rect
                  x={x}
                  y={top}
                  width={colW}
                  height={height - top - pad}
                  fill="rgba(255,255,255,0.06)"
                />
                <rect x={x} y={top} width={colW} height="2" fill={COLUMN_INK[id]} />
                {Array.from({ length: shown }, (_, n) => (
                  <rect
                    key={n}
                    x={x + (colW - noteW) / 2 + (n % 2 === 0 ? -1 : 1)}
                    y={top + 5 + n * (noteH + 3)}
                    width={noteW}
                    height={noteH}
                    rx="1"
                    fill={COLUMN_INK[id]}
                  />
                ))}
                {count > MAX_NOTES ? (
                  <text
                    x={x + colW / 2}
                    y={height - pad - 2}
                    fill="#dbe4ff"
                    fontSize="6"
                    textAnchor="middle"
                  >
                    +{count - MAX_NOTES}
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>
      </svg>
      {interactive ? (
        <button
          type="button"
          className="office-floor-night-shift-hit"
          style={{
            left: box.left,
            top: box.top,
            width: box.width,
            height: box.height,
            clipPath: box.clip
          }}
          data-testid="office-floor-night-shift-open"
          aria-label={label}
          title={label}
          onClick={() => openNightShiftBoard(manifest.shiftDate)}
          onMouseEnter={() => setLit(true)}
          onMouseLeave={() => setLit(false)}
          onFocus={() => setLit(true)}
          onBlur={() => setLit(false)}
        />
      ) : null}
    </>
  );
}

export default FloorNightShiftBoard;
