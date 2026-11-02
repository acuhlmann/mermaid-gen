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
  'prop'
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
  printer: 'you printed something off at the printer',
  whiteboard: 'you stopped and read the whiteboard'
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
 * @param {{kind?: string, colleagueId?: string, detail?: string}} entry
 * @returns {string}
 */
function sentenceOf(entry) {
  const who = clamp(entry?.colleagueId, 40);
  const detail = clamp(entry?.detail);
  switch (entry?.kind) {
    case 'run':
      return detail ? `you shipped a ${detail} diagram` : 'you shipped a diagram';
    case 'pitch':
      return who
        ? `you took ${who}'s suggestion${detail ? ` (${detail})` : ''}`
        : `you took a suggestion${detail ? ` (${detail})` : ''}`;
    case 'walkby':
      return who ? `${who} stopped by your desk` : '';
    case 'email':
      return who ? `${who} emailed you${detail ? `: "${detail}"` : ''}` : '';
    // Deliberately bodiless — see the DM privacy note in the module header.
    case 'chat':
      return who ? `you and ${who} traded messages` : '';
    case 'coffee':
      return 'you took a coffee break';
    case 'battle':
      return detail
        ? `a cubicle argument was settled, ${detail} won`
        : 'a cubicle argument was settled';
    case 'meeting':
      return detail === 'left' ? 'you left a meeting early' : 'you sat through a meeting';
    case 'huddle':
      return 'the team crowded around your screen';
    /*
     * Slice 26. `detail` is who *sent* you, which is the half that makes this
     * office business rather than a private chat: the whole floor knows Linda
     * outsources her difficult conversations. What was actually said stays out,
     * for the same reason `chat` is bodiless.
     */
    case 'errand':
      return who
        ? `you went and had a word with ${who}${detail ? `, at ${detail}'s asking` : ''}`
        : '';
    // §10.1 / §10.2. Both are things the whole office would plausibly know
    // about by lunchtime — which is exactly the test for what belongs here.
    case 'training':
      return detail
        ? `you finally completed compliance module ${detail}`
        : 'you finally completed a compliance module';
    case 'security':
      return detail === 'reported'
        ? 'you reported a phishing email'
        : 'you clicked a simulated phishing email';
    case 'levelUp':
      return detail ? `you were promoted to ${detail}` : 'you were promoted';
    /*
     * Slice 9's props, finally leaving something behind. Bodiless like `chat`
     * in spirit — the line says you were at the thing, never what the page
     * said, because what the printer produced is your own work and the office
     * does not read it back to you (ADR-0010).
     */
    case 'prop':
      return PROP_SENTENCES[detail] ?? '';
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
 */
/*
 * Noun phrases with an explicit count, never verb phrases. "emailed you,
 * traded messages with you" loses track of who the subject is by the second
 * item — and the one thing this block must not do is leave the model guessing
 * which of you did what.
 */
const RELATIONSHIP_KINDS = {
  email: { one: 'email from them', many: 'emails from them' },
  chat: { one: 'chat', many: 'chats' },
  walkby: { one: 'desk visit', many: 'desk visits' },
  pitch: { one: 'suggestion of theirs you took', many: 'suggestions of theirs you took' }
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
      ? `you and ${who} have crossed paths once today${lastAt === null ? '' : `, at ${clockOf(lastAt)}`}`
      : `you and ${who} have crossed paths ${total} times today${lastAt === null ? '' : `, most recently at ${clockOf(lastAt)}`}`
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
        ? `you took ${who}'s suggestion earlier`
        : `you have taken ${counts.pitch} of ${who}'s suggestions`
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
