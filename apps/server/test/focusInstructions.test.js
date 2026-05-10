import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAnalyzeFocusInstructions,
  buildFocusScopeInstructions
} from '../src/agents/mermaidLangChainAgent.js';

test('buildAnalyzeFocusInstructions centers explain on selected node', () => {
  const text = buildAnalyzeFocusInstructions(
    { id: 'flowchart-v2-Mars-0', label: 'Mars', selectionKind: 'node' },
    'explain'
  );
  assert.match(text, /Selection focus \(node\)/);
  assert.match(text, /Mars/);
  assert.doesNotMatch(text, /Prefer changes/);
});

test('buildAnalyzeFocusInstructions centers critique on selected edge', () => {
  const text = buildAnalyzeFocusInstructions(
    {
      id: 'L_A_B_0',
      selectionKind: 'edge',
      edgeFrom: 'A',
      edgeTo: 'B',
      label: 'feeds'
    },
    'critique'
  );
  assert.match(text, /Selection focus \(edge\)/);
  assert.match(text, /"A" → "B"/);
  assert.match(text, /feeds/);
});

test('buildFocusScopeInstructions uses mutation wording for edges', () => {
  const text = buildFocusScopeInstructions({
    id: 'L_A_B_0',
    selectionKind: 'edge',
    edgeFrom: 'A',
    edgeTo: 'B'
  });
  assert.match(text, /Prefer edits centered on the edge/);
  assert.match(text, /"A"/);
  assert.match(text, /"B"/);
});
