import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInfographicTransformConstraint } from '../src/infographicTransformPolicy.js';

const BASE =
  'infographic list-row-simple-horizontal-arrow\n' +
  'data\n' +
  '  lists\n' +
  '    - label Step 1\n' +
  '      desc Start\n' +
  '    - label Step 2\n' +
  '      desc Build';

test('refine rejects template change', () => {
  const after = BASE.replace('list-row-simple-horizontal-arrow', 'sequence-steps-simple').replace(
    'lists',
    'sequences'
  );
  const result = validateInfographicTransformConstraint({
    transformMode: 'refine',
    beforeSource: BASE,
    afterSource: after
  });
  if (result.ok) throw new Error('expected not ok');
  assert.match(result.error, /keep template/i);
});

test('refine allows label polish and one new item', () => {
  const after = BASE + '\n    - label Step 3\n' + '      desc Ship';
  const result = validateInfographicTransformConstraint({
    transformMode: 'refine',
    beforeSource: BASE,
    afterSource: after.replace('Step 1', 'Step One')
  });
  assert.equal(result.ok, true);
});

test('barker rejects extra items', () => {
  const after = BASE + '\n    - label Step 3\n' + '      desc Extra';
  const result = validateInfographicTransformConstraint({
    transformMode: 'barker',
    beforeSource: BASE,
    afterSource: after
  });
  if (result.ok) throw new Error('expected not ok');
});

test('goMad tier 2 keeps template', () => {
  const after = BASE.replace(/Step 1/g, 'RFC 9001');
  const result = validateInfographicTransformConstraint({
    transformMode: 'goMad',
    goMadDepth: 2,
    beforeSource: BASE,
    afterSource: after
  });
  assert.equal(result.ok, true);
});

test('goMad tier 3 requires family change', () => {
  const result = validateInfographicTransformConstraint({
    transformMode: 'goMad',
    goMadDepth: 3,
    beforeSource: BASE,
    afterSource: BASE.replace('Step 1', 'RFC 9001')
  });
  if (result.ok) throw new Error('expected not ok');
  assert.match(result.error, /switch template family/i);
});

test('erlich rejects more than four new items', () => {
  const after =
    BASE +
    '\n    - label Step 3\n      desc Vision\n' +
    '    - label Step 4\n      desc Disruption\n' +
    '    - label Step 5\n      desc Aviato\n' +
    '    - label Step 6\n      desc Incubator\n' +
    '    - label Step 7\n      desc Keynote';
  const result = validateInfographicTransformConstraint({
    transformMode: 'erlich',
    beforeSource: BASE,
    afterSource: after
  });
  if (result.ok) throw new Error('expected not ok');
  assert.match(result.error, /Erlich may add at most 4 items/i);
});

test('erlich allows a bolder reshape within the item budget', () => {
  const after =
    BASE +
    '\n    - label Step 3\n      desc Vision\n' +
    '    - label Step 4\n      desc Disruption';
  const result = validateInfographicTransformConstraint({
    transformMode: 'erlich',
    beforeSource: BASE,
    afterSource: after.replace('Step 1', 'Aviato')
  });
  assert.equal(result.ok, true);
});
