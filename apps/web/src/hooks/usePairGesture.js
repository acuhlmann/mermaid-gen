import { useEffect, useState } from 'react';
import { PAIR_GESTURE_MS } from '../utils/officeHuddleGaze.js';

/**
 * The partner's latest nod or glance while it is still happening, else null.
 *
 * The store keeps the last gesture forever (it is a fact that it happened);
 * on screen it lasts `PAIR_GESTURE_MS`, which is what this hook enforces.
 *
 * @param {{ gesture?: { kind: 'nod' | 'glance', focusId: string | null, seq: number, at: number } } | null} huddle
 * @returns {{ kind: 'nod' | 'glance', focusId: string | null, seq: number } | null}
 */
export function usePairGesture(huddle) {
  const gesture = huddle?.gesture ?? null;
  const [expiredSeq, setExpiredSeq] = useState(0);
  const seq = gesture?.seq ?? 0;
  const at = gesture?.at ?? 0;

  useEffect(() => {
    if (!seq) return undefined;
    const left = Math.max(0, PAIR_GESTURE_MS - (Date.now() - at));
    const timer = setTimeout(() => setExpiredSeq(seq), left);
    return () => clearTimeout(timer);
  }, [seq, at]);

  if (!gesture || seq === expiredSeq) return null;
  return gesture;
}

export default usePairGesture;
