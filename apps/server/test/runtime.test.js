import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAndPreparePatch } from '../src/tools/mermaidDiffTool.js';

test('mermaid tool accepts valid flowchart source', async () => {
  const result = await validateAndPreparePatch({
    currentState: { revisionId: 0 },
    proposedMermaidSource: 'flowchart TD\n  A --> B',
    reason: 'test'
  });

  assert.equal(result.accepted, true);
  assert.equal(result.patch.nextRevisionId, 1);
  assert.match(result.patch.diagramSource, /^%%\{init:/);
  assert.equal(result.patch.styleConfig.theme, 'base');
  assert.equal(result.patch.styleConfig.flowchart.curve, 'rounded');
});

test('mermaid tool rejects invalid source', async () => {
  const result = await validateAndPreparePatch({
    currentState: { revisionId: 0 },
    proposedMermaidSource: 'not-a-diagram',
    reason: 'test'
  });

  assert.equal(result.accepted, false);
  assert.match(result.error, /not valid Mermaid syntax/);
});
