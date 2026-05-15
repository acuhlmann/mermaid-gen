import test from 'node:test';
import assert from 'node:assert/strict';

import { createSessionEventBus } from '../src/state/sessionEventBus.js';

test('sessionEventBus waitForEvent resolves on publish', async () => {
  const bus = createSessionEventBus();
  const sessionId = 'wait-test';
  const waitPromise = bus.waitForEvent(sessionId, { sinceSeq: 0, timeoutMs: 2000 });
  bus.publish(sessionId, { type: 'presence_update', payload: [] });
  const envelope = await waitPromise;
  assert.equal(envelope?.type, 'presence_update');
});
