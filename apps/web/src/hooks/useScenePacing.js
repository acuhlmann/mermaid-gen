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
import { cancelOfficeNarration, OFFICE_NARRATION_GAP_MS } from '../utils/officeNarration.js';

/**
 * @param {{
 *   lines: Array<{speakerId: string, text: string}>,
 *   active: boolean,
 *   paused?: boolean,
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
  paused = false,
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
  const pausedRef = useRef(paused);
  useEffect(() => {
    narrateRef.current = narrateLine;
    prefetchRef.current = prefetchLine;
    onDoneRef.current = onDone;
    linesRef.current = lines;
    pausedRef.current = paused;
  });

  useEffect(() => {
    if (!active || lineCount === 0) return undefined;
    const shouldNarrate = typeof narrateRef.current === 'function';

    const wait = (ms) =>
      new Promise((resolve) => {
        setTimeout(resolve, ms);
      });

    // Hold the clock while a huddle Do-it is running — do not reset the index.
    const waitWhilePaused = async () => {
      while (pausedRef.current) {
        await wait(120);
      }
    };

    if (!shouldNarrate) {
      // Keep the original sync-timer path: floor/coffee tests advance fake timers
      // with vi.advanceTimersByTime (not Async). Huddle always passes a narrator.
      setVisibleLines(lineCount);
      const timer = setTimeout(() => onDoneRef.current?.(), silentDurationMs);
      return () => clearTimeout(timer);
    }

    let cancelled = false;
    setVisibleLines(1);

    void (async () => {
      for (let index = 0; index < lineCount; index += 1) {
        if (cancelled) return;
        await waitWhilePaused();
        if (cancelled) return;
        setVisibleLines(index + 1);
        const line = linesRef.current?.[index];
        const nextLine = linesRef.current?.[index + 1];
        if (nextLine) prefetchRef.current?.(nextLine);
        let spoken = false;
        try {
          // Skip speaking the line aloud while paused (e.g. notebook Do-it).
          if (!pausedRef.current) {
            const result = await narrateRef.current?.(line);
            // Hard stop / dismiss cancels TTS before React re-renders this
            // effect — without this bail the loop would start the next line.
            if (cancelled || result?.cancelled) return;
            spoken = Boolean(result?.spoken);
          }
        } catch {
          // Narration failed (offline, muted, no voice): pace as if silent.
        }
        if (cancelled) return;
        await waitWhilePaused();
        if (cancelled) return;
        if (index < lineCount - 1) {
          await wait(spoken ? OFFICE_NARRATION_GAP_MS : paceMs);
        }
      }
      if (cancelled) return;
      await waitWhilePaused();
      if (cancelled) return;
      await wait(tailMs);
      await waitWhilePaused();
      if (!cancelled) onDoneRef.current?.();
    })();

    return () => {
      cancelled = true;
      // Cutting the scene must cut the voice — waiting for the line to finish
      // after you walked away feels like a ghost still talking.
      cancelOfficeNarration();
    };
  }, [active, sceneId, lineCount, paceMs, silentDurationMs, tailMs]);

  return visibleLines;
}
