import { useCallback } from 'react';

/**
 * Retry a failed insight entry from its stored retry descriptor.
 *
 * @param {{
 *   contentMode: string;
 *   insightsEntriesRef: import('react').MutableRefObject<Array<object>>;
 *   loadingRef: import('react').MutableRefObject<boolean>;
 *   modelProfile: string;
 *   runStreamingAgent: Function;
 *   setActiveRequest: (value: string | null) => void;
 *   setError: (message: string) => void;
 *   setGoMadStreak: import('react').Dispatch<import('react').SetStateAction<number>>;
 *   setLoading: (value: boolean) => void;
 *   streamingPreviewRef: import('react').MutableRefObject<boolean>;
 *   syncDiagramOrThrow: () => Promise<object>;
 * }} deps
 */
export function useRetryFailedInsight({
  contentMode,
  insightsEntriesRef,
  loadingRef,
  modelProfile,
  runStreamingAgent,
  setActiveRequest,
  setError,
  setGoMadStreak,
  setLoading,
  streamingPreviewRef,
  syncDiagramOrThrow
}) {
  const retryFailedInsight = useCallback(
    async (entryId, options = {}) => {
      const entry = insightsEntriesRef.current.find((e) => e.id === entryId);
      const desc = entry?.retryDescriptor;
      if (!desc || loadingRef.current || streamingPreviewRef.current) return;

      const useQuality = Boolean(options.useQuality);
      const profile = useQuality ? 'quality' : (desc.modelProfile ?? modelProfile);

      setLoading(true);
      setActiveRequest(desc.operation === 'intent' ? 'intent' : `transform:${desc.mode}`);
      setError('');
      if (desc.variant !== 'goMad') setGoMadStreak(0);

      try {
        const syncedState = await syncDiagramOrThrow();
        const sharedPayload = {
          revisionId: syncedState.revisionId,
          diagramSource: syncedState.diagramSource,
          contentType: contentMode,
          modelProfile: profile,
          focusNode: desc.focusNode ?? undefined,
          ...(desc.peerContext ? { peerContext: desc.peerContext } : {})
        };

        if (desc.operation === 'intent') {
          await runStreamingAgent({
            operation: 'intent',
            payload: {
              operation: 'intent',
              prompt: desc.prompt,
              settings: desc.settings ?? {},
              ...sharedPayload
            },
            title: entry.title,
            variant: desc.variant,
            diagramUndoBaseline: { ...syncedState },
            topic: desc.topic,
            modeSwitchSync: desc.modeSwitchSync,
            modeSwitchPeerRevisionId: desc.modeSwitchPeerRevisionId,
            modeSwitchPeerMode: desc.modeSwitchPeerMode
          });
        } else {
          await runStreamingAgent({
            operation: 'transform',
            payload: {
              operation: 'transform',
              mode: desc.mode,
              ...(desc.goMadDepth != null ? { goMadDepth: desc.goMadDepth } : {}),
              ...sharedPayload
            },
            title: entry.title,
            variant: desc.variant,
            diagramUndoBaseline: { ...syncedState },
            topic: desc.topic
          });
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
        setActiveRequest(null);
      }
    },
    [
      contentMode,
      insightsEntriesRef,
      loadingRef,
      modelProfile,
      runStreamingAgent,
      setActiveRequest,
      setError,
      setGoMadStreak,
      setLoading,
      streamingPreviewRef,
      syncDiagramOrThrow
    ]
  );

  return { retryFailedInsight };
}
