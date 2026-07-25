/**
 * The floor, made clickable (docs/office-isometric-mode.md § 5 slice 7).
 *
 * A transparent surface over the room that turns a point into a tile to walk
 * to, plus the marker showing which tile that would be. It sits *under* every
 * prop and person (z-index 1 against a lowest prop depth of 20), so the cast's
 * `<button>`s keep their clicks and only bare floor — including the furniture,
 * which is `pointer-events: none` — falls through to here.
 *
 * The marker doubles as the room's answer to "may I go there": where
 * `standableTileAt` finds nowhere legal it simply does not appear, so the
 * fishbowl reads as sealed before you click rather than after (§ 6 rule 17).
 *
 * Pointer-only by design, and `aria-hidden` for that reason — a 1210×800
 * clickable region is noise to a screen reader. The keyboard route to the same
 * tiles is arrow-key stepping in `OfficeFloor`, and people remain real buttons.
 */

import { useCallback, useState } from 'react';
import { STAGE_H, STAGE_W, projectIso } from '../../utils/officeFloorPlan.js';
import { sameTile, standableTileAtPoint } from '../../utils/officeFloorMovement.js';

/** The diamond outline of one tile, as SVG polygon points. */
function tilePoints(tile) {
  return [
    projectIso(tile.x - 0.5, tile.y - 0.5),
    projectIso(tile.x + 0.5, tile.y - 0.5),
    projectIso(tile.x + 0.5, tile.y + 0.5),
    projectIso(tile.x - 0.5, tile.y + 0.5)
  ]
    .map((p) => `${p.left.toFixed(1)},${p.top.toFixed(1)}`)
    .join(' ');
}

/**
 * @param {{
 *   scale: number,
 *   origin: { x: number, y: number } | null,
 *   onWalkTo: (tile: { x: number, y: number }) => void
 * }} props `origin` is where you are standing now — reachability is a
 *   different question from standing room, so the snap needs it (§ 6 rule 17).
 */
export function FloorRoam({ scale, origin, onWalkTo }) {
  const [hover, setHover] = useState(null);

  /*
   * The stage is authored at STAGE_W×STAGE_H and CSS-scaled to fit, so the
   * on-screen box is `scale` times the coordinate space every tile is in.
   * Dividing back out is what makes one click handler work at every zoom.
   */
  const tileFrom = useCallback(
    (event) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const left = (event.clientX - rect.left) / (scale || 1);
      const top = (event.clientY - rect.top) / (scale || 1);
      return standableTileAtPoint(left, top, { from: origin });
    },
    [scale, origin]
  );

  const handleMove = useCallback(
    (event) => {
      const tile = tileFrom(event);
      setHover((current) => (sameTile(current, tile) ? current : tile));
    },
    [tileFrom]
  );

  const handleClick = useCallback(
    (event) => {
      const tile = tileFrom(event);
      if (tile) onWalkTo(tile);
    },
    [tileFrom, onWalkTo]
  );

  return (
    <div
      className="office-floor-roam"
      data-testid="office-floor-roam"
      style={{ width: STAGE_W, height: STAGE_H }}
      aria-hidden="true"
      onClick={handleClick}
      onPointerMove={handleMove}
      onPointerLeave={() => setHover(null)}
    >
      {hover ? (
        <svg
          className="office-floor-roam-marker"
          width={STAGE_W}
          height={STAGE_H}
          viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
          aria-hidden="true"
          focusable="false"
        >
          <polygon points={tilePoints(hover)} />
        </svg>
      ) : null}
    </div>
  );
}

export default FloorRoam;
