import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgentStreamEmitter } from '../src/agentStreamEmitter.js';
import { AGUI_CUSTOM_NAME_A2UI, AGUI_CUSTOM_NAME_PLAN_BEAT } from '../src/agUiWireConstants.js';

test('createAgentStreamEmitter emit.planBeat maps to CUSTOM plan_beat', () => {
  const captured: Array<Record<string, unknown>> = [];
  const emit = createAgentStreamEmitter({
    rawEmit: (e) => captured.push(e),
    threadId: 'thr_test',
    runId: 'run_test',
    contentType: 'mermaid'
  });
  emit.planBeat('Adding an auth boundary for the login flow.', 'agent');
  assert.equal(captured.length, 1);
  assert.equal(captured[0].type, 'CUSTOM');
  assert.equal(captured[0].name, AGUI_CUSTOM_NAME_PLAN_BEAT);
  assert.equal(
    (captured[0].value as Record<string, unknown>).text,
    'Adding an auth boundary for the login flow.'
  );
  assert.equal((captured[0].value as Record<string, unknown>).source, 'agent');
});

test('createAgentStreamEmitter emit.a2ui maps to CUSTOM a2ui', () => {
  const captured: Array<Record<string, unknown>> = [];
  const emit = createAgentStreamEmitter({
    rawEmit: (e) => captured.push(e),
    threadId: 'thr_test',
    runId: 'run_test',
    contentType: 'mermaid'
  });
  const messages = [{ op: 'test' }];
  emit.a2ui(messages);
  assert.equal(captured.length, 1);
  assert.equal(captured[0].type, 'CUSTOM');
  assert.equal(captured[0].name, AGUI_CUSTOM_NAME_A2UI);
  assert.deepEqual((captured[0].value as Record<string, unknown>).messages, messages);
});

test('createAgentStreamEmitter passes through AG-UI wire events', () => {
  const captured: Array<Record<string, unknown>> = [];
  const emit = createAgentStreamEmitter({
    rawEmit: (e) => captured.push(e),
    threadId: 'thr_test',
    runId: 'run_test',
    contentType: 'mermaid'
  });
  emit({ type: 'RUN_ERROR', message: 'boom' });
  assert.equal(captured[0].type, 'RUN_ERROR');
  assert.equal(captured[0].message, 'boom');
});

test('createAgentStreamEmitter suppresses events after legacy error → final pair', () => {
  // Mirrors the transform/Go Mad failure path: emit `error` (which sends RUN_ERROR), then
  // still emit `final`. The legacy `final` handler tries to send STATE_DELTA / STATE_SNAPSHOT /
  // RUN_FINISHED — all of which the AG-UI client verifier rejects after RUN_ERROR.
  const captured: Array<Record<string, unknown>> = [];
  const emit = createAgentStreamEmitter({
    rawEmit: (e) => captured.push(e),
    threadId: 'thr_test',
    runId: 'run_test',
    contentType: 'mermaid'
  });
  emit({ type: 'error', message: 'no patch', code: 'no_mutation_revision' });
  emit({ type: 'final', revisionChanged: false, message: '' });
  emit({ type: 'token', text: 'late' });

  const errIdx = captured.findIndex((e) => e.type === 'RUN_ERROR');
  assert.ok(errIdx >= 0, 'should emit RUN_ERROR');
  // Nothing after RUN_ERROR should leak through.
  for (let i = errIdx + 1; i < captured.length; i++) {
    assert.fail(`Unexpected event after RUN_ERROR: ${captured[i].type}`);
  }
});
