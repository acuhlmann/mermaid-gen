import test from 'node:test';
import assert from 'node:assert/strict';
import { repairMermaidWithFixer } from '../src/agents/mermaidSyntaxFixer.js';

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

test('repairMermaidWithFixer returns valid Mermaid when model output is valid', async () => {
  const result = await repairMermaidWithFixer({
    brokenSource: 'flowchart TD\n  A[user (admin)] --> B',
    parseError: 'Parse error on line 2: unexpected (',
    modelOverride: fakeModel('```mermaid\nflowchart TD\n  A["user (admin)"] --> B\n```')
  });
  assert.equal(result.accepted, true);
  assert.match(result.diagramSource, /A\["user \(admin\)"\]/);
  assert.equal(result.metadata.validator, 'syntax-fixer');
});

test('repairMermaidWithFixer handles unfenced output', async () => {
  const result = await repairMermaidWithFixer({
    brokenSource: 'flowchart TD\n  A[bad (paren)] --> B',
    parseError: 'parser rejected',
    modelOverride: fakeModel('flowchart TD\n  A["bad (paren)"] --> B')
  });
  assert.equal(result.accepted, true);
  assert.match(result.diagramSource, /A\["bad \(paren\)"\]/);
});

test('repairMermaidWithFixer rejects when model output is still invalid', async () => {
  const result = await repairMermaidWithFixer({
    brokenSource: 'flowchart TD\n  A[bad (paren)] --> B',
    parseError: 'parser rejected',
    modelOverride: fakeModel('```mermaid\nstill not a diagram\n```')
  });
  assert.equal(result.accepted, false);
  assert.match(String(result.error), /missing known diagram type|parser rejected/);
});

test('repairMermaidWithFixer reports model exceptions as accepted:false', async () => {
  const model = {
    async invoke() {
      throw new Error('rate limited');
    }
  };
  const result = await repairMermaidWithFixer({
    brokenSource: 'flowchart TD\n  A --> B',
    parseError: 'something',
    modelOverride: model
  });
  assert.equal(result.accepted, false);
  assert.match(String(result.error), /rate limited/);
});

test('repairMermaidWithFixer includes rule pack and parser error in the prompt', async () => {
  const spy = { responseText: '```mermaid\nflowchart TD\n  A --> B\n```' };
  await repairMermaidWithFixer({
    brokenSource: 'flowchart TD\n  A --> B',
    parseError: 'Parse error: unexpected token',
    modelOverride: fakeModelFromMessages(spy)
  });
  const human = spy.lastMessages[spy.lastMessages.length - 1];
  const content = typeof human.content === 'string' ? human.content : '';
  assert.match(content, /Parse error: unexpected token/);
  assert.match(content, /Universal Mermaid rules:/);
  assert.match(content, /Flowchart \/ graph rules:/);
});

test('repairMermaidWithFixer rejects when broken source is empty', async () => {
  const result = await repairMermaidWithFixer({ brokenSource: '', modelOverride: fakeModel('') });
  assert.equal(result.accepted, false);
});

test('repairMermaidWithFixer reports missing model gracefully', async () => {
  const result = await repairMermaidWithFixer({
    brokenSource: 'flowchart TD\n  A --> B',
    parseError: 'x',
    env: {},
    modelOverride: null
  });
  assert.equal(result.accepted, false);
  assert.match(String(result.error), /not configured/);
});
