import { describe, expect, it } from 'vitest';
import { diffMermaidFlowcharts, peekDiagramDirective } from '../src/utils/mermaidFlowchartDiff.js';

describe('diffMermaidFlowcharts', () => {
  it('detects new node', () => {
    const before = ['flowchart TD', '  A --> B'].join('\n');
    const after = ['flowchart TD', '  A --> B', '  B --> C'].join('\n');
    const d = diffMermaidFlowcharts(before, after);
    expect(d.addedIds).toContain('C');
    expect(d.removedIds).toEqual([]);
    expect(d.modifiedIds).toContain('B');
  });

  it('detects removed node', () => {
    const before = ['flowchart TD', '  A --> B', '  B --> C'].join('\n');
    const after = ['flowchart TD', '  A --> B'].join('\n');
    const d = diffMermaidFlowcharts(before, after);
    expect(d.removedIds).toContain('C');
    expect(d.addedIds).toEqual([]);
    expect(d.modifiedIds).toContain('B');
  });

  it('detects label change on same id', () => {
    const before = ['flowchart TD', '  A[Old] --> B'].join('\n');
    const after = ['flowchart TD', '  A[New] --> B'].join('\n');
    const d = diffMermaidFlowcharts(before, after);
    expect(d.addedIds).toEqual([]);
    expect(d.removedIds).toEqual([]);
    expect(d.modifiedIds).toEqual(['A']);
  });

  it('detects subgraph add and remove', () => {
    const base = ['flowchart TD', '  X --> Y'].join('\n');
    const withSg = ['flowchart TD', '  subgraph SG', '    X --> Y', '  end'].join('\n');
    let d = diffMermaidFlowcharts(base, withSg);
    expect(d.addedIds).toContain('SG');
    expect(d.removedIds).toEqual([]);

    d = diffMermaidFlowcharts(withSg, base);
    expect(d.removedIds).toContain('SG');
    expect(d.addedIds).toEqual([]);
  });

  it('detects simple edge reroute affecting fingerprints', () => {
    const before = ['flowchart TD', '  A --> B', '  B --> D'].join('\n');
    const after = ['flowchart TD', '  A --> B', '  B --> E'].join('\n');
    const d = diffMermaidFlowcharts(before, after);
    expect(d.addedIds).toContain('E');
    expect(d.removedIds).toContain('D');
    expect(d.modifiedIds).toContain('B');
  });

  it('returns empty arrays for identical sources', () => {
    const src = ['flowchart TD', '  Start[Start] --> EndNode[End]'].join('\n');
    const d = diffMermaidFlowcharts(src, src);
    expect(d.addedIds).toEqual([]);
    expect(d.removedIds).toEqual([]);
    expect(d.modifiedIds).toEqual([]);
  });

  it('handles empty sources', () => {
    expect(diffMermaidFlowcharts('', '')).toEqual({
      addedIds: [],
      removedIds: [],
      modifiedIds: []
    });
  });

  it('detects new sequenceDiagram participant via message line', () => {
    const before = ['sequenceDiagram', '  Alice->>Bob: hi'].join('\n');
    const after = ['sequenceDiagram', '  Alice->>Bob: hi', '  Bob->>Charlie: bye'].join('\n');
    const d = diffMermaidFlowcharts(before, after);
    expect(d.addedIds).toContain('Charlie');
    expect(d.removedIds).toEqual([]);
    expect(d.modifiedIds).toContain('Bob');
  });

  it('detects sequenceDiagram participant declaration change', () => {
    const before = ['sequenceDiagram', '  participant A as Alpha'].join('\n');
    const after = ['sequenceDiagram', '  participant A as Alpha-plus'].join('\n');
    const d = diffMermaidFlowcharts(before, after);
    expect(d.modifiedIds).toContain('A');
    expect(d.addedIds).toEqual([]);
    expect(d.removedIds).toEqual([]);
  });

  it('detects new stateDiagram-v2 state from transition', () => {
    const before = ['stateDiagram-v2', '  [*] --> A', '  A --> B'].join('\n');
    const after = ['stateDiagram-v2', '  [*] --> A', '  A --> B', '  B --> C'].join('\n');
    const d = diffMermaidFlowcharts(before, after);
    expect(d.addedIds).toContain('C');
    expect(d.removedIds).toEqual([]);
    expect(d.modifiedIds).toContain('B');
  });
});

describe('peekDiagramDirective', () => {
  it('reads directive after comments', () => {
    expect(peekDiagramDirective('%% x\nsequenceDiagram\n A->>B')).toBe('sequence');
    expect(peekDiagramDirective('flowchart LR\n A-->B')).toBe('flowchart');
    expect(peekDiagramDirective('graph TD\n A-->B')).toBe('flowchart');
    expect(peekDiagramDirective('stateDiagram-v2\n [*] --> X')).toBe('state');
  });

  it('skips YAML-style --- fences when scanning', () => {
    const src = ['---', 'title: x', '---', 'sequenceDiagram', '  A->>B'].join('\n');
    expect(peekDiagramDirective(src)).toBe('sequence');
  });
});
