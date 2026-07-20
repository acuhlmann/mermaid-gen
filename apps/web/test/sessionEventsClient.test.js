// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/state/diagramSession.js', () => ({
  API_BASE_URL: 'http://test-api.local',
  SESSION_HEADER: 'x-session-id'
}));

import {
  acceptProposal,
  approveHandshake,
  denyHandshake,
  fetchInvite,
  fetchPendingHandshakes,
  fetchPendingProposals,
  fetchPresence,
  joinRoomByPairingCode,
  openSessionEventsStream,
  rejectProposal,
  rotatePairingCode
} from '../src/state/sessionEventsClient.js';

const API_BASE = 'http://test-api.local';

class MockEventSource {
  static instances = [];

  constructor(url) {
    this.url = url;
    this.onmessage = null;
    this.onerror = null;
    this.closed = false;
    MockEventSource.instances.push(this);
  }

  close() {
    this.closed = true;
  }

  emitMessage(data) {
    this.onmessage?.({ data });
  }

  emitError(event = new Event('error')) {
    this.onerror?.(event);
  }
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

describe('sessionEventsClient', () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    vi.stubGlobal('EventSource', MockEventSource);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ ok: true }))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('openSessionEventsStream', () => {
    it('opens EventSource with encoded session id and dispatches parsed events', () => {
      const onEvent = vi.fn();
      const close = openSessionEventsStream({
        sessionId: 'sess/1',
        onEvent
      });
      expect(MockEventSource.instances).toHaveLength(1);
      expect(MockEventSource.instances[0].url).toBe(
        `${API_BASE}/api/copilotkit/session-events?sessionId=${encodeURIComponent('sess/1')}`
      );

      MockEventSource.instances[0].emitMessage(JSON.stringify({ type: 'presence', count: 2 }));
      expect(onEvent).toHaveBeenCalledWith({ type: 'presence', count: 2 });

      close();
      expect(MockEventSource.instances[0].closed).toBe(true);
    });

    it('ignores malformed JSON without throwing', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      openSessionEventsStream({ sessionId: 's1', onEvent: vi.fn() });
      MockEventSource.instances[0].emitMessage('{not json');
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it('forwards transport errors to onError', () => {
      const onError = vi.fn();
      openSessionEventsStream({ sessionId: 's1', onError });
      const err = new Event('error');
      MockEventSource.instances[0].emitError(err);
      expect(onError).toHaveBeenCalledWith(err);
    });
  });

  describe('collaboration REST helpers', () => {
    it('approveHandshake POSTs to the handshake approve route with session header', async () => {
      await approveHandshake({ sessionId: 'sess-9', requestId: 'req-1' });
      expect(fetch).toHaveBeenCalledWith(
        `${API_BASE}/api/copilotkit/handshakes/req-1/approve?sessionId=${encodeURIComponent('sess-9')}`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'x-session-id': 'sess-9'
          })
        })
      );
    });

    it('denyHandshake POSTs to the handshake deny route', async () => {
      await denyHandshake({ sessionId: 'sess-9', requestId: 'req-2' });
      expect(fetch).toHaveBeenCalledWith(
        `${API_BASE}/api/copilotkit/handshakes/req-2/deny?sessionId=${encodeURIComponent('sess-9')}`,
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('acceptProposal and rejectProposal hit proposal routes', async () => {
      await acceptProposal({ sessionId: 's1', proposalId: 'p1' });
      await rejectProposal({ sessionId: 's1', proposalId: 'p2' });
      expect(fetch).toHaveBeenCalledWith(
        `${API_BASE}/api/copilotkit/proposals/p1/accept?sessionId=${encodeURIComponent('s1')}`,
        expect.objectContaining({ method: 'POST' })
      );
      expect(fetch).toHaveBeenCalledWith(
        `${API_BASE}/api/copilotkit/proposals/p2/reject?sessionId=${encodeURIComponent('s1')}`,
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('fetchInvite, presence, proposals, and handshakes use GET with session header', async () => {
      await fetchInvite({ sessionId: 's1' });
      await fetchPresence({ sessionId: 's1' });
      await fetchPendingProposals({ sessionId: 's1' });
      await fetchPendingHandshakes({ sessionId: 's1' });
      expect(fetch).toHaveBeenCalledWith(
        `${API_BASE}/api/copilotkit/invite?sessionId=${encodeURIComponent('s1')}`,
        expect.objectContaining({
          headers: expect.objectContaining({ 'x-session-id': 's1' })
        })
      );
      expect(fetch).toHaveBeenCalledWith(
        `${API_BASE}/api/copilotkit/presence?sessionId=${encodeURIComponent('s1')}`,
        expect.any(Object)
      );
    });

    it('rotatePairingCode POSTs to invite rotate route', async () => {
      await rotatePairingCode({ sessionId: 's1' });
      expect(fetch).toHaveBeenCalledWith(
        `${API_BASE}/api/copilotkit/invite/rotate-pairing?sessionId=${encodeURIComponent('s1')}`,
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('joinRoomByPairingCode POSTs pairing code without session header', async () => {
      await joinRoomByPairingCode({ pairingCode: 'ABCD-1234' });
      expect(fetch).toHaveBeenCalledWith(
        `${API_BASE}/api/copilotkit/join-room`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ pairingCode: 'ABCD-1234' })
        })
      );
    });

    it('throws with server error message on non-OK responses', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => jsonResponse({ error: 'invalid pairing code' }, 400))
      );
      await expect(joinRoomByPairingCode({ pairingCode: 'NOPE' })).rejects.toThrow(
        /400 invalid pairing code/
      );
    });
  });
});
