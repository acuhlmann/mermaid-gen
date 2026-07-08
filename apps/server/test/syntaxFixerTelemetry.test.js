import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgentStreamEmitter, AGUI_CUSTOM_NAME_SYNTAX_FIXER } from '@archislop/shared';
import {
  emitSyntaxFixerResult,
  emitSyntaxFixerStart
} from '../src/agents/syntaxFixerTelemetry.js';

test('emitSyntaxFixerStart emits plan beat, phase, and syntax_fixer_start', () => {
  const captured = [];
  const emit = (evt) => captured.push(evt);
  emitSyntaxFixerStart(emit, {
    contentType: 'chart',
    triggerError: 'Vega-Lite compile failed: missing field'
  });
  assert.equal(captured.length, 3);
  assert.equal(captured[0].type, 'plan_beat');
  assert.match(captured[0].text, /quick syntax pass/i);
  assert.equal(captured[1].type, 'phase');
  assert.equal(captured[1].id, 'chart_syntax_fixer');
  assert.equal(captured[2].type, 'syntax_fixer_start');
  assert.equal(captured[2].contentType, 'chart');
  assert.equal(captured[2].triggerError, 'Vega-Lite compile failed: missing field');
});

test('emitSyntaxFixerResult emits syntax_fixer_result envelope', () => {
  const captured = [];
  emitSyntaxFixerResult((evt) => captured.push(evt), {
    contentType: 'chart',
    outcome: 'fixer_failed',
    error: 'Could not repair chart DSL'
  });
  assert.equal(captured.length, 1);
  assert.equal(captured[0].type, 'syntax_fixer_result');
  assert.equal(captured[0].outcome, 'fixer_failed');
  assert.equal(captured[0].error, 'Could not repair chart DSL');
});

test('createAgentStreamEmitter maps syntax_fixer_start to CUSTOM wire event', () => {
  const wire = [];
  const emit = createAgentStreamEmitter({
    rawEmit: (e) => wire.push(e),
    threadId: 'thr',
    runId: 'run',
    contentType: 'chart'
  });
  emit({
    type: 'syntax_fixer_start',
    contentType: 'chart',
    triggerError: 'bad encoding'
  });
  assert.equal(wire.length, 1);
  assert.equal(wire[0].type, 'CUSTOM');
  assert.equal(wire[0].name, AGUI_CUSTOM_NAME_SYNTAX_FIXER);
  assert.equal(wire[0].value.phase, 'start');
});
