/**
 * A conversation you are having on your feet (slice 8).
 *
 * Owns only what a conversation needs *beyond* being somewhere: the opener
 * fires once when you arrive, there is a draft in the composer, and the send is
 * in flight or it is not. Everything said is stored as an ordinary Slop Chat™
 * IM by the caller's handlers, so this hook holds no dialogue at all — it holds
 * a text box.
 *
 * The opener is **reactive** spend in office-parody § 11's sense: you walked
 * over, so a live LLM line in persona voice is exactly the class of call that
 * doctrine is generous with, and it is self-limiting because you had to cross
 * the room for it.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * @param {{
 *   colleagueId: string | null,
 *   arrived: boolean,
 *   onGreet?: (colleagueId: string) => Promise<void> | void,
 *   onReply?: (colleagueId: string, body: string) => Promise<void> | void
 * }} options
 * @returns {{ draft: string, setDraft: (v: string) => void, busy: boolean, send: (body: string) => void }}
 */
export function useFloorTalk({ colleagueId, arrived, onGreet, onReply }) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  /** Who we have already opened with, so arriving does not re-greet on every render. */
  const greeted = useRef(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Walking away resets the conversation; the thread survives in Slop Chat.
  useEffect(() => {
    if (colleagueId) return;
    greeted.current = null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- (reason: clearing a composer whose conversation has ended; there is nothing to derive it from once the intent is gone)
    setDraft('');
  }, [colleagueId]);

  useEffect(() => {
    if (!colleagueId || !arrived) return;
    if (greeted.current === colleagueId) return;
    greeted.current = colleagueId;
    const run = async () => {
      setBusy(true);
      try {
        await onGreet?.(colleagueId);
      } finally {
        if (alive.current) setBusy(false);
      }
    };
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- (reason: one opener per arrival; `onGreet` identity must not re-trigger a live LLM call)
  }, [colleagueId, arrived]);

  const send = useCallback(
    (body) => {
      const text = String(body ?? '').trim();
      if (!text || !colleagueId) return;
      setDraft('');
      const run = async () => {
        setBusy(true);
        try {
          await onReply?.(colleagueId, text);
        } finally {
          if (alive.current) setBusy(false);
        }
      };
      void run();
    },
    [colleagueId, onReply]
  );

  return { draft, setDraft, busy, send };
}

export default useFloorTalk;
