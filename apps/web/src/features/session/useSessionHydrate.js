import { useEffect, useState } from 'react';
import {
  buildIntentPeerContext,
  CONTENT_MODES,
  createEmptyCrossModeSyncMarkers,
  createSessionId,
  fetchSessionDiagramState,
  isSlotCustomized,
  isSlotInSyncForTopic,
  mergeLeavingSlotSnapshot,
  needsModeSwitchPeerSync,
  normalizeSessionId,
  peerRequiresModeSwitchTranslation,
  pickPrimaryPeerMode,
  resolveModeSwitchCandidate,
  isDiagramCacheSubstantial,
  isServerSessionPristine,
  mintFreshServerSession,
  readDiagramCache,
  SESSION_NOT_FOUND_CODE,
  shouldAutoSubmitModeSwitchIntent,
  syncClientDiagramState
} from '../../state/diagramStore.js';
import { markAppReady } from '../../utils/appReadySignal.js';
import { sessionPathFor } from '../../utils/appSessionLocation.js';
import { createInitialDiagramState } from '@archislop/shared';
import { isConcreteContentMode } from '../../utils/renderModeAction.js';

/**
 * Session hydrate effect: fetch server state on session/mode change, handle 404 rotation,
 * and auto-submit mode-switch intents when peer slots need translation.
 *
 * @param {{
 *   activeSessionId: string;
 *   contentMode: string;
 *   freshlyMintedSessionIdsRef: import('react').MutableRefObject<Set<string>>;
 *   sessionIdFromUrlRef: import('react').MutableRefObject<boolean>;
 *   sessionTopicRef: import('react').MutableRefObject<string | null>;
 *   modeSwitch: import('./useContentModeSwitch.js').ContentModeSwitchRefs;
 *   stateRef: import('react').MutableRefObject<object>;
 *   promptRef: import('react').MutableRefObject<string>;
 *   loadingRef: import('react').MutableRefObject<boolean>;
 *   submitIntentWithPromptRef: import('react').MutableRefObject<Function | null>;
 *   cacheRef: import('react').MutableRefObject<object | null>;
 *   setActiveSessionId: (id: string) => void;
 *   setState: (value: object) => void;
 *   setSessionHasPeerContent: (value: boolean) => void;
 *   setLoading: (value: boolean) => void;
 *   setActiveRequest: (value: string | null) => void;
 *   setPrompt: (value: string) => void;
 *   setError: (value: string) => void;
 *   setInsightsEntries: (value: unknown) => void;
 *   setLatestCritique: (value: object | null) => void;
 *   setCritiqueActionableSelected: (value: unknown) => void;
 *   setLiveDraftSource: (value: string) => void;
 *   setLiveDraftContentType: (value: string | null) => void;
 *   setRussStreak: (value: number) => void;
 *   setModelProfile: (value: string) => void;
 *   setContentMode: (value: string) => void;
 * }} deps
 */
export function useSessionHydrate({
  activeSessionId,
  contentMode,
  freshlyMintedSessionIdsRef,
  sessionIdFromUrlRef,
  sessionTopicRef,
  modeSwitch,
  stateRef,
  promptRef,
  loadingRef,
  submitIntentWithPromptRef,
  cacheRef,
  setActiveSessionId,
  setState,
  setSessionHasPeerContent,
  setLoading,
  setActiveRequest,
  setPrompt,
  setError,
  setInsightsEntries,
  setLatestCritique,
  setCritiqueActionableSelected,
  setLiveDraftSource,
  setLiveDraftContentType,
  setRussStreak,
  setModelProfile,
  setContentMode
}) {
  const {
    previousContentModeRef,
    sourceRevisionAtViewRef,
    leavingSlotSnapshotRef,
    crossModeSyncRef,
    suppressNextModeSwitchRerunRef,
    skipHydrateOnceRef,
    pendingRenderModeRequestRef
  } = modeSwitch;

  const [sessionHydrated, setSessionHydrated] = useState(false);

  // Let the cold-start gate dismiss only after the shell has painted real UI.
  useEffect(() => {
    if (!sessionHydrated) return undefined;
    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cancelled) markAppReady();
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [sessionHydrated]);

  useEffect(() => {
    let cancelled = false;
    // Capture the textarea state at the moment the user toggled mode. Used below to gate
    // auto-rerun: if the user is actively typing a different prompt, don't clobber it.
    const promptAtSwitch = promptRef.current;
    const sourceMode =
      previousContentModeRef.current !== contentMode &&
      isConcreteContentMode(previousContentModeRef.current)
        ? previousContentModeRef.current
        : null;
    const sourceRevisionAtLastView =
      sourceMode != null ? (sourceRevisionAtViewRef.current[sourceMode] ?? null) : null;
    // Keep loading true across the hydrate → auto-submit microtask gap so an empty sibling
    // slot never flashes the first-run intro between those two phases.
    let keepLoadingForModeSwitch = false;

    // Auto is not a server slot — keep a blank local canvas and skip mode-switch auto-intent.
    if (contentMode === 'auto') {
      if (skipHydrateOnceRef.current) {
        skipHydrateOnceRef.current = false;
        setSessionHydrated(true);
        return undefined;
      }
      const empty = createInitialDiagramState('mermaid');
      stateRef.current = empty;
      setState(empty);
      setSessionHasPeerContent(false);
      setSessionHydrated(true);
      setLoading(false);
      setActiveRequest(null);
      return undefined;
    }

    // Mid-stream Auto → concrete resolve: update the picker without re-hydrating.
    if (skipHydrateOnceRef.current) {
      skipHydrateOnceRef.current = false;
      setSessionHydrated(true);
      return undefined;
    }

    setSessionHydrated(false);
    setLoading(true);
    setActiveRequest('hydrate');
    const leavingSnapshot = sourceMode ? leavingSlotSnapshotRef.current[sourceMode] : null;

    const flushLeavingSlot = async () => {
      if (!sourceMode || !leavingSnapshot || !isSlotCustomized(leavingSnapshot)) return;
      try {
        await syncClientDiagramState({
          contentType: sourceMode,
          diagramSource: leavingSnapshot.diagramSource,
          ...(leavingSnapshot.styleConfig != null
            ? { styleConfig: leavingSnapshot.styleConfig }
            : {}),
          sessionId: activeSessionId
        });
      } catch {
        // Best-effort — mergeLeavingSlotSnapshot below still enables peer detection.
      }
    };

    flushLeavingSlot()
      .then(() => fetchSessionDiagramState({ sessionId: activeSessionId }))
      .then((fetchedSession) => {
        const session = mergeLeavingSlotSnapshot(fetchedSession, sourceMode, leavingSnapshot);
        if (sourceMode) {
          delete leavingSlotSnapshotRef.current[sourceMode];
        }
        return session;
      })
      .then((session) => {
        if (cancelled) return;
        freshlyMintedSessionIdsRef.current.delete(activeSessionId);
        const staleLocalCache = readDiagramCache(activeSessionId);
        if (
          sessionIdFromUrlRef.current &&
          isServerSessionPristine(session) &&
          isDiagramCacheSubstantial(staleLocalCache)
        ) {
          const err = new Error('Session not found');
          err.code = SESSION_NOT_FOUND_CODE;
          throw err;
        }
        const data = session?.[contentMode];
        if (!data) {
          throw new Error('Invalid session state');
        }
        stateRef.current = data;
        setState(data);
        setSessionHasPeerContent(
          CONTENT_MODES.some((mode) => mode !== contentMode && isSlotCustomized(session?.[mode]))
        );

        const trimmedAtSwitch = (promptAtSwitch ?? '').trim();
        let candidate = resolveModeSwitchCandidate({
          contentMode,
          session,
          sessionTopic: sessionTopicRef.current,
          promptAtSwitch: trimmedAtSwitch,
          sourceMode
        });

        if (candidate) {
          sessionTopicRef.current = candidate;
        }

        const primaryPeerMode = pickPrimaryPeerMode({
          contentMode,
          session,
          candidate,
          sourceMode
        });
        const peerSlot = primaryPeerMode ? session?.[primaryPeerMode] : null;

        const newSlotInSync = isSlotInSyncForTopic(data, candidate);
        const textareaDirty = trimmedAtSwitch.length > 0 && trimmedAtSwitch !== candidate;
        const peerRequiresTranslation = peerRequiresModeSwitchTranslation({
          contentMode,
          session,
          candidate,
          syncMarkers: crossModeSyncRef.current,
          sourceMode,
          sourceRevisionAtLastView
        });
        const needsPeerSync = needsModeSwitchPeerSync({
          contentMode,
          session,
          candidate,
          syncMarkers: crossModeSyncRef.current,
          sourceMode,
          sourceRevisionAtLastView
        });

        if (candidate && !textareaDirty) {
          setPrompt(candidate);
          promptRef.current = candidate;
        }

        const peerContext = buildIntentPeerContext(contentMode, session, candidate, sourceMode);
        const pendingRenderModeRequest = pendingRenderModeRequestRef.current;
        if (pendingRenderModeRequest?.targetMode === contentMode) {
          pendingRenderModeRequestRef.current = null;
          keepLoadingForModeSwitch = true;
          Promise.resolve().then(async () => {
            if (cancelled) return;
            try {
              await submitIntentWithPromptRef.current?.(pendingRenderModeRequest.promptText, {
                stateOverride: data,
                peerContext: pendingRenderModeRequest.peerContext,
                focusTarget: pendingRenderModeRequest.descriptor,
                contentTypeOverride: contentMode,
                skipLoadingGuard: true
              });
            } catch (err) {
              if (!cancelled) setError(err.message);
            }
          });
          return;
        }
        // Cross-mode Restore intentionally jumps to a specific snapshot — don't let the auto
        // mode-switch rerun overwrite it on the very next hydrate pass.
        const restoreSuppressed = suppressNextModeSwitchRerunRef.current;
        if (restoreSuppressed) suppressNextModeSwitchRerunRef.current = false;
        if (
          !restoreSuppressed &&
          shouldAutoSubmitModeSwitchIntent({
            candidate,
            textareaDirty,
            newSlotInSync,
            peerRequiresTranslation,
            needsPeerSync
          })
        ) {
          const peerRevisionAtSubmit = peerSlot?.revisionId ?? 0;
          keepLoadingForModeSwitch = true;
          // Defer to a microtask so React has committed the state update before the auto
          // submit kicks off; pass the override anyway so revisionId is correct regardless.
          Promise.resolve().then(async () => {
            if (cancelled) return;
            try {
              if (!peerContext) {
                const cleared = await syncClientDiagramState({
                  contentType: contentMode,
                  diagramSource: '',
                  sessionId: activeSessionId
                });
                if (cancelled) return;
                stateRef.current = cleared;
                setState(cleared);
                await submitIntentWithPromptRef.current?.(candidate, {
                  stateOverride: cleared,
                  skipLoadingGuard: true
                });
                return;
              }
              await submitIntentWithPromptRef.current?.(candidate, {
                stateOverride: data,
                peerContext,
                skipLoadingGuard: true,
                modeSwitchSync: true,
                modeSwitchPeerRevisionId: peerRevisionAtSubmit,
                modeSwitchPeerMode: primaryPeerMode
              });
            } catch (err) {
              if (!cancelled) {
                setError(err.message);
                setLoading(false);
                setActiveRequest(null);
              }
            }
          });
        }
        if (isConcreteContentMode(contentMode)) {
          sourceRevisionAtViewRef.current[contentMode] = data.revisionId ?? 0;
        }
        previousContentModeRef.current = contentMode;
      })
      .catch(async (err) => {
        if (cancelled) return;
        if (err?.code === SESSION_NOT_FOUND_CODE) {
          setInsightsEntries([]);
          setLatestCritique(null);
          setCritiqueActionableSelected([]);
          setPrompt('');
          promptRef.current = '';
          setLiveDraftSource('');
          setLiveDraftContentType(null);
          setRussStreak(0);
          sessionTopicRef.current = null;
          setSessionHasPeerContent(false);
          crossModeSyncRef.current = createEmptyCrossModeSyncMarkers();
          sourceRevisionAtViewRef.current = {};
          cacheRef.current = null;
          sessionIdFromUrlRef.current = false;
          setModelProfile('fast');
          setContentMode('mermaid');
          // Two cases:
          //  (a) Stale URL/bookmark after a server restart — rotate to a new room id + wipe storage.
          //  (b) Client-minted id on first visit — 404 is expected; keep id and prime the server.
          const wasFreshlyMinted = freshlyMintedSessionIdsRef.current.has(activeSessionId);
          let targetId = activeSessionId;
          if (!wasFreshlyMinted) {
            const fresh = createInitialDiagramState('mermaid');
            stateRef.current = fresh;
            setState(fresh);
            try {
              targetId = await mintFreshServerSession();
            } catch {
              targetId = normalizeSessionId(createSessionId()) ?? `session-${Date.now()}`;
            }
            freshlyMintedSessionIdsRef.current.add(targetId);
          } else {
            try {
              await Promise.all([
                syncClientDiagramState({
                  contentType: 'mermaid',
                  diagramSource: '',
                  sessionId: targetId
                }),
                syncClientDiagramState({
                  contentType: 'infographic',
                  diagramSource: '',
                  sessionId: targetId
                }),
                syncClientDiagramState({
                  contentType: 'metaphor3d',
                  diagramSource: '',
                  sessionId: targetId
                }),
                syncClientDiagramState({
                  contentType: 'chart',
                  diagramSource: '',
                  sessionId: targetId
                }),
                syncClientDiagramState({
                  contentType: 'forms',
                  diagramSource: '',
                  sessionId: targetId
                }),
                syncClientDiagramState({
                  contentType: 'anything',
                  diagramSource: '',
                  sessionId: targetId
                })
              ]);
            } catch {
              // best-effort — if priming sync fails the next user action will create the session
            }
          }
          if (cancelled) return;
          if (targetId !== activeSessionId) {
            // Keep targetId in freshlyMintedSessionIdsRef so the next hydration cycle
            // treats it as client-minted and primes the server if it lands on a different
            // Cloud Run instance. The .then() path cleans it up after a successful fetch.
            window.history.replaceState({}, '', `${sessionPathFor(targetId)}`);
            setActiveSessionId(targetId);
          } else {
            freshlyMintedSessionIdsRef.current.delete(targetId);
            const fresh = createInitialDiagramState('mermaid');
            stateRef.current = fresh;
            setState(fresh);
          }
          return;
        }
        setError(err?.message ?? String(err));
      })
      .finally(() => {
        if (cancelled) return;
        sessionIdFromUrlRef.current = false;
        setSessionHydrated(true);
        if (keepLoadingForModeSwitch) {
          // submitIntentWithPrompt owns loading for the follow-on mode-switch run.
          return;
        }
        loadingRef.current = false;
        setLoading(false);
        setActiveRequest(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId, contentMode]);

  return { sessionHydrated };
}
