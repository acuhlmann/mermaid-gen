import test from 'node:test';
import assert from 'node:assert/strict';
import { repairChartWithFixer } from '../src/agents/chartSyntaxFixer.js';

const HELLO_BAR_SPEC = {
  $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
  data: { values: [{ q: 'Q1', rev: 12 }] },
  mark: 'bar',
  encoding: {
    x: { field: 'q', type: 'ordinal' },
    y: { field: 'rev', type: 'quantitative' }
  }
};

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

test('repairChartWithFixer returns valid chart JSON when model output is valid', async () => {
  const fixed = JSON.stringify({ theme: 'whiteboard', spec: HELLO_BAR_SPEC });
  const result = await repairChartWithFixer({
    brokenSource: '{"theme":"whiteboard","spec":{}}',
    parseError: 'non-empty Vega-Lite object',
    modelOverride: fakeModel('```json\n' + fixed + '\n```')
  });
  assert.equal(result.accepted, true);
  assert.equal(result.metadata.validator, 'chart-syntax-fixer');
  assert.match(result.diagramSource, /"mark":\s*"bar"/);
});

test('repairChartWithFixer handles unfenced JSON output', async () => {
  const fixed = JSON.stringify({ theme: 'noir', spec: HELLO_BAR_SPEC });
  const result = await repairChartWithFixer({
    brokenSource: '{"theme":"noir","spec":{}}',
    parseError: 'compile failed',
    modelOverride: fakeModel(fixed)
  });
  assert.equal(result.accepted, true);
  assert.equal(result.metadata.theme, 'noir');
});

test('repairChartWithFixer rejects when model output is still invalid', async () => {
  const result = await repairChartWithFixer({
    brokenSource: '{"theme":"whiteboard","spec":{}}',
    parseError: 'empty spec',
    modelOverride: fakeModel('```json\n{"theme":"galaxy","spec":{}}\n```')
  });
  assert.equal(result.accepted, false);
  assert.ok(result.error);
});

test('repairChartWithFixer reports model exceptions as accepted:false', async () => {
  const model = {
    async invoke() {
      throw new Error('rate limited');
    }
  };
  const result = await repairChartWithFixer({
    brokenSource: '{"theme":"whiteboard","spec":{}}',
    parseError: 'broken',
    modelOverride: model
  });
  assert.equal(result.accepted, false);
  assert.match(String(result.error), /rate limited/);
});

test('repairChartWithFixer includes rule pack and validation error in the prompt', async () => {
  const fixed = JSON.stringify({ theme: 'whiteboard', spec: HELLO_BAR_SPEC });
  const spy = { responseText: '```json\n' + fixed + '\n```' };
  await repairChartWithFixer({
    brokenSource: '{"theme":"whiteboard","spec":{}}',
    parseError: 'Vega-Lite compile() rejected the spec',
    modelOverride: fakeModelFromMessages(spy)
  });
  const human = spy.lastMessages[spy.lastMessages.length - 1];
  const content = typeof human.content === 'string' ? human.content : '';
  assert.match(content, /Vega-Lite compile\(\) rejected the spec/);
  assert.match(content, /Self-check before calling apply_chart_patch/);
});
