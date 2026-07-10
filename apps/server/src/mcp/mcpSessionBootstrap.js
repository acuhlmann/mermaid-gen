import { buildWebCanvasUrl } from './diagramDiffSummary.js';

/**
 * One-shot bootstrap document for external agents after room bind.
 */
export function buildSessionBootstrap({ entry, services, pairingCodeStore, publicBaseUrl }) {
  const checklist = [
    'join_session',
    'register_agent',
    'open_welcome',
    'open_diagram_canvas',
    'open_session_events'
  ];
  const collaborationGuidePrompt = 'archislop_collaboration_guide';

  if (!entry) {
    return {
      bound: false,
      checklist,
      collaborationGuidePrompt,
      message: 'No MCP transport session. Connect to /mcp first.'
    };
  }

  if (!entry.appSessionId) {
    return {
      bound: false,
      checklist,
      collaborationGuidePrompt,
      inviteHint: 'Open Invite agent in the ArchiSlop web UI and copy the pairing code.',
      message: 'Not bound to an ArchiSlop room.'
    };
  }

  const sessionId = entry.appSessionId;
  const pairingCode = pairingCodeStore.getOrCreateCode(sessionId);
  const sessionState = services.stateStore.getSessionState();
  const mermaidSlot = services.stateStore.getSlot('mermaid');
  const infographicSlot = services.stateStore.getSlot('infographic');
  const pendingHandshakes = services.handshakeStore.listPendingRequests();
  const pendingForSession = pendingHandshakes.filter((h) => h.sessionId === sessionId);

  let handshakeStatus = 'none';
  if (entry.agentId) {
    handshakeStatus = 'approved';
  } else if (entry.pendingHandshakeRequestId) {
    handshakeStatus = 'pending';
  } else if (pendingForSession.length > 0) {
    handshakeStatus = 'pending';
  }

  return {
    bound: true,
    sessionId,
    pairingCode,
    webCanvasUrl: buildWebCanvasUrl(sessionId),
    publicBaseUrl: publicBaseUrl ?? undefined,
    activeContentType: sessionState.activeContentType,
    revisions: {
      mermaid: mermaidSlot.revisionId,
      infographic: infographicSlot.revisionId
    },
    agentRegistered: Boolean(entry.agentId),
    agentId: entry.agentId ?? null,
    agentName: entry.agentName ?? null,
    handshakeStatus,
    pendingHandshakeRequestId:
      entry.pendingHandshakeRequestId ?? pendingForSession[0]?.requestId ?? null,
    pendingHandshakes: pendingForSession,
    presence: services.presenceStore.list(),
    checklist,
    collaborationGuidePrompt,
    message: entry.agentId
      ? 'Ready to collaborate. Call get_session_state before proposing edits.'
      : 'Room bound. Call register_agent and wait for human approval.'
  };
}
