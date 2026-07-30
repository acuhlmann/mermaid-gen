/**
 * The office floor plan — pure geometry + layout data for isometric mode
 * (docs/office-isometric-mode.md, ADR-0011).
 *
 * This module is the floor's single source of truth: where the room is, who
 * sits where, and which props stand on which tile. It is deliberately pure
 * data + pure math (no JSX, no React, no DOM) so the layout can be asserted in
 * tests and later reused for walk-path waypoints (slice 2) without dragging a
 * renderer along.
 *
 * Coordinates are **tiles**, not pixels. The grid runs `x` down-right and `y`
 * down-left; `projectIso` turns a tile into a stage pixel using the classic 2:1
 * projection, and `depthOf` gives the painter's-algorithm order (nearer things
 * — larger x + y — paint later).
 *
 *     screen x = (x - y) * TILE_W / 2       screen y = (x + y) * TILE_H / 2
 *
 * Seat rows are the floor's answer to `personaFaceTraits`: a new cast member
 * costs one row here, and a test fails until they get one.
 */

/** Tile footprint in stage pixels. 2:1 is the standard isometric ratio. */
export const TILE_W = 112;
export const TILE_H = 56;

/** Tiles across (x) and deep (y). The floor plate spans −0.5 … GRID−0.5. */
export const GRID_W = 12;
export const GRID_H = 9;

/** Tile (0,0) lands here on the stage, leaving headroom for the back walls. */
export const ORIGIN_X = 520;
export const ORIGIN_Y = 120;

/**
 * The logical stage. Everything is laid out at this fixed size and then scaled
 * to fit the viewport by the renderer, so layout math never depends on the
 * device — the reason a phone and a 4K monitor show the same room.
 */
export const STAGE_W = 1210;
export const STAGE_H = 800;

/** Height of the two back walls, in stage pixels. */
export const WALL_H = 132;

/**
 * The SVG canvas every prop and seat is drawn on, with (0, 0) at the centre of
 * its floor tile — so a prop is positioned by `projectIso` plus this offset and
 * nothing else. Tall props (server rack, glass) draw upward into `minY`.
 *
 * Lives here rather than beside the art because component modules may only
 * export components (Fast Refresh).
 */
export const PROP_VIEW = { w: 260, h: 260, minX: -130, minY: -200 };
export const PROP_VIEW_BOX = `${PROP_VIEW.minX} ${PROP_VIEW.minY} ${PROP_VIEW.w} ${PROP_VIEW.h}`;

/**
 * Project a tile coordinate to a point on the stage. Accepts fractional tiles
 * so props can sit between tiles (the meeting table straddles four).
 *
 * @param {number} x
 * @param {number} y
 * @returns {{ left: number, top: number }}
 */
export function projectIso(x, y) {
  return {
    left: ORIGIN_X + (x - y) * (TILE_W / 2),
    top: ORIGIN_Y + (x + y) * (TILE_H / 2)
  };
}

/**
 * Horizontal bias for a speech bubble so edge speakers do not clip off the
 * stage. A counter-scaled bubble is ~60vw wide; centred on someone at the left
 * of the room it eats half the viewport. `start` shifts the balloon toward
 * screen-centre from a left-edge speaker, `end` the mirror for the right.
 *
 * @param {{ x: number, y: number }} tile
 * @returns {'start' | 'center' | 'end'}
 */
export function bubbleAlignForTile(tile) {
  if (!tile || !Number.isFinite(tile.x) || !Number.isFinite(tile.y)) return 'center';
  const { left } = projectIso(tile.x, tile.y);
  const ratio = left / STAGE_W;
  if (ratio < 0.34) return 'start';
  if (ratio > 0.66) return 'end';
  return 'center';
}

/** Counter-scaled bubble width at stage scale 1 (§ 6 rule 29). */
const BUBBLE_W = 264;
/** Typical bubble height above the speaker's head. */
const BUBBLE_H = 75;
/** `--align-start` / `--align-end` shift (OfficeFloor.css). */
const BUBBLE_SHIFT_RATIO = 0.42;
const BUBBLE_OVER_SEAT_LIFT = 82;
const BUBBLE_OVER_STANDING_LIFT = 52;

/**
 * Screen-space box for a speech bubble anchored on a tile. Approximates the
 * painted footprint at scale 1 so occlusion can be tested without a browser.
 *
 * @param {{ x: number, y: number }} tile
 * @param {'start' | 'center' | 'end'} align
 * @param {{ standing?: boolean }} [options]
 * @returns {{ x0: number, x1: number, y0: number, y1: number }}
 */
export function bubbleScreenBox(tile, align, { standing = true } = {}) {
  const { left, top } = projectIso(tile.x, tile.y);
  const lift = standing ? BUBBLE_OVER_STANDING_LIFT : BUBBLE_OVER_SEAT_LIFT;
  const bottom = top - lift - 6;
  const y0 = bottom - BUBBLE_H;
  const y1 = bottom;
  let x0 = left - BUBBLE_W / 2;
  let x1 = left + BUBBLE_W / 2;
  if (align === 'start') {
    const shift = BUBBLE_W * BUBBLE_SHIFT_RATIO;
    x0 += shift;
    x1 += shift;
  } else if (align === 'end') {
    const shift = BUBBLE_W * BUBBLE_SHIFT_RATIO;
    x0 -= shift;
    x1 -= shift;
  }
  return { x0, x1, y0, y1 };
}

function bubbleVictimIds(tile, align, speakerId, standing) {
  const bubble = bubbleScreenBox(tile, align, { standing });
  return FLOOR_SEATS.filter((seat) => {
    if (seat.id === speakerId || seat.id === YOU_SEAT_ID) return false;
    return boxesOverlap(bubble, headBox({ x: seat.x, y: seat.y }, { seated: true }));
  }).map((seat) => seat.id);
}

/**
 * Horizontal bias for a speech bubble: edge clipping first (rule 28), then
 * sideways shift when a centred balloon would cover a bystander's head (rule 29).
 *
 * @param {{ x: number, y: number }} tile where the speaker is standing
 * @param {string} speakerId cast id — excluded from bystander checks
 * @param {{ standing?: boolean }} [options] false when the speaker is seated at a desk
 * @returns {'start' | 'center' | 'end'}
 */
export function bubbleAlignForSpeaker(tile, speakerId, { standing = true } = {}) {
  const edge = bubbleAlignForTile(tile);
  if (edge !== 'center') return edge;

  const centerVictims = new Set(bubbleVictimIds(tile, 'center', speakerId, standing));
  if (centerVictims.size === 0) return 'center';

  const startVictims = new Set(bubbleVictimIds(tile, 'start', speakerId, standing));
  const endVictims = new Set(bubbleVictimIds(tile, 'end', speakerId, standing));
  const clearedByStart = [...centerVictims].filter((id) => !startVictims.has(id)).length;
  const clearedByEnd = [...centerVictims].filter((id) => !endVictims.has(id)).length;

  if (clearedByStart > clearedByEnd) return 'start';
  if (clearedByEnd > clearedByStart) return 'end';
  if (clearedByStart > 0) return 'start';

  if (startVictims.size < centerVictims.size && startVictims.size <= endVictims.size) {
    return 'start';
  }
  if (endVictims.size < centerVictims.size) return 'end';
  return 'center';
}

/**
 * `projectIso` backwards: a point on the stage to the (fractional) tile under
 * it. Two callers need this and both are about *you* rather than the layout —
 * turning a click on the floor into somewhere to walk, and reading a walker's
 * live position off its transform so an interrupted walk can carry on from
 * where it actually got to rather than snapping back.
 *
 * @param {number} left
 * @param {number} top
 * @returns {{ x: number, y: number }}
 */
export function unprojectIso(left, top) {
  const dx = (left - ORIGIN_X) / (TILE_W / 2);
  const dy = (top - ORIGIN_Y) / (TILE_H / 2);
  return { x: (dx + dy) / 2, y: (dy - dx) / 2 };
}

/**
 * Painter's-algorithm depth for a tile: things closer to the viewer (larger
 * x + y) paint on top. Scaled by 10 so a seat's own parts (chair / person /
 * desk) can interleave within one tile without colliding with the next.
 *
 * @param {number} x
 * @param {number} y
 * @returns {number}
 */
export function depthOf(x, y) {
  return Math.round((x + y) * 10);
}

/** The floor plate's outer corners, in tiles (north, east, south, west). */
export const FLOOR_BOUNDS = {
  minX: -0.5,
  minY: -0.5,
  maxX: GRID_W - 0.5,
  maxY: GRID_H - 0.5
};

/**
 * Zone plates: tinted floor regions with a label. `rect` is
 * `[x0, y0, x1, y1]` in tiles and projects to a parallelogram. `copyKey` looks
 * the label up in `officeChromeCopy().floor.zones` so zones localize like the
 * rest of the office.
 *
 * @type {Array<{ id: string, rect: [number, number, number, number], tone: 'neutral' | 'glass' | 'kitchen' | 'pod' }>}
 */
export const FLOOR_ZONES = [
  { id: 'reception', rect: [-0.5, -0.5, 2.3, 1.7], tone: 'neutral' },
  { id: 'leadership', rect: [5.3, -0.5, 9.7, 1.0], tone: 'glass' },
  { id: 'kitchen', rect: [-0.5, 5.6, 2.7, 8.5], tone: 'kitchen' },
  { id: 'meeting', rect: [9.4, 5.7, 11.5, 8.5], tone: 'glass' },
  { id: 'pod', rect: [3.6, 3.6, 9.4, 8.5], tone: 'pod' },
  { id: 'hrCorner', rect: [9.4, 3.2, 11.5, 5.4], tone: 'neutral' }
];

/**
 * The four projected corners of a zone rect, for an SVG polygon.
 *
 * @param {[number, number, number, number]} rect
 * @returns {Array<{ left: number, top: number }>}
 */
export function zonePolygon([x0, y0, x1, y1]) {
  return [projectIso(x0, y0), projectIso(x1, y0), projectIso(x1, y1), projectIso(x0, y1)];
}

/**
 * The centre of a zone rect — where its label sits.
 *
 * @param {[number, number, number, number]} rect
 * @returns {{ left: number, top: number }}
 */
export function zoneCentre([x0, y0, x1, y1]) {
  return projectIso((x0 + x1) / 2, (y0 + y1) / 2);
}

/**
 * Which floor zone contains a tile (first match). Used for per-room room-tone
 * shaping without new audio assets — see `setRoomToneZone`.
 *
 * @param {{ x: number, y: number } | null | undefined} tile
 * @returns {'neutral' | 'glass' | 'kitchen' | 'pod'}
 */
export function floorZoneToneAt(tile) {
  if (!tile || !Number.isFinite(tile.x) || !Number.isFinite(tile.y)) return 'neutral';
  for (const zone of FLOOR_ZONES) {
    const [x0, y0, x1, y1] = zone.rect;
    if (tile.x >= x0 && tile.x <= x1 && tile.y >= y0 && tile.y <= y1) {
      return zone.tone;
    }
  }
  return 'neutral';
}

/**
 * Who sits where. `id` doubles as the React key and the `PersonaFace` id, so
 * the player's seat uses the same `'you'` convention as the meeting overlay
 * (unknown id → `fallbackEmoji`).
 *
 * `desk: false` means they are on their feet — Gary lives at the fridge, not at
 * a workstation.
 *
 * @type {Array<{ id: string, x: number, y: number, desk: boolean, zone: string }>}
 */
export const FLOOR_SEATS = [
  // You, near the front of the room, facing your own monitor.
  { id: 'you', x: 7, y: 7, desk: true, zone: 'pod' },

  // Your team — the six advisor personas at adjacent desks. The two engineers
  // sit next to each other, which is the entire joke.
  { id: 'gilfoyle', x: 6, y: 4, desk: true, zone: 'pod' },
  { id: 'dinesh', x: 7, y: 4, desk: true, zone: 'pod' },
  { id: 'erlich', x: 4, y: 6, desk: true, zone: 'pod' },
  { id: 'jared', x: 8, y: 5, desk: true, zone: 'pod' },
  { id: 'richard', x: 5, y: 8, desk: true, zone: 'pod' },
  { id: 'russ', x: 9, y: 6, desk: true, zone: 'pod' },

  // The floor.
  { id: 'helpdesk', x: 2, y: 2, desk: true, zone: 'reception' },
  { id: 'scrumMaster', x: 5, y: 2, desk: true, zone: 'floor' },
  { id: 'intern', x: 2, y: 5, desk: true, zone: 'floor' },
  { id: 'greybeard', x: 9, y: 2, desk: true, zone: 'floor' },
  { id: 'hr', x: 10, y: 4, desk: true, zone: 'hrCorner' },
  { id: 'facilities', x: 1, y: 6, desk: false, zone: 'kitchen' },

  // Leadership, in a glass row along the back wall. Four people, one window.
  { id: 'belson', x: 6, y: 0, desk: true, zone: 'leadership' },
  { id: 'cfo', x: 7, y: 0, desk: true, zone: 'leadership' },
  { id: 'ciso', x: 8, y: 0, desk: true, zone: 'leadership' },
  { id: 'barker', x: 9, y: 0, desk: true, zone: 'leadership' }
];

/** The player's seat id — the tile "sit down" returns you to. */
export const YOU_SEAT_ID = 'you';

/**
 * Environment props. `span` / `axis` apply to `glassPanel` only (a partition
 * running `span` tiles along the given axis).
 *
 * @type {Array<{ kind: string, x: number, y: number, span?: number, axis?: 'x' | 'y' }>}
 */
export const FLOOR_PROPS = [
  { kind: 'receptionDesk', x: 1, y: 1 },
  /*
   * Moved back and screen-left from 3.4/0.6 when the printer became usable
   * (§ 6 rule 22). At 3.4/0.6 it sat on the depth line where Pam's and Linda's
   * *name chips* live — invisible, wider than the figures they label, and above
   * the printer in paint order. Only 11 of 441 sampled points on the printer
   * reached the printer; its own centre selected Pam. One row back clears both
   * boxes on depth alone.
   */
  { kind: 'printer', x: 2.4, y: 0.6 },
  // Nudged a tile screen-right of 6.8/2.2 (§ 6 rule 11): it stood a third of a
  // tile from the only spot you can look at Pam's calendar from, and pushed
  // that mark two tiles down the aisle — a peek that read as loitering.
  { kind: 'whiteboard', x: 7.8, y: 2.4 },
  { kind: 'serverRack', x: 10.4, y: 1.2 },
  { kind: 'fridge', x: 0.2, y: 6.6 },
  { kind: 'coffeeMachine', x: 1, y: 7.4 },
  // Tucked into the kitchen corner: at 2.4/8.2 it stood exactly where somebody
  // on a coffee break has to stand, and hid them from the chest up.
  { kind: 'waterCooler', x: 0.4, y: 8.2 },
  { kind: 'meetingTable', x: 10.4, y: 6.9 },
  { kind: 'plant', x: 0, y: 3.6 },
  { kind: 'plant', x: 11.2, y: 3 },
  { kind: 'plant', x: 3, y: 8.2 },
  /*
   * Glass: the leadership row, then the two walls of the meeting room.
   *
   * The leadership panel and its two returns enclose the whole leadership row,
   * with the floor plate's own back edge closing the fourth side. The returns
   * sit at x 5.3 and x 10.7 — **wider than the `leadership` zone rect**, whose
   * far edge is 9.7, and that gap is the point rather than a mismatch: the
   * tinted plate is signage, the glass is a barrier, and a barrier that only
   * spanned the signage would be one you could walk around the end of. The
   * strip between 9.7 and 10.7 is where the server rack stands. The front panel
   * used to stop at x 9.8 while
   * the row runs x 6…10, which sealed the fishbowl only from the south — the
   * direction `PEEK_OFFSETS` happen to approach from. Free roam (slice 7) can
   * walk at the ends, and walked straight round the partition to stand beside
   * the CTO. § 6 rule 17's payoff is that the room refuses entry by being a
   * room; that only holds if the walls actually meet.
   */
  { kind: 'glassPanel', x: 8, y: 1.05, span: 5.4, axis: 'x' },
  { kind: 'glassPanel', x: 5.3, y: 0.275, span: 1.55, axis: 'y' },
  { kind: 'glassPanel', x: 10.7, y: 0.275, span: 1.55, axis: 'y' },
  { kind: 'glassPanel', x: 9.45, y: 7.1, span: 2.8, axis: 'y' },
  { kind: 'glassPanel', x: 10.45, y: 5.65, span: 2.1, axis: 'x' }
];

/**
 * @param {string} id
 * @returns {{ id: string, x: number, y: number, desk: boolean, zone: string } | null}
 */
export function seatFor(id) {
  return FLOOR_SEATS.find((seat) => seat.id === id) ?? null;
}

/**
 * Where a colleague stands when they walk over to bother you: beside your desk,
 * one step nearer the viewer, so they are drawn after it and never half-buried.
 */
export const VISITOR_TILE = { x: 8, y: 7 };

/** Where you stand on your first day, before anybody has given you a desk. */
export const RECEPTION_TILE = { x: 2, y: 1 };

/**
 * Where set pieces happen (slice 4). Coffee happens by the machine; a battle
 * happens across the aisle in the open plan, where the floor can watch.
 *
 * Two placement rules, both learned the hard way:
 *
 * 1. **Equal depth** (`x + y` the same for both marks) puts the pair side by
 *    side on screen instead of one eclipsing the other.
 * 2. **Pick a column no seat occupies.** Tiles sharing `x - y` land in the same
 *    screen column, so a mark two tiles of depth from a desk in that column
 *    stacks the standing figure on the seated one's head. No seat sits at
 *    `x - y` of ±1 (the battle marks) or −4/−6 (the coffee marks).
 */
export const COFFEE_TILES = [
  { x: 2, y: 8 },
  { x: 3, y: 7 }
];
export const BATTLE_TILES = [
  { x: 4, y: 5 },
  { x: 5, y: 4 }
];

/**
 * Where the team stands when they ring your desk for a huddle (renderer #2).
 * Closer than a coffee break — they lean in around YOUR seat at (7, 7). Six
 * marks so a full Your Team roster surrounds you without stacking heads.
 */
export const HUDDLE_TILES = [
  { x: 6, y: 7 },
  { x: 8, y: 7 },
  { x: 7, y: 6 },
  { x: 7, y: 8 },
  { x: 6, y: 8 },
  { x: 8, y: 6 }
];

/**
 * Seats around the meeting table, inside the glass room (slice 5). Eight of
 * them — `MEETING_ROSTER_MAX` — in seating order, so a two-person huddle and a
 * full steering committee both look deliberate.
 *
 * The room is 2 tiles wide and the table is nearly all of it, so there is no
 * mark at either *end* of the table: screen-left is the glass wall (with
 * Ulrich's desk a tile beyond it), screen-right is the edge of the floor plate.
 * The head of the table is therefore seat 0, the far-centre mark **across the
 * table from you** — which is where a facilitator stands anyway, facing the room.
 *
 * Three geometry rules decide the two rows (see § 6 of the design doc):
 *
 * 1. **The far row must paint before the table** (`x + y` < the table's 17.3)
 *    and the near row after it, so the table hides the far side's laps and the
 *    near side's torsos sit in front of it. That single ordering is what makes
 *    eight people read as *seated around* a table rather than standing near one.
 * 2. **The far row keeps out of Ulrich's screen column** (rule 10). His desk at
 *    (9, 6) is one tile beyond the glass, only ~1 tile of depth behind the far
 *    row, so a mark in his column would drop a head onto his. `x - y > 3.6`
 *    clears him; the near row is 2+ tiles nearer and clears him on depth alone.
 * 3. **Neighbours may overlap; strangers may not.** A tile of screen column is
 *    56 px and a head is 34, so four people along one side of a 1.9-tile table
 *    must overlap a little — which is exactly what a crowded table looks like,
 *    and the nearer one paints in front. What must never overlap is a meeting
 *    attendee and somebody working at their own desk.
 *
 * @type {Array<{ x: number, y: number }>}
 */
export const MEETING_SEATS = [
  { x: 10.3, y: 6.1 }, // the head — across the table from you
  { x: 10.1, y: 7.7 }, // beside you, screen-left
  { x: 10.9, y: 7.7 }, // beside you, screen-right
  { x: 10.7, y: 6.1 }, // across, next to the head
  { x: 9.7, y: 7.7 }, // near side, outer left
  { x: 11.3, y: 7.7 }, // near side, outer right
  { x: 9.9, y: 6.1 }, // far side, outer left
  { x: 11.1, y: 6.1 } // far side, outer right
];

/**
 * Your chair: the near-centre mark. The meeting is the one place "you" should
 * be visibly in the room rather than at your desk, and the near centre is both
 * the most legible spot and the one that reads as the room facing you.
 */
export const MEETING_PLAYER_TILE = { x: 10.5, y: 7.7 };

/**
 * The depth line (`x + y`) a meeting speech bubble sits on, whoever is talking.
 *
 * Anchored on the speaker's own tile the bubble is a disaster, and only a
 * capture shows it: the glass room renders ~170 px wide, a `FloorBubble` is
 * ~264 px, so a line spoken *in* the room blankets the room. Parked on one
 * depth line above the back wall it clears every head, stops jumping about
 * between beats, and still points down the speaker's column.
 */
export const MEETING_BUBBLE_DEPTH = 12.8;

/**
 * The point straight above a tile in screen space: same column, lifted onto the
 * given depth line. Moving equally along `-x` and `-y` cancels in screen `x`,
 * which is the same trick that shifts a monitor sideways (§ 6 rule 1) run the
 * other way round.
 *
 * @param {{ x: number, y: number }} tile
 * @param {number} depth target `x + y`
 * @returns {{ x: number, y: number }}
 */
export function liftToDepth(tile, depth) {
  const half = (tile.x + tile.y - depth) / 2;
  return { x: tile.x - half, y: tile.y - half };
}

/**
 * Who sits on which mark. The facilitator takes the head; everyone else keeps
 * the order they were invited in, so the first few attendees land beside you.
 *
 * @param {string[]} attendees
 * @param {string} [facilitatorId]
 * @returns {Array<{ id: string, tile: { x: number, y: number } }>}
 */
export function meetingSeating(attendees, facilitatorId = '') {
  const ids = (Array.isArray(attendees) ? attendees : []).filter(
    (id, index, all) => typeof id === 'string' && id.length > 0 && all.indexOf(id) === index
  );
  const head = ids.includes(facilitatorId) ? facilitatorId : null;
  const ordered = head ? [head, ...ids.filter((id) => id !== head)] : ids;
  return ordered
    .slice(0, MEETING_SEATS.length)
    .map((id, index) => ({ id, tile: MEETING_SEATS[index] }));
}

/**
 * A figure's screen footprint, in stage px: a 34 px `PersonaFace` head over a
 * 24 px torso pulled up 10 px to overlap it, so 34 wide by **48** tall — not 58
 * (§ 6 rule 14; the overlap is what fuses head and body into one figure).
 * Confirmed against `getBoundingClientRect()` in a capture rather than read off
 * the stylesheet, and lifted 30 px when seated (§ 6 rule 2).
 *
 * These are the honest form of § 6 rule 10. "No mark may share `x - y` with a
 * desk" is the integer shorthand, and it does not survive fractional marks —
 * what the rule is actually about is one figure's head landing on another's,
 * which is a rectangle intersection. Every mark family that came after the
 * meeting seats is validated with these boxes rather than the shorthand.
 */
export const FIGURE_HALF_W = 17;
export const FIGURE_H = 48;
export const FIGURE_HEAD_H = 34;
export const SEATED_LIFT = 30;

/**
 * @param {{ x: number, y: number }} tile
 * @param {{ seated?: boolean }} [options] seated by default — every mark family
 *   so far is a chair; the peeker standing at somebody's desk is the exception.
 * @returns {{ x0: number, x1: number, y0: number, y1: number }}
 */
export function figureBox(tile, { seated = true } = {}) {
  const { left, top } = projectIso(tile.x, tile.y);
  const feet = top - (seated ? SEATED_LIFT : 0);
  return { x0: left - FIGURE_HALF_W, x1: left + FIGURE_HALF_W, y0: feet - FIGURE_H, y1: feet };
}

/** Just the head — the part that must never be covered. */
export function headBox(tile, options) {
  const box = figureBox(tile, options);
  return { ...box, y1: box.y0 + FIGURE_HEAD_H };
}

/**
 * @param {{ x0: number, x1: number, y0: number, y1: number }} a
 * @param {{ x0: number, x1: number, y0: number, y1: number }} b
 */
export function boxesOverlap(a, b) {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}

/** Tiles closer than this to a path count as walking through the furniture. */
const OBSTACLE_RADIUS = 0.55;

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Everything a walker should not stroll through: other people's seats and the
 * glass partitions (sampled into points along their span).
 *
 * @param {string} walkerId
 */
function obstaclesFor(walkerId) {
  const blocked = FLOOR_SEATS.filter((seat) => seat.id !== walkerId).map(({ x, y }) => ({ x, y }));
  for (const prop of FLOOR_PROPS) {
    if (prop.kind !== 'glassPanel') continue;
    const span = prop.span ?? 2;
    for (let t = -span / 2; t <= span / 2; t += 0.5) {
      blocked.push(prop.axis === 'y' ? { x: prop.x, y: prop.y + t } : { x: prop.x + t, y: prop.y });
    }
  }
  return blocked;
}

/**
 * How much furniture a path clips, sampled along each leg. Used only to choose
 * between two candidate routes — this is a tie-breaker, not a pathfinder.
 *
 * @param {Array<{x: number, y: number}>} path
 * @param {string} walkerId
 */
export function pathCost(path, walkerId) {
  const blocked = obstaclesFor(walkerId);
  let cost = 0;
  for (let leg = 1; leg < path.length; leg += 1) {
    const from = path[leg - 1];
    const to = path[leg];
    const steps = Math.max(1, Math.ceil(distance(from, to) * 4));
    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps;
      const point = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
      if (blocked.some((b) => distance(point, b) < OBSTACLE_RADIUS)) cost += 1;
    }
  }
  return cost;
}

/**
 * Waypoints for a colleague walking from their desk to yours.
 *
 * Deliberately not a pathfinder: an L-shaped route reads as "down the aisle,
 * then turn", which looks more like an office walk than a diagonal drift across
 * the room. We build both L's (along x first, along y first) and keep whichever
 * clips less furniture. Residual clipping is fine — depth ordering makes a
 * walker passing a desk read as passing *behind* it.
 *
 * @param {string} seatId
 * @param {{x: number, y: number}} [target]
 * @returns {Array<{x: number, y: number}>} at least two points, or [] if unseated
 */
export function walkPathFrom(seatId, target = VISITOR_TILE) {
  const seat = seatFor(seatId);
  if (!seat) return [];
  return walkPathBetween({ x: seat.x, y: seat.y }, target, seatId);
}

/**
 * The same L-route choice between two arbitrary tiles — used when the walker
 * has no desk to start from (you, arriving at reception on your first day).
 *
 * @param {{x: number, y: number}} from
 * @param {{x: number, y: number}} to
 * @param {string} [walkerId] excluded from the obstacle set
 * @returns {Array<{x: number, y: number}>}
 */
export function walkPathBetween(from, to, walkerId = '') {
  const start = { x: from.x, y: from.y };
  const target = { x: to.x, y: to.y };
  const xFirst = [start, { x: target.x, y: start.y }, target];
  const yFirst = [start, { x: start.x, y: target.y }, target];
  const dedupe = (path) =>
    path.filter((p, i) => i === 0 || p.x !== path[i - 1].x || p.y !== path[i - 1].y);
  return pathCost(xFirst, walkerId) <= pathCost(yFirst, walkerId) ? dedupe(xFirst) : dedupe(yFirst);
}

/**
 * Every id with a seat on the floor, player included.
 *
 * @returns {string[]}
 */
export function floorSeatIds() {
  return FLOOR_SEATS.map((seat) => seat.id);
}

/* ── desk peeking (slice 6) ─────────────────────────────────────────────── */

/**
 * The glass partitions as line segments in tile space. `FLOOR_PROPS` stores a
 * panel as centre + span; a walk has to be checked against the whole wall, and
 * the sampled points `obstaclesFor` uses are a cost heuristic, not a barrier.
 *
 * @returns {Array<{ from: {x: number, y: number}, to: {x: number, y: number} }>}
 */
export function glassSegments() {
  return FLOOR_PROPS.filter((prop) => prop.kind === 'glassPanel').map((prop) => {
    const half = (prop.span ?? 2) / 2;
    return prop.axis === 'y'
      ? { from: { x: prop.x, y: prop.y - half }, to: { x: prop.x, y: prop.y + half } }
      : { from: { x: prop.x - half, y: prop.y }, to: { x: prop.x + half, y: prop.y } };
  });
}

function orientation(a, b, c) {
  const value = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  if (Math.abs(value) < 1e-9) return 0;
  return value > 0 ? 1 : -1;
}

/** Proper crossing only: a path that merely touches a wall's end is fine. */
function segmentsCross(a1, a2, b1, b2) {
  return (
    orientation(a1, a2, b1) !== orientation(a1, a2, b2) &&
    orientation(b1, b2, a1) !== orientation(b1, b2, a2)
  );
}

/**
 * Does this route walk through a glass wall? Clipping a desk is fine — depth
 * ordering makes it read as passing behind — but a wall is a wall, and it is
 * what keeps the leadership fishbowl a fishbowl.
 *
 * @param {Array<{x: number, y: number}>} path
 * @returns {boolean}
 */
export function pathCrossesGlass(path) {
  const walls = glassSegments();
  for (let leg = 1; leg < path.length; leg += 1) {
    for (const wall of walls) {
      if (segmentsCross(path[leg - 1], path[leg], wall.from, wall.to)) return true;
    }
  }
  return false;
}

/**
 * Where you might stand to look over somebody's shoulder, in preference order.
 * Every offset moves **nearer the viewer** (so you paint in front of their desk
 * instead of behind it) and lands in a screen column that clears their monitor
 * — see `coversTheMonitor`. `{ dx: 0, dy: 1 }`, the obvious "beside them"
 * choice, is exactly the one that does not: it parks you on the screen.
 */
export const PEEK_OFFSETS = [
  { dx: 1, dy: 0 },
  { dx: 1, dy: 1 },
  { dx: 2, dy: 0 },
  { dx: 0, dy: 2 },
  { dx: 2, dy: 1 }
];

/** Marks that belong to another staging; two people on one tile is one person. */
function reservedMarks() {
  return [
    VISITOR_TILE,
    ...COFFEE_TILES,
    ...BATTLE_TILES,
    // HUDDLE_TILES deliberately absent: the ring only exists while a huddle is
    // live, and permanently reserving it strands Richard's peek/approach marks.
    MEETING_PLAYER_TILE,
    ...MEETING_SEATS
  ];
}

const STAND_SEAT_CLEARANCE = 0.8;
const STAND_PROP_CLEARANCE = 0.7;
/** A prop nearer than this that paints later stands in front of whoever stands here. */
const STAND_PROP_OCCLUSION_RANGE = 1.5;

/**
 * The monitor sits ~34 px to the screen-left of its desk and is ~26 px wide
 * (§ 6 rule 1, `DeskFurniture` in isoArt.jsx). A peeker one tile along `+y`
 * lands 56 px screen-left — squarely between the viewer and the screen they
 * walked over to read.
 */
const MONITOR_LEFT_PX = -34;
const MONITOR_HALF_W = 13;

function coversTheMonitor(mark, seat) {
  const monitor = projectIso(seat.x, seat.y).left + MONITOR_LEFT_PX;
  return Math.abs(projectIso(mark.x, mark.y).left - monitor) < FIGURE_HALF_W + MONITOR_HALF_W;
}

/**
 * Can you see the desk from the mark? Two different questions, deliberately
 * asked with two different tests:
 *
 * - **Glass** blocks only when the sight line properly *crosses* it. A radius
 *   test gets this wrong in both directions — the meeting-room wall runs
 *   parallel to russ's mark half a tile away and blocks nothing, while the
 *   leadership row's wall is exactly what stands between you and the CFO.
 * - **Furniture and colleagues** block by proximity to the line. The server
 *   rack is what makes the CEO unpeekable: there is a standable tile in front
 *   of him, and a rack of blinkenlights between it and his desk.
 */
function hasClearSightTo(mark, seat) {
  const desk = { x: seat.x, y: seat.y };
  if (pathCrossesGlass([mark, desk])) return false;

  const blockers = [
    ...FLOOR_SEATS.filter((other) => other.id !== seat.id && other.id !== YOU_SEAT_ID),
    ...FLOOR_PROPS.filter((prop) => prop.kind !== 'glassPanel')
  ];
  const steps = Math.max(1, Math.ceil(distance(mark, desk) * 4));
  for (let step = 1; step < steps; step += 1) {
    const t = step / steps;
    const point = { x: mark.x + (desk.x - mark.x) * t, y: mark.y + (desk.y - mark.y) * t };
    if (blockers.some((blocker) => distance(point, blocker) < OBSTACLE_RADIUS)) return false;
  }
  return true;
}

/**
 * Is this a tile somebody could actually stand on and be seen? Furniture, other
 * people's marks and other people's heads all veto it.
 *
 * This is the room's own answer to "may a figure stand here", with nothing
 * peek-specific in it, so free roam (slice 7) and the peek marks share one
 * definition — the geometry rules in § 6 are expensive to rediscover and there
 * should only ever be one place that encodes them.
 *
 * @param {{ x: number, y: number }} mark
 * @param {{ excludeSeatId?: string }} [options] Whose seat to skip in the face
 *   test. Defaults to you — the walker for most mark families. Pass a
 *   wanderer's `seatId` when validating marks they will occupy while you stay
 *   seated (§ 6 rule 27).
 * @returns {boolean}
 */
export function isStandableTile(mark, options = {}) {
  const { excludeSeatId = YOU_SEAT_ID } = options;
  if (!isOnFloor(mark.x, mark.y)) return false;
  if (reservedMarks().some((tile) => distance(tile, mark) < 0.5)) return false;
  return clearsFurniture(mark) && clearsFaces(mark, excludeSeatId);
}

/** Room to stand: not inside a desk, not inside the furniture, not behind it. */
function clearsFurniture(mark) {
  for (const other of FLOOR_SEATS) {
    if (distance(other, mark) < STAND_SEAT_CLEARANCE) return false;
  }
  for (const prop of FLOOR_PROPS) {
    if (prop.kind === 'glassPanel') continue;
    const gap = distance(prop, mark);
    if (gap < STAND_PROP_CLEARANCE) return false;
    // § 6 rule 11 the other way round: the marks move, the furniture does not.
    if (gap < STAND_PROP_OCCLUSION_RANGE && depthOf(prop.x, prop.y) >= depthOf(mark.x, mark.y)) {
      return false;
    }
  }
  return true;
}

/**
 * Nobody's face may be covered, in either direction — § 6 rules 10 and 14,
 * measured with the real 48 px figure rather than the stylesheet's apparent
 * height.
 */
function clearsFaces(mark, excludeSeatId = YOU_SEAT_ID) {
  const standing = { seated: false };
  for (const other of FLOOR_SEATS) {
    if (other.id === excludeSeatId) continue;
    const theirs = { x: other.x, y: other.y };
    if (boxesOverlap(figureBox(mark, standing), headBox(theirs))) return false;
    if (boxesOverlap(figureBox(theirs), headBox(mark, standing))) return false;
  }
  return true;
}

/**
 * A standable tile that also clears the screen you walked over to read — the
 * one extra thing a peek asks for beyond standing room (§ 6 rule 16).
 */
function isPeekMarkClear(mark, seat) {
  if (coversTheMonitor(mark, seat)) return false;
  return isStandableTile(mark);
}

/**
 * Where you stand to see what somebody is working on, or `null` if there is
 * nowhere to stand — which is a feature, not a gap: leadership sit behind
 * glass with no way in from the floor, and Gary has no desk to peek at. The
 * person card offers the walk only where this returns a tile.
 *
 * @param {string} seatId
 * @returns {{ x: number, y: number } | null}
 */
export function peekTileFor(seatId) {
  const seat = seatFor(seatId);
  if (!seat || !seat.desk || seat.id === YOU_SEAT_ID) return null;
  const you = seatFor(YOU_SEAT_ID);
  if (!you) return null;

  for (const { dx, dy } of PEEK_OFFSETS) {
    const mark = { x: seat.x + dx, y: seat.y + dy };
    if (!isPeekMarkClear(mark, seat)) continue;
    if (!hasClearSightTo(mark, seat)) continue;
    // You have to be able to *get* there without walking through a wall.
    if (pathCrossesGlass(walkPathBetween({ x: you.x, y: you.y }, mark, YOU_SEAT_ID))) continue;
    return mark;
  }
  return null;
}

/**
 * Everyone whose desk you can walk over to. Order follows `FLOOR_SEATS`.
 *
 * @returns {string[]}
 */
export function peekableSeatIds() {
  return FLOOR_SEATS.filter((seat) => peekTileFor(seat.id) !== null).map((seat) => seat.id);
}

/**
 * True when a tile is inside the floor plate. Used by the layout tests to keep
 * a mis-typed coordinate from parking someone in the car park.
 *
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
export function isOnFloor(x, y) {
  return (
    x >= FLOOR_BOUNDS.minX &&
    x <= FLOOR_BOUNDS.maxX &&
    y >= FLOOR_BOUNDS.minY &&
    y <= FLOOR_BOUNDS.maxY
  );
}
