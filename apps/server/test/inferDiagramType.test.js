import test from 'node:test';
import assert from 'node:assert/strict';
import { inferDiagramType } from '../src/agents/inferDiagramType.js';

test('inferDiagramType handles flowchart variants', () => {
  assert.equal(inferDiagramType('flowchart TD\n  A --> B'), 'flowchart');
  assert.equal(inferDiagramType('graph LR\n  A --> B'), 'flowchart');
  assert.equal(inferDiagramType('   flowchart TD'), 'flowchart');
});

test('inferDiagramType handles other diagram types', () => {
  assert.equal(inferDiagramType('sequenceDiagram\n  Alice->>Bob: hi'), 'sequenceDiagram');
  assert.equal(inferDiagramType('classDiagram\n  ClassA <|-- ClassB'), 'classDiagram');
  assert.equal(inferDiagramType('stateDiagram-v2\n  A --> B'), 'stateDiagram-v2');
  assert.equal(inferDiagramType('stateDiagram\n  A --> B'), 'stateDiagram-v2');
  assert.equal(inferDiagramType('erDiagram\n  A ||--o{ B : has'), 'erDiagram');
  assert.equal(inferDiagramType('gitGraph\n  commit'), 'gitGraph');
  assert.equal(inferDiagramType('block-beta\n  A B'), 'block-beta');
  assert.equal(inferDiagramType('C4Context\n  title X'), 'C4Context');
});

test('inferDiagramType skips init directives and blank lines', () => {
  assert.equal(
    inferDiagramType('\n\n%%{init: {"theme":"dark"}}%%\nflowchart TD\n  A --> B'),
    'flowchart'
  );
});

test('inferDiagramType returns null for unknown or empty source', () => {
  assert.equal(inferDiagramType(''), null);
  assert.equal(inferDiagramType(null), null);
  assert.equal(inferDiagramType('something\nflowchart TD'), null);
  assert.equal(inferDiagramType('not-a-diagram'), null);
});

test('inferDiagramType resolves Mermaid 12 beta types, including the bare name', () => {
  assert.equal(
    inferDiagramType('agentflow-beta TB\n  a["A"]@{ shape: task } --> b["B"]'),
    'agentflow-beta'
  );
  assert.equal(inferDiagramType('usecase-beta\n  actor User\n  User --> Login'), 'usecase-beta');
  // The sanitizer promotes these, but the type must resolve before it runs so the right
  // rule pack gets injected into the repair prompt.
  assert.equal(inferDiagramType('agentflow TB\n  A --> B'), 'agentflow-beta');
  assert.equal(inferDiagramType('usecase\n  actor User'), 'usecase-beta');
});
