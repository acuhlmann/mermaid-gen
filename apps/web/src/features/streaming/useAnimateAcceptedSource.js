import { startTransition, useCallback } from 'react';

/**
 * Typewriter-style acceptance animation when a diagram revision lands on the canvas.
 *
 * @param {{
 *   stateRef: import('react').MutableRefObject<object>;
 *   streamTimerRef: import('react').MutableRefObject<number | null>;
 *   setState: import('react').Dispatch<import('react').SetStateAction<object>>;
 *   setStreamingPreview: (value: boolean) => void;
 *   setLoading: (value: boolean) => void;
 *   setActiveRequest: (value: string | null) => void;
 * }} deps
 */
export function useAnimateAcceptedSource({
  stateRef,
  streamTimerRef,
  setState,
  setStreamingPreview,
  setLoading,
  setActiveRequest
}) {
  const animateAcceptedSource = useCallback(
    (nextState, onFullyApplied, opts = {}) => {
      const previousState = stateRef.current;
      const nextSource = nextState.diagramSource;

      if (streamTimerRef.current != null) {
        cancelAnimationFrame(streamTimerRef.current);
        streamTimerRef.current = null;
      }

      if (
        previousState.revisionId === nextState.revisionId ||
        previousState.diagramSource === nextSource
      ) {
        setState(nextState);
        setStreamingPreview(false);
        setLoading(false);
        setActiveRequest(null);
        queueMicrotask(() => onFullyApplied?.());
        return;
      }

      const reduceMotion =
        typeof globalThis.matchMedia === 'function' &&
        globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const skipTypewriter = reduceMotion || nextState.contentType === 'forms';

      if (skipTypewriter) {
        setState(nextState);
        setStreamingPreview(false);
        setLoading(false);
        setActiveRequest(null);
        queueMicrotask(() => onFullyApplied?.());
        return;
      }

      const stepBudget = opts.denseSteps ? 26 : 40;
      const chunkSize = Math.max(1, Math.ceil(nextSource.length / stepBudget));
      let cursor = 0;

      setStreamingPreview(true);

      function pump() {
        cursor = Math.min(nextSource.length, cursor + chunkSize);
        if (cursor >= nextSource.length) {
          streamTimerRef.current = null;
          setState(nextState);
          setStreamingPreview(false);
          setLoading(false);
          setActiveRequest(null);
          queueMicrotask(() => onFullyApplied?.());
          return;
        }

        startTransition(() => {
          setState((prev) => {
            const slice = nextSource.slice(0, cursor);
            if (prev.diagramSource === slice && prev.revisionId === nextState.revisionId) {
              return prev;
            }
            return {
              ...nextState,
              diagramSource: slice,
              updatedAt: nextState.updatedAt ?? previousState.updatedAt
            };
          });
        });

        streamTimerRef.current = requestAnimationFrame(pump);
      }

      streamTimerRef.current = requestAnimationFrame(pump);
    },
    [setActiveRequest, setLoading, setState, setStreamingPreview, stateRef, streamTimerRef]
  );

  return { animateAcceptedSource };
}
