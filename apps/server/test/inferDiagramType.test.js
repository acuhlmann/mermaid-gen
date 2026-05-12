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
