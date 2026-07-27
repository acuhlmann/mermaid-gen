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

test('barker rejects added nodes', () => {
  const after = `${BUSY_FLOW}\n  F --> G[Extra]`;
  const result = validateMermaidTransformConstraint({
    transformMode: 'barker',
    beforeSource: BUSY_FLOW,
    afterSource: after
  });
  if (result.ok) throw new Error('expected not ok');
  assert.match(result.error, /subtractive only/i);
});

test('barker rejects relabel-only on large diagrams', () => {
  const after = BUSY_FLOW.replace(/Acquire/g, 'Buy');
  const result = validateMermaidTransformConstraint({
    transformMode: 'barker',
    beforeSource: BUSY_FLOW,
    afterSource: after
  });
  if (result.ok) throw new Error('expected not ok');
  assert.match(result.error, /remove nodes or edges/i);
});

test('barker accepts merge that drops nodes', () => {
  const after =
    'flowchart TD\n' + '  A[Acquire] --> B[Build]\n' + '  B --> C[Ship]\n' + '  C --> D[Operate]';
  const result = validateMermaidTransformConstraint({
    transformMode: 'barker',
    beforeSource: BUSY_FLOW,
    afterSource: after
  });
  assert.equal(result.ok, true);
});

test('barker allows label tighten on small diagrams', () => {
  const before = 'flowchart TD\n  A[Start] --> B[End]';
  const after = 'flowchart TD\n  A[Go] --> B[Done]';
  const result = validateMermaidTransformConstraint({
    transformMode: 'barker',
    beforeSource: before,
    afterSource: after
  });
  assert.equal(result.ok, true);
});

test('isMermaidTransformConstraintError detects policy failures', () => {
  assert.equal(isMermaidTransformConstraintError('Executive simplify is subtractive only'), true);
  assert.equal(isMermaidTransformConstraintError('not valid mermaid'), false);
});

/*
 * Dinesh is a gilfoyle-class seat (docs/recipes/replicate-tv-character.md): the
 * two engineers deliberately share one branch, so the budget is asserted on the
 * new id directly. If someone ever retunes them apart, these fail first.
 */
test('dinesh shares the gilfoyle node budget', () => {
  const withinBudget = `${BUSY_FLOW}\n  F --> G[Extra]\n  G --> H[More]`;
  assert.equal(
    validateMermaidTransformConstraint({
      transformMode: 'dinesh',
      beforeSource: BUSY_FLOW,
      afterSource: withinBudget
    }).ok,
    true
  );

  const overBudget = `${BUSY_FLOW}\n  F --> G1[a]\n  G1 --> G2[b]\n  G2 --> G3[c]\n  G3 --> G4[d]\n  G4 --> G5[e]`;
  const result = validateMermaidTransformConstraint({
    transformMode: 'dinesh',
    beforeSource: BUSY_FLOW,
    afterSource: overBudget
  });
  if (result.ok) throw new Error('expected not ok');
  assert.match(result.error, /may add at most/i);
  // The constraint message stays generic — the retry regex keys off the phrase,
  // never the persona word.
  assert.equal(isMermaidTransformConstraintError(result.error), true);
});

test('dinesh keeps the diagram type locked, like gilfoyle', () => {
  const result = validateMermaidTransformConstraint({
    transformMode: 'dinesh',
    beforeSource: BUSY_FLOW,
    afterSource: 'sequenceDiagram\n  A->>B: hi'
  });
  if (result.ok) throw new Error('expected not ok');
  assert.match(result.error, /must keep diagram type/i);
});

/*
 * Erlich's budget is the widest of the transform seats and had NO test on main:
 * PR #233 added these, then Sessions 3-4 overwrote the same region with the
 * gilfoyle/dinesh cases. Ported back so a widened cap cannot pass silently.
 */
test('erlich rejects runaway node growth', () => {
  const extra =
    '  F --> G1\n  G1 --> G2\n  G2 --> G3\n  G3 --> G4\n  G4 --> G5\n' +
    '  G5 --> G6\n  G6 --> G7\n  G7 --> G8\n  G8 --> G9\n  G9 --> G10\n  G10 --> G11';
  const after = `${BUSY_FLOW}\n${extra}`;
  const result = validateMermaidTransformConstraint({
    transformMode: 'erlich',
    beforeSource: BUSY_FLOW,
    afterSource: after
  });
  if (result.ok) throw new Error('expected not ok');
  assert.match(result.error, /Erlich may add at most 10 nodes/i);
});

test('erlich accepts bold restructuring within node and edge budgets', () => {
  const after =
    'flowchart TD\n' +
    '  A[Acquire] --> B[Build]\n' +
    '  B --> C[Test]\n' +
    '  C --> D[Ship]\n' +
    '  D --> E[Operate]\n' +
    '  E --> F[Retire]\n' +
    '  F --> G[Vision]\n' +
    '  G --> H[Disruption]';
  const result = validateMermaidTransformConstraint({
    transformMode: 'erlich',
    beforeSource: BUSY_FLOW,
    afterSource: after
  });
  assert.equal(result.ok, true);
});
