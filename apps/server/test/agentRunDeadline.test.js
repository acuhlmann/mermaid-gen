import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { createRunDeadlineSignal } from '../src/agents/_lib/agentRunDeadline.js';

// Note: AbortSignal.timeout timers are unref'd, so tests wait with a ref'd delay
// instead of listening for the abort event (which would let the event loop drain).

test('createRunDeadlineSignal aborts once the budget elapses', async () => {
  const signal = createRunDeadlineSignal({ budgetMs: 20 });
  assert.equal(signal.aborted, false);
  await delay(80);
  assert.equal(signal.aborted, true);
});

test('createRunDeadlineSignal aborts immediately for an already-spent budget', async () => {
  const signal = createRunDeadlineSignal({ budgetMs: 50, startedAt: Date.now() - 10_000 });
  await delay(40);
  assert.equal(signal.aborted, true);
});

test('createRunDeadlineSignal propagates the caller abort before the deadline', () => {
  const controller = new AbortController();
  const signal = createRunDeadlineSignal({ abortSignal: controller.signal, budgetMs: 60_000 });
  assert.equal(signal.aborted, false);
  controller.abort();
  assert.equal(signal.aborted, true);
});

test('createRunDeadlineSignal leaves the caller signal untouched on deadline abort', async () => {
  const controller = new AbortController();
  const signal = createRunDeadlineSignal({ abortSignal: controller.signal, budgetMs: 20 });
  await delay(80);
  assert.equal(signal.aborted, true);
  assert.equal(controller.signal.aborted, false);
});
