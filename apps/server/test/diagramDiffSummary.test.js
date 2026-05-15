import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDiagramDiffSummary,
  buildMermaidGraphDiff,
  extractMermaidEdges,
  extractMermaidNodeIds,
  buildWebCanvasUrl
} from '../src/mcp/diagramDiffSummary.js';

test('extractMermaidNodeIds finds node-like ids', () => {
  const ids = extractMermaidNodeIds('graph TD\n  A[Start] --> B(Process)\n');
  assert.ok(ids.has('A'));
  assert.ok(ids.has('B'));
});

test('buildDiagramDiffSummary reports line and node changes', () => {
  const before = 'graph TD\n  A --> B\n';
  const after = 'graph TD\n  A --> C\n  D[New]\n';
  const summary = buildDiagramDiffSummary(before, after, { contentType: 'mermaid' });
  assert.ok(summary.linesAdded >= 1 || summary.linesChanged >= 1);
  assert.ok(summary.nodesAdded.includes('C') || summary.nodesAdded.includes('D'));
  assert.ok(summary.unified.some((r) => r.kind === 'add' || r.kind === 'del'));
});

test('buildMermaidGraphDiff detects edge changes', () => {
  const before = 'graph TD\n  A --> B\n';
  const after = 'graph TD\n  A --> C\n  B --> C\n';
  const g = buildMermaidGraphDiff(before, after);
  assert.ok(g.edgesAdded.some((e) => e.from === 'A' && e.to === 'C'));
  assert.equal(extractMermaidEdges(before).length, 1);
});

test('buildWebCanvasUrl encodes session in path', () => {
  const url = buildWebCanvasUrl('my session/id');
  assert.match(url, /\/sessions\/my%20session%2Fid$/);
});
