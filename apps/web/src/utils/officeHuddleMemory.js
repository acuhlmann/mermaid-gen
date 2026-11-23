/**
 * Pairing with somebody leaves a mark on the person who pulled their chair up.
 *
 * **This is the longest conversation the office supports, and it was the only
 * one nobody remembered.** A pair huddle is `mode: 'pair'` on
 * `officeMomentStore.js`: one named colleague, a `turns` transcript of up to
 * `PAIR_TURNS_MAX` lines that the server reads back so each answer replies to
 * the one before it, a `listening` phase that advances on nothing but you
 * typing, and an interrupt verb for cutting them off mid-sentence. Twelve turns
 * of that and `hasWorkingMemoryFact(partner)` was still **false** — so the next
 * time you stood next to them, `useFloorDwell` dealt from the canned deck,
 * exactly the hole queue 2 closed for somebody you walked into. A single desk
 * visit was remembered three ways; the one real conversation on this floor was
 * remembered none.
 *
 * **It is the same beat a dwell writes, and that is the argument for it.**
 * `yours` / `theirs` already exist, already carry the spoken prefixes (`the user
 * said:` / `you said:`), and are already trimmed and capped at 200 characters by
 * `normalizeWorkingMemoryBeat`. So a pair needs **no new field, no new prompt
 * line, no schema change and no wire change** — it needs the writer the talk
 * path has had since v1. A pair *is* a talk with more turns.
 *
 * **One conversation is one beat.** The cap is six beats per colleague, so a
 * beat per turn would let one chat evict everything else that happened between
 * you two today — the peek, the interruption, the suggestion you took. So the
 * beat is written once, when the pair ends, and it holds the **last real
 * exchange**: the last line they said, and the last thing you said *before* it.
 * Reading it in that order matters, because `workingMemoryPromptLines` pushes
 * `yours` ahead of `theirs` — pairing your last line with an answer that came
 * before it would hand the model a reply to something it had not heard yet.
 *
 * **`edit` turns are not speech.** The transcript's third role is a canvas
 * change the partner reacted to, not a sentence anybody said, so quoting one as
 * `the user said:` is the fabrication the situation rule in
 * `docs/agents/domains/office.md` warns about, arriving through memory.
 *
 * **Pair only, and the mob is not an oversight.** A mob seats
 * `CAST_TIERS.team`, and writing a beat on each of them is the roster-at-a-time
 * question the ledger parks as `meeting-attendees-hold-nothing`: this store's
 * rule is about the *edge* — "each writer is a moment the user aimed at one
 * named person" — and a mob is aimed at the team. A pair is the one huddle you
 * aim, by naming them.
 *
 * **It records, it does not trigger** (ADR-0010 consequence #4). Nothing here
 * ends the huddle, re-opens it, pays XP or schedules a follow-up; the caller
 * ends the huddle immediately afterwards and would end it identically with this
 * module deleted. The only things written are two sentences a later `/moment`
 * may quote.
 *
 * **Two records, one guard** — the shape `useFloorInterruptMemory.js` arrived
 * at for the other event that two memories hold. The partner gets the beat and
 * the room gets a line, both behind the single `beat.theirs` test below,
 * because one conversation is one fact however many memories hold it: the two
 * cannot disagree about whether it happened. Which half carries what is the
 * same split as an interruption — the body is the partner's (only they are
 * handed their own beat) and the bare fact is the room's, since a chair pulled
 * up to your desk is drawn by both renderers and has witnesses.
 *
 * The entry is written **here rather than through `onOfficeEvent`**, which is
 * the precedent and not an exception: `interrupt`, `prop`, `pitch`, `email`,
 * `walkby` and one of the two `chat` writers all record at the edge that holds
 * the fact. The funnel in `useRunCeremony.js` drops everything but `now` for
 * this kind, so routing a pair through it would file the mob's sentence about
 * one person — the false fact `docs/office-isometric-mode.md` § 8 said would
 * get worse before it got better. The mob keeps that path untouched.
 *
 * **Why a module and not two lines in the handler.** Both worlds draw the
 * huddle — `HuddleOverlay.jsx` at the desk and `FloorHuddle.jsx` in the room —
 * and what a conversation costs is renderer-agnostic (ADR-0011 rule 1). It is
 * also the asymmetry the ledger records against `markWorkingMemoryPitchTaken`,
 * whose call sites are inline in `OfficeLayer.jsx` and so went unfound through
 * four refusal slices: every other beat writer is findable by listing files,
 * and this one is too.
 */

import { recordOfficeLogEntry } from '../state/officeLogStore.js';
import { rememberWorkingMemoryBeat } from '../state/officeWorkingMemoryStore.js';

/**
 * Roles that are something somebody said out loud. `edit` is not one.
 *
 * A `Set` rather than an object map, for `PAIR_TURN_ROLES`' reason: a lookup on
 * a plain object inherits `Object.prototype`, so `'constructor'` would read as
 * a spoken role.
 */
const SPOKEN_ROLES = new Set(['partner', 'you']);

/**
 * The last exchange in a pairing transcript, in the order it happened.
 *
 * Their last line, plus the last thing you said *before* it. A trailing line of
 * yours with no answer under it is deliberately left out rather than paired
 * with an older answer: the beat is a record of an exchange, and an exchange
 * that has not been answered yet is not one. It is also the live state of every
 * pair that is `awaitingReply`, so including it would write a different fact
 * depending on whether you closed the chair before or after their reply landed.
 *
 * @param {Array<{role?: string, text?: string}>} turns oldest first
 * @returns {{ yours?: string, theirs?: string }}
 */
function lastExchangeOf(turns) {
  const said = (Array.isArray(turns) ? turns : []).filter(
    (turn) => SPOKEN_ROLES.has(turn?.role) && typeof turn?.text === 'string' && turn.text.trim()
  );
  let theirsAt = -1;
  for (let i = said.length - 1; i >= 0; i -= 1) {
    if (said[i].role === 'partner') {
      theirsAt = i;
      break;
    }
  }
  if (theirsAt < 0) return {};
  const theirs = said[theirsAt].text;
  for (let i = theirsAt - 1; i >= 0; i -= 1) {
    if (said[i].role === 'you') return { yours: said[i].text, theirs };
  }
  return { theirs };
}

/**
 * Remember the pair you are about to close, on the one person who was in it.
 *
 * Takes the huddle rather than reading the store, the discipline
 * `rememberSceneJoin` and `workingMemoryPromptLines`' `boardNow` already get:
 * the caller holds the snapshot it is about to end, so the beat and the thing
 * being closed cannot be two different conversations.
 *
 * Deliberately **not** gated on the phase `handleHardStop` reads, and the
 * reason is the second record below. That gate fires `onOfficeEvent('huddled')`
 * from `speaking` or `watching` only, while `useHuddleRingControls`' `onDone` is
 * `pairing ? handleTurnDone : onHardStop` — a mob ends from `speaking`, a pair
 * is sent to `listening` and waits there for you — so a pair reaches it only if
 * you cut it off mid-line or close it during a Do-it.
 *
 * **The `no XP` half of that finding is retracted.** `huddled` is absent from
 * `OFFICE_XP_AWARDS`, and `applyOfficeEvent` bails on a falsy award, so *no*
 * huddle has ever paid XP — the event's only effect is one
 * `recordOfficeLogEntry('huddle')` in `useRunCeremony.js`. A pair was not
 * underpaid relative to a mob; it was unrecorded, which is the half that
 * mattered and the half this module now closes.
 *
 * @see docs/office-isometric-mode.md § 8 Debts, `pair-huddle-is-never-huddled`.
 *
 * @param {{ mode?: string, attendees?: string[],
 *   turns?: Array<{role?: string, text?: string}> } | null} huddle the huddle as
 *   it stands, before it is ended.
 * @returns {string | null} the colleague the beat was written on, or `null` when
 *   there was nobody to write it on or nothing anybody said.
 */
export function rememberPairHuddle(huddle) {
  if (!huddle || huddle.mode !== 'pair') return null;
  const partner = Array.isArray(huddle.attendees) ? huddle.attendees[0] : null;
  if (typeof partner !== 'string' || !partner) return null;
  const beat = lastExchangeOf(huddle.turns);
  /*
   * A pair that never got a word out writes nothing. `gathering` is a drawn
   * chair with no script yet, and a chair is not a conversation — the same
   * degradation `rememberSceneJoin` makes for a scene with no cast.
   */
  if (!beat.theirs) return null;
  rememberWorkingMemoryBeat(partner, beat);
  /*
   * The room's half. `colleagueId` is who pulled their chair up and there is no
   * `detail`, which is what the log's consecutive-duplicate collapse then reads:
   * two conversations with the same person inside a minute become one line,
   * which is the truthful reading of closing the chair and immediately pulling
   * it back — the same latch `chat` and `walkby` already rely on.
   */
  recordOfficeLogEntry('huddle', { colleagueId: partner });
  return partner;
}

export default rememberPairHuddle;
