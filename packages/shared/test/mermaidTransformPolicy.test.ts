import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isMermaidTransformConstraintError,
  validateMermaidTransformConstraint
} from '../src/mermaidTransformPolicy.js';

const BUSY_FLOW =
  'flowchart TD\n' +
  '  A[Acquire] --> B[Build]\n' +
  '  B --> C[Test]\n' +
  '  C --> D[Ship]\n' +
  '  D --> E[Operate]\n' +
  '  E --> F[Retire]';

test('exec rejects added nodes', () => {
  const after = `${BUSY_FLOW}\n  F --> G[Extra]`;
  const result = validateMermaidTransformConstraint({
    transformMode: 'exec',
    beforeSource: BUSY_FLOW,
    afterSource: after
  });
  assert.equal(result.ok, false);
  assert.match(result.error, /subtractive only/i);
});

test('exec rejects relabel-only on large diagrams', () => {
  const after = BUSY_FLOW.replace(/Acquire/g, 'Buy');
  const result = validateMermaidTransformConstraint({
    transformMode: 'exec',
    beforeSource: BUSY_FLOW,
    afterSource: after
  });
  assert.equal(result.ok, false);
  assert.match(result.error, /remove nodes or edges/i);
});

test('exec accepts merge that drops nodes', () => {
  const after =
    'flowchart TD\n' +
    '  A[Acquire] --> B[Build]\n' +
    '  B --> C[Ship]\n' +
    '  C --> D[Operate]';
  const result = validateMermaidTransformConstraint({
    transformMode: 'exec',
    beforeSource: BUSY_FLOW,
    afterSource: after
  });
  assert.equal(result.ok, true);
});

test('exec allows label tighten on small diagrams', () => {
  const before = 'flowchart TD\n  A[Start] --> B[End]';
  const after = 'flowchart TD\n  A[Go] --> B[Done]';
  const result = validateMermaidTransformConstraint({
    transformMode: 'exec',
    beforeSource: before,
    afterSource: after
  });
  assert.equal(result.ok, true);
});

test('isMermaidTransformConstraintError detects policy failures', () => {
  assert.equal(isMermaidTransformConstraintError('Executive simplify is subtractive only'), true);
  assert.equal(isMermaidTransformConstraintError('not valid mermaid'), false);
});
