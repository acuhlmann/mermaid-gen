/**
 * Coming to a set piece leaves a mark on whoever asked you in — the other half
 * of `officeSceneDeclineMemory.js`, and the half that should have shipped with
 * it.
 *
 * Every player-side **refusal** in this room has left a fact behind since
 * 2026-10-31: a dropped errand, a declined calendar invite, a waved-off
 * suggestion, a turned-down coffee break, a shouting match you walked away
 * from. The acceptances were a different story. `pitchTaken` was the only yes
 * the office recorded at all, so a set piece inverted the asymmetry the walk-by
 * slice named: there the room kept its hits and forgot its misses, here it kept
 * every refusal and forgot you turned up.
 *
 * **And the inverse is worse, because the refusal beat does not merely go
 * unaccompanied — it goes on being the office's whole record of an episode it
 * is no longer true about.** `declineOfficeCoffee` leaves the scene standing and
 * `sceneJoinOfferFor` keeps offering you the way back in, so "no, then yes" is
 * a path the floor actively invites. Walk it and Gary carries *"they stayed at
 * their desk and you went anyway"* into the next thing he says to you, while
 * you are the person who crossed the room and stood in his kitchen. That is a
 * stated circumstance the room contradicted, which is the fabrication the
 * situation rule in `docs/agents/domains/office.md` was measured on (8 of 12),
 * arriving through memory instead of through a prompt.
 *
 * **Two doors, one beat.** You can be in a scene because you said yes on the
 * invite, or because you declined and walked over anyway. They are the same
 * answer to the same question and the beat says only that — `sceneJoined`
 * names the scene, never the door, for the reason the meeting invite's single
 * line covers its two refusals: a sentence naming which one needs a field the
 * beat does not carry. When it was the second door the decline beat is sitting
 * directly above this one in the same ordered list, so the history reads itself
 * without either line claiming anything about the other.
 *
 * **The beat lands on the first participant and nowhere else**, the same person
 * `sceneJoinOfferFor` calls "the one that asked you in the first place" and the
 * same person the decline writes on — so a scene you refused and then joined
 * leaves both facts on one colleague rather than a contradiction split across
 * two. The other half of the pair was standing there; they were not the one
 * doing the asking.
 *
 * **It records, it does not trigger** (ADR-0010 consequence #4). Nothing here
 * schedules, re-offers or pays: `handleCoffeeDone` awards `coffeeBreak` and
 * `voteOfficeBattle` pays `battleSettled`, both of them after this has run and
 * neither of them this module's business. The only thing written is a sentence a
 * later `/moment` may quote.
 *
 * **Why a module and not two lines in the handler.** Both panels render in both
 * worlds, and what an answer costs is renderer-agnostic (ADR-0011 rule 1) — the
 * floor's _Join in_ is the only door on the floor today, and the invite's accept
 * is pressed at the desk. It is also the asymmetry the ledger records against
 * `pitchTaken`, whose two call sites are inline in `OfficeLayer.jsx` and so went
 * unfound through four refusal slices: every other beat writer is findable by
 * listing files, and this one is too.
 */

import {
  acceptOfficeBattle,
  acceptOfficeCoffee,
  joinOfficeBattle,
  joinOfficeCoffee
} from '../state/officeMomentStore.js';
import { rememberWorkingMemoryBeat } from '../state/officeWorkingMemoryStore.js';
import { sceneParticipants } from './officeSceneCast.js';

/**
 * @param {{ lines?: Array<{ speakerId: string }> } | null} scene the scene **as
 *   it was before the store touched it**, which matters for the join door: that
 *   mutator swaps the remaining script for one closing beat, so reading the
 *   cast afterwards would nominate whoever happens to speak last instead of
 *   whoever asked.
 * @param {'coffee' | 'battle'} kind
 * @returns {string | null} the colleague the beat was written on, or `null` when
 *   there was nobody to write it on.
 */
function rememberSceneJoin(scene, kind) {
  if (!scene) return null;
  const askedYou = sceneParticipants(scene.lines)[0];
  /*
   * A scene with no cast writes nothing — the same degradation
   * `rememberSceneDecline` and `sceneJoinOfferFor` already chose: an answer
   * aimed at nobody is not an answer. The scene is still joined, so the panel
   * behaves identically.
   */
  if (!askedYou) return null;
  rememberWorkingMemoryBeat(askedYou, { sceneJoined: kind });
  return askedYou;
}

/**
 * Say yes to the coffee break, and leave whoever asked you knowing you came.
 *
 * @returns {{id: string, lines: Array<{speakerId: string, text: string}>,
 *   accepted: boolean, declined: boolean, createdAt: number} | null} the scene
 *   you walked into, or `null` when there was nothing to accept. A `null` writes
 *   no beat: a press that accepted nothing is not an answer to anything.
 */
export function acceptOfficeCoffeeWithMemory() {
  const accepted = acceptOfficeCoffee();
  rememberSceneJoin(accepted, 'coffee');
  return accepted;
}

/**
 * Take a side in the argument, and leave whoever wanted you in it knowing.
 *
 * @returns {{id: string, lines: Array<{speakerId: string, text: string}>,
 *   accepted: boolean, declined: boolean, createdAt: number} | null} same
 *   reading as above.
 */
export function acceptOfficeBattleWithMemory() {
  const accepted = acceptOfficeBattle();
  rememberSceneJoin(accepted, 'battle');
  return accepted;
}

/**
 * Change your mind and walk over to the break you turned down.
 *
 * The cast is read from `scene` rather than from the store afterwards, for the
 * reason in `rememberSceneJoin`'s docs — and `scene` is what the caller already
 * holds, since it had to derive the closing beat's speaker from it to build the
 * line at all. One derivation, so the beat and the sentence in the room cannot
 * name two different people.
 *
 * @param {{ lines?: Array<{ speakerId: string }> } | null} scene the unattended
 *   break, as the caller read it out of the snapshot.
 * @param {{ speakerId: string, text: string }} line the closing beat, which the
 *   store refuses when blank — so an untranslated locale withholds the whole
 *   verb rather than writing a memory of a join that did not happen.
 * @returns {boolean} whether there was an unattended break to join.
 */
export function joinOfficeCoffeeWithMemory(scene, line) {
  const joined = joinOfficeCoffee(line);
  if (joined) rememberSceneJoin(scene, 'coffee');
  return joined;
}

/**
 * Change your mind and wade back into the argument you walked away from.
 *
 * @param {{ lines?: Array<{ speakerId: string }> } | null} scene the unattended
 *   battle, as the caller read it out of the snapshot.
 * @param {{ speakerId: string, text: string }} line the closing beat.
 * @returns {boolean} whether there was an unattended battle to join.
 */
export function joinOfficeBattleWithMemory(scene, line) {
  const joined = joinOfficeBattle(line);
  if (joined) rememberSceneJoin(scene, 'battle');
  return joined;
}

export default joinOfficeCoffeeWithMemory;
