import { useEffect, useRef, useState } from 'react';
import { boardFrom } from '../utils/officeFloorBoard.js';

/**
 * What of your work the office is currently showing
 * (docs/office-isometric-mode.md § 5 slice 16).
 *
 * **This hook samples; it deliberately does not subscribe.** `OfficeLayer`
 * takes the diagram as getters rather than props, and that is load-bearing: the
 * office must not re-render while you type. Subscribing the floor to the
 * diagram store would repaint sixteen animated figures, a walk animation and a
 * directed camera on every keystroke, to change a 62 px panel nobody is looking
 * at yet.
 *
 * So the board refreshes on the three edges that mean *the work changed*:
 *
 * 1. **A completed run** (`runSignal`) — the same edge `useOfficeRunReactions`
 *    already treats as "they shipped something".
 * 2. **Standing up** (`onFloor`) — you should walk into a room showing the
 *    current state of things, not the state at boot.
 * 3. **A meeting opening** (`meetingOpen`) — the glass room's table is about to
 *    show what the meeting is about. A boolean rather than the meeting's title,
 *    because the title is rewritten from the script a beat after the room
 *    opens, and a board that re-sampled on that would be sampling on an
 *    unrelated event that happens to be nearby.
 *
 * The constraint turned out to be the better fiction. A whiteboard shows what
 * was **drawn** on it; a board that tracked your cursor would be a live mirror
 * of the canvas, which is a feature the canvas already has and a worse joke.
 *
 * The ref-and-one-dep shape is copied from `useOfficeRunReactions` for the
 * reason it uses it: the getters are inline arrows from the app shell, so a new
 * identity arrives every render and anything reading them from a dependency
 * array would fire every render.
 *
 * @param {{
 *   getDiagramSource?: () => string,
 *   getContentType?: () => string,
 *   runSignal?: unknown,
 *   onFloor?: boolean,
 *   meetingOpen?: boolean
 * }} params
 * @returns {import('../utils/officeFloorBoard.js').BoardState | null}
 */
export function useOfficeBoard(params) {
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const [board, setBoard] = useState(null);

  const { runSignal, onFloor, meetingOpen } = params;

  useEffect(() => {
    const p = paramsRef.current;
    setBoard(
      boardFrom({
        contentType: p.getContentType?.() ?? 'mermaid',
        diagramSource: p.getDiagramSource?.() ?? ''
      })
    );
    // Three edges, one sample. `onFloor` is in here rather than gated behind an
    // `if` so that sitting back down re-samples too — cheap, and it means the
    // next stand-up never shows a stale room for a frame.
  }, [runSignal, onFloor, meetingOpen]);

  return board;
}

export default useOfficeBoard;
