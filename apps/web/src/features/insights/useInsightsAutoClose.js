import { useEffect, useRef } from 'react';

/**
 * On mobile, auto-collapse the thinking pane when a run produces a new diagram revision.
 *
 * @param {{
 *   autoCloseActiveEntryIdRef: import('react').MutableRefObject<string | null>;
 *   insightsEntries: Array<object>;
 *   insightsOpen: boolean;
 *   phoneLayout: boolean;
 *   setInsightsOpen: (open: boolean) => void;
 *   state: { revisionId: number; diagramSource?: string };
 * }} deps
 */
export function useInsightsAutoClose({
  autoCloseActiveEntryIdRef,
  insightsEntries,
  insightsOpen,
  phoneLayout,
  setInsightsOpen,
  state
}) {
  const prevAutoCloseRunningRef = useRef(false);
  const autoCloseRunStartRevisionRef = useRef(state.revisionId);

  useEffect(() => {
    const activeEntryId = autoCloseActiveEntryIdRef.current;
    const activeAutoCloseEntry = insightsEntries.find((e) => e.id === activeEntryId);
    const activeEntryStatus = activeAutoCloseEntry?.status ?? null;
    const activeEntryRunning = activeEntryStatus === 'running';
    const wasRunning = prevAutoCloseRunningRef.current;
    if (activeEntryRunning && !wasRunning) {
      autoCloseRunStartRevisionRef.current = state.revisionId;
    }
    const revisionChanged = state.revisionId !== autoCloseRunStartRevisionRef.current;
    const completedActiveMutation =
      activeEntryStatus === 'done' && Boolean(activeAutoCloseEntry?.diagramRevisionApplied);
    const runProducedCanvasResult = revisionChanged || completedActiveMutation;
    if (
      phoneLayout &&
      insightsOpen &&
      !activeEntryRunning &&
      Boolean(activeEntryId) &&
      runProducedCanvasResult &&
      Boolean(state.diagramSource?.trim())
    ) {
      setInsightsOpen(false);
      autoCloseActiveEntryIdRef.current = null;
    } else if (
      !activeEntryRunning &&
      activeAutoCloseEntry &&
      ['failed', 'cancelled'].includes(activeEntryStatus)
    ) {
      autoCloseActiveEntryIdRef.current = null;
    }
    prevAutoCloseRunningRef.current = activeEntryRunning;
  }, [
    autoCloseActiveEntryIdRef,
    insightsEntries,
    insightsOpen,
    phoneLayout,
    setInsightsOpen,
    state.diagramSource,
    state.revisionId
  ]);
}
