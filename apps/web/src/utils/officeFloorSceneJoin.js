/**
 * The way into a set piece you turned down
 * (docs/office-isometric-mode.md § 5 slice 28).
 *
 * Slice 22 let you overhear two colleagues, and slice 23 let you join them. The
 * half neither could reach was the office's *scripted* theatre: a coffee break
 * is offered to you by name, and until this slice saying no deleted it. There
 * was therefore no such thing as a set piece happening near you that you were
 * not already in — the one state an "overhear, then join" verb needs to exist.
 *
 * **Declining now means "not for me" rather than "not happening".** The cast
 * still walks to the machine and still talks; you are simply not in it, and the
 * floor is where you can change your mind. That is the whole content of this
 * module: given a scene nobody is attending and a tile you are standing on, may
 * you walk into it.
 *
 * **Why this is not shop talk with different copy.** The two look alike from the
 * card slot and are unalike underneath, in three ways that each nearly caused a
 * bug:
 *
 * - **There is no inner bound.** Shop talk refuses to exist while you are inside
 *   `NAME_CHIP_RANGE_TILES` of either speaker, because at that range slice 19
 *   would have somebody talk *to* you and the room would owe you two lines at
 *   once. A scene's cast are `awayIds` — out of their chairs, claimed by a
 *   moment — so `dwellTargetAt` cannot pick them and there is no collision to
 *   dodge. Standing right at the machine is the most natural possible moment to
 *   be offered a way in, and an inner bound would switch the offer off there.
 * - **The mark is fixed, not derived.** `COFFEE_TILES` are in `reservedMarks()`,
 *   so the cast's positions are known before anybody walks anywhere and no
 *   `talkTileFor` lookup is needed. Earshot is measured to **either** tile
 *   rather than to a midpoint: the two marks are a tile apart, and a midpoint
 *   would put the boundary half a tile off the person you are actually near.
 * - **Joining ends it.** Slice 23's join is a walk that starts a conversation;
 *   this one stops a performance. Everybody turns to you, one closing beat, and
 *   the scene is over — which is why the offer needs no hold, the mechanism the
 *   handoff correctly flagged as missing for `awayIds`. Nothing has to be paused
 *   while you cross the room, because pressing the button *is* the arrival.
 *
 * Zero LLM budget, like the other two overheard performances: the closing beat
 * is canned copy, and § 11's reactive spend is for sentences you typed.
 */

import { BATTLE_TILES, COFFEE_TILES, isWithinEarshot } from './officeFloorPlan.js';
import { sceneParticipants } from './officeSceneCast.js';

/**
 * @typedef {{ colleagueId: string, participants: string[], kind: 'coffee' | 'battle' }} SceneJoinOffer
 */

/**
 * Where each joinable set piece stands. Both are fixed marks in
 * `reservedMarks()`, which is what lets the offer be derived without waiting for
 * anybody to finish walking (see the module header).
 *
 * @type {Record<string, Array<{ x: number, y: number }>>}
 */
const SCENE_TILES = { coffee: COFFEE_TILES, battle: BATTLE_TILES };

/**
 * Whether this scene is running with nobody from your desk in it.
 *
 * Both flags rather than `declined` alone. `accepted` is what the award and the
 * desk overlay key off, and a scene carrying both would offer you a way into
 * something you are already in — reachable through the store even though the
 * panel swaps itself for the script.
 *
 * @param {{ accepted?: boolean, declined?: boolean } | null} scene
 * @returns {boolean}
 */
export function isUnattendedScene(scene) {
  return Boolean(scene && scene.declined && !scene.accepted);
}

/**
 * Near enough to walk into the scene and be part of it.
 *
 * Either tile rather than both: the cast stand a tile apart, so requiring
 * earshot of both would carve a notch out of the range on the far side of
 * whichever one you approached from.
 *
 * @param {{ x: number, y: number } | null} youTile
 * @param {'coffee' | 'battle'} [kind]
 * @returns {boolean}
 */
export function withinSceneEarshot(youTile, kind = 'coffee') {
  if (!youTile) return false;
  return (SCENE_TILES[kind] ?? []).some((tile) => isWithinEarshot(youTile, tile));
}

/**
 * The offer itself, or `null` — which is the answer nearly always.
 *
 * `colleagueId` is the first participant, who is the one that asked you in the
 * first place, so the card names the person whose invitation you turned down
 * rather than an arbitrary half of the pair. `participants` rides along because
 * the closing beat is spoken by one of them and the caller should not have to
 * re-derive the cast from `scene.lines`.
 *
 * Returns `null` for a scene with no cast, which is how an empty or malformed
 * script degrades: an offer to join nobody is worse than no offer.
 *
 * Slice 30 added the battle as a second kind. The two are scanned in a fixed
 * order rather than merged, because they stand in different places and the card
 * can only hold one — and the order barely matters in practice, since
 * `canOfferOfficeBattle` refuses while another surface is up, so two unattended
 * scenes at once is a store-only state.
 *
 * @param {{ accepted?: boolean, declined?: boolean, lines?: Array<{ speakerId: string }> } | null} coffee
 * @param {{ x: number, y: number } | null} youTile
 * @param {{ accepted?: boolean, declined?: boolean, lines?: Array<{ speakerId: string }> } | null} [battle]
 * @returns {SceneJoinOffer | null}
 */
export function sceneJoinOfferFor(coffee, youTile, battle = null) {
  for (const [kind, scene] of [
    ['coffee', coffee],
    ['battle', battle]
  ]) {
    if (!isUnattendedScene(scene)) continue;
    if (!withinSceneEarshot(youTile, kind)) continue;

    const participants = sceneParticipants(scene.lines);
    if (participants.length === 0) continue;

    return { colleagueId: participants[0], participants, kind };
  }
  return null;
}

export default sceneJoinOfferFor;
