/**
 * The office log as a prompt block — "what has already happened today".
 *
 * Built client-side by `officeLogDigest.js` and shipped on office requests as
 * `officeLog`. Lives in `_lib/` because both prompt systems need it and they
 * are deliberately kept apart: `officePersonas.js` owns dialogue contracts
 * (beats, moments, huddles) and `advisorPrompts.js` owns the
 * `{suggestion, highlightIds, kind}` envelope. Same character, two cards — and
 * now one shared memory, without either module importing the other.
 *
 * @typedef {'dialogue' | 'work'} OfficeLogPurpose
 *   What the reader is about to do with the day.
 *
 *   `dialogue` — someone is about to *speak*. They lived through the day and
 *   may glance back at it.
 *
 *   `work` — the advisor is about to propose a diagram edit in ≤80 characters.
 *   Handed the same "reference it naturally" rule, it spends that budget on
 *   office chit-chat and stops being a suggestion. What it actually needs from
 *   the log is narrower and more useful: *don't propose what was just done.*
 */

/** Mirrors the digest's own line cap (`officeLogDigest.js`). */
const LOG_LINE_MAX_CHARS = 200;
const LOG_MAX_LINES = 12;

/**
 * The closing instruction is the load-bearing half of this block. Handed a list
 * of facts with no instruction, a model recaps them — you get Gilfoyle opening
 * with a summary of your morning, which is neither in character nor how memory
 * works. What is wanted is the *option* of a reference, taken rarely.
 *
 * @type {Record<OfficeLogPurpose, string[]>}
 */
const PURPOSE_RULES = {
  dialogue: [
    'Use this ONLY if a reference lands naturally — a glance back at one thing, in your own',
    'voice. Do NOT summarize the day, do not list events, and do not mention this at all if',
    'nothing here is worth mentioning. Most of the time it is not.'
  ],
  work: [
    'This is context, NOT material. Do not narrate the day and do not mention it in your',
    'suggestion — you have far too few characters to spend on it. Use it for one thing only:',
    'never propose something the user has already just done.'
  ]
};

/**
 * @param {string[] | undefined} officeLog already-capped digest lines
 * @param {{purpose?: OfficeLogPurpose}} [options]
 * @returns {string[] | null} prompt lines, or null when the log is empty — so
 *   callers can drop the heading entirely rather than print an empty section.
 *   A heading over "(none)" reads to the model as an absence worth remarking
 *   on, and the first minute of a session is exactly when nobody should open
 *   with "quiet morning so far".
 */
export function buildOfficeLogBlock(officeLog, { purpose = 'dialogue' } = {}) {
  const lines = Array.isArray(officeLog)
    ? officeLog.filter((line) => typeof line === 'string' && line.trim()).slice(-LOG_MAX_LINES)
    : [];
  if (lines.length === 0) return null;
  const heading =
    purpose === 'work'
      ? 'Earlier today, in this office (context — what the user has already done):'
      : 'Earlier today, in this office (shared memory — everyone here lived through it):';
  return [
    '',
    heading,
    ...lines.map((line) => `- ${line.slice(0, LOG_LINE_MAX_CHARS)}`),
    '',
    ...PURPOSE_RULES[purpose]
  ];
}

export default buildOfficeLogBlock;
