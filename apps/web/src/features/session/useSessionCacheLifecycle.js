import { useEffect } from 'react';
import { joinRoomByPairingCode } from '../../state/sessionEventsClient.js';
import { readDiagramCache, writeDiagramCache } from '../../state/diagramStore.js';
import {
  MODEL_PROFILE_STORAGE_KEY,
  ensureUrlBackedSession,
  sessionPathFor
} from '../../utils/appSessionLocation.js';

/**
 * Browser session navigation, room join, per-session cache reset, and cache persistence.
 *
 * @param {{
 *   activeSessionId: string;
 *   clearDiagramHighlightTimers: () => void;
 *   contentMode: string;
 *   controls: { loading: { invalidRoom?: string } };
 *   editorOpen: boolean;
 *   freshlyMintedSessionIdsRef: import('react').MutableRefObject<Set<string>>;
 *   insightsEntries: Array<object>;
 *   insightsOpen: boolean;
 *   latestCritique: object | null;
 *   modelProfile: string;
 *   promptRef: import('react').MutableRefObject<string>;
 *   resetCollaborationState: () => void;
 *   setActiveRequest: (value: string | null) => void;
 *   setActiveSessionId: (id: string) => void;
 *   setEditorOpen: (open: boolean) => void;
 *   setError: (message: string) => void;
 *   setHoverDescriptor: (value: object | null) => void;
 *   setInsightsEntries: import('react').Dispatch<import('react').SetStateAction<Array<object>>>;
 *   setInsightsOpen: (open: boolean) => void;
 *   setLatestCritique: (value: object | null) => void;
 *   setLoading: (value: boolean) => void;
 *   setPrompt: (value: string) => void;
 *   setSelectedNode: (value: object | null) => void;
 *   setSoundEnabled: (enabled: boolean) => void;
 *   setStreamingPreview: (value: boolean) => void;
 *   setToolbarAnchor: (value: object | null) => void;
 *   soundEnabled: boolean;
 *   state: { diagramSource?: string };
 *   streamAgentAbortRef: import('react').MutableRefObject<AbortController | null>;
 *   streamTimerRef: import('react').MutableRefObject<number | null>;
 *   syncTimerRef: import('react').MutableRefObject<ReturnType<typeof setTimeout> | null>;
 *   cacheRef: import('react').MutableRefObject<object | null>;
 * }} deps
 */
export function useSessionCacheLifecycle({
  activeSessionId,
  clearDiagramHighlightTimers,
  contentMode,
  controls,
  editorOpen,
  freshlyMintedSessionIdsRef,
  insightsEntries,
  insightsOpen,
  latestCritique,
  modelProfile,
  promptRef,
  resetCollaborationState,
  setActiveRequest,
  setActiveSessionId,
  setEditorOpen,
  setError,
  setHoverDescriptor,
  setInsightsEntries,
  setInsightsOpen,
  setLatestCritique,
  setLoading,
  setPrompt,
  setSelectedNode,
  setSoundEnabled,
  setStreamingPreview,
  setToolbarAnchor,
  soundEnabled,
  state,
  streamAgentAbortRef,
  streamTimerRef,
  syncTimerRef,
  cacheRef
}) {
  useEffect(() => {
    function handlePopState() {
      const { sessionId: nextSessionId, fromUrl } = ensureUrlBackedSession();
      if (!fromUrl) freshlyMintedSessionIdsRef.current.add(nextSessionId);
      setActiveSessionId(nextSessionId);
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [freshlyMintedSessionIdsRef, setActiveSessionId]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const room = new URLSearchParams(window.location.search).get('room');
    if (!room) return undefined;
    let cancelled = false;
    joinRoomByPairingCode({ pairingCode: room })
      .then(({ sessionId }) => {
        if (cancelled || !sessionId) return;
        freshlyMintedSessionIdsRef.current.delete(sessionId);
        setActiveSessionId(sessionId);
        const nextPath = sessionPathFor(sessionId);
        const url = new URL(window.location.href);
        url.searchParams.delete('room');
        window.history.replaceState({}, '', `${nextPath}${url.search}${url.hash}`);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message ?? controls.loading.invalidRoom);
      });
    return () => {
      cancelled = true;
    };
  }, [controls.loading.invalidRoom, freshlyMintedSessionIdsRef, setActiveSessionId, setError]);

  useEffect(() => {
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }
    if (streamTimerRef.current != null) {
      cancelAnimationFrame(streamTimerRef.current);
      streamTimerRef.current = null;
    }
    streamAgentAbortRef.current?.abort();
    cacheRef.current = readDiagramCache(activeSessionId);
    setPrompt('');
    promptRef.current = '';
    setInsightsEntries(
      Array.isArray(cacheRef.current?.insightsEntries) ? cacheRef.current.insightsEntries : []
    );
    setLatestCritique(
      cacheRef.current?.latestCritique?.text ? cacheRef.current.latestCritique : null
    );
    setEditorOpen(Boolean(cacheRef.current?.editorOpen));
    setInsightsOpen(Boolean(cacheRef.current?.insightsOpen));
    setSoundEnabled(cacheRef.current?.soundEnabled ?? true);
    setSelectedNode(null);
    setHoverDescriptor(null);
    setToolbarAnchor(null);
    clearDiagramHighlightTimers();
    setStreamingPreview(false);
    setLoading(false);
    setActiveRequest(null);
    setError('');
    resetCollaborationState();
  }, [
    activeSessionId,
    cacheRef,
    clearDiagramHighlightTimers,
    promptRef,
    resetCollaborationState,
    setActiveRequest,
    setEditorOpen,
    setError,
    setHoverDescriptor,
    setInsightsEntries,
    setInsightsOpen,
    setLatestCritique,
    setLoading,
    setPrompt,
    setSelectedNode,
    setSoundEnabled,
    setStreamingPreview,
    setToolbarAnchor,
    streamAgentAbortRef,
    streamTimerRef,
    syncTimerRef
  ]);

  useEffect(() => {
    writeDiagramCache(
      {
        diagramSource: contentMode === 'anything' ? '' : state.diagramSource,
        contentMode,
        insightsEntries,
        latestCritique,
        editorOpen,
        insightsOpen,
        soundEnabled
      },
      activeSessionId
    );
  }, [
    activeSessionId,
    contentMode,
    editorOpen,
    insightsEntries,
    insightsOpen,
    latestCritique,
    soundEnabled,
    state.diagramSource
  ]);

  useEffect(() => {
    try {
      window.localStorage.setItem(MODEL_PROFILE_STORAGE_KEY, modelProfile);
    } catch {
      // ignore quota / privacy mode
    }
  }, [modelProfile]);
}
