/**
 * Turning down a set piece leaves a mark on whoever asked you in
 * (`docs/automations/office-life.md` queue 13, the instance the playbook names
 * by file: *"`sceneJoin`'s decline path in particular ends the offer and
 * records nothing"*).
 *
 * The dropped errand was the first refusal on this floor to leave a fact behind
 * (`officeErrandMemory.js`) and the calendar invite was the second
 * (`officeInviteMemory.js`). The coffee break and the shouting match are the
 * third, and they are the pair the original sweep listed first — _Nah, not
 * today_, _Decline_ and _Not my circus_ were all silent, and this is the ✕ that
 * was still silent after the other two landed.
 *
 * **It is also the refusal with the strongest claim to a memory, because it is
 * the one where nothing else happens.** A dropped errand ends an errand; a
 * declined invite empties a slot on your calendar. `declineOfficeCoffee` ends
 * nothing: slice 28 made declining mean *"not for me"* rather than *"not
 * happening"*, so the cast still walks to the machine and still talks, and
 * `sceneJoinOfferFor` keeps offering you the way in for as long as the scene
 * runs. Before this module the office's entire record of your answer was a flag
 * that switched a card on. Richard asked you along, you said no in front of
 * him, he had his coffee without you — and the next time you stood next to him
 * the room was as blank as if he had never asked.
 *
 * **It records, it does not trigger** (ADR-0010 consequence #4). Nothing here
 * re-raises the invitation, schedules a second one or nags; it cannot, because
 * the only thing it writes is a sentence a later `/moment` may quote. The
 * standing join offer is not this module chasing you — it is derived from the
 * scene's own `declined` flag, it predates this slice, and it goes away with
 * the scene.
 *
 * **The beat lands on the first participant and nowhere else.** That is the
 * same person `sceneJoinOfferFor` names as *"the one that asked you in the
 * first place"*, derived here through the same `sceneParticipants` call rather
 * than through a second reading of `scene.lines`. The other half of the pair
 * was standing right there, and writing your no on them would hand somebody a
 * memory of a conversation they were not having with you — the fabrication the
 * situation rule in `docs/agents/domains/office.md` was measured on, arriving
 * through memory instead of through a prompt.
 *
 * **Why two functions and not one with a `kind`.** The two scenes are two store
 * slices with two idempotency guards, and a single entry point would have to
 * read the snapshot to decide which one it was declining — a second derivation
 * of a fact the caller already holds (it is pressing one of two buttons). The
 * `kind` the beat carries comes from which function ran, which is why it cannot
 * disagree with which scene was actually turned down.
 *
 * **Why a function and not a line in the handler.** Both panels render in both
 * worlds, and what a refusal costs is renderer-agnostic (ADR-0011 rule 1), so
 * it is written once here rather than beside each button. It is also why the
 * store returns the declined scene instead of writing the beat itself — the
 * store records state, and memory has one writer per edge.
 */

import { declineOfficeBattle, declineOfficeCoffee } from '../state/officeMomentStore.js';
import { rememberWorkingMemoryBeat } from '../state/officeWorkingMemoryStore.js';
import { sceneParticipants } from './officeSceneCast.js';

/**
 * @param {{ lines?: Array<{ speakerId: string }> } | null} scene
 * @param {'coffee' | 'battle'} kind
 * @returns {string | null} the colleague the beat was written on, or `null`
 *   when there was nobody to write it on.
 */
function rememberSceneDecline(scene, kind) {
  if (!scene) return null;
  const askedYou = sceneParticipants(scene.lines)[0];
  /*
   * A scene with no cast writes nothing, which is the same degradation
   * `sceneJoinOfferFor` already chose for an empty or malformed script: a
   * refusal aimed at nobody is not a refusal. The scene is still declined —
   * the store did that before we got here — so the panel behaves identically.
   */
  if (!askedYou) return null;
  rememberWorkingMemoryBeat(askedYou, { sceneDeclined: kind });
  return askedYou;
}

/**
 * Say no to the coffee break, and leave whoever asked you knowing.
 *
 * @returns {{id: string, lines: Array<{speakerId: string, text: string}>,
 *   accepted: boolean, declined: boolean, createdAt: number} | null}
 *   the scene that was declined, or `null` when there was nothing on screen to
 *   decline. A `null` writes no beat: a press that declined nothing is not an
 *   answer to anything.
 */
export function declineOfficeCoffeeWithMemory() {
  const declined = declineOfficeCoffee();
  rememberSceneDecline(declined, 'coffee');
  return declined;
}

/**
 * Walk away from the argument, and leave whoever wanted you in it knowing.
 *
 * @returns {{id: string, lines: Array<{speakerId: string, text: string}>,
 *   accepted: boolean, declined: boolean, createdAt: number} | null}
 *   the scene that was walked away from, or `null` — same reading as above.
 */
export function declineOfficeBattleWithMemory() {
  const declined = declineOfficeBattle();
  rememberSceneDecline(declined, 'battle');
  return declined;
}

export default declineOfficeCoffeeWithMemory;
