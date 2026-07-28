import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAnalyzeFocusInstructions,
  buildFocusScopeInstructions
} from '../src/agents/mermaidLangChainAgent.js';

test('buildAnalyzeFocusInstructions centers explain on selected node', () => {
  const text = buildAnalyzeFocusInstructions(
    { id: 'flowchart-v2-Mars-0', label: 'Mars', selectionKind: 'node' },
    'richard'
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
    'jared'
  );
  assert.match(text, /Selection focus \(edge\)/);
  assert.match(text, /"A" → "B"/);
  assert.match(text, /feeds/);
});

test('buildAnalyzeFocusInstructions includes clicked label fragment when distinct from aggregate label', () => {
  const text = buildAnalyzeFocusInstructions(
    {
      id: 'flowchart-v2-X-0',
      label: 'Alpha · Beta',
      selectionKind: 'node',
      clickedLabel: 'Beta'
    },
    'richard'
  );
  assert.match(text, /label fragment/);
  assert.match(text, /Beta/);
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
