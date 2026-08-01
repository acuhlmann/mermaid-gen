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
 * **DM bodies never appear.** A chat logs that it happened and with whom; what
 * was said stays between you and them (§11 DM privacy). Email subjects *are*
 * included, which is the honest line rather than a lax one: in the fiction a
 * subject line is what the office gossips about, and a direct message is not.
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
  'training',
  'security',
  'levelUp'
]);

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
 * @param {Array<{at?: number, kind?: string, colleagueId?: string, detail?: string}> | null | undefined} entries
 * @returns {string[]} at most `OFFICE_LOG_DIGEST_MAX_LINES` lines, together no
 *   longer than `OFFICE_LOG_DIGEST_MAX_CHARS`.
 */
export function buildOfficeLogDigest(entries) {
  const lines = [];
  for (const entry of entries ?? []) {
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
