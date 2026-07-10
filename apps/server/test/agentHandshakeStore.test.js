import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAgentHandshakeStore,
  AGENT_COLOR_PALETTE
} from '../src/state/agentHandshakeStore.js';

test('createRequest auto-assigns a color from the palette if none provided', () => {
  const store = createAgentHandshakeStore();
  const req = store.createRequest({ sessionId: 's1', proposedName: 'Cursor' });
  assert.ok(AGENT_COLOR_PALETTE.includes(req.proposedColor));
  assert.equal(req.status, 'pending');
});

test('approveRequest produces an agent and marks the request approved', async () => {
  const store = createAgentHandshakeStore();
  const req = store.createRequest({ sessionId: 's1', proposedName: 'Cursor' });
  const waiter = store.waitForResolution(req.requestId, { timeoutMs: 200 });
  const agent = store.approveRequest(req.requestId);
  assert.ok(agent.agentId);
  assert.equal(agent.agentName, 'Cursor');
  const resolution = await waiter;
  assert.equal(resolution.status, 'approved');
  assert.equal(resolution.agent.agentId, agent.agentId);
  assert.ok(store.isApproved(agent.agentId));
});

test('denyRequest marks the request denied and resolves waiters', async () => {
  const store = createAgentHandshakeStore();
  const req = store.createRequest({ sessionId: 's1', proposedName: 'Cursor' });
  const waiter = store.waitForResolution(req.requestId, { timeoutMs: 200 });
  assert.equal(store.denyRequest(req.requestId), true);
  const resolution = await waiter;
  assert.equal(resolution.status, 'denied');
});

test('waitForResolution returns pending on timeout without rejecting', async () => {
  const store = createAgentHandshakeStore();
  const req = store.createRequest({ sessionId: 's1', proposedName: 'Cursor' });
  const result = await store.waitForResolution(req.requestId, { timeoutMs: 30 });
  assert.equal(result.status, 'pending');
});
