/**
 * What the person in the chair noticed you change, and when they speak up.
 *
 * Pure helpers for `usePairInitiative`. A pair used to talk only when talked
 * to; these two are what let them react to an edit you just made and, now and
 * then, pipe up after you have gone quiet — the two things a colleague in the
 * next chair does that a chatbot does not.
 */

/** Edits come in bursts; wait for the canvas to sit still before reacting. */
export const PAIR_EDIT_SETTLE_MS = 2_500;
/** At most one unprompted line in this window, so a busy edit streak is not narrated. */
export const PAIR_INITIATIVE_GAP_MS = 15_000;
/** Edit reactions per pairing. You are working, they are commenting — bounded. */
export const PAIR_EDIT_REACTIONS_MAX = 10;
/**
 * Small edits (a rename, an arrow, a label on one) get a nod, not a line — but
 * after this many nods in a row the next small one is worth a word again, so a
 * long run of tweaks is not met with silence.
 */
export const PAIR_NODS_BEFORE_WORDS = 3;
/** First quiet stretch before they speak up, doubling after each one. */
export const PAIR_LULL_BASE_MS = 45_000;
/** Unprompted remarks per pairing; "sometimes", never a metronome. */
export const PAIR_LULLS_MAX = 3;

const MAX_LIST = 3;
const MAX_LABEL_CHARS = 60;
const MAX_LINE_CHARS = 80;

function quoted(label) {
  return `"${String(label).slice(0, MAX_LABEL_CHARS)}"`;
}

function listed(labels) {
  const shown = labels.slice(0, MAX_LIST).map(quoted).join(', ');
  const more = labels.length - MAX_LIST;
  return more > 0 ? `${shown} and ${more} more` : shown;
}

function uniqueLabels(canvas) {
  return Array.isArray(canvas?.labels) ? canvas.labels.filter(Boolean) : [];
}

/** Source lines the new canvas has that the old one did not, minus blanks. */
function addedSourceLines(before, after) {
  const old = new Set(
    String(before ?? '')
      .split('\n')
      .map((line) => line.trim())
  );
  return String(after ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !old.has(line) && !line.startsWith('%%'));
}

/** The id rendered for `label`, when the canvas has one to point at. */
function idForLabel(canvas, label) {
  const index = uniqueLabels(canvas).indexOf(label);
  const id = index >= 0 && Array.isArray(canvas?.ids) ? canvas.ids[index] : null;
  return typeof id === 'string' && id ? id : null;
}

/**
 * Describe the change between two canvas reads, for the partner to react to.
 *
 * Boxes are compared by label rather than by rendered id: Mermaid numbers its
 * node ids by position, so adding one box can renumber every box after it and
 * an id diff would report the whole diagram as new. One box out and one in with
 * the count unchanged reads as a rename, which is what it almost always is.
 * When no box changed, the new source lines say what did (an arrow, a label on
 * one), so the reaction can be about the actual edit rather than "something".
 *
 * @param {{ labels?: string[], ids?: string[], diagramSource?: string }} before
 * @param {{ labels?: string[], ids?: string[], diagramSource?: string }} after
 * `kind` says how big the change was: `boxes` (a box came or went) is worth a
 * remark; `rename` and `source` (an arrow, a label on one) are the tweaks a
 * person at your shoulder nods at.
 *
 * @returns {{ text: string, focusId: string | null, kind: 'boxes' | 'rename' | 'source' } | null}
 *   null when nothing worth a remark changed (whitespace, a reflow, an
 *   identical source)
 */
export function describePairEdit(before, after) {
  if (String(before?.diagramSource ?? '').trim() === String(after?.diagramSource ?? '').trim()) {
    return null;
  }
  const oldLabels = uniqueLabels(before);
  const newLabels = uniqueLabels(after);
  const added = newLabels.filter((label) => !oldLabels.includes(label));
  const removed = oldLabels.filter((label) => !newLabels.includes(label));

  if (added.length === 1 && removed.length === 1) {
    return {
      text: `renamed ${quoted(removed[0])} to ${quoted(added[0])}`,
      focusId: idForLabel(after, added[0]),
      kind: 'rename'
    };
  }
  const parts = boxChanges(added, removed);
  if (parts.length === 0) {
    return { text: sourceChange(before, after), focusId: null, kind: 'source' };
  }
  return {
    text: parts.join('; '),
    focusId: added.length > 0 ? idForLabel(after, added[0]) : null,
    kind: 'boxes'
  };
}

/** "added a box …" / "removed the boxes …", either or both. */
function boxChanges(added, removed) {
  const parts = [];
  if (added.length > 0)
    parts.push(`added ${added.length === 1 ? 'a box' : 'boxes'} ${listed(added)}`);
  if (removed.length > 0) {
    parts.push(`removed ${removed.length === 1 ? 'the box' : 'the boxes'} ${listed(removed)}`);
  }
  return parts;
}

/** No box came or went, so say which source lines are new (an arrow, a label on one). */
function sourceChange(before, after) {
  const lines = addedSourceLines(before?.diagramSource, after?.diagramSource);
  if (lines.length === 0) return 'deleted something from the diagram';
  const shown = lines.slice(0, 2).map((line) => `\`${line.slice(0, MAX_LINE_CHARS)}\``);
  return `edited the diagram: ${shown.join(', ')}`;
}

/**
 * How long a quiet stretch lasts before they speak up, for the `count`th time.
 *
 * Doubling, so a pair left running does not settle into a rhythm you can set a
 * watch by; jittered ±20% for the same reason.
 *
 * @param {number} count unprompted remarks already made this pairing
 * @param {() => number} [random]
 */
export function pairLullDelayMs(count, random = Math.random) {
  const base = PAIR_LULL_BASE_MS * 2 ** Math.max(0, count);
  return Math.round(base * (0.8 + 0.4 * random()));
}

/**
 * True while you are typing somewhere — the reply strip, the work order, a
 * search box. Speaking up then would talk over the sentence you are writing.
 */
export function isComposingText(doc = typeof document !== 'undefined' ? document : null) {
  const el = doc?.activeElement;
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag !== 'TEXTAREA' && tag !== 'INPUT') return false;
  // Monaco keeps a hidden textarea with text in it whenever the source editor
  // has focus; edits made there reach the pair as edits, not as a sentence.
  if (el.closest?.('.monaco-editor')) return false;
  return typeof el.value === 'string' && el.value.trim() !== '';
}

/**
 * True while you are still in the middle of a canvas edit: the inline label
 * box is open (a new box starts there under its placeholder id), or you are
 * typing in any other text field. An edit reaction waits for this to clear.
 */
export function isEditingCanvas(doc = typeof document !== 'undefined' ? document : null) {
  if (doc?.querySelector?.('.graph-edit-label-inline')) return true;
  return isComposingText(doc);
}
