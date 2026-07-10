import { API_BASE_URL } from './diagramSession.js';

const SESSION_HEADER = 'x-session-id';

function sessionHeaders(sessionId) {
  return sessionId ? { [SESSION_HEADER]: sessionId } : {};
}

/**
 * Opens a long-lived EventSource against `/api/copilotkit/session-events` for the given
 * session. Returns a `close()` function. Each `data:` line is parsed as JSON and dispatched
 * via `onEvent`. `onError` fires on transport errors (which the browser will auto-retry).
 */
export function openSessionEventsStream({ sessionId, onEvent, onError }) {
  if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
    return () => {};
  }
  const url = `${API_BASE_URL}/api/copilotkit/session-events?sessionId=${encodeURIComponent(sessionId)}`;
  const es = new EventSource(url);
  es.onmessage = (event) => {
    if (!event?.data) return;
    try {
      const parsed = JSON.parse(event.data);
      onEvent?.(parsed);
    } catch (error) {
      console.warn('session-events: bad JSON', error);
    }
  };
  es.onerror = (event) => {
    onError?.(event);
  };
  return () => {
    try {
      es.close();
    } catch {
      // ignore close errors
    }
  };
}

async function jsonFetch(input, init = {}) {
  const res = await fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {})
    }
  });
  const ct = res.headers.get('content-type') ?? '';
  const body = ct.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    const message =
      body?.error ?? body?.message ?? (typeof body === 'string' ? body : 'Request failed');
    throw new Error(`${res.status} ${message}`);
  }
  return body;
}

function sessionUrl(path, sessionId) {
  const sep = path.includes('?') ? '&' : '?';
  return `${API_BASE_URL}${path}${sep}sessionId=${encodeURIComponent(sessionId)}`;
}

export function approveHandshake({ sessionId, requestId }) {
  return jsonFetch(sessionUrl(`/api/copilotkit/handshakes/${requestId}/approve`, sessionId), {
    method: 'POST',
    headers: sessionHeaders(sessionId)
  });
}

export function denyHandshake({ sessionId, requestId }) {
  return jsonFetch(sessionUrl(`/api/copilotkit/handshakes/${requestId}/deny`, sessionId), {
    method: 'POST',
    headers: sessionHeaders(sessionId)
  });
}

export function acceptProposal({ sessionId, proposalId }) {
  return jsonFetch(sessionUrl(`/api/copilotkit/proposals/${proposalId}/accept`, sessionId), {
    method: 'POST',
    headers: sessionHeaders(sessionId)
  });
}

export function rejectProposal({ sessionId, proposalId }) {
  return jsonFetch(sessionUrl(`/api/copilotkit/proposals/${proposalId}/reject`, sessionId), {
    method: 'POST',
    headers: sessionHeaders(sessionId)
  });
}

export function fetchInvite({ sessionId }) {
  return jsonFetch(sessionUrl('/api/copilotkit/invite', sessionId), {
    headers: sessionHeaders(sessionId)
  });
}

export function fetchPresence({ sessionId }) {
  return jsonFetch(sessionUrl('/api/copilotkit/presence', sessionId), {
    headers: sessionHeaders(sessionId)
  });
}

export function fetchPendingProposals({ sessionId }) {
  return jsonFetch(sessionUrl('/api/copilotkit/proposals', sessionId), {
    headers: sessionHeaders(sessionId)
  });
}

export function fetchPendingHandshakes({ sessionId }) {
  return jsonFetch(sessionUrl('/api/copilotkit/handshakes', sessionId), {
    headers: sessionHeaders(sessionId)
  });
}

export function rotatePairingCode({ sessionId }) {
  return jsonFetch(sessionUrl('/api/copilotkit/invite/rotate-pairing', sessionId), {
    method: 'POST',
    headers: sessionHeaders(sessionId)
  });
}

export function joinRoomByPairingCode({ pairingCode }) {
  return jsonFetch(`${API_BASE_URL}/api/copilotkit/join-room`, {
    method: 'POST',
    body: JSON.stringify({ pairingCode })
  });
}
