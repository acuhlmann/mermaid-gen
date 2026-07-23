import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isConcreteContentType } from '@archislop/shared';
import { syncClientDiagramState } from '../../state/diagramStore.js';
import { computeDiagramStructuralDiff } from '../../utils/diagramChangeDiff.js';
import { AUTO_DIAGRAM_CHANGE_HIGHLIGHT_MS } from '../../utils/appConstants.js';

/**
 * Diagram diff highlights, restore-to-entry snapshots, and pending SVG-render arming.
 *
 * @param {{
 *   activeSessionId: string;
 *   contentMode: string;
 *   insightsEntries: Array<object>;
 *   insightsOpen: boolean;
 *   loadingRef: import('react').MutableRefObject<boolean>;
 *   narrowLayout: boolean;
 *   setContentMode: (mode: string) => void;
 *   setError: (message: string) => void;
 *   setInsightsOpen: (open: boolean) => void;
 *   setState: import('react').Dispatch<import('react').SetStateAction<object>>;
 *   setStreamingPreview: (value: boolean) => void;
 *   state: object;
 *   streamTimerRef: import('react').MutableRefObject<number | null>;
 *   syncTimerRef: import('react').MutableRefObject<ReturnType<typeof setTimeout> | null>;
 *   armSuppressHydrateRerun: () => void;
 *   disarmSuppressHydrateRerun: () => void;
 *   resetRadialChrome: () => void;
 *   switchContentModeForRestore: (mode: string) => void;
 * }} deps
 */
export function useDiagramChangeHighlight({
  activeSessionId,
  contentMode,
  insightsEntries,
  insightsOpen,
  loadingRef,
  narrowLayout,
  setContentMode,
  setError,
  setInsightsOpen,
  setState,
  setStreamingPreview,
  state,
  streamTimerRef,
  syncTimerRef,
  armSuppressHydrateRerun,
  disarmSuppressHydrateRerun,
  resetRadialChrome,
  switchContentModeForRestore
}) {
  const [diagramChangeHighlightEntryId, setDiagramChangeHighlightEntryId] = useState(null);
  const [diagramChangeHighlightAddedOnly, setDiagramChangeHighlightAddedOnly] = useState(false);

  const diagramAutoHighlightTimerRef = useRef(null);
  const pendingAutoDiagramHighlightRef = useRef(null);
  const pendingAutoDiagramHighlightTimeoutRef = useRef(null);

  const clearPendingAutoDiagramHighlight = useCallback(() => {
    pendingAutoDiagramHighlightRef.current = null;
    if (pendingAutoDiagramHighlightTimeoutRef.current != null) {
      window.clearTimeout(pendingAutoDiagramHighlightTimeoutRef.current);
      pendingAutoDiagramHighlightTimeoutRef.current = null;
    }
  }, []);

  const applyDiagramSnapshotToCanvas = useCallback(
    async ({ diagramSource, contentType, styleConfig }) => {
      if (typeof diagramSource !== 'string' || !diagramSource.trim()) return;
      if (!isConcreteContentType(contentType)) return;

      const needsModeSwitch = contentType !== contentMode;

      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
      if (streamTimerRef.current != null) {
        cancelAnimationFrame(streamTimerRef.current);
        streamTimerRef.current = null;
      }
      setStreamingPreview(false);
      if (needsModeSwitch) armSuppressHydrateRerun();

      try {
        const payload = {
          contentType,
          diagramSource,
          sessionId: activeSessionId
        };
        if (styleConfig != null) {
          payload.styleConfig = styleConfig;
        }
        const synced = await syncClientDiagramState(payload);
        setState(synced);
        if (needsModeSwitch) setContentMode(contentType);
        if (diagramAutoHighlightTimerRef.current != null) {
          window.clearTimeout(diagramAutoHighlightTimerRef.current);
          diagramAutoHighlightTimerRef.current = null;
        }
        clearPendingAutoDiagramHighlight();
        setDiagramChangeHighlightEntryId(null);
      } catch (err) {
        if (needsModeSwitch) disarmSuppressHydrateRerun();
        setError(err.message);
      }
    },
    [
      activeSessionId,
      armSuppressHydrateRerun,
      clearPendingAutoDiagramHighlight,
      contentMode,
      disarmSuppressHydrateRerun,
      setContentMode,
      setError,
      setState,
      setStreamingPreview,
      streamTimerRef,
      syncTimerRef
    ]
  );

  const handleRestoreToEntry = useCallback(
    async (entryId) => {
      if (loadingRef.current) return;

      const entry = insightsEntries.find((e) => e.id === entryId);
      const targetSource = entry?.diagramAfterSource;
      const targetContentType = entry?.diagramAfterContentType;
      if (typeof targetSource !== 'string' || !targetSource.trim()) return;
      if (!isConcreteContentType(targetContentType)) return;

      const baseline = entry?.diagramUndoBaseline;
      await applyDiagramSnapshotToCanvas({
        diagramSource: targetSource,
        contentType: targetContentType,
        styleConfig: baseline?.styleConfig
      });

      if (narrowLayout && insightsOpen) {
        setInsightsOpen(false);
      }
    },
    [
      applyDiagramSnapshotToCanvas,
      insightsEntries,
      insightsOpen,
      loadingRef,
      narrowLayout,
      setInsightsOpen
    ]
  );

  const handleRestoreDiagramSnapshot = useCallback(
    async ({ diagramSource, contentType }) => {
      if (loadingRef.current) return;
      await applyDiagramSnapshotToCanvas({ diagramSource, contentType });

      if (narrowLayout && insightsOpen) {
        setInsightsOpen(false);
      }
    },
    [applyDiagramSnapshotToCanvas, insightsOpen, loadingRef, narrowLayout, setInsightsOpen]
  );

  const handleOpenProposalFullPreview = useCallback(
    async ({ diagramSource, contentType }) => {
      if (loadingRef.current) return;
      await applyDiagramSnapshotToCanvas({ diagramSource, contentType });
      requestAnimationFrame(() => {
        document.querySelector('.diagram-output')?.scrollIntoView?.({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest'
        });
      });
    },
    [applyDiagramSnapshotToCanvas, loadingRef]
  );

  const handleToggleDiagramChangeHighlight = useCallback(
    (entryId) => {
      clearPendingAutoDiagramHighlight();
      if (diagramAutoHighlightTimerRef.current != null) {
        window.clearTimeout(diagramAutoHighlightTimerRef.current);
        diagramAutoHighlightTimerRef.current = null;
      }
      setDiagramChangeHighlightAddedOnly(false);

      const isClearing = diagramChangeHighlightEntryId === entryId;
      if (isClearing) {
        setDiagramChangeHighlightEntryId(null);
        return;
      }

      const entry = insightsEntries.find((e) => e.id === entryId);
      const targetContentType = entry?.diagramAfterContentType;
      if (isConcreteContentType(targetContentType) && targetContentType !== contentMode) {
        switchContentModeForRestore(targetContentType);
      }

      setDiagramChangeHighlightEntryId(entryId);

      if (narrowLayout && insightsOpen) {
        setInsightsOpen(false);
      }
    },
    [
      clearPendingAutoDiagramHighlight,
      contentMode,
      diagramChangeHighlightEntryId,
      insightsEntries,
      insightsOpen,
      narrowLayout,
      setInsightsOpen,
      switchContentModeForRestore
    ]
  );

  const changeHighlightDiff = useMemo(() => {
    if (!diagramChangeHighlightEntryId) return null;
    const entry = insightsEntries.find((e) => e.id === diagramChangeHighlightEntryId);
    const baseline = entry?.diagramUndoBaseline?.diagramSource;
    const after =
      typeof entry?.diagramAfterSource === 'string'
        ? entry.diagramAfterSource
        : (state.diagramSource ?? '');
    const kind = entry?.diagramAfterContentType ?? contentMode;
    return computeDiagramStructuralDiff(kind, baseline, after);
  }, [contentMode, diagramChangeHighlightEntryId, insightsEntries, state.diagramSource]);

  const changeHighlightForCanvas = useMemo(() => {
    if (!diagramChangeHighlightEntryId || !changeHighlightDiff) return null;
    if (diagramChangeHighlightAddedOnly) {
      return {
        addedIds: changeHighlightDiff.addedIds,
        modifiedIds: [],
        removedIds: changeHighlightDiff.removedIds
      };
    }
    return {
      addedIds: changeHighlightDiff.addedIds,
      modifiedIds: changeHighlightDiff.modifiedIds,
      removedIds: changeHighlightDiff.removedIds
    };
  }, [changeHighlightDiff, diagramChangeHighlightEntryId, diagramChangeHighlightAddedOnly]);

  const changeHighlightContentType = useMemo(() => {
    if (!diagramChangeHighlightEntryId) return null;
    const entry = insightsEntries.find((e) => e.id === diagramChangeHighlightEntryId);
    return entry?.diagramAfterContentType ?? contentMode;
  }, [contentMode, diagramChangeHighlightEntryId, insightsEntries]);

  const diagramChangeHighlightSummary = useMemo(() => {
    if (!diagramChangeHighlightEntryId || !changeHighlightDiff) return null;
    const { addedIds, modifiedIds, removedIds } = changeHighlightDiff;
    const isStructuralEmpty =
      addedIds.length === 0 && modifiedIds.length === 0 && removedIds.length === 0;
    return { addedIds, modifiedIds, removedIds, isStructuralEmpty };
  }, [changeHighlightDiff, diagramChangeHighlightEntryId]);

  const entryDiagramDiffById = useMemo(() => {
    const map = {};
    for (const entry of insightsEntries) {
      if (!entry?.diagramRevisionApplied) continue;
      const kind = entry.diagramAfterContentType;
      const baseline = entry.diagramUndoBaseline?.diagramSource;
      const after = entry.diagramAfterSource;
      if (typeof baseline !== 'string' || typeof after !== 'string') continue;
      const diff = computeDiagramStructuralDiff(kind, baseline, after);
      if (diff) map[entry.id] = diff;
    }
    return map;
  }, [insightsEntries]);

  useEffect(() => {
    if (!diagramChangeHighlightEntryId) return;
    const entry = insightsEntries.find((e) => e.id === diagramChangeHighlightEntryId);
    const shouldClear =
      !entry?.diagramUndoBaseline ||
      entry.diagramUndoConsumed ||
      (entry.status ?? 'running') === 'failed' ||
      (entry.status ?? 'running') === 'cancelled' ||
      ((entry.status ?? 'running') === 'done' && !entry.diagramRevisionApplied);
    if (shouldClear) {
      clearPendingAutoDiagramHighlight();
      setDiagramChangeHighlightEntryId(null);
    }
  }, [clearPendingAutoDiagramHighlight, diagramChangeHighlightEntryId, insightsEntries]);

  useEffect(() => {
    if (!diagramChangeHighlightEntryId) {
      setDiagramChangeHighlightAddedOnly(false);
    }
  }, [diagramChangeHighlightEntryId]);

  useEffect(() => {
    if (!state.diagramSource?.trim()) {
      clearPendingAutoDiagramHighlight();
    }
  }, [clearPendingAutoDiagramHighlight, state.diagramSource]);

  const armAutoDiagramChangeHighlight = useCallback(
    (entryId) => {
      if (diagramAutoHighlightTimerRef.current != null) {
        window.clearTimeout(diagramAutoHighlightTimerRef.current);
        diagramAutoHighlightTimerRef.current = null;
      }
      if (pendingAutoDiagramHighlightTimeoutRef.current != null) {
        window.clearTimeout(pendingAutoDiagramHighlightTimeoutRef.current);
        pendingAutoDiagramHighlightTimeoutRef.current = null;
      }
      resetRadialChrome();
      setDiagramChangeHighlightAddedOnly(false);
      setDiagramChangeHighlightEntryId(entryId);
      diagramAutoHighlightTimerRef.current = window.setTimeout(() => {
        diagramAutoHighlightTimerRef.current = null;
        setDiagramChangeHighlightEntryId((prev) => (prev === entryId ? null : prev));
      }, AUTO_DIAGRAM_CHANGE_HIGHLIGHT_MS);
    },
    [resetRadialChrome]
  );

  const handleDiagramSvgRendered = useCallback(
    ({ revisionId: renderedRevisionId }) => {
      const pending = pendingAutoDiagramHighlightRef.current;
      if (!pending) return;
      if (renderedRevisionId !== pending.revisionId) return;
      pendingAutoDiagramHighlightRef.current = null;
      if (pendingAutoDiagramHighlightTimeoutRef.current != null) {
        window.clearTimeout(pendingAutoDiagramHighlightTimeoutRef.current);
        pendingAutoDiagramHighlightTimeoutRef.current = null;
      }
      armAutoDiagramChangeHighlight(pending.entryId);
    },
    [armAutoDiagramChangeHighlight]
  );

  const clearDiagramHighlightTimers = useCallback(() => {
    if (diagramAutoHighlightTimerRef.current != null) {
      window.clearTimeout(diagramAutoHighlightTimerRef.current);
      diagramAutoHighlightTimerRef.current = null;
    }
    clearPendingAutoDiagramHighlight();
    setDiagramChangeHighlightEntryId(null);
    setDiagramChangeHighlightAddedOnly(false);
  }, [clearPendingAutoDiagramHighlight]);

  return {
    diagramChangeHighlightEntryId,
    diagramChangeHighlightAddedOnly,
    setDiagramChangeHighlightEntryId,
    setDiagramChangeHighlightAddedOnly,
    pendingAutoDiagramHighlightRef,
    pendingAutoDiagramHighlightTimeoutRef,
    diagramAutoHighlightTimerRef,
    clearPendingAutoDiagramHighlight,
    clearDiagramHighlightTimers,
    armAutoDiagramChangeHighlight,
    handleDiagramSvgRendered,
    handleRestoreToEntry,
    handleRestoreDiagramSnapshot,
    handleOpenProposalFullPreview,
    handleToggleDiagramChangeHighlight,
    changeHighlightForCanvas,
    changeHighlightContentType,
    diagramChangeHighlightSummary,
    entryDiagramDiffById
  };
}
