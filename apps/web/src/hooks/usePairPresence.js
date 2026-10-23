import { useEffect, useRef } from 'react';
import {
  getOfficeSnapshot,
  interruptOfficeHuddle,
  setOfficeHuddleGesture
} from '../state/officeMomentStore.js';
import { attentionNodeId } from '../utils/officeHuddleGaze.js';
import { beatFocusIds } from '../utils/officePairPointing.js';

/** How often to look at what you have picked up on the canvas. */
const PAIR_ATTENTION_POLL_MS = 300;
/** At most one glance in this window, so clicking around is not a tennis match. */
const PAIR_GLANCE_GAP_MS = 1200;

/** The inline label box is open: you are naming or renaming a node. */
function isLabelOpen() {
  return (
    typeof document !== 'undefined' && Boolean(document.querySelector('.graph-edit-label-inline'))
  );
}

function isEditableTarget(target) {
  if (!target || typeof target !== 'object') return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA';
}

/** A key that types or deletes something, rather than one that only moves or modifies. */
function isTypingKey(event) {
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  return event.key.length === 1 || event.key === 'Backspace' || event.key === 'Delete';
}

/**
 * The person in the chair is present between their lines, not only during
 * them. Two behaviours, both wordless and both pair-only:
 *
 * - **You can cut them off.** Start typing, open a label, or change the
 *   diagram while they are mid-sentence and they stop and hand you the turn
 *   (`interruptOfficeHuddle`), instead of finishing a monologue over the top of
 *   what you are doing.
 * - **They follow your attention.** While it is your turn, picking up a node
 *   (selecting it, or dragging a connection out of it) gets a glance at it —
 *   no line, no request, just someone looking where you are looking.
 *
 * Neither ever calls the model. A glance that cost a round trip would arrive
 * after you had moved on, and is not something a person says anyway.
 *
 * @param {{ huddle: object | null, diagramWatchKey: string, onCancelNarration?: () => void }} params
 */
export function usePairPresence({ huddle, diagramWatchKey, onCancelNarration }) {
  const cancelRef = useRef(onCancelNarration);
  const watchKeyRef = useRef(diagramWatchKey);
  useEffect(() => {
    cancelRef.current = onCancelNarration;
    watchKeyRef.current = diagramWatchKey;
  });

  const isPair = huddle?.mode === 'pair';
  const huddleId = huddle?.id ?? '';
  const turnIndex = huddle?.turnIndex ?? 0;
  const talking = isPair && huddle?.phase === 'speaking' && (huddle?.beats?.length ?? 0) > 0;
  const listening = isPair && huddle?.phase === 'listening';

  /** The canvas as it was when this turn started talking. */
  const talkKeyRef = useRef(/** @type {string | null} */ (null));

  // Interrupt: a key typed into a field, or a label box opening.
  useEffect(() => {
    if (!talking) {
      talkKeyRef.current = null;
      return undefined;
    }
    talkKeyRef.current = watchKeyRef.current;
    const cut = () => {
      cancelRef.current?.();
      interruptOfficeHuddle(huddleId);
    };
    const onKeyDown = (event) => {
      if (isEditableTarget(event.target) && isTypingKey(event)) cut();
    };
    const timer = setInterval(() => {
      if (isLabelOpen()) cut();
    }, PAIR_ATTENTION_POLL_MS);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      clearInterval(timer);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [talking, huddleId, turnIndex]);

  // Interrupt: the diagram changed under them (the source editor, a toolbar).
  useEffect(() => {
    if (!talking || talkKeyRef.current === null) return;
    if (!diagramWatchKey || diagramWatchKey === talkKeyRef.current) return;
    cancelRef.current?.();
    interruptOfficeHuddle(huddleId);
  }, [talking, huddleId, diagramWatchKey]);

  // Attention: glance at the node you just picked up.
  useEffect(() => {
    if (!listening) return undefined;
    let last = attentionNodeId();
    let lastAt = 0;
    const timer = setInterval(() => {
      const id = attentionNodeId();
      if (!id || id === last) {
        last = id;
        return;
      }
      if (Date.now() - lastAt < PAIR_GLANCE_GAP_MS) return;
      const live = getOfficeSnapshot().huddle;
      // Already pointing at it: the hand says more than a glance would.
      const beat = live?.beats?.at(-1);
      if (beatFocusIds(beat).includes(id)) {
        last = id;
        return;
      }
      last = id;
      lastAt = Date.now();
      setOfficeHuddleGesture(huddleId, { kind: 'glance', focusId: id });
    }, PAIR_ATTENTION_POLL_MS);
    return () => clearInterval(timer);
  }, [listening, huddleId]);
}

export default usePairPresence;
