/**
 * The directed camera — **what** to frame, never a camera anyone drives
 * (docs/office-isometric-mode.md § 5 slice 14).
 *
 * Reopens slice 7's "zoom levels stay out" answer in one scoped form: the
 * floor may lean in on a moment and lean back out when it clears, but there is
 * still no free camera — this module answers "which tile deserves the frame"
 * from state the view already holds, and `useFloorCamera` performs the move.
 * Binding rule 1 stays intact: nothing here is office state, it is a
 * projection of it, so the camera can never disagree with what the stage draws.
 *
 * Pure on purpose — no React, no DOM — so the priority ladder is testable in a
 * node environment, the way `floorAnnouncement` is.
 */

import { MEETING_MODALITY_REMOTE } from '../../utils/officeCast.js';
import {
  BATTLE_TILES,
  COFFEE_TILES,
  FLOOR_ZONES,
  HUDDLE_TILES,
  MEETING_PLAYER_TILE
} from '../../utils/officeFloorPlan.js';

/** Every boost is clamped here, whatever the viewport gave us to start from. */
export const CAMERA_MAX_SCALE = 1.6;

/**
 * The one tuning table for how far the room leans in, per kind of moment.
 * Meeting keeps the slice-5 figure; scenes a touch tighter than the glass
 * room's crowd, a huddle and a one-on-one just enough to put you at the
 * centre of the frame.
 */
export const CAMERA_BOOSTS = Object.freeze({
  meeting: 1.38,
  scene: 1.35,
  huddle: 1.2,
  social: 1.22
});

/**
 * The physical meeting's card anchors below the top bar, so the glass room is
 * framed that much lower in the viewport — carried over from the slice-5
 * meeting focus.
 */
export const MEETING_CAMERA_BIAS = 110;

/**
 * A glass-room sync the floor renders as a place. Remote headset syncs have no
 * location to frame; a cancelled meeting has no room to look at.
 *
 * @param {unknown} meeting
 * @returns {boolean}
 */
export function isPhysicalFloorMeeting(meeting) {
  return Boolean(
    meeting && meeting.modality !== MEETING_MODALITY_REMOTE && meeting.state !== 'cancelled'
  );
}

/**
 * @param {Array<{ x: number, y: number }>} tiles
 * @returns {{ x: number, y: number }}
 */
function tilesCentroid(tiles) {
  let x = 0;
  let y = 0;
  for (const tile of tiles) {
    x += tile.x;
    y += tile.y;
  }
  return { x: x / tiles.length, y: y / tiles.length };
}

/** The midpoint between a set piece's two marks — where `ScenePanel` parks. */
function sceneMidpoint(tiles) {
  return {
    x: (tiles[0].x + tiles[tiles.length - 1].x) / 2,
    y: (tiles[0].y + tiles[tiles.length - 1].y) / 2
  };
}

const MEETING_ZONE = FLOOR_ZONES.find((zone) => zone.id === 'meeting');

/** Tile-space centre of the glass room's zone plate. */
function meetingFocusTile() {
  if (!MEETING_ZONE) return MEETING_PLAYER_TILE;
  const [x0, y0, x1, y1] = MEETING_ZONE.rect;
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
}

/**
 * One set piece's focus. The key carries `accepted`, so pressing "Coffee?"
 * counts as a new moment: the invite panel and the break itself share a
 * location but not a beat, and an override made at the invite should not
 * stick once the scene actually starts.
 */
function sceneFocus(kind, scene, tiles) {
  return {
    key: `scene:${kind}:${scene.id ?? 'live'}:${scene.accepted ? 1 : 0}`,
    tile: sceneMidpoint(tiles),
    boost: CAMERA_BOOSTS.scene,
    bias: 0
  };
}

function meetingFocus(meeting) {
  return {
    key: `meeting:${meeting.id ?? meeting.title ?? 'live'}`,
    tile: meetingFocusTile(),
    boost: CAMERA_BOOSTS.meeting,
    bias: MEETING_CAMERA_BIAS
  };
}

function huddleFocus(huddle) {
  return {
    key: `huddle:${huddle.id ?? 'ring'}`,
    tile: tilesCentroid(HUDDLE_TILES),
    boost: CAMERA_BOOSTS.huddle,
    bias: 0
  };
}

function socialFocus(presence) {
  const subject = presence.intent.colleagueId ?? presence.intent.propKind ?? 'mark';
  return {
    key: `social:${presence.intent.kind}:${subject}`,
    tile: presence.to,
    boost: CAMERA_BOOSTS.social,
    bias: 0
  };
}

/**
 * Which moment owns the frame right now — the first rung that holds, in
 * descending order of how much of the room is watching:
 *
 * 1. A physical meeting — the whole floor is in or facing the glass room.
 * 2. A huddle — six faces ringing your desk.
 * 3. A set piece — coffee at the machine, a battle across the aisle. The
 *    invite counts: it is already standing there asking.
 * 4. Your own reasons to be somewhere — walking to talk, to peek, to use a
 *    prop, engaged from the first step. Free roam and the walk home are
 *    deliberately camera-free: wandering is the room being yours, and the
 *    release back to the wide view is how a moment says it is over.
 *
 * @param {{
 *   meeting?: unknown,
 *   huddle?: { id?: string } | null,
 *   coffee?: { id?: string, accepted?: boolean } | null,
 *   battle?: { id?: string, accepted?: boolean } | null,
 *   presence?: import('./useFloorPresence.js').FloorPresence | null
 * }} state
 * @returns {{ key: string, tile: { x: number, y: number }, boost: number, bias: number } | null}
 *   `bias` is viewport pixels to keep clear at the top of the frame (the
 *   meeting's top-anchored card). `null` means fit-to-viewport.
 */
export function cameraFocusFor({ meeting, huddle, coffee, battle, presence }) {
  if (isPhysicalFloorMeeting(meeting)) return meetingFocus(meeting);
  if (huddle) return huddleFocus(huddle);
  // Both on at once is near-impossible; coffee wins the tie because the
  // kitchen is the smaller stage and needs the framing more.
  if (coffee) return sceneFocus('coffee', coffee, COFFEE_TILES);
  if (battle) return sceneFocus('battle', battle, BATTLE_TILES);
  if (presence && presence.intent && !presence.homeward) return socialFocus(presence);
  return null;
}

/**
 * Whose walk the phone-overflow auto-pan still serves. While the camera is
 * framing a moment it owns the pan; the camera-free walks keep the fallback.
 *
 * @param {ReturnType<typeof cameraFocusFor>} focus
 * @param {unknown} presence
 * @returns {unknown}
 */
export function autoPanPresenceFor(focus, presence) {
  return focus ? null : presence;
}

/**
 * The scale a focus asks for. Never below the fit scale — a zoom that makes
 * the room smaller than the viewport already shows would be a lie — and
 * clamped at `CAMERA_MAX_SCALE` so faces stay drawn at phone widths.
 *
 * @param {number} fitScale
 * @param {number | null} boost
 * @returns {number}
 */
export function cameraScaleFor(fitScale, boost) {
  if (!boost) return fitScale;
  return Math.min(CAMERA_MAX_SCALE, Math.max(fitScale, fitScale * boost));
}
