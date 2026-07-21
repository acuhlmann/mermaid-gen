import { useCallback, useEffect, useState } from 'react';
import {
  openSessionEventsStream,
  approveHandshake,
  denyHandshake,
  acceptProposal as acceptProposalApi,
  rejectProposal as rejectProposalApi
} from '../../state/sessionEventsClient.js';
import { fetchSessionDiagramState } from '../../state/diagramStore.js';
import { pushError } from '../../state/errorToastStore.js';
import {
  proposalToInsightEntry,
  enrichProposalForInsight,
  attributedInsightToInsightEntry
} from '../../utils/appInsightHelpers.js';

/**
 * External-agent collaboration: SSE session-events stream, handshake approval,
 * and proposal accept/reject handlers.
 *
 * @param {{
 *   activeSessionId: string;
 *   sessionHydrated: boolean;
 *   contentMode: string;
 *   controlsLoading: object;
 *   setInsightsEntries: (value: unknown) => void;
 *   stateRef: import('react').MutableRefObject<object>;
 *   setState: (value: object) => void;
 * }} deps
 */
export function useSessionCollaboration({
  activeSessionId,
  sessionHydrated,
  contentMode,
  controlsLoading,
  setInsightsEntries,
  stateRef,
  setState
}) {
  const [pendingHandshake, setPendingHandshake] = useState(null);
  const [externalAgentPresence, setExternalAgentPresence] = useState([]);
  const [agentReactions, setAgentReactions] = useState([]);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  const resetCollaborationState = useCallback(() => {
    setPendingHandshake(null);
    setExternalAgentPresence([]);
    setAgentReactions([]);
  }, []);

  // External-agent session events: handshake requests, proposals, presence, reactions, attributed insights.
  // One always-open SSE stream per active session (after hydrate so SSE cannot register a phantom room).
  useEffect(() => {
    if (!activeSessionId || !sessionHydrated) return undefined;

    const close = openSessionEventsStream({
      sessionId: activeSessionId,
      onEvent: (envelope) => {
        if (!envelope || typeof envelope !== 'object') return;
        const { type, payload } = envelope;

        if (type === 'snapshot') {
          setExternalAgentPresence(Array.isArray(payload?.presence) ? payload.presence : []);
          // Re-hydrate any proposals that arrived before this client connected.
          const proposals = Array.isArray(payload?.pendingProposals)
            ? payload.pendingProposals
            : [];
          if (proposals.length > 0) {
            fetchSessionDiagramState({ sessionId: activeSessionId })
              .then((session) => {
                setInsightsEntries((prev) => {
                  const existingIds = new Set(prev.map((e) => e.id));
                  const additions = proposals
                    .filter((p) => !existingIds.has(p.proposalId))
                    .map((p) =>
                      proposalToInsightEntry(enrichProposalForInsight(p, session, activeSessionId))
                    );
                  return additions.length > 0 ? [...prev, ...additions] : prev;
                });
              })
              .catch(() => {
                setInsightsEntries((prev) => {
                  const existingIds = new Set(prev.map((e) => e.id));
                  const additions = proposals
                    .filter((p) => !existingIds.has(p.proposalId))
                    .map((p) => proposalToInsightEntry(p));
                  return additions.length > 0 ? [...prev, ...additions] : prev;
                });
              });
          }
          return;
        }

        if (type === 'pairing_rotated') {
          return;
        }

        if (type === 'handshake_request') {
          // Newest pending handshake wins (one modal at a time is enough for v1).
          setPendingHandshake(payload ?? null);
          return;
        }

        if (type === 'handshake_resolved') {
          setPendingHandshake((current) =>
            current && current.requestId === payload?.requestId ? null : current
          );
          return;
        }

        if (type === 'presence_update') {
          setExternalAgentPresence(Array.isArray(payload) ? payload : []);
          return;
        }

        if (type === 'proposal_received' && payload?.proposalId) {
          fetchSessionDiagramState({ sessionId: activeSessionId })
            .then((session) => {
              setInsightsEntries((prev) => {
                if (prev.some((e) => e.id === payload.proposalId)) return prev;
                return [
                  ...prev,
                  proposalToInsightEntry(
                    enrichProposalForInsight(payload, session, activeSessionId)
                  )
                ];
              });
            })
            .catch(() => {
              setInsightsEntries((prev) => {
                if (prev.some((e) => e.id === payload.proposalId)) return prev;
                return [...prev, proposalToInsightEntry(payload)];
              });
            });
          return;
        }

        if (type === 'proposal_resolved' && payload?.proposalId) {
          setInsightsEntries((prev) =>
            prev.map((entry) =>
              entry.id === payload.proposalId
                ? {
                    ...entry,
                    proposalStatus: payload.status ?? 'rejected',
                    status: 'done',
                    statusText:
                      payload.status === 'accepted'
                        ? controlsLoading.proposalApplied
                        : payload.status === 'rejected'
                          ? controlsLoading.proposalRejected
                          : payload.status === 'stale'
                            ? controlsLoading.proposalStale
                            : controlsLoading.proposalResolved,
                    completedAt: Date.now()
                  }
                : entry
            )
          );
          return;
        }

        if (type === 'attributed_insight' && payload?.insightId) {
          setInsightsEntries((prev) => [...prev, attributedInsightToInsightEntry(payload)]);
          return;
        }

        if (type === 'reaction' && payload?.reactionId) {
          setAgentReactions((prev) => [...prev, payload]);
          // Auto-expire after 4s so the UI doesn't grow unbounded.
          setTimeout(() => {
            setAgentReactions((prev) => prev.filter((r) => r.reactionId !== payload.reactionId));
          }, 4000);
          return;
        }

        if (type === 'state_changed') {
          // An external proposal was accepted (or otherwise mutated state). Refetch session
          // state so the canvas + insights reflect the new revision.
          fetchSessionDiagramState({ sessionId: activeSessionId })
            .then((session) => {
              const data = session?.[contentMode];
              if (data) {
                stateRef.current = data;
                setState(data);
              }
            })
            .catch(() => {
              // Non-fatal; the next user action will resync.
            });
        }
      },
      onError: () => {
        // The browser auto-reconnects EventSource; nothing to do here for now.
      }
    });

    return close;
  }, [
    activeSessionId,
    sessionHydrated,
    controlsLoading,
    contentMode,
    setInsightsEntries,
    setState,
    stateRef
  ]);

  const handleApproveHandshake = useCallback(async () => {
    if (!pendingHandshake) return;
    try {
      await approveHandshake({ sessionId: activeSessionId, requestId: pendingHandshake.requestId });
    } catch (err) {
      console.error('handshake approve failed', err);
      pushError(`Handshake approve failed: ${err?.message ?? 'unknown error'}`);
    }
    setPendingHandshake(null);
  }, [pendingHandshake, activeSessionId]);

  const handleDenyHandshake = useCallback(async () => {
    if (!pendingHandshake) return;
    try {
      await denyHandshake({ sessionId: activeSessionId, requestId: pendingHandshake.requestId });
    } catch (err) {
      console.error('handshake deny failed', err);
      pushError(`Handshake deny failed: ${err?.message ?? 'unknown error'}`);
    }
    setPendingHandshake(null);
  }, [pendingHandshake, activeSessionId]);

  const patchProposalInsightEntry = useCallback(
    (proposalId, patch) => {
      if (!proposalId) return;
      setInsightsEntries((prev) =>
        prev.map((entry) => (entry.id === proposalId ? { ...entry, ...patch } : entry))
      );
    },
    [setInsightsEntries]
  );

  const handleAcceptProposal = useCallback(
    async (proposalId) => {
      if (!proposalId) throw new Error('Missing proposal id.');
      const body = await acceptProposalApi({ sessionId: activeSessionId, proposalId });
      patchProposalInsightEntry(proposalId, {
        proposalStatus: 'accepted',
        status: 'done',
        statusText: controlsLoading.proposalApplied,
        completedAt: Date.now()
      });
      if (body?.state?.diagramSource != null) {
        stateRef.current = body.state;
        setState(body.state);
      }
    },
    [
      activeSessionId,
      controlsLoading.proposalApplied,
      patchProposalInsightEntry,
      setState,
      stateRef
    ]
  );

  const handleRejectProposal = useCallback(
    async (proposalId) => {
      if (!proposalId) throw new Error('Missing proposal id.');
      await rejectProposalApi({ sessionId: activeSessionId, proposalId });
      patchProposalInsightEntry(proposalId, {
        proposalStatus: 'rejected',
        status: 'done',
        statusText: controlsLoading.proposalRejected,
        completedAt: Date.now()
      });
    },
    [activeSessionId, controlsLoading.proposalRejected, patchProposalInsightEntry]
  );

  return {
    pendingHandshake,
    externalAgentPresence,
    agentReactions,
    inviteDialogOpen,
    setInviteDialogOpen,
    handleApproveHandshake,
    handleDenyHandshake,
    handleAcceptProposal,
    handleRejectProposal,
    resetCollaborationState
  };
}
