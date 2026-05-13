import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAndPrepareInfographicPatch } from '../src/tools/infographicDslTool.js';

const currentState = { revisionId: 0 };

const VALID_LIST_ROW =
  'infographic list-row-simple-horizontal-arrow\n' +
  'data\n' +
  '  lists\n' +
  '    - label Step 1\n' +
  '      desc Start\n' +
  '    - label Step 2\n' +
  '      desc Build';

test('accepts a well-formed list-row infographic', async () => {
  const result = await validateAndPrepareInfographicPatch({
    currentState,
    proposedDiagramSource: VALID_LIST_ROW,
    reason: 'test'
  });
  assert.equal(result.accepted, true);
  assert.equal(result.patch.contentType, 'infographic');
  assert.equal(result.patch.styleConfig, null);
  assert.equal(result.patch.previousRevisionId, 0);
  assert.equal(result.patch.nextRevisionId, 1);
  assert.equal(result.metadata.template, 'list-row-simple-horizontal-arrow');
  assert.equal(result.metadata.validator, 'infographic-parseSyntax');
});

test('accepts a chart-pie template with items shape', async () => {
  const dsl =
    'infographic chart-pie-plain-text\n' +
    'data\n' +
    '  items\n' +
    '    - label Apples\n' +
    '      value 10\n' +
    '    - label Pears\n' +
    '      value 7';
  const result = await validateAndPrepareInfographicPatch({
    currentState,
    proposedDiagramSource: dsl,
    reason: 'test'
  });
  assert.equal(result.accepted, true);
});

test('rejects an empty DSL', async () => {
  const result = await validateAndPrepareInfographicPatch({
    currentState,
    proposedDiagramSource: '   \n   ',
    reason: 'test'
  });
  assert.equal(result.accepted, false);
  assert.match(result.error, /empty/i);
});

test('accepts and normalizes smart quotes', async () => {
  const dsl = VALID_LIST_ROW.replace('Step 1', '“Step 1”');
  const result = await validateAndPrepareInfographicPatch({
    currentState,
    proposedDiagramSource: dsl,
    reason: 'test'
  });
  assert.equal(result.accepted, true);
  assert.ok(result.metadata.sanitizerApplied.includes('smart-quotes-to-ascii'));
  assert.ok(!result.patch.diagramSource.match(/[‘’“”]/));
});

test('accepts and normalizes tabs to spaces', async () => {
  const dsl =
    'infographic list-row-simple-horizontal-arrow\n' +
    'data\n' +
    '\tlists\n' +
    '\t\t- label Step 1\n' +
    '\t\t  desc Start';
  const result = await validateAndPrepareInfographicPatch({
    currentState,
    proposedDiagramSource: dsl,
    reason: 'test'
  });
  assert.equal(result.accepted, true);
  assert.ok(result.metadata.sanitizerApplied.includes('tabs-to-spaces'));
  assert.ok(!result.patch.diagramSource.includes('\t'));
});

test('strips fenced code blocks around the DSL', async () => {
  const dsl = '```infographic\n' + VALID_LIST_ROW + '\n```';
  const result = await validateAndPrepareInfographicPatch({
    currentState,
    proposedDiagramSource: dsl,
    reason: 'test'
  });
  assert.equal(result.accepted, true);
  assert.ok(result.metadata.sanitizerApplied.includes('strip-code-fence'));
});

test('strips leading prose before the infographic header', async () => {
  const dsl = 'Here is your update:\n\n' + VALID_LIST_ROW;
  const result = await validateAndPrepareInfographicPatch({
    currentState,
    proposedDiagramSource: dsl,
    reason: 'test'
  });
  assert.equal(result.accepted, true);
  assert.ok(result.metadata.sanitizerApplied.includes('strip-leading-prose'));
});

test('rejects a header that is not "infographic <template>"', async () => {
  const result = await validateAndPrepareInfographicPatch({
    currentState,
    proposedDiagramSource: 'list-row-simple-horizontal-arrow\n  data',
    reason: 'test'
  });
  assert.equal(result.accepted, false);
  assert.match(result.error, /First non-blank line/);
});

test('rejects an unknown template name and suggests siblings from the family', async () => {
  const result = await validateAndPrepareInfographicPatch({
    currentState,
    proposedDiagramSource: 'infographic list-made-up-template\n  data',
    reason: 'test'
  });
  assert.equal(result.accepted, false);
  assert.match(result.error, /Unknown template "list-made-up-template"/);
  assert.match(result.error, /Did you mean/);
});

test('parseSyntax rejects bad structure (unknown top-level keys)', async () => {
  const dsl =
    'infographic list-row-simple-horizontal-arrow\n' +
    '  title Sun\n' +
    '  content The Sun is a star.';
  const result = await validateAndPrepareInfographicPatch({
    currentState,
    proposedDiagramSource: dsl,
    reason: 'test'
  });
  assert.equal(result.accepted, false);
  assert.match(result.error, /parser rejected/i);
});

test('uses the current revisionId to compute next revisionId', async () => {
  const result = await validateAndPrepareInfographicPatch({
    currentState: { revisionId: 5 },
    proposedDiagramSource: VALID_LIST_ROW,
    reason: 'test'
  });
  assert.equal(result.accepted, true);
  assert.equal(result.patch.previousRevisionId, 5);
  assert.equal(result.patch.nextRevisionId, 6);
});
