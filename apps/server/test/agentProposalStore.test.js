import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgentProposalStore } from '../src/state/agentProposalStore.js';

const ORIGIN = {
  kind: 'external-agent',
  agentId: 'agent-1',
  agentName: 'Cursor',
  color: '#f97316',
  emoji: '🦊'
};

function fixture(overrides = {}) {
  return {
    sessionId: 'session-1',
    origin: ORIGIN,
    contentType: 'mermaid',
    baseRevisionId: 0,
    diagramSource: 'graph TD; A-->B;',
    reason: 'hello',
    ...overrides
  };
}

test('create returns a unique pending proposal', () => {
  const store = createAgentProposalStore();
  const p1 = store.create(fixture());
  const p2 = store.create(fixture({ reason: 'second' }));
  assert.notEqual(p1.proposalId, p2.proposalId);
  assert.equal(p1.status, 'pending');
});

test('listPending hides proposals whose baseRevisionId is behind the current slot', () => {
  const store = createAgentProposalStore();
  const fresh = store.create(fixture({ baseRevisionId: 2 }));
  const stale = store.create(fixture({ baseRevisionId: 0 }));
  const pending = store.listPending({
    currentRevisionByContentType: { mermaid: 2, infographic: 0 }
  });
  const ids = pending.map((p) => p.proposalId);
  assert.ok(ids.includes(fresh.proposalId));
  assert.ok(!ids.includes(stale.proposalId));
  assert.equal(store.get(stale.proposalId).status, 'stale');
});

test('markAccepted transitions only pending proposals', () => {
  const store = createAgentProposalStore();
  const p = store.create(fixture());
  assert.ok(store.markAccepted(p.proposalId));
  assert.equal(store.get(p.proposalId).status, 'accepted');
  assert.equal(store.markAccepted(p.proposalId), null);
});

test('waitForResolution resolves when the proposal is accepted', async () => {
  const store = createAgentProposalStore();
  const p = store.create(fixture());
  const pending = store.waitForResolution(p.proposalId, { timeoutMs: 1000 });
  store.markAccepted(p.proposalId);
  const result = await pending;
  assert.equal(result.status, 'accepted');
});

test('listByAgent returns proposals for matching agentId', () => {
  const store = createAgentProposalStore();
  const mine = store.create(fixture({ reason: 'mine' }));
  store.create(
    fixture({
      reason: 'other',
      origin: { ...ORIGIN, agentId: 'agent-2', agentName: 'Other' }
    })
  );
  store.markAccepted(mine.proposalId);
  const listed = store.listByAgent('agent-1', { includeResolved: true, limit: 10 });
  assert.equal(listed.length, 1);
  assert.equal(listed[0].proposalId, mine.proposalId);
  assert.equal(listed[0].status, 'accepted');
});

test('listByAgent excludes resolved when includeResolved is false', () => {
  const store = createAgentProposalStore();
  const p = store.create(fixture());
  store.markAccepted(p.proposalId);
  const pendingOnly = store.listByAgent('agent-1', { includeResolved: false });
  assert.equal(pendingOnly.length, 0);
});

test('waitForResolution times out cleanly without hanging the test', async () => {
  const store = createAgentProposalStore();
  const p = store.create(fixture());
  const result = await store.waitForResolution(p.proposalId, { timeoutMs: 30 });
  assert.equal(result.status, 'timeout');
});
