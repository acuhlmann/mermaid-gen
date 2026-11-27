/**
 * The office log's prompt face — "what has already happened today", compact
 * enough to ride along in every office LLM request.
 *
 * This is the §11 *context contract* (docs/office-parody.md) given its first
 * worked form. The problem it solves is that every character has spoken from a
 * blank slate: Gilfoyle cannot know a meeting happened, Pam cannot know you
 * settled the tabs-vs-spaces war, and nobody can say "since this morning's
 * thing" because nobody has a this-morning. Six voices with no shared past are
 * six chatbots; the digest is what makes them one office.
 *
 * Three decisions worth keeping:
 *
 * **The digest is always English.** It is prompt context, not UI copy, and the
 * server already owns output language through `buildOfficeLanguageRule` ("
 * translate the JOKE, not the words"). Localizing the digest would translate
 * the input twice and give the model a second language to be confused by, so
 * this module has no locale mirrors and should not grow any.
 *
 * **Lines name cast ids, not display names.** `gilfoyle`, not "Gilfoyle" —
 * those are the ids every server prompt builder already speaks, so a line
 * lands as a reference rather than as a new proper noun to reconcile.
 *
 * **DM bodies never appear, and since 2026-11-02 nor does the fact.** A chat
 * logs that it happened and with whom, and that line is now handed only to the
 * person who was in it (`OFFICE_LOG_PRIVATE_KINDS`, `audience`). Email
 * subjects *are* included, which is the honest line rather than a lax one: in
 * the fiction a subject line is what the office gossips about, and a direct
 * message is not.
 *
 * **Both projections name the user out loud; neither says "you" about them.**
 * Nothing here is UI copy, so there is no reader for whom "you" means the user:
 * every line lands in a prompt whose frame addresses the **colleague** as "you"
 * (`buildOfficeLogBlock` sits under a system prompt opening "You are writing
 * ONE office moment"). Until 2026-11-27 all fifteen digest sentences and every
 * relationship line were written from the user's side, three to five lines under
 * a frame saying the opposite — the identical defect
 * `officeWorkingMemoryStore.js` measured on its own bullets on 2026-11-10 and
 * fixed by naming the party rather than flipping the pronoun.
 *
 * Measured here the same way (replicate the route, hold the diagram fixed, vary
 * only the phrasing, keep a control arm, judge meaning rather than wording):
 * **12 of 40 attributions came back with the two people swapped, against 0 of
 * 40 once the user was named**, and the control arm with neither block invented
 * none of the five facts in either direction. The reversals concentrated exactly
 * where a sentence carries two human parties — `interrupt` **6 of 8**, `walkby`
 * **4 of 8** — and "the user" never once leaked into a spoken line (0 of 8 in
 * all three arms), which is the cost this phrasing looked like it might carry
 * and does not.
 *
 * **The two projections then take opposite rules about the cast id, and that is
 * not an inconsistency.** The digest is shared, has no single addressee, and
 * names everybody (`gilfoyle`, not "you"). The relationship block is handed to
 * one speaker, so *they* are the "you" and naming them as well said they had
 * crossed paths with themselves. Both are asserted, in
 * `officeLogDigest.test.js`.
 */

/**
 * Entry kinds the log records. Kept here rather than in the store so the
 * digest — the only consumer that has to render them — owns the vocabulary it
 * knows how to speak.
 */
export const OFFICE_LOG_KINDS = /** @type {const} */ ([
  'run',
  'pitch',
  'walkby',
  'email',
  'chat',
  'coffee',
  'battle',
  'meeting',
  'huddle',
  'errand',
  'training',
  'security',
  'levelUp',
  'prop',
  'interrupt'
]);

/**
 * The log kinds whose *existence* is private to the two people in them.
 *
 * This module's header has always said a chat is bodiless — "what was said
 * stays between you and them" (§ 11 DM privacy) — and that half was true. The
 * other half was not: the line saying *that* you and somebody traded messages
 * rode on every speaker's prompt, so Gary at his own desk could open with your
 * thread with Gilfoyle as plainly as with the fridge. The body stayed private
 * and the fact did not.
 *
 * Everything else the log records is public by an argument this file already
 * made. A walk-by happens in an open-plan room; a pitch changed the diagram on
 * your monitor; an errand is the whole floor knowing Linda outsources her
 * difficult conversations; and an email *subject* is explicitly "what the
 * office gossips about". A direct message is the one exchange on this floor
 * with no witness, which is both why § 11 singles it out and why it is the only
 * kind in this set.
 *
 * **A set of kinds, never a flag per entry.** Entitlement is a property of the
 * channel, not of the sentence: a per-entry flag would let a writer forget one
 * and leak by omission, and there are six of them
 * (`officeLogStore.js`'s callers).
 *
 * @type {ReadonlySet<string>}
 */
export const OFFICE_LOG_PRIVATE_KINDS = Object.freeze(new Set(['chat']));

/**
 * The floor props that leave a mark, keyed by prop kind.
 *
 * A lookup rather than a phrase built from the kind, because a kind is an
 * identifier (`coffeeMachine`) and these are sentences — and because the set is
 * closed by geometry: only a prop the room can give you a mark for
 * (`usablePropKinds()`) is reachable, and only one with no `verb` records here
 * at all, since a verb logs its own consequence. `officeFloorPropsTable.test.js`
 * sweeps that set against this table, so a prop that becomes usable without a
 * sentence fails rather than recording an entry the digest silently drops.
 *
 * Past tense and plain, like every other line in this module: the digest is the
 * model's memory, not its material.
 */
const PROP_SENTENCES = {
  printer: 'the user printed something off at the printer',
  whiteboard: 'the user stopped and read the whiteboard'
};

/**
 * Caps, in the order they apply: each line is trimmed, then the newest
 * `MAX_LINES` are kept, then oldest lines are dropped until the whole thing
 * fits `MAX_CHARS`.
 *
 * `LINE_MAX_CHARS` and `MAX_LINES` mirror the server's `officeLog` field
 * (`apps/server/src/routes/office.js`) exactly. A digest that a route would
 * reject is a bug this side of the wire, not a validation exercise on the far
 * side.
 */
export const OFFICE_LOG_LINE_MAX_CHARS = 200;
export const OFFICE_LOG_DIGEST_MAX_LINES = 12;
export const OFFICE_LOG_DIGEST_MAX_CHARS = 700;

/** Detail strings come from LLM output and user prompts — always clamp. */
const DETAIL_MAX_CHARS = 70;

/**
 * Wall-clock `HH:MM`, local time.
 *
 * Local rather than UTC because the fiction is office hours: "09:12" should be
 * the user's morning. Tests stay deterministic by constructing timestamps the
 * same way they read them (`new Date(2026, 0, 1, 9, 12)`), so the zone cancels.
 *
 * @param {number} at epoch ms
 * @returns {string}
 */
function clockOf(at) {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return '--:--';
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Squash whitespace and clamp. Log details are quoted into a prompt, so a
 * stray newline would forge a line break in the digest block.
 *
 * @param {unknown} value
 * @param {number} max
 * @returns {string}
 */
function clamp(value, max = DETAIL_MAX_CHARS) {
  if (typeof value !== 'string') return '';
  const flat = value.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/**
 * One entry as a sentence, or `''` when the entry says nothing worth a line.
 *
 * Phrasing is deliberately plain and past-tense. The temptation is to write
 * these in the office's comic register ("Gary declared war on the fridge"),
 * but the digest is the model's *memory*, not its *material* — a funny digest
 * gets quoted back verbatim, and a flat one gets built on. The same lesson the
 * character recipe learned about example lines (docs/recipes/
 * replicate-tv-character.md §2: a vivid example comes back word-for-word).
 *
 * **The user is `the user`, never `you`** — see the module header for the
 * measurement. A sixteenth kind written in the obvious register is how this
 * re-breaks, which is why the assertion sweeps `OFFICE_LOG_KINDS` rather than
 * naming a sentence.
 *
 * @param {{kind?: string, colleagueId?: string, detail?: string}} entry
 * @returns {string}
 */
function sentenceOf(entry) {
  const who = clamp(entry?.colleagueId, 40);
  const detail = clamp(entry?.detail);
  switch (entry?.kind) {
    case 'run':
      return detail ? `the user shipped a ${detail} diagram` : 'the user shipped a diagram';
    case 'pitch':
      return who
        ? `the user took ${who}'s suggestion${detail ? ` (${detail})` : ''}`
        : `the user took a suggestion${detail ? ` (${detail})` : ''}`;
    case 'walkby':
      return who ? `${who} stopped by the user's desk` : '';
    case 'email':
      return who ? `${who} emailed the user${detail ? `: "${detail}"` : ''}` : '';
    // Deliberately bodiless — see the DM privacy note in the module header.
    case 'chat':
      return who ? `the user and ${who} traded messages` : '';
    case 'coffee':
      return 'the user took a coffee break';
    case 'battle':
      return detail
        ? `a cubicle argument was settled, ${detail} won`
        : 'a cubicle argument was settled';
    case 'meeting':
      return detail === 'left' ? 'the user left a meeting early' : 'the user sat through a meeting';
    /*
     * Two sentences, because the room supports two huddles and it only ever had
     * a line for one. A mob is `CAST_TIERS.team` dragged over, and "the team
     * crowded around your screen" is true of it. A **pair** is one named
     * colleague pulling their chair up — the longest conversation this office
     * supports — and the mob line is false about it, which is why the write that
     * would have filed one stayed shut until this branch existed
     * (`docs/office-isometric-mode.md` § 8, `pair-huddle-is-never-huddled`).
     *
     * **Public, and bodiless** — the two halves decided separately, as for an
     * interruption. Public because a chair pulled up to your desk has
     * witnesses: both renderers draw it (`HuddleOverlay.jsx` at the desk,
     * `FloorHuddle.jsx` ringing the desk in the room), so this is the `walkby`
     * case and not the `chat` one. Bodiless because what was said is on the
     * partner's own working-memory beat, which only they are handed: the office
     * knows the two of you talked, never what about.
     */
    case 'huddle':
      return who
        ? `the user and ${who} talked something through at their desk`
        : "the team crowded around the user's screen";
    /*
     * Slice 26. `detail` is who *sent* you, which is the half that makes this
     * office business rather than a private chat: the whole floor knows Linda
     * outsources her difficult conversations. What was actually said stays out,
     * for the same reason `chat` is bodiless.
     */
    case 'errand':
      return who
        ? `the user went and had a word with ${who}${detail ? `, at ${detail}'s asking` : ''}`
        : '';
    // §10.1 / §10.2. Both are things the whole office would plausibly know
    // about by lunchtime — which is exactly the test for what belongs here.
    case 'training':
      return detail
        ? `the user finally completed compliance module ${detail}`
        : 'the user finally completed a compliance module';
    case 'security':
      return detail === 'reported'
        ? 'the user reported a phishing email'
        : 'the user clicked a simulated phishing email';
    case 'levelUp':
      return detail ? `the user was promoted to ${detail}` : 'the user was promoted';
    /*
     * Slice 9's props, finally leaving something behind. Bodiless like `chat`
     * in spirit — the line says you were at the thing, never what the page
     * said, because what the printer produced is your own work and the office
     * does not read it back to you (ADR-0010).
     */
    case 'prop':
      return PROP_SENTENCES[detail] ?? '';
    /*
     * The most public thing on this list, and the last to arrive. You claim the
     * tile somebody was walking to, they turn round and say something about it
     * out loud in the middle of an open-plan room — it has more witnesses than
     * an email subject, which this module already calls "what the office
     * gossips about". Until it was here the only record of it was the victim's
     * own working memory, so the one thing the whole floor watched happen was
     * the one thing nobody but the two of you could mention.
     *
     * **`detail` is the reaction, and deliberately not the prop.**
     * `interrupted` (`gotIt` / `gaveUp`) already reaches a mouth, through
     * `INTERRUPTION_PROMPT_LINES`; `interruptedProp` deliberately does not —
     * `useFloorInterruptMemory.js` calls it "a fact for the floor, not a fact
     * for a mouth". Keeping the same split here means the room's memory and the
     * victim's can never disagree about which machine it was, because neither
     * of them names one.
     *
     * Not in `OFFICE_LOG_PRIVATE_KINDS`: see above, there is no witness-free
     * version of walking into somebody.
     */
    case 'interrupt':
      if (!who) return '';
      return detail === 'gaveUp'
        ? `the user got in ${who}'s way and they went back to their desk empty-handed`
        : `the user took the spot ${who} was using`;
    default:
      return '';
  }
}

/**
 * Entries → prompt lines, oldest first.
 *
 * Oldest-first because that is the order a person would recount a day in, and
 * because the last line — the most recent thing — then sits closest to the
 * instruction that follows it in the prompt.
 *
 * Over-budget drops from the **front**: the model losing what happened at 09:02
 * is a character forgetting the early morning, which is what people do. Dropping
 * from the back would make it forget the thing that just happened, which reads
 * as broken rather than as human.
 *
 * **Scoped before it is capped**, which is the half of this that is not about
 * privacy: the caps run over what this audience may hear, so a morning of
 * private threads with one colleague no longer pushes the room's own facts out
 * of everybody else's memory. Withholding a line gives the budget back.
 *
 * @param {Array<{at?: number, kind?: string, colleagueId?: string, detail?: string}> | null | undefined} entries
 * @param {{audience?: string[] | string}} [options] `audience` is who the
 *   digest is for — one speaker, or a whole room. Omit it for the unscoped
 *   digest.
 * @returns {string[]} at most `OFFICE_LOG_DIGEST_MAX_LINES` lines, together no
 *   longer than `OFFICE_LOG_DIGEST_MAX_CHARS`.
 */
/**
 * The four kinds that name a colleague in `colleagueId`, which is the whole
 * eligibility test for a relationship: they are the ways a *named* person and
 * the user touch each other's day.
 *
 * `battle` is deliberately absent even though it looks like it belongs. Its
 * colleague rides in `detail` (the winner of the argument) rather than in
 * `colleagueId`, so counting it would mean reading one kind's `detail` as an
 * id — and the fact it carries is about the argument, not about the two of you.
 * The global digest already says who won.
 *
 * `errand` (slice 26) is absent for a different reason and is worth recording
 * so nobody re-derives it: it *would* qualify — it names the person you crossed
 * the room for. It is left out because this projection's own effect on the
 * model has only been measured once, on one fixture at n=5, and came back
 * modest; widening what feeds it before that measurement is redone would be
 * building on an unaudited result. Every errand is accompanied by a `chat`
 * entry anyway, so nothing about the two of you is lost — only the framing.
 *
 * `interrupt` is absent for the same reason as `errand` and one of its own: it
 * names the person you walked into, so it would qualify, and the person it
 * names already carries the richer version of it in working memory — a beat
 * with the line they said in it. A count here would be the third telling of one
 * collision, in the same prompt as the other two.
 *
 * A `huddle` that names somebody — a pair — is absent for exactly
 * `interrupt`'s reason, and it is the strongest instance of it: the partner's
 * beat holds the last exchange *verbatim* (`officeHuddleMemory.js` writes both
 * records behind one guard), and that beat rides on the same `/moment` request
 * as this block. "1 chat at your desk" is a worse telling of a conversation
 * than the conversation. A mob `huddle` has no `colleagueId` at all and so
 * cannot reach this projection either way.
 */
/*
 * Noun phrases with an explicit count, never verb phrases. "emailed you,
 * traded messages with you" loses track of who the subject is by the second
 * item — and the one thing this block must not do is leave the model guessing
 * which of you did what.
 *
 * Written from the **speaker's** side, which is the opposite of the digest's
 * rule and for the same reason: this block is handed to one named colleague
 * under "You and this user, today (yours alone)", so the reader is the "you"
 * and the other party has to be named. The noun phrases therefore carry the
 * user rather than a bare "them" — "2 emails you sent the user" rather than
 * "2 emails from them", where "them" would resolve to the reader.
 */
const RELATIONSHIP_KINDS = {
  email: { one: 'email you sent the user', many: 'emails you sent the user' },
  chat: { one: 'chat with the user', many: 'chats with the user' },
  walkby: { one: "visit to the user's desk", many: "visits to the user's desk" },
  pitch: { one: 'suggestion of yours the user took', many: 'suggestions of yours the user took' }
};

/** At most this many lines — a moment prompt is already long. */
export const OFFICE_RELATIONSHIP_MAX_LINES = 3;

/**
 * One colleague's private history with the user, today.
 *
 * **Why this exists when the digest already names colleagues.** The digest is
 * the *shared* memory and it is budgeted as one: 12 lines, 700 characters,
 * dropping from the front. So the four times you and Gilfoyle actually spoke
 * are competing with everything else the office did, and by mid-afternoon they
 * have scrolled off — the one person who should remember them is the one who
 * cannot. This projection is over the same entries and answers a narrower
 * question that survives that budget: *what have you and I been to each other
 * today.* No new state, no new store, no second write path (ADR-0010 — this
 * still only records).
 *
 * **Strictly relational.** Counts, recency and texture — never the clock's
 * general facts and never the office's other business, which is slice 20's
 * precedent (the log is not where you learn what time it is) and § 11's
 * division of labour. A colleague with no history gets `[]` and the caller
 * drops the block entirely: "we have not spoken today" is not a thing anyone
 * remarks on in an office they have been sitting in all day.
 *
 * @param {Array<{at?: number, kind?: string, colleagueId?: string}> | null | undefined} entries
 * @param {string} colleagueId
 * @returns {string[]} at most `OFFICE_RELATIONSHIP_MAX_LINES` lines
 */
export function buildOfficeRelationship(entries, colleagueId) {
  const who = clamp(colleagueId, 40);
  if (!who) return [];

  const counts = {};
  let total = 0;
  let lastAt = null;
  for (const entry of entries ?? []) {
    if (clamp(entry?.colleagueId, 40) !== who) continue;
    if (!Object.prototype.hasOwnProperty.call(RELATIONSHIP_KINDS, entry?.kind)) continue;
    counts[entry.kind] = (counts[entry.kind] ?? 0) + 1;
    total += 1;
    if (Number.isFinite(entry.at)) lastAt = entry.at;
  }
  if (total === 0) return [];

  const lines = [
    total === 1
      ? `you and the user have crossed paths once today${lastAt === null ? '' : `, at ${clockOf(lastAt)}`}`
      : `you and the user have crossed paths ${total} times today${lastAt === null ? '' : `, most recently at ${clockOf(lastAt)}`}`
  ];

  // The texture, only when there is more than one thing to distinguish —
  // repeating "1 email" straight after "crossed paths once" says nothing twice.
  const parts = Object.entries(RELATIONSHIP_KINDS)
    .filter(([kind]) => counts[kind])
    .map(([kind, label]) => `${counts[kind]} ${counts[kind] === 1 ? label.one : label.many}`);
  if (total > 1 && parts.length > 0) lines.push(`that was: ${parts.join(', ')}`);

  // Taking somebody's suggestion is the strongest relational fact the log holds
  // — it is the one entry where they changed the user's work — so it gets its
  // own line rather than sitting third in a list.
  if (counts.pitch) {
    lines.push(
      counts.pitch === 1
        ? 'the user took your suggestion earlier'
        : `the user has taken ${counts.pitch} of your suggestions`
    );
  }

  return lines
    .slice(0, OFFICE_RELATIONSHIP_MAX_LINES)
    .map((line) => clamp(line, OFFICE_LOG_LINE_MAX_CHARS));
}

/**
 * Would this audience know about this entry?
 *
 * `audience` is the set of cast ids the digest is being rendered *for* — one
 * speaker on `/moment`, and (once the ensemble senders can reach it) everybody
 * in a room. An empty set means nobody has been named, and the answer is then
 * the unscoped digest every caller got before this existed: a default that
 * keeps the three ensemble surfaces byte-identical rather than silently
 * narrowing a prompt no test here covers.
 *
 * A private entry survives for the person who was in it — they are the one
 * character who may say "about those messages" — and for nobody else.
 *
 * @param {{kind?: string, colleagueId?: string}} entry
 * @param {Set<string>} audience
 * @returns {boolean}
 */
function audibleTo(entry, audience) {
  if (audience.size === 0) return true;
  if (!OFFICE_LOG_PRIVATE_KINDS.has(entry?.kind)) return true;
  return audience.has(clamp(entry?.colleagueId, 40));
}

export function buildOfficeLogDigest(entries, { audience = [] } = {}) {
  const heard = new Set(
    (Array.isArray(audience) ? audience : [audience]).map((id) => clamp(id, 40)).filter(Boolean)
  );
  const lines = [];
  for (const entry of entries ?? []) {
    if (!audibleTo(entry, heard)) continue;
    const sentence = sentenceOf(entry);
    if (!sentence) continue;
    lines.push(clamp(`${clockOf(entry.at)} ${sentence}`, OFFICE_LOG_LINE_MAX_CHARS));
  }

  const recent = lines.slice(-OFFICE_LOG_DIGEST_MAX_LINES);
  let total = recent.reduce((sum, line) => sum + line.length + 1, 0);
  let start = 0;
  while (start < recent.length && total > OFFICE_LOG_DIGEST_MAX_CHARS) {
    total -= recent[start].length + 1;
    start += 1;
  }
  return recent.slice(start);
}

export default buildOfficeLogDigest;
