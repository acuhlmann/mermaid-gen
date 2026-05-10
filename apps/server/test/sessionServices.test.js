import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSessionServicesRegistry,
  resolveSessionIdFromCopilotInput,
  resolveSessionIdFromRequest
} from '../src/state/sessionServices.js';

test('resolveSessionIdFromRequest prefers x-session-id header', () => {
  const sessionId = resolveSessionIdFromRequest({
    headers: { 'x-session-id': 'browser-123' },
    query: { sessionId: 'fallback' }
  });

  assert.equal(sessionId, 'browser-123');
});

test('resolveSessionIdFromRequest falls back to query keys', () => {
  assert.equal(resolveSessionIdFromRequest({ query: { sessionId: 'query-session' } }), 'query-session');
  assert.equal(resolveSessionIdFromRequest({ query: { threadId: 'thread-session' } }), 'thread-session');
});

test('resolveSessionIdFromCopilotInput reads threadId', () => {
  assert.equal(resolveSessionIdFromCopilotInput({ threadId: 'thread-1' }), 'thread-1');
  assert.equal(resolveSessionIdFromCopilotInput({}), 'default');
});

test('session registry isolates state per session id', async () => {
  const registry = createSessionServicesRegistry({
    env: {
      OPENROUTER_API_KEY: ''
    }
  });

  const alpha = registry.getSessionServices('alpha');
  const beta = registry.getSessionServices('beta');

  assert.notEqual(alpha.stateStore, beta.stateStore);
  assert.equal(alpha.stateStore.getState().revisionId, 0);
  assert.equal(beta.stateStore.getState().revisionId, 0);

  const alphaUpdate = await alpha.stateStore.syncClientMermaidSource({
    mermaidSource: 'flowchart TD\n  A --> B'
  });

  assert.equal(alphaUpdate.accepted, true);
  assert.equal(alpha.stateStore.getState().revisionId, 1);
  assert.equal(beta.stateStore.getState().revisionId, 0);
});
