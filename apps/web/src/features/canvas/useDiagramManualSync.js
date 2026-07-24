import { useCallback } from 'react';
import { syncClientDiagramState } from '../../state/diagramStore.js';
import { createInitialDiagramState } from '@archislop/shared';

/**
 * Debounced manual editor sync and eager sync-before-agent helper.
 *
 * @param {{
 *   activeSessionId: string;
 *   clientValidationRef: import('react').MutableRefObject<{ source: string | null; error: string | null }>;
 *   contentMode: string;
 *   setState: import('react').Dispatch<import('react').SetStateAction<object>>;
 *   stateRef: import('react').MutableRefObject<object>;
 *   syncDiagramOrThrowRef: import('react').MutableRefObject<() => Promise<object>>;
 *   syncTimerRef: import('react').MutableRefObject<ReturnType<typeof setTimeout> | null>;
 * }} deps
 */
export function useDiagramManualSync({
  activeSessionId,
  clientValidationRef,
  contentMode,
  setState,
  stateRef,
  syncDiagramOrThrowRef,
  syncTimerRef
}) {
  const handleManualEdit = useCallback(
    (nextSource) => {
      let scheduledSource = null;

      setState((currentState) => {
        if (nextSource === currentState.diagramSource) {
          return currentState;
        }
        scheduledSource = nextSource;
        const nextState = {
          ...currentState,
          diagramSource: nextSource,
          updatedAt: new Date().toISOString()
        };
        stateRef.current = nextState;
        return nextState;
      });

      if (!scheduledSource) {
        return;
      }

      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }

      syncTimerRef.current = setTimeout(async () => {
        const cv = clientValidationRef.current;
        if (cv.error && cv.source === scheduledSource) {
          return;
        }
        try {
          const synced = await syncClientDiagramState({
            contentType: contentMode,
            diagramSource: scheduledSource,
            sessionId: activeSessionId
          });
          setState(synced);
        } catch {
          // Local editing stays responsive even when background sync is unavailable.
        }
      }, 350);
    },
    [activeSessionId, clientValidationRef, contentMode, setState, stateRef, syncTimerRef]
  );

  const syncDiagramOrThrow = useCallback(async () => {
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }

    if (contentMode === 'auto') {
      const empty = createInitialDiagramState('mermaid');
      stateRef.current = empty;
      setState(empty);
      return empty;
    }

    const currentState = stateRef.current;
    const syncedState = await syncClientDiagramState({
      contentType: contentMode,
      diagramSource: currentState.diagramSource,
      sessionId: activeSessionId
    });
    setState(syncedState);
    return syncedState;
  }, [activeSessionId, contentMode, setState, stateRef, syncTimerRef]);

  syncDiagramOrThrowRef.current = syncDiagramOrThrow;

  return { handleManualEdit, syncDiagramOrThrow };
}
