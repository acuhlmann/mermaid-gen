import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgentPresenceStore } from '../src/state/agentPresenceStore.js';

const AGENT = {
  agentId: 'a1',
  agentName: 'Cursor',
  color: '#f97316',
  emoji: '🦊',
  focus: null
};

test('upsert adds and updates an agent, list returns all current agents', () => {
  const store = createAgentPresenceStore();
  store.upsert(AGENT);
  store.upsert({ ...AGENT, focus: { contentType: 'mermaid', nodeId: 'N1', label: 'Node 1' } });
  const list = store.list();
  assert.equal(list.length, 1);
  assert.equal(list[0].focus.nodeId, 'N1');
});

test('remove drops an agent from presence', () => {
  const store = createAgentPresenceStore();
  store.upsert(AGENT);
  assert.equal(store.remove('a1'), true);
  assert.equal(store.list().length, 0);
});

test('touch updates lastSeenAt without changing focus', () => {
  const store = createAgentPresenceStore();
  store.upsert({ ...AGENT, focus: { contentType: 'mermaid', nodeId: 'N1' } });
  const before = store.get('a1').lastSeenAt;
  return new Promise((resolve) => {
    setTimeout(() => {
      store.touch('a1');
      const after = store.get('a1');
      assert.ok(after.lastSeenAt >= before);
      assert.equal(after.focus?.nodeId, 'N1');
      resolve();
    }, 10);
  });
});
