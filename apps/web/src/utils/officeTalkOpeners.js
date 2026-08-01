/**
 * What you might say when you walk up to somebody
 * (docs/office-isometric-mode.md § 8, "topic hotspots").
 *
 * `useFloorTalk` states the doctrine this has to live inside: *"Like real IM:
 * you speak first. No auto-opener when you walk up to someone."* So what gets
 * seeded is **your** composer, never their mouth — these are dialogue options
 * in the point-and-click sense, and pressing one fills the box rather than
 * sending it. You still speak first; you just are not starting from a blank
 * line while stood in front of a colleague.
 *
 * **Where the topics come from is a deviation from § 8's sketch, on purpose.**
 * That sketch reads "walking up with a recent run in mind seeds the opener
 * ('about the gateway node…')", which wants the diagram's visible labels. No
 * diagram context reaches the floor today, and threading it would mean growing
 * the bridge, `OfficeFloorView` (already 48 against a max of 12), and
 * `useFloorActivity` — the exact growth § 8 warns about. The office log carries
 * better material anyway: an adopted pitch quotes real diagram text, and
 * everything else in it is *personal* ("about your email") in a way a node
 * label is not. Walking up to Gary about the fridge email beats walking up to
 * Gary about the gateway node.
 *
 * Pure — takes log entries and returns strings, so it unit-tests without a
 * floor, a store, or a locale provider.
 */

import { formatLocale } from '../i18n/formatLocale.js';

/** Three is the most a card can offer before it reads as a menu. */
export const FLOOR_OPENER_MAX = 3;

/** A quoted pitch has to fit a chip; past this it stops being a chip. */
const TOPIC_MAX_CHARS = 34;

/**
 * Trim an adopted pitch down to something you would actually say.
 *
 * Pitches are imperative instructions ("Split Auth into Authentication and
 * Authorization"), so the first clause is the subject and the rest is the
 * instruction — dropping at the first comma or dash usually lands on the noun.
 *
 * @param {string} detail
 * @returns {string}
 */
function topicOf(detail) {
  const flat = String(detail ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!flat) return '';
  const clause = flat.split(/[,—–:;]/)[0].trim();
  const pick = clause.length >= 8 ? clause : flat;
  return pick.length > TOPIC_MAX_CHARS ? `${pick.slice(0, TOPIC_MAX_CHARS - 1)}…` : pick;
}

/**
 * Openers for walking up to `colleagueId`, most specific first.
 *
 * The ordering is the whole design: something *they* did outranks something
 * *you* did, because the difference between an office and a tool is that the
 * other people in it have been doing things. The generic opener is always last
 * and always present — a card that sometimes offers nothing to say is worse
 * than one that offers a dull option.
 *
 * `chat` is deliberately never an opener. You already talked to them; leading
 * with "about our chat" is the one option nobody needs a button for.
 *
 * @param {Array<{kind?: string, colleagueId?: string, detail?: string}>} entries
 *   office log entries, oldest first (`getOfficeLogSnapshot()`)
 * @param {string | null} colleagueId who you are stood in front of
 * @param {Record<string, string>} copy `officeChromeCopy().floor.talk.openers`
 * @returns {string[]} at most `FLOOR_OPENER_MAX`, deduped, never empty
 */
export function buildFloorTalkOpeners(entries, colleagueId, copy) {
  if (!copy) return [];
  const log = Array.isArray(entries) ? entries : [];
  const openers = [];

  const push = (text) => {
    if (text && !openers.includes(text)) openers.push(text);
  };

  // Newest first — the most recent thing is the most sayable thing.
  for (let i = log.length - 1; i >= 0 && openers.length < FLOOR_OPENER_MAX; i -= 1) {
    const entry = log[i];
    if (!entry) continue;
    const theirs = colleagueId && entry.colleagueId === colleagueId;
    if (entry.kind === 'pitch' && entry.detail) {
      const topic = topicOf(entry.detail);
      if (topic) push(formatLocale(copy.pitch, { topic }));
    } else if (entry.kind === 'email' && theirs) {
      push(copy.email);
    } else if (entry.kind === 'walkby' && theirs) {
      push(copy.visit);
    } else if (entry.kind === 'battle') {
      push(copy.battle);
    } else if (entry.kind === 'run') {
      push(copy.run);
    }
  }

  push(copy.generic);
  return openers.slice(0, FLOOR_OPENER_MAX);
}

export default buildFloorTalkOpeners;
