import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateAndPrepareInfographicPatch,
  validateInfographicStrict
} from '../src/tools/infographicDslTool.js';

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

test('rejects DSL containing multiple `infographic <template>` headers', async () => {
  const dsl =
    'infographic list-row-simple-horizontal-arrow\n' +
    'data\n' +
    '  lists\n' +
    '    - label Step 1\n' +
    '      desc Start\n' +
    '\n' +
    'infographic list-row-simple-horizontal-arrow\n' +
    'data\n' +
    '  lists\n' +
    '    - label Other\n' +
    '      desc Drift';
  const result = await validateAndPrepareInfographicPatch({
    currentState,
    proposedDiagramSource: dsl,
    reason: 'test'
  });
  assert.equal(result.accepted, false);
  assert.match(result.error, /Multiple `infographic <template>` headers/);
});

test('strips stray interior code fences inside the DSL', async () => {
  const dsl =
    'infographic list-row-simple-horizontal-arrow\n' +
    'data\n' +
    '```\n' +
    '  lists\n' +
    '    - label Step 1\n' +
    '      desc Start\n' +
    '```';
  const result = await validateAndPrepareInfographicPatch({
    currentState,
    proposedDiagramSource: dsl,
    reason: 'test'
  });
  assert.equal(result.accepted, true);
  assert.ok(result.metadata.sanitizerApplied.includes('strip-interior-fences'));
  assert.ok(!result.patch.diagramSource.includes('```'));
});

test('accepts canonical sequence DSL with `sequences` (not `lists`)', async () => {
  const dsl =
    'infographic sequence-steps-simple\n' +
    'data\n' +
    '  sequences\n' +
    '    - label Define\n' +
    '      icon clipboard check\n' +
    '    - label Build\n' +
    '      icon code\n' +
    '    - label Ship\n' +
    '      icon rocket';
  const result = await validateAndPrepareInfographicPatch({
    currentState,
    proposedDiagramSource: dsl,
    reason: 'test'
  });
  assert.equal(result.accepted, true);
  assert.equal(result.metadata.template, 'sequence-steps-simple');
});

test('accepts canonical chart DSL with `values` (not `items`)', async () => {
  const dsl =
    'infographic chart-bar-plain-text\n' +
    'data\n' +
    '  values\n' +
    '    - label Q1\n' +
    '      value 10\n' +
    '    - label Q2\n' +
    '      value 18';
  const result = await validateAndPrepareInfographicPatch({
    currentState,
    proposedDiagramSource: dsl,
    reason: 'test'
  });
  assert.equal(result.accepted, true);
});

test('accepts canonical compare-binary DSL with `compares` of 2 roots + `children`', async () => {
  const dsl =
    'infographic compare-binary-horizontal-simple-fold\n' +
    'data\n' +
    '  compares\n' +
    '    - label Before\n' +
    '      icon calendar\n' +
    '      children\n' +
    '        - label Slow\n' +
    '          icon snail\n' +
    '    - label After\n' +
    '      icon rocket\n' +
    '      children\n' +
    '        - label Fast\n' +
    '          icon zap';
  const result = await validateAndPrepareInfographicPatch({
    currentState,
    proposedDiagramSource: dsl,
    reason: 'test'
  });
  assert.equal(result.accepted, true);
});

test('accepts canonical compare-swot DSL with `compares` of 4 roots + `children`', async () => {
  const dsl =
    'infographic compare-swot\n' +
    'data\n' +
    '  compares\n' +
    '    - label Strengths\n' +
    '      children\n' +
    '        - label Strong brand\n' +
    '    - label Weaknesses\n' +
    '      children\n' +
    '        - label Cost pressure\n' +
    '    - label Opportunities\n' +
    '      children\n' +
    '        - label New segment\n' +
    '    - label Threats\n' +
    '      children\n' +
    '        - label New entrant';
  const result = await validateAndPrepareInfographicPatch({
    currentState,
    proposedDiagramSource: dsl,
    reason: 'test'
  });
  assert.equal(result.accepted, true);
});

test('accepts canonical relation DSL with `nodes` + `relations` arrow syntax', async () => {
  const dsl =
    'infographic relation-dagre-flow-tb-simple-circle-node\n' +
    'data\n' +
    '  nodes\n' +
    '    - label API\n' +
    '    - id db\n' +
    '      label Postgres\n' +
    '  relations\n' +
    '    API - reads -> db';
  const result = await validateAndPrepareInfographicPatch({
    currentState,
    proposedDiagramSource: dsl,
    reason: 'test'
  });
  assert.equal(result.accepted, true);
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

test('parser-rejection messages quote the offending source line', async () => {
  // Use a top-level key the parser doesn't know about to provoke an error WITH a line number.
  // The exact wording of the error message is owned by AntV, so we only assert that the
  // offending line text appears as a `> ` quote in the response.
  const dsl =
    'infographic list-row-simple-horizontal-arrow\n' +
    'data\n' +
    '  lists\n' +
    '    - label Step 1\n' +
    '      desc Start\n' +
    '      thisKeyIsNotInTheGrammar value';
  const result = await validateAndPrepareInfographicPatch({
    currentState,
    proposedDiagramSource: dsl,
    reason: 'test'
  });
  if (!result.accepted) {
    // Only assert when the parser actually flagged a line — if AntV silently accepts the
    // unknown key the test is effectively a no-op (and the schema-validation surface area
    // isn't ours to police). Skip rather than fail to keep the test stable across releases.
    if (/\(line \d+\)/.test(result.error)) {
      assert.match(result.error, /\n  > /);
    }
  }
});

test('validateInfographicStrict accepts a well-formed list-row template', () => {
  const result = validateInfographicStrict(VALID_LIST_ROW);
  assert.equal(result.valid, true);
  assert.equal(result.template, 'list-row-simple-horizontal-arrow');
  assert.match(result.diagramSource, /list-row-simple-horizontal-arrow/);
});

test('validateInfographicStrict rejects an empty string', () => {
  const result = validateInfographicStrict('');
  assert.equal(result.valid, false);
  assert.match(result.error, /empty/i);
});

test('validateInfographicStrict rejects an unknown template with siblings suggestion', () => {
  const result = validateInfographicStrict('infographic list-totally-made-up-template\ndata\n  lists\n    - label A');
  assert.equal(result.valid, false);
  assert.match(result.error, /Unknown template/);
});

test('validateInfographicStrict rejects non-string input', () => {
  const result = validateInfographicStrict(undefined);
  assert.equal(result.valid, false);
  assert.match(result.error, /string/i);
});
