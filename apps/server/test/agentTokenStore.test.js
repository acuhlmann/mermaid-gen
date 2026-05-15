import test from 'node:test';
import assert from 'node:assert/strict';

import { createAgentTokenStore } from '../src/state/agentTokenStore.js';

test('agentTokenStore issue verify and mcp binding', () => {
  const store = createAgentTokenStore();
  const token = store.issue({
    sessionId: 'sess-1',
    agentId: 'agent-1',
    mcpSessionId: 'mcp-a'
  });
  const verified = store.verify(token);
  assert.equal(verified?.sessionId, 'sess-1');
  assert.equal(verified?.agentId, 'agent-1');
  assert.ok(store.verifyMcpBinding('sess-1', 'agent-1', 'mcp-a'));
  assert.equal(store.verifyMcpBinding('sess-1', 'agent-1', 'mcp-b'), false);
});
