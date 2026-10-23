import { useEffect, useRef } from 'react';
import { getOfficeSnapshot, setOfficeHuddleGesture } from '../state/officeMomentStore.js';
import {
  PAIR_EDIT_REACTIONS_MAX,
  PAIR_EDIT_SETTLE_MS,
  PAIR_INITIATIVE_GAP_MS,
  PAIR_LULLS_MAX,
  PAIR_NODS_BEFORE_WORDS,
  describePairEdit,
  isComposingText,
  isEditingCanvas,
  pairLullDelayMs
} from '../utils/officePairEdits.js';

/** A blocked lull (you are typing, the tab is hidden) looks again this much later. */
const PAIR_LULL_RETRY_MS = 15_000;
/** The server's cap on one transcript line (`OfficePairTurnSchema.text`). */
const PAIR_TURN_TEXT_MAX = 400;
/** What of their last proposal rides along with an edit, so they can tell if you took it. */
const PAIR_SUGGESTION_MAX = 160;

/** The pair is waiting on you, with nothing of theirs in flight. */
function isPairListening(huddle) {
  return Boolean(
    huddle && huddle.mode === 'pair' && huddle.phase === 'listening' && !huddle.awaitingReply
  );
}

function isPageHidden() {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden';
}

/**
 * The edit, as a transcript line. A box that was added or renamed carries its
 * rendered id so the reaction can point at it; the server still validates the
 * id against `visibleIds`, so this is a hint and never a way to invent one.
 *
 * `suggestion` is what they last proposed and you did not hand over with Do
 * it. Carrying it is what lets them notice whether this edit is you taking
 * their advice or going your own way, which is most of what makes a remark
 * about your change sound like it came from the person who suggested one.
 * Clamped as a whole, because the server answers 400 to an over-long line.
 */
function editTurnText(edit, contentType, { ran = false, suggestion = null } = {}) {
  let text = ran ? `ran your suggestion, which ${edit.text}` : edit.text;
  if (edit.focusId && contentType === 'mermaid') text = `${text} (id ${edit.focusId})`;
  if (!ran && suggestion) {
    text = `${text}. You had suggested: "${suggestion.slice(0, PAIR_SUGGESTION_MAX)}"`;
  }
  return text.slice(0, PAIR_TURN_TEXT_MAX);
}

/** Their most recent proposal in the turn that just landed, or null. */
function latestSuggestion(huddle) {
  const beats = Array.isArray(huddle?.beats) ? huddle.beats : [];
  for (let index = beats.length - 1; index >= 0; index -= 1) {
    const prompt = beats[index]?.actionPrompt;
    if (typeof prompt === 'string' && prompt.trim()) return prompt.trim();
  }
  return null;
}

/**
 * The person in the chair speaks without being spoken to.
 *
 * Two triggers, both only while the pair is `listening` — waiting on you, with
 * none of their own lines playing and nothing in flight:
 *
 * - **Your edit.** The canvas changed since their last line. Once it has sat
 *   still for `PAIR_EDIT_SETTLE_MS` they react to what changed (an `edit` turn
 *   naming the boxes added, removed or renamed). A small edit — a rename, an
 *   arrow, a label — gets a nod (`setOfficeHuddleGesture`) rather than a
 *   line, until `PAIR_NODS_BEFORE_WORDS` nods in a row make the next one
 *   worth a word; nobody at your shoulder comments on every keystroke. Edits
 *   made while they were still talking wait for them to finish.
 * - **A lull.** You have been quietly working, so now and then they pipe up
 *   with something new. Any edit, reply or line of theirs restarts the quiet
 *   clock, each lull doubles the next one, and there are at most
 *   `PAIR_LULLS_MAX` per pairing. Never while you are typing, and never into a
 *   hidden tab.
 *
 * Both share `PAIR_INITIATIVE_GAP_MS`, so an edit streak does not become a
 * running commentary. They only ever *speak* — nothing here runs the agent or
 * touches the diagram (ADR-0010: the cast comments, the human produces).
 *
 * Doctrine note (docs/office-parody.md § 11): a lull is timer-driven, which
 * normally means canned. It is LLM here because you seated this person and it
 * is the same conversation — a canned line from someone you are pairing with
 * is the clearest "nobody is home" tell there is — so it is held to a hard
 * per-pairing cap instead.
 *
 * @param {{
 *   huddle: object | null,
 *   diagramWatchKey: string,
 *   readCanvas: () => { contentType: string, diagramSource: string, labels: string[], ids: string[] },
 *   askPartner: (ask: { cue: 'edit' | 'lull', userTurn?: { role: 'edit', text: string } }) => Promise<unknown>
 * }} params
 */
export function usePairInitiative({ huddle, diagramWatchKey, readCanvas, askPartner }) {
  const readCanvasRef = useRef(readCanvas);
  const askPartnerRef = useRef(askPartner);
  const watchKeyRef = useRef(diagramWatchKey);
  useEffect(() => {
    readCanvasRef.current = readCanvas;
    askPartnerRef.current = askPartner;
    watchKeyRef.current = diagramWatchKey;
  });

  /** The canvas their last line was about: what an edit is measured against. */
  const baselineRef = useRef(
    /** @type {{ huddleId: string, key: string, canvas: object } | null} */ (null)
  );
  const countsRef = useRef({ huddleId: '', edits: 0, nods: 0, lulls: 0, lastAt: 0 });
  /** True once a Do-it ran since their last line, so the next edit is its result. */
  const ranSuggestionRef = useRef(false);
  /**
   * The turn whose proposal an edit was last measured against. Their proposal
   * rides along with the first spoken edit after it lands and not again, or
   * every later change would read as "still not what I suggested".
   */
  const suggestionTurnRef = useRef(/** @type {string | null} */ (null));

  const isPair = huddle?.mode === 'pair';
  const huddleId = huddle?.id ?? '';
  const turnIndex = huddle?.turnIndex ?? 0;
  const listening = isPairListening(huddle);

  // Each new pairing starts with a fresh budget and a fresh baseline; each of
  // their turns moves the baseline, because that line was about the canvas as
  // it then was.
  useEffect(() => {
    if (!isPair || !huddleId) {
      baselineRef.current = null;
      return;
    }
    if (countsRef.current.huddleId !== huddleId) {
      countsRef.current = { huddleId, edits: 0, nods: 0, lulls: 0, lastAt: 0 };
      ranSuggestionRef.current = false;
    }
    baselineRef.current = { huddleId, key: watchKeyRef.current, canvas: readCanvasRef.current() };
  }, [isPair, huddleId, turnIndex]);

  // A Do-it run is the pair watching their own suggestion land; remember it so
  // the change it makes reads as "it ran", not as something you did by hand.
  const watching = isPair && huddle?.phase === 'watching';
  useEffect(() => {
    if (watching) ranSuggestionRef.current = true;
  }, [watching]);

  // Your edit → their reaction, once the canvas sits still and you have
  // finished the action: a new box whose name you are still typing is not done
  // yet, and reacting then would be reacting to its placeholder id.
  useEffect(() => {
    if (!listening) return undefined;
    const base = baselineRef.current;
    if (!base || base.huddleId !== huddleId) return undefined;
    if (!diagramWatchKey || diagramWatchKey === base.key) return undefined;
    const counts = countsRef.current;

    let timer = null;
    const attempt = () => {
      if (!isPairListening(getOfficeSnapshot().huddle)) return;
      if (isEditingCanvas()) {
        timer = setTimeout(attempt, PAIR_EDIT_SETTLE_MS);
        return;
      }
      const canvas = readCanvasRef.current();
      const edit = describePairEdit(base.canvas, canvas);
      if (!edit) {
        baselineRef.current = { huddleId, key: diagramWatchKey, canvas };
        return;
      }
      const ran = ranSuggestionRef.current;
      const outOfWords = counts.edits >= PAIR_EDIT_REACTIONS_MAX;
      const small = edit.kind !== 'boxes' && !ran;
      if (outOfWords || (small && counts.nods < PAIR_NODS_BEFORE_WORDS)) {
        // Measured against, whether or not it was worth a remark: a skipped
        // reaction must not re-fire on the same change forever.
        baselineRef.current = { huddleId, key: diagramWatchKey, canvas };
        counts.nods += 1;
        setOfficeHuddleGesture(huddleId, { kind: 'nod', focusId: edit.focusId });
        return;
      }
      // Words, but not straight after their last unprompted ones: the gap is
      // what keeps an edit streak from becoming a running commentary.
      const gapLeft = PAIR_INITIATIVE_GAP_MS - (Date.now() - counts.lastAt);
      if (gapLeft > 0) {
        timer = setTimeout(attempt, gapLeft);
        return;
      }
      baselineRef.current = { huddleId, key: diagramWatchKey, canvas };
      counts.edits += 1;
      counts.nods = 0;
      counts.lastAt = Date.now();
      ranSuggestionRef.current = false;
      const live = getOfficeSnapshot().huddle;
      const turnKey = `${huddleId}:${live?.turnIndex ?? 0}`;
      const suggestion = suggestionTurnRef.current === turnKey ? null : latestSuggestion(live);
      suggestionTurnRef.current = turnKey;
      void askPartnerRef.current({
        cue: 'edit',
        userTurn: {
          role: 'edit',
          text: editTurnText(edit, canvas.contentType, { ran, suggestion })
        }
      });
    };
    timer = setTimeout(attempt, PAIR_EDIT_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [listening, huddleId, diagramWatchKey]);

  // A quiet stretch → now and then, something unprompted. Any change to the
  // canvas or the turn restarts the clock, because that was not quiet.
  useEffect(() => {
    if (!listening) return undefined;
    const counts = countsRef.current;
    if (counts.huddleId !== huddleId || counts.lulls >= PAIR_LULLS_MAX) return undefined;

    let timer = null;
    const attempt = () => {
      if (!isPairListening(getOfficeSnapshot().huddle)) return;
      const sinceLast = Date.now() - counts.lastAt;
      if (isPageHidden() || isComposingText() || sinceLast < PAIR_INITIATIVE_GAP_MS) {
        timer = setTimeout(attempt, PAIR_LULL_RETRY_MS);
        return;
      }
      counts.lulls += 1;
      counts.lastAt = Date.now();
      void askPartnerRef.current({ cue: 'lull' });
    };
    timer = setTimeout(attempt, pairLullDelayMs(counts.lulls));
    return () => clearTimeout(timer);
  }, [listening, huddleId, turnIndex, diagramWatchKey]);
}

export default usePairInitiative;
