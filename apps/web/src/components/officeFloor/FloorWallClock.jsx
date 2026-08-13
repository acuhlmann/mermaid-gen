/**
 * The wall clock — the one surface that *reads* the hour the office runs on
 * (docs/office-isometric-mode.md § 5 slice 25).
 *
 * Since slice 20 the room has told the time as mood: window tint, wall colour,
 * mugs at nine, papers at five, and — since slice 24 — a drift toward the
 * kitchen between two and half four. All of it is felt; nothing states it.
 * The clock is the same fact made legible, and it reads the **same instant**
 * the day-phase dial does (`officeWallClockAt` beside `officeDayPhaseAt`), so
 * the hands and the light can never disagree about the hour. One clock, two
 * faces.
 *
 * **A screen-space circle on the wall, not a projected ellipse.** The windows
 * are skewed parallelograms because they are two tiles wide — the skew is
 * visible. A 26 px face has almost nothing to skew, and this is the one art on
 * the floor whose job is to be *read*: a tilted dial with foreshortened hands
 * would cost legibility for a projection accuracy nobody can see at this size.
 * Zone labels and name chips set the precedent — chrome on the room stays
 * flat.
 *
 * **Its own layer rather than part of `FloorRoom`.** The room SVG is static by
 * design; the hands move once a minute, so they live on a separate layer that
 * repaints alone. Drawn right after the room and before everything walkable —
 * it hangs on a wall, so nothing in the room can be behind it except the wall
 * itself, and `pointer-events: none` keeps it from catching a click that was
 * meant for the floor.
 *
 * **The face carries its own light.** Every phase grades five tokens pinned by
 * `officeFloorStyles.test.js`; a face that needs grading at all five would owe
 * that file five more values to buy nothing — white ink on a white face reads
 * on every wall the phases can produce, including the dimmed after-hours one.
 * And nothing here is *animated* (the hands hard-cut every minute, exactly like
 * the light hard-cuts at every phase), so the clock owes the reduced-motion
 * block nothing either.
 */

import { FLOOR_WALL_CLOCK, STAGE_H, STAGE_W, wallPoint } from '../../utils/officeFloorPlan.js';
import { useOfficeWallClock } from './useOfficeWallClock.js';

/** The four cardinal ticks, in degrees clockwise from twelve. */
const TICK_DEGREES = [0, 90, 180, 270];

/**
 * The accessible label is the time itself. HH:MM in 24-hour form is
 * locale-neutral by construction — the office's chrome copy swaps whole
 * bundles per language, but a clock face that reads "15:47" needs no
 * translation, so this one string deliberately never enters a bundle.
 */
function clockLabel(hour, minute) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/**
 * The wall clock on the north-west wall. Self-contained: it reads the wall
 * clock itself (the cadence's `officeWallClockAt`, the same instant the
 * day-phase dial uses), so the floor hands it nothing and it can never
 * disagree with the light.
 */
export function FloorWallClock() {
  const { hour, minute, hourDeg, minuteDeg } = useOfficeWallClock();
  const centre = wallPoint(FLOOR_WALL_CLOCK.axis, FLOOR_WALL_CLOCK.t, FLOOR_WALL_CLOCK.h);
  const { r } = FLOOR_WALL_CLOCK;

  return (
    <svg
      className="office-floor-wall-clock"
      width={STAGE_W}
      height={STAGE_H}
      viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
      role="img"
      aria-label={clockLabel(hour, minute)}
      focusable="false"
    >
      <g
        transform={`translate(${centre.left} ${centre.top})`}
        data-testid="office-floor-wall-clock"
      >
        <circle className="office-floor-wall-clock-face" r={r} />
        {TICK_DEGREES.map((deg) => (
          <line
            key={deg}
            className="office-floor-wall-clock-tick"
            transform={`rotate(${deg})`}
            y1={-(r - 4)}
            y2={-(r - 9)}
          />
        ))}
        {/* SVG `rotate` is clockwise for positive degrees with y pointing
            down — which is exactly what a clock wants, so the angles the
            cadence returns go on the transforms unchanged. */}
        <line
          className="office-floor-wall-clock-hand office-floor-wall-clock-hand--hour"
          transform={`rotate(${hourDeg})`}
          y2={-r * 0.5}
        />
        <line
          className="office-floor-wall-clock-hand office-floor-wall-clock-hand--minute"
          transform={`rotate(${minuteDeg})`}
          y2={-r * 0.78}
        />
        <circle className="office-floor-wall-clock-pin" r={2.2} />
      </g>
    </svg>
  );
}

export default FloorWallClock;
