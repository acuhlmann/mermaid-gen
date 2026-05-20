import test from 'node:test';
import assert from 'node:assert/strict';
import { refineInfographicDsl } from '../src/infographicRefinePrepass.js';

const DSL =
  'infographic list-row-simple-horizontal-arrow\n' +
  'data\n' +
  '  lists\n' +
  '    - label   Step 1  \n' +
  '      desc Start here.\n';

test('refineInfographicDsl trims label and desc whitespace', () => {
  const { dsl, applied } = refineInfographicDsl(DSL);
  assert.ok(applied.includes('trim-labels'));
  assert.match(dsl, /label Step 1/);
  assert.doesNotMatch(dsl, /label   Step/);
});

test('refineInfographicDsl leaves template line untouched', () => {
  const { dsl } = refineInfographicDsl(DSL);
  assert.match(dsl, /^infographic list-row-simple-horizontal-arrow/m);
});
