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

test('gilfoyle rejects template change', () => {
  const after = BASE.replace('list-row-simple-horizontal-arrow', 'sequence-steps-simple').replace(
    'lists',
    'sequences'
  );
  const result = validateInfographicTransformConstraint({
    transformMode: 'gilfoyle',
    beforeSource: BASE,
    afterSource: after
  });
  if (result.ok) throw new Error('expected not ok');
  assert.match(result.error, /keep template/i);
});

test('gilfoyle allows label polish and one new item', () => {
  const after = BASE + '\n    - label Step 3\n' + '      desc Ship';
  const result = validateInfographicTransformConstraint({
    transformMode: 'gilfoyle',
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

test('russ tier 2 keeps template', () => {
  const after = BASE.replace(/Step 1/g, 'RFC 9001');
  const result = validateInfographicTransformConstraint({
    transformMode: 'russ',
    russDepth: 2,
    beforeSource: BASE,
    afterSource: after
  });
  assert.equal(result.ok, true);
});

test('russ tier 3 requires family change', () => {
  const result = validateInfographicTransformConstraint({
    transformMode: 'russ',
    russDepth: 3,
    beforeSource: BASE,
    afterSource: BASE.replace('Step 1', 'RFC 9001')
  });
  if (result.ok) throw new Error('expected not ok');
  assert.match(result.error, /switch template family/i);
});

/* Dinesh clones the gilfoyle item budget and template lock (same branch). */
test('dinesh shares the gilfoyle item budget and template lock', () => {
  const oneMore = BASE + '\n    - label Step 3\n' + '      desc Ship';
  assert.equal(
    validateInfographicTransformConstraint({
      transformMode: 'dinesh',
      beforeSource: BASE,
      afterSource: oneMore
    }).ok,
    true
  );

  const templateSwitch = BASE.replace(
    'list-row-simple-horizontal-arrow',
    'sequence-steps-simple'
  ).replace('lists', 'sequences');
  const result = validateInfographicTransformConstraint({
    transformMode: 'dinesh',
    beforeSource: BASE,
    afterSource: templateSwitch
  });
  if (result.ok) throw new Error('expected not ok');
  assert.match(result.error, /keep template/i);
});

/*
 * Erlich's budget is the widest of the transform seats and had NO test on main:
 * PR #233 added these, then Sessions 3-4 overwrote the same region with the
 * gilfoyle/dinesh cases. Ported back so a widened cap cannot pass silently.
 */
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
