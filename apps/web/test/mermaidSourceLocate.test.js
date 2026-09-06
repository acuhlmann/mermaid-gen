import { describe, expect, it } from 'vitest';
import {
  collectLogicalIdCandidates,
  findFlowchartVertexRange,
  findMermaidSourceRange,
  findMermaidSourceRangeForDiagramSelection,
  findSequenceMessageRange,
  findSequenceParticipantRange,
  findSubgraphBlockRange,
  peekDiagramDirective,
  logicalIdFromDiagramSelection,
  normalizeDiagramElementId,
  parseSubgraphHeaderId,
  stripLineComment
} from '../src/utils/mermaidSourceLocate.js';

describe('stripLineComment', () => {
  it('removes trailing %% comment', () => {
    expect(stripLineComment(`  A --> B %% comment`)).toBe('  A --> B ');
  });
});

describe('normalizeDiagramElementId', () => {
  it('strips flowchart prefix and numeric suffix for nodes', () => {
    expect(normalizeDiagramElementId('flowchart-A-12', 'node')).toBe('A');
    expect(normalizeDiagramElementId('flowchart-v2-B-3', 'node')).toBe('B');
    expect(normalizeDiagramElementId('diagram-1-flowchart-A-0', 'node')).toBe('A');
    expect(normalizeDiagramElementId('diagram-12-flowchart-user-service-3', 'node')).toBe(
      'user-service'
    );
  });

  it('strips cluster prefix for clusters', () => {
    expect(normalizeDiagramElementId('cluster-flowchart-SG-1', 'cluster')).toBe('SG');
  });
});

describe('logicalIdFromDiagramSelection', () => {
  it('prefers data-id over element id', () => {
    expect(
      logicalIdFromDiagramSelection({
        elementId: 'flowchart-X-9',
        dataId: 'Alpha',
        kind: 'node'
      })
    ).toBe('Alpha');
  });

  it('reads the canvas descriptor `id` when elementId is absent', () => {
    expect(logicalIdFromDiagramSelection({ id: 'flowchart-B-0' })).toBe('B');
    expect(logicalIdFromDiagramSelection({ id: 'diagram-1-flowchart-A-0' })).toBe('A');
  });

  it('preserves timeline and pie slice indexes from rendered SVG ids', () => {
    expect(logicalIdFromDiagramSelection({ id: 'diagram-1-node-0' })).toBe('0');
    expect(logicalIdFromDiagramSelection({ id: 'diagram-12-node-3' })).toBe('3');
  });
});

describe('parseSubgraphHeaderId', () => {
  it('parses id before bracket title', () => {
    expect(parseSubgraphHeaderId('  subgraph SG [My Sub]')).toBe('SG');
  });

  it('parses quoted title', () => {
    expect(parseSubgraphHeaderId(`subgraph "Lane A"`)).toBe('Lane A');
  });
});

describe('findFlowchartVertexRange', () => {
  it('finds definition line by shape bracket', () => {
    const src = ['flowchart LR', '  Start([Begin]) --> Stop', '  Stop[End]'].join('\n');
    const r = findFlowchartVertexRange(src, 'Stop');
    expect(r).toEqual({
      startLineNumber: 3,
      startColumn: 3,
      endLineNumber: 3,
      endColumn: 7
    });
  });

  it('finds edge-only references when no dedicated definition line exists', () => {
    const src = 'flowchart TD\n  A --> B\n  B --> C';
    const r = findFlowchartVertexRange(src, 'C');
    expect(r?.startLineNumber).toBe(3);
    expect(r?.startColumn).toBe(9);
  });

  it('ignores content after %% on same line', () => {
    const src = 'flowchart TD\n  Z[Zed] %% mention B as text';
    const r = findFlowchartVertexRange(src, 'B');
    expect(r).toBeNull();
  });
});

describe('findSubgraphBlockRange', () => {
  it('returns nested subgraph block with balanced end keywords', () => {
    const src = [
      'flowchart TD',
      '  subgraph Outer',
      '    subgraph Inner',
      '      A --> B',
      '    end',
      '  end',
      '  C --> D'
    ].join('\n');
    const inner = findSubgraphBlockRange(src, 'Inner');
    expect(inner).toEqual({
      startLineNumber: 3,
      startColumn: 1,
      endLineNumber: 5,
      endColumn: 8
    });
    const outer = findSubgraphBlockRange(src, 'Outer');
    expect(outer?.startLineNumber).toBe(2);
    expect(outer?.endLineNumber).toBe(6);
  });
});

describe('findSequenceParticipantRange', () => {
  it('finds explicit participant declarations', () => {
    const src = [
      'sequenceDiagram',
      '  participant Ingestion',
      '  Ingestion ->> Validation: hi'
    ].join('\n');
    const r = findSequenceParticipantRange(src, 'Ingestion');
    expect(r?.startLineNumber).toBe(2);
    expect(r?.startColumn).toBe(15);
  });

  it('finds implicit participants on message lines', () => {
    const src = 'sequenceDiagram\n  Alice->>Bob: hi';
    const r = findSequenceParticipantRange(src, 'Bob');
    expect(r?.startLineNumber).toBe(2);
  });
});

describe('peekDiagramDirective', () => {
  it('detects sequence diagrams after init directives', () => {
    const src = '%%{init: {}}%%\nsequenceDiagram\n  A->>B';
    expect(peekDiagramDirective(src)).toBe('sequence');
  });

  it('detects mindmap diagrams', () => {
    expect(peekDiagramDirective('mindmap\n  root((X))')).toBe('mindmap');
  });

  it('detects pie and timeline diagrams', () => {
    expect(peekDiagramDirective('pie title T\n  "A" : 1')).toBe('pie');
    expect(peekDiagramDirective('pie showData\n  "A" : 1')).toBe('pie');
    expect(peekDiagramDirective('timeline\n  title T\n  2024 : Launch')).toBe('timeline');
  });

  it('detects every kind the table names, including the two added last', () => {
    // class and er had no case here until #547 moved the chain into a table —
    // which is the risk of a table over an if-chain: a row can be dropped in
    // transcription and nothing notices. These three lines are the row-set's
    // floor, so the next diagram kind that ships graph-edit support adds one
    // case here and one row there, and a lost row fails.
    expect(peekDiagramDirective('classDiagram\n  A <|-- B')).toBe('class');
    expect(peekDiagramDirective('erDiagram\n  A ||--o{ B : has')).toBe('er');
    expect(peekDiagramDirective('stateDiagram-v2\n  [*] --> X')).toBe('state');
  });

  it('reads case-insensitively and takes the first content line, not the last', () => {
    expect(peekDiagramDirective('SEQUENCEDIAGRAM\n  A->>B')).toBe('sequence');
    expect(peekDiagramDirective('%% a comment\nflowchart LR\n  A --> B')).toBe('flowchart');
    // The first non-comment line decides even when a later line would match a
    // different row, so re-ordering `DIAGRAM_DIRECTIVES` cannot quietly change
    // which kind a real document reports.
    expect(peekDiagramDirective('graph TD\nsequenceDiagram\n  A->>B')).toBe('flowchart');
    expect(peekDiagramDirective('gantt\ntitle T')).toBe('unknown');
  });
});

describe('findMermaidSourceRange', () => {
  it('dispatches cluster vs node kind', () => {
    const src = ['flowchart TD', 'subgraph SG', '  X[Hi]', 'end', '  SG -.-> X'].join('\n');
    const cluster = findMermaidSourceRange(src, { logicalId: 'SG', kind: 'cluster' });
    expect(cluster?.startLineNumber).toBe(2);
    const node = findMermaidSourceRange(src, { logicalId: 'X', kind: 'node' });
    expect(node?.startLineNumber).toBe(3);
  });
});

describe('collectLogicalIdCandidates', () => {
  it('adds hyphen segments from dom ids', () => {
    const c = collectLogicalIdCandidates({ elementId: 'flowchart-ProcessGate-2', kind: 'node' });
    expect(c).toContain('ProcessGate');
  });
});

describe('findSequenceMessageRange', () => {
  it('locates a message line by endpoints', () => {
    const src = ['sequenceDiagram', '  Alice->>Bob: Hello world', '  Bob-->>Alice: Reply'].join(
      '\n'
    );
    const r = findSequenceMessageRange(src, { from: 'Alice', to: 'Bob', label: 'Hello world' });
    expect(r?.startLineNumber).toBe(2);
    expect(r?.endLineNumber).toBe(2);
  });

  it('returns null when a label is provided but does not match', () => {
    const src = ['sequenceDiagram', '  Alice->>Bob: first', '  Alice->>Bob: second'].join('\n');
    expect(
      findSequenceMessageRange(src, { from: 'Alice', to: 'Bob', label: 'second' })?.startLineNumber
    ).toBe(3);
    expect(
      findSequenceMessageRange(src, { from: 'Alice', to: 'Bob', label: 'missing' })
    ).toBeNull();
  });

  it('picks the message by Mermaid id when duplicates share a label', () => {
    const src = [
      'sequenceDiagram',
      '  Alice->>Bob: ping',
      '  Bob-->>Alice: ack',
      '  Alice->>Bob: ping'
    ].join('\n');
    expect(
      findSequenceMessageRange(src, { from: 'Alice', to: 'Bob', label: 'ping', messageId: 2 })
        ?.startLineNumber
    ).toBe(4);
    expect(
      findSequenceMessageRange(src, { from: 'Alice', to: 'Bob', label: 'ping', messageId: 0 })
        ?.startLineNumber
    ).toBe(2);
  });

  it('refuses a message id whose endpoints do not match', () => {
    const src = ['sequenceDiagram', '  Alice->>Bob: first', '  Bob-->>Alice: hi'].join('\n');
    expect(findSequenceMessageRange(src, { from: 'Alice', to: 'Bob', messageId: 1 })).toBeNull();
  });

  it('counts label-less messages in Mermaid id order', () => {
    const src = [
      'sequenceDiagram',
      '  participant Alice',
      '  participant Bob',
      '  Alice->>Bob',
      '  Alice->>Bob: hi'
    ].join('\n');
    expect(
      findSequenceMessageRange(src, { from: 'Alice', to: 'Bob', messageId: 0 })?.startLineNumber
    ).toBe(4);
    expect(
      findSequenceMessageRange(src, { from: 'Alice', to: 'Bob', messageId: 1 })?.startLineNumber
    ).toBe(5);
  });
});

describe('findMermaidSourceRangeForDiagramSelection', () => {
  it('matches sequence participants using data-id', () => {
    const src = ['sequenceDiagram', '  participant Storage', '  Storage ->> Index: ok'].join('\n');
    const r = findMermaidSourceRangeForDiagramSelection(src, {
      elementId: 'root-3',
      dataId: 'Storage',
      kind: 'node'
    });
    expect(r?.startLineNumber).toBe(2);
    expect(r?.startColumn).toBe(15);
  });

  it('matches vertex using only a prefixed svg-style id', () => {
    const src = 'flowchart LR\n  PG[Gate] --> Z';
    const r = findMermaidSourceRangeForDiagramSelection(src, {
      elementId: 'flowchart-PG-9',
      kind: 'node'
    });
    expect(r?.startLineNumber).toBe(2);
    expect(r?.startColumn).toBe(3);
  });
});
