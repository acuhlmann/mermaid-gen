import { useEffect, useRef } from 'react';
import { getOfficeSnapshot } from '../state/officeMomentStore.js';
import {
  PAIR_EDIT_REACTIONS_MAX,
  PAIR_EDIT_SETTLE_MS,
  PAIR_INITIATIVE_GAP_MS,
  PAIR_LULLS_MAX,
  describePairEdit,
  isComposingText,
  isEditingCanvas,
  pairLullDelayMs
} from '../utils/officePairEdits.js';

/** A blocked lull (you are typing, the tab is hidden) looks again this much later. */
const PAIR_LULL_RETRY_MS = 15_000;

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
 */
function editTurnText(edit, contentType, { ran = false } = {}) {
  const text = ran ? `ran your suggestion, which ${edit.text}` : edit.text;
  if (!edit.focusId || contentType !== 'mermaid') return text;
  return `${text} (id ${edit.focusId})`;
}

/**
 * The person in the chair speaks without being spoken to.
 *
 * Two triggers, both only while the pair is `listening` — waiting on you, with
 * none of their own lines playing and nothing in flight:
 *
 * - **Your edit.** The canvas changed since their last line. Once it has sat
 *   still for `PAIR_EDIT_SETTLE_MS` they react to what changed (an `edit` turn
 *   naming the boxes added, removed or renamed). Edits made while they were
 *   still talking wait for them to finish rather than interrupting.
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
  const countsRef = useRef({ huddleId: '', edits: 0, lulls: 0, lastAt: 0 });
  /** True once a Do-it ran since their last line, so the next edit is its result. */
  const ranSuggestionRef = useRef(false);

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
      countsRef.current = { huddleId, edits: 0, lulls: 0, lastAt: 0 };
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
    if (counts.edits >= PAIR_EDIT_REACTIONS_MAX) return undefined;

    const sinceLast = Date.now() - counts.lastAt;
    const wait = Math.max(PAIR_EDIT_SETTLE_MS, PAIR_INITIATIVE_GAP_MS - sinceLast);
    let timer = null;
    const attempt = () => {
      if (!isPairListening(getOfficeSnapshot().huddle)) return;
      if (isEditingCanvas()) {
        timer = setTimeout(attempt, PAIR_EDIT_SETTLE_MS);
        return;
      }
      const canvas = readCanvasRef.current();
      const edit = describePairEdit(base.canvas, canvas);
      // Measured against, whether or not it was worth a remark: a failed or
      // skipped reaction must not re-fire on the same change forever.
      baselineRef.current = { huddleId, key: diagramWatchKey, canvas };
      if (!edit) return;
      counts.edits += 1;
      counts.lastAt = Date.now();
      const ran = ranSuggestionRef.current;
      ranSuggestionRef.current = false;
      void askPartnerRef.current({
        cue: 'edit',
        userTurn: { role: 'edit', text: editTurnText(edit, canvas.contentType, { ran }) }
      });
    };
    timer = setTimeout(attempt, wait);
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
