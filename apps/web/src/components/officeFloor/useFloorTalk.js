/**
 * A conversation you are having on your feet (slice 8).
 *
 * Owns only what a conversation needs *beyond* being somewhere: a draft in the
 * composer, and the send is in flight or it is not. Everything said is stored
 * as an ordinary Slop Chat™ IM by the caller's handlers, so this hook holds no
 * dialogue at all — it holds a text box.
 *
 * Like real IM: you speak first. No auto-opener when you walk up to someone.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * @param {{
 *   colleagueId: string | null,
 *   onReply?: (colleagueId: string, body: string) => Promise<void> | void
 * }} options
 * @returns {{ draft: string, setDraft: (v: string) => void, busy: boolean, send: (body: string) => void }}
 */
export function useFloorTalk({ colleagueId, onReply }) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- (reason: clearing a composer whose conversation has ended; there is nothing to derive it from once the intent is gone)
    setDraft('');
  }, [colleagueId]);

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
