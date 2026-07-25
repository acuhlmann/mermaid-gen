/**
 * Pace a canned two-hander scene (coffee break, cubicle battle) line by line.
 *
 * Extracted from `CoffeeBreakOverlay` so the desk-mode card and the isometric
 * floor drive a scene identically — same reveal order, same narration, same
 * gaps. Two renderers, one performance (ADR-0011); only one of them may be
 * mounted at a time, or the scene would be spoken twice.
 *
 * With narration on, each line is revealed, spoken, and followed by the
 * narration gap. With narration off there is nothing to wait for, so every line
 * shows at once and the scene ends on a fixed timer.
 */

import { useEffect, useRef, useState } from 'react';
import { OFFICE_NARRATION_GAP_MS } from '../utils/officeNarration.js';

/**
 * @param {{
 *   lines: Array<{speakerId: string, text: string}>,
 *   active: boolean,
 *   narrateLine?: (line: any) => Promise<{spoken?: boolean}> | void,
 *   prefetchLine?: (line: any) => void,
 *   paceMs: number,
 *   silentDurationMs: number,
 *   tailMs?: number,
 *   sceneId?: string | null,
 *   onDone?: () => void
 * }} options
 * @returns {number} how many lines have been revealed
 */
export function useScenePacing({
  lines,
  active,
  narrateLine,
  prefetchLine,
  paceMs,
  silentDurationMs,
  tailMs = 1200,
  sceneId = null,
  onDone
}) {
  const lineCount = lines?.length ?? 0;
  const [visibleLines, setVisibleLines] = useState(lineCount);

  // Kept in refs so a re-rendered parent can't restart a scene mid-sentence.
  const narrateRef = useRef(narrateLine);
  const prefetchRef = useRef(prefetchLine);
  const onDoneRef = useRef(onDone);
  const linesRef = useRef(lines);
  useEffect(() => {
    narrateRef.current = narrateLine;
    prefetchRef.current = prefetchLine;
    onDoneRef.current = onDone;
    linesRef.current = lines;
  });

  useEffect(() => {
    if (!active || lineCount === 0) return undefined;
    const shouldNarrate = typeof narrateRef.current === 'function';

    if (!shouldNarrate) {
      setVisibleLines(lineCount);
      const timer = setTimeout(() => onDoneRef.current?.(), silentDurationMs);
      return () => clearTimeout(timer);
    }

    let cancelled = false;
    setVisibleLines(1);

    const wait = (ms) =>
      new Promise((resolve) => {
        setTimeout(resolve, ms);
      });

    void (async () => {
      for (let index = 0; index < lineCount; index += 1) {
        if (cancelled) return;
        setVisibleLines(index + 1);
        const line = linesRef.current?.[index];
        const nextLine = linesRef.current?.[index + 1];
        if (nextLine) prefetchRef.current?.(nextLine);
        let spoken = false;
        try {
          const result = await narrateRef.current?.(line);
          spoken = Boolean(result?.spoken);
        } catch {
          // Narration failed (offline, muted, no voice): pace as if silent.
        }
        if (cancelled) return;
        if (index < lineCount - 1) {
          await wait(spoken ? OFFICE_NARRATION_GAP_MS : paceMs);
        }
      }
      if (cancelled) return;
      await wait(tailMs);
      if (!cancelled) onDoneRef.current?.();
    })();

    return () => {
      cancelled = true;
    };
  }, [active, sceneId, lineCount, paceMs, silentDurationMs, tailMs]);

  return visibleLines;
}
