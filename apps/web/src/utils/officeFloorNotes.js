/**
 * What the *room* has written on the whiteboard
 * (docs/automations/office-life.md § 6a / § 15).
 *
 * The whiteboard used to be a third copy of your own diagram, beside your
 * monitor and the glass room's table. The owner's steer retired that: *"a
 * whiteboard is something different. Office participants can look at my office
 * screen if they want to see what I draw."* The empty state was already the
 * proof — the architecture from two re-orgs ago is what a whiteboard has on it,
 * and it was the only surface in the room with a life of its own.
 *
 * So this is the board's own record: the re-org nobody undid, the migration
 * nobody approved, Pam's parked item from a retro nobody attends, Linda's
 * deadline, and a bad secondhand sketch of whatever you are working on, drawn
 * by somebody who only heard about it. Each note carries the **colleague who
 * wrote it**, because a note nobody owns cannot be quoted, and a board you can
 * quote is the one piece of office memory you can see from across the room.
 *
 * **It derives, it never stores** (ADR-0011 rule 1). Every input is state the
 * office already keeps — the office log, the cast's own standing items — so
 * there is no second truth to render in the desk world and nothing here forks
 * office state per mode. User-*pinned* notes would be genuinely new state and
 * would owe the desk world a view of the same notes; that is deliberately not
 * this module. ADR-0010 holds either way: the cast writes on the room's board,
 * never on your canvas.
 *
 * **The board lags, on purpose.** A live board is a dashboard; a stale one is a
 * whiteboard. Nothing here is sorted by "now" — the standing items are standing
 * whether or not you have met their author today, and the log only decides
 * *whose* handwriting is nearest the front.
 *
 * **Words come from the locale bundle, order comes from here.** `copy` is
 * `officeChromeCopy().floor.props.items.whiteboard.notes`, so the board can be
 * translated; which notes are on it, in what order, and who wrote them is a
 * derivation and lives in this file. That split is also why the open-note order
 * is a constant below rather than the bank's key order: a translator may
 * reorder keys, and the board's reading order is not theirs to change.
 *
 * **There are two faces and one derivation.** `boardNotesFor` is also handed an
 * English-only bank — `BOARD_NOTE_PROMPT_COPY` at the foot of this file — so a
 * colleague can quote the board in a prompt without the office log's
 * always-English rule being broken. Same inputs, same order, same three notes;
 * only the words differ.
 *
 * **Pure and DOM-free**, like its sibling `officeFloorBoard.js` — the caller
 * samples `getOfficeLogSnapshot()` and hands it over. The floor must not
 * subscribe to anything that repaints sixteen figures, and a board that
 * re-inked itself the moment somebody printed a page would be the dashboard
 * again.
 */

import { formatLocale } from '../i18n/formatLocale.js';

/**
 * Most notes the board ever carries.
 *
 * Three, because the readable half is the **Look closer** card and the drawn
 * half is a 62 px panel: a fourth is a mark nobody can tell from the third.
 */
export const BOARD_MAX_NOTES = 3;

/**
 * @typedef {'stale' | 'open' | 'heard-about-yours'} BoardNoteKind
 *   - `stale` — the thing nobody has dared erase. Always present: a whiteboard
 *     is never blank, and this one is older than today.
 *   - `open` — somebody's standing item, in their handwriting.
 *   - `heard-about-yours` — your work, drawn from hearsay, therefore wrong.
 *
 * @typedef {object} BoardNote
 * @property {string} id stable per note, so a renderer can key on it
 * @property {BoardNoteKind} kind
 * @property {string | null} colleagueId who wrote it — `null` only for `stale`
 * @property {string} text the note itself, already slot-filled
 */

/** @type {readonly BoardNoteKind[]} */
export const BOARD_NOTE_KINDS = Object.freeze(['stale', 'open', 'heard-about-yours']);

/**
 * Reading order for the standing items, front of the board first.
 *
 * Gilfoyle's unapproved migration, Pam's parked retro item, Linda's deadline —
 * the three the brief names, in the order a board fills up: the one somebody
 * actually believes in, the one a ceremony produced, the one admin produced.
 *
 * @type {readonly string[]}
 */
const OPEN_NOTE_ORDER = Object.freeze(['gilfoyle', 'scrumMaster', 'hr']);

/**
 * Log kinds that mean the room has *heard about* your work.
 *
 * A run, a pitch, a meeting or a huddle all put your diagram in front of
 * somebody. Reading it off the whiteboard (`prop`) deliberately does not: you
 * cannot have heard about it from the board you are standing at.
 */
const HEARD_KINDS = new Set(['run', 'pitch', 'meeting', 'huddle']);

/**
 * Cast ids in the log, most recent first, deduped.
 *
 * @param {Array<{kind?: string, colleagueId?: string}>} officeLog
 * @returns {string[]}
 */
function recentColleagues(officeLog) {
  /** @type {string[]} */
  const ids = [];
  for (let i = officeLog.length - 1; i >= 0; i -= 1) {
    const id = officeLog[i]?.colleagueId;
    if (typeof id === 'string' && id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/**
 * Whose standing items are on the board, and in what order.
 *
 * Somebody you have dealt with today comes first — not because the note is
 * newer (it is not; that is the whole point of a stale board) but because the
 * room puts the handwriting you recognise at the front. Everyone else follows
 * in `OPEN_NOTE_ORDER`.
 *
 * @param {Record<string, string>} bank
 * @param {string[]} recent
 * @returns {string[]}
 */
function openAuthors(bank, recent) {
  const known = OPEN_NOTE_ORDER.filter((id) => typeof bank[id] === 'string' && bank[id]);
  const front = recent.filter((id) => known.includes(id));
  return [...front, ...known.filter((id) => !front.includes(id))];
}

/**
 * The note somebody drew from hearsay, or `null`.
 *
 * Two conditions, and both are refusals rather than guards: with no board there
 * is nothing to have misremembered, and with nobody in the log there is nobody
 * who could have heard about it. The office does not get to invent a witness.
 *
 * @param {{ bank: string, board: import('./officeFloorBoard.js').BoardState | null,
 *   officeLog: Array<{kind?: string, colleagueId?: string}>, recent: string[] }} params
 * @returns {BoardNote | null}
 */
function heardNote({ bank, board, officeLog, recent }) {
  if (!bank || !board?.labels?.length) return null;
  if (!officeLog.some((entry) => HEARD_KINDS.has(entry?.kind))) return null;
  const author = recent[0];
  if (!author) return null;
  return {
    id: `heard:${author}`,
    kind: 'heard-about-yours',
    colleagueId: author,
    text: formatLocale(bank, { label: board.labels[0] })
  };
}

/**
 * What is written on the whiteboard right now.
 *
 * Always at least the `stale` note when the bank has one — a board with nothing
 * on it is a board somebody cleaned, and nobody on this floor has ever cleaned
 * anything. The budget is spent in that order: the standing marker first, then
 * the hearsay sketch if there is one, then as many standing items as fit, so a
 * busy board never pushes the one note that is about *you* off the edge.
 *
 * @param {{
 *   officeLog?: Array<{kind?: string, colleagueId?: string}>,
 *   board?: import('./officeFloorBoard.js').BoardState | null,
 *   copy?: { stale?: string, open?: Record<string, string>, heardAboutYours?: string } | null
 * }} [params] `copy` is the whiteboard item's `notes` bank.
 * @returns {BoardNote[]} at most `BOARD_MAX_NOTES`
 */
export function boardNotesFor({ officeLog = [], board = null, copy = null } = {}) {
  if (!copy) return [];
  const log = Array.isArray(officeLog) ? officeLog : [];
  const open = copy.open ?? {};
  const recent = recentColleagues(log);

  /** @type {BoardNote[]} */
  const notes = copy.stale
    ? [{ id: 'stale', kind: 'stale', colleagueId: null, text: copy.stale }]
    : [];

  const heard = heardNote({ bank: copy.heardAboutYours, board, officeLog: log, recent });
  const room = Math.max(0, BOARD_MAX_NOTES - notes.length - (heard ? 1 : 0));

  for (const author of openAuthors(open, recent).slice(0, room)) {
    notes.push({ id: `open:${author}`, kind: 'open', colleagueId: author, text: open[author] });
  }

  if (heard) notes.push(heard);
  return notes;
}

/**
 * What each kind of note looks like at 62 px, in 0…1 panel fractions within
 * that note's own band.
 *
 * Marks, not glyphs. A note is one or two strokes of somebody's handwriting;
 * the hearsay sketch is three little boxes in a row, because a diagram drawn
 * from a description is boxes with nothing joining them. The readable words are
 * on the **Look closer** card, which is where there is room for them — the
 * panel's job is to say *the room has been writing on this*.
 *
 * @type {Readonly<Record<BoardNoteKind, ReadonlyArray<{x: number, w: number, h: number}>>>}
 */
const NOTE_MARKS = Object.freeze({
  // Permanent marker, and wider than anything after it: three boxes and the
  // word SYNERGY is what the empty state has always described.
  stale: Object.freeze([
    Object.freeze({ x: 0.1, w: 0.3, h: 0.1 }),
    Object.freeze({ x: 0.46, w: 0.18, h: 0.1 }),
    Object.freeze({ x: 0.7, w: 0.2, h: 0.05 })
  ]),
  // One line of writing, indented the way a margin item is.
  open: Object.freeze([Object.freeze({ x: 0.16, w: 0.56, h: 0.05 })]),
  // Three unjoined boxes — the tell that whoever drew this never saw it.
  'heard-about-yours': Object.freeze([
    Object.freeze({ x: 0.14, w: 0.14, h: 0.08 }),
    Object.freeze({ x: 0.34, w: 0.14, h: 0.08 }),
    Object.freeze({ x: 0.54, w: 0.14, h: 0.08 })
  ])
});

/**
 * The whiteboard panel's rendering of its own notes — boxes in the same 0…1
 * space `IsoPanelInk` already takes, so the art needs no new drawing code, only
 * a different source of marks.
 *
 * No edges are returned. Connectors would make this a topology, and the board
 * is not showing a diagram any more; the one note that *is* about a diagram
 * draws its boxes unjoined for exactly that reason.
 *
 * @param {BoardNote[]} notes
 * @returns {Array<{x: number, y: number, w: number, h: number}>}
 */
export function boardNoteMarks(notes) {
  const list = Array.isArray(notes) ? notes.slice(0, BOARD_MAX_NOTES) : [];
  if (!list.length) return [];

  const band = 0.76 / list.length;
  /** @type {Array<{x: number, y: number, w: number, h: number}>} */
  const marks = [];
  list.forEach((note, index) => {
    const top = 0.12 + index * band;
    for (const mark of NOTE_MARKS[note.kind] ?? NOTE_MARKS.open) {
      marks.push({ x: mark.x, y: top + (band - mark.h) / 2, w: mark.w, h: mark.h });
    }
  });
  return marks;
}

/**
 * The board's **English** prompt face — the same notes, in the language every
 * office prompt is written in.
 *
 * § 15 ruled the board *quotable both ways*, and the notes were deliberately
 * made text rather than pixels so a prompt could carry them. What stood in the
 * way was not plumbing but a collision of two rules: note text above is
 * localized UI copy (`officeChromeCopy()`, four bundles), while
 * `officeLogDigest.js`'s own header says the prompt digest **is always
 * English** — "localizing the digest would translate the input twice and give
 * the model a second language to be confused by". Sending the localized words
 * would have broken that; translating them on the server would have broken it
 * twice.
 *
 * So the board gets the split `officeDeskWork.js`'s `LOOK_PROMPT_LINES` already
 * uses: the row carries the *fact*, and there are two faces for it — one for
 * the reader, one for the model. The derivation is **not** duplicated. These
 * lines go through `boardNotesFor` with this bank in place of the locale one,
 * so the prompt can only ever say what is actually on the panel, in the order
 * it is up there. A note added to the locale bank and not to this one quietly
 * stops reaching the model, which is what the key sweep in
 * `officeFloorProps.test.jsx` is for.
 *
 * Two conventions borrowed wholesale from the digest, because the model reads
 * this beside it: **cast ids, not display names** (`gilfoyle`, not "Gilfoyle"
 * — the ids every server prompt builder already speaks), and plain sentences
 * rather than UI fragments. These are the model's memory, not its material.
 *
 * @type {{ stale: string, open: Record<string, string>, heardAboutYours: string }}
 */
const BOARD_NOTE_PROMPT_COPY = Object.freeze({
  stale:
    'an architecture from two re-orgs ago is still up there in permanent marker, with SYNERGY underlined twice',
  open: Object.freeze({
    gilfoyle:
      "gilfoyle's migration plan is up there in small furious handwriting, with the date it was approved left blank",
    scrumMaster:
      'a parked item from a retro is up there in a colour nobody else uses: revisit who owns the arrows',
    hr: 'hr has written COMPLIANCE TRAINING - FRIDAY up there, underlined three times, with a smiley face'
  }),
  heardAboutYours:
    'somebody has had a go at drawing "{label}" up there from memory, three boxes with nothing joining them and one of the words wrong'
});

/**
 * Both-sides-must-match caps for the `officeBoard` field.
 *
 * `BOARD_NOTE_PROMPT_LINE_MAX_CHARS` mirrors the route's per-line cap
 * (`OfficeBoardField` in `apps/server/src/routes/office.js`) for the reason
 * `officeLogDigest.js` states about its own: a client that drifts past a cap
 * becomes a 400 the user experiences as *the office went quiet*, and the only
 * line here that can grow is the hearsay note, because it interpolates a label
 * off the user's own diagram. `visibleLabels` allows 200 characters each, so
 * that one note could have carried the whole cap by itself.
 *
 * The label is cut first and much shorter, because a note on a whiteboard is
 * short by nature — somebody wrote it standing up, from memory. Truncating the
 * sentence instead would drop the clause that makes it a *bad* sketch, which is
 * the whole content of that note.
 */
const BOARD_NOTE_PROMPT_LINE_MAX_CHARS = 200;
const BOARD_NOTE_LABEL_MAX_CHARS = 60;

/**
 * What the whiteboard says, for the prompt — at most `BOARD_MAX_NOTES` English
 * lines, or none.
 *
 * Takes `labels` rather than a `BoardState` because the caller that has a
 * reason to send this is the moment funnel, and what it holds is the visible
 * labels it is already shipping (`ctx.labels`). The hearsay note needs exactly
 * one of them and nothing else from the board, and asking the funnel to build a
 * `BoardState` it has no other use for would be a second derivation of the same
 * fact.
 *
 * Empty when the board bank has nothing to say, so the server drops the block
 * rather than printing a heading over nothing.
 *
 * @param {{ officeLog?: Array<{kind?: string, colleagueId?: string}>,
 *   labels?: string[] }} [params]
 * @returns {string[]}
 */
export function boardNotePromptLines({ officeLog = [], labels = [] } = {}) {
  const list = Array.isArray(labels)
    ? labels
        .filter((label) => typeof label === 'string')
        .map((label) => label.slice(0, BOARD_NOTE_LABEL_MAX_CHARS))
    : [];
  return boardNotesFor({
    officeLog,
    board: list.length > 0 ? { labels: list } : null,
    copy: BOARD_NOTE_PROMPT_COPY
  }).map((note) => note.text.slice(0, BOARD_NOTE_PROMPT_LINE_MAX_CHARS));
}

/**
 * The prompt bank itself, for the sweep that keeps the two faces in step.
 *
 * Exported for `officeFloorProps.test.jsx` rather than for a renderer: nothing
 * in the app reads this bank except `boardNotePromptLines` above.
 */
export const BOARD_NOTE_PROMPT_KEYS = Object.freeze({
  top: Object.freeze(Object.keys(BOARD_NOTE_PROMPT_COPY)),
  open: Object.freeze(Object.keys(BOARD_NOTE_PROMPT_COPY.open))
});

export default boardNotesFor;
