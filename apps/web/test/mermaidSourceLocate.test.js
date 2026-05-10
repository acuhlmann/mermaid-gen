import { describe, expect, it } from 'vitest';
import {
  collectLogicalIdCandidates,
  findFlowchartVertexRange,
  findMermaidSourceRange,
  findMermaidSourceRangeForDiagramSelection,
  findSubgraphBlockRange,
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

describe('findMermaidSourceRangeForDiagramSelection', () => {
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
