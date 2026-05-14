import test from 'node:test';
import assert from 'node:assert/strict';
import { repairInfographicWithFixer } from '../src/agents/infographicSyntaxFixer.js';

const VALID_LIST_DSL =
  'infographic list-row-simple-horizontal-arrow\n' +
  'data\n' +
  '  lists\n' +
  '    - label Step 1\n' +
  '      desc Start\n' +
  '    - label Step 2\n' +
  '      desc Build';

function fakeModel(responseText) {
  return {
    async invoke() {
      return { content: responseText };
    }
  };
}

function fakeModelFromMessages(spy) {
  return {
    async invoke(messages) {
      spy.lastMessages = messages;
      return { content: spy.responseText ?? '' };
    }
  };
}

test('repairInfographicWithFixer accepts model output that passes validateInfographicStrict', async () => {
  const result = await repairInfographicWithFixer({
    brokenSource: 'infographic list-row-simple-horizontal-arrow\ndata\n  lists\n    - label A',
    parseError: 'parser rejected',
    modelOverride: fakeModel(`\`\`\`\n${VALID_LIST_DSL}\n\`\`\``)
  });
  assert.equal(result.accepted, true);
  assert.match(result.diagramSource, /list-row-simple-horizontal-arrow/);
  assert.equal(result.metadata.validator, 'infographic-syntax-fixer');
});

test('repairInfographicWithFixer handles unfenced model output', async () => {
  const result = await repairInfographicWithFixer({
    brokenSource: 'infographic list-row-simple-horizontal-arrow\ndata\n  lists\n    - label A',
    parseError: 'parser rejected',
    modelOverride: fakeModel(VALID_LIST_DSL)
  });
  assert.equal(result.accepted, true);
  assert.match(result.diagramSource, /Step 1/);
});

test('repairInfographicWithFixer rejects when model output still fails validation', async () => {
  const result = await repairInfographicWithFixer({
    brokenSource: 'infographic list-row-simple-horizontal-arrow\ndata\n  lists\n    - label A',
    parseError: 'parser rejected',
    modelOverride: fakeModel('```\ninfographic totally-fake-template\ndata\n  lists\n    - label A\n```')
  });
  assert.equal(result.accepted, false);
  assert.match(String(result.error), /Unknown template|parser/i);
});

test('repairInfographicWithFixer reports empty output', async () => {
  const result = await repairInfographicWithFixer({
    brokenSource: 'infographic list-row-simple-horizontal-arrow\ndata\n  lists\n    - label A',
    parseError: 'parser rejected',
    modelOverride: fakeModel('')
  });
  assert.equal(result.accepted, false);
  assert.match(String(result.error), /empty/i);
});

test('repairInfographicWithFixer reports model exceptions as accepted:false', async () => {
  const model = {
    async invoke() {
      throw new Error('rate limited');
    }
  };
  const result = await repairInfographicWithFixer({
    brokenSource: VALID_LIST_DSL,
    parseError: 'something',
    modelOverride: model
  });
  assert.equal(result.accepted, false);
  assert.match(String(result.error), /rate limited/);
});

test('repairInfographicWithFixer rejects when broken source is empty', async () => {
  const result = await repairInfographicWithFixer({
    brokenSource: '',
    parseError: 'irrelevant',
    modelOverride: fakeModel(VALID_LIST_DSL)
  });
  assert.equal(result.accepted, false);
  assert.match(String(result.error), /No broken source/i);
});

test('repairInfographicWithFixer reports missing model gracefully', async () => {
  const result = await repairInfographicWithFixer({
    brokenSource: VALID_LIST_DSL,
    parseError: 'parser',
    env: {},
    modelOverride: null
  });
  assert.equal(result.accepted, false);
  assert.match(String(result.error), /not configured/i);
});

test('repairInfographicWithFixer includes the rule pack, error, and original request in its prompt', async () => {
  const spy = { responseText: `\`\`\`\n${VALID_LIST_DSL}\n\`\`\`` };
  await repairInfographicWithFixer({
    brokenSource: 'infographic list-row-simple-horizontal-arrow\ndata\n  lists\n    - label A',
    parseError: 'AntV parser rejected: missing data field',
    originalRequest: 'Show our release workflow as a row of steps',
    modelOverride: fakeModelFromMessages(spy)
  });
  const human = spy.lastMessages[spy.lastMessages.length - 1];
  const content = typeof human.content === 'string' ? human.content : '';
  assert.match(content, /AntV parser rejected: missing data field/);
  assert.match(content, /Show our release workflow/);
  assert.match(content, /Output the corrected DSL/i);
});

test('repairInfographicWithFixer is tool-less (no `tools` arg passed to model)', async () => {
  // Confirms we invoke the model with [SystemMessage, HumanMessage] only — never a tools array,
  // never a runnable with bound tools. If invoke is ever called with a second argument the
  // assertion below trips.
  let invokeCallCount = 0;
  let invokeSecondArg = 'unset';
  const model = {
    async invoke(_messages, secondArg) {
      invokeCallCount += 1;
      invokeSecondArg = secondArg;
      return { content: `\`\`\`\n${VALID_LIST_DSL}\n\`\`\`` };
    }
  };
  const result = await repairInfographicWithFixer({
    brokenSource: VALID_LIST_DSL,
    parseError: 'irrelevant',
    modelOverride: model
  });
  assert.equal(result.accepted, true);
  assert.equal(invokeCallCount, 1);
  assert.equal(invokeSecondArg, undefined);
});
