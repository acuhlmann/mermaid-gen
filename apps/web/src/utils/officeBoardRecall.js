/**
 * What a colleague remembers of your board, said as a fact instead of recited
 * as a fingerprint (`docs/automations/office-life.md` § 4, the situation rule).
 *
 * `boardFingerprintOf` builds an **identity** — `mermaid:Login|Verify email:482`
 * — so that two sightings of the same board can be told apart from two
 * different ones. Nothing ever compared two of them. The one consumer,
 * `workingMemoryPromptLines`, pushed the string itself into the prompt as
 * `last board they noticed: mermaid:Login|Verify email:482`, which made it the
 * only line in that block that is not a sentence, and put a character count
 * inside a block whose own closing instruction is *"do not recite them and
 * never count them"*. A machine id doing duty as a sentence is a fact the
 * office recorded correctly and read wrongly.
 *
 * **Compare, never parse.** `boardFingerprintOf` joins the user's own node
 * labels with `|` and does not escape them, so a label holding a `|` or a `:`
 * makes the string ambiguous. That is harmless for equality and fatal for a
 * parser, so equality is the only question this string may be asked — which is
 * also the only question it was built to answer.
 *
 * **Three lines, closed, and none of them names a delta.** The prompt carries
 * the board as it is now (`diagramSource`, `visibleLabels`, `officeBoard`) and
 * nothing anywhere carries the one they saw. So `changed` states *when they
 * last looked* and stops: a colleague told their picture is out of date can ask
 * about the part they missed, while one told "your diagram changed" has to
 * invent the change — the failure the domain file measured at 8 of 12 turns
 * when a moment ended "react to what changed". The circumstance here is
 * genuinely measured rather than asserted (two fingerprints, client-side), and
 * it is still the *circumstance* that goes in the line.
 *
 * **The identity is byte-sensitive, and that is the second reason `changed`
 * names a time rather than a difference.** The fingerprint ends in
 * `diagramSource.length`, so one keystroke flips `same` to `changed`. "Not the
 * same board" is therefore all this comparison can honestly claim — never
 * "meaningfully different" — and a line that only says when they last looked is
 * true at one character of drift and at a rewrite alike.
 *
 * **`unknown` belongs to callers that are not building a request.**
 * `boardFingerprintOf` always returns a non-empty string (`mermaid::0` for an
 * empty slot), so every production caller carries both sides and lands on
 * `same` or `changed`. The instrument reads `workingMemoryPromptLines` with no
 * board in hand, and so do the unit cases; `unknown` is the honest answer for
 * them rather than a branch the room reaches.
 *
 * Pure, DOM-free and English-only, like the prompt side generally
 * (`officeLogDigest.js`): these lines are read by the model, never by the user,
 * so they are not a locale bank.
 */

/**
 * @typedef {'unknown' | 'same' | 'changed'} BoardRecallKind
 *   - `unknown` — they looked, and there is no current board to compare with.
 *   - `same` — the board they looked at is the board on the screen now.
 *   - `changed` — they looked before the state it is in now.
 */

/**
 * The one sentence each verdict is allowed to be.
 *
 * Phrased as facts about the sighting rather than about the diagram, which is
 * what keeps `changed` on the right side of the situation rule. Each is well
 * under the 200-character per-line cap `OfficeWorkingMemoryField` enforces on
 * the route, so none of them can cost another beat its place.
 *
 * **Second person is the speaker, and the other party is named.** These lines
 * land in `buildOfficeWorkingMemoryBlock`, whose own closing sentence already
 * says *"you already looked at their board"* — so until 2026-11-10 this bank
 * stated the same fact with the pronouns swapped, three lines away from it. The
 * convention, and the measurement behind it, are in
 * `officeWorkingMemoryStore.js` beside `INTERRUPTION_PROMPT_LINES`; the short
 * version is that a colleague asked to recall the day got 23 of 24 facts
 * backwards while the block disagreed with its own frame.
 *
 * @type {Readonly<Record<BoardRecallKind, string>>}
 */
export const BOARD_RECALL_LINES = Object.freeze({
  unknown: "you have already looked at the user's board today",
  same: "you have already looked at the user's board, exactly as it stands now",
  changed: "you last looked at the user's board before the state it is in now"
});

/**
 * Which of the three this sighting is.
 *
 * `remembered` absent is the only case that earns nothing: a colleague with no
 * stamped fingerprint has not looked, and the block's job is to say what is
 * shared rather than to announce an absence.
 *
 * @param {unknown} remembered the fingerprint stamped when they last looked
 * @param {unknown} current the fingerprint of the board right now
 * @returns {BoardRecallKind | null}
 */
export function boardRecallKind(remembered, current) {
  const seen = typeof remembered === 'string' ? remembered.trim() : '';
  if (!seen) return null;
  const now = typeof current === 'string' ? current.trim() : '';
  if (!now) return 'unknown';
  return now === seen ? 'same' : 'changed';
}

/**
 * The prompt line for this sighting, or `null` when there is nothing to recall.
 *
 * @param {unknown} remembered
 * @param {unknown} current
 * @returns {string | null}
 */
export function boardRecallLine(remembered, current) {
  const kind = boardRecallKind(remembered, current);
  return kind ? BOARD_RECALL_LINES[kind] : null;
}

export default boardRecallLine;
