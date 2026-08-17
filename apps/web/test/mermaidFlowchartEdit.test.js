import { describe, expect, it } from 'vitest';
import {
  addLinkedFlowchartNode,
  allocateFlowchartNodeId,
  connectFlowchartNodes,
  deleteFlowchartEdge,
  deleteFlowchartNode,
  formatMermaidNodeShape,
  isFlowchartFamilySource,
  renameFlowchartEdge,
  renameFlowchartNode
} from '../src/utils/mermaidFlowchartEdit.js';

const FLOW = `flowchart TD
  A[Start] --> B[End]
`;

describe('isFlowchartFamilySource', () => {
  it('accepts flowchart and graph, rejects sequence', () => {
    expect(isFlowchartFamilySource('flowchart TD\n  A --> B')).toBe(true);
    expect(isFlowchartFamilySource('graph LR\n  A --> B')).toBe(true);
    expect(isFlowchartFamilySource('sequenceDiagram\n  Alice->>Bob: hi')).toBe(false);
  });
});

describe('connectFlowchartNodes', () => {
  it('adds A --> C', () => {
    const result = connectFlowchartNodes(FLOW, 'A', 'B');
    expect(result).toEqual({ ok: false, reason: 'duplicate' });
    const added = connectFlowchartNodes(FLOW, 'B', 'A');
    expect(added.ok).toBe(true);
    expect(added.source).toMatch(/B --> A/);
  });

  it('treats self-links as a failed click, not a loop', () => {
    expect(connectFlowchartNodes(FLOW, 'A', 'A')).toEqual({ ok: false, reason: 'self' });
  });

  it('allows a cycle that is not a self-link', () => {
    const result = connectFlowchartNodes(FLOW, 'B', 'A');
    expect(result.ok).toBe(true);
    expect(result.source).toMatch(/B --> A/);
  });
});

describe('addLinkedFlowchartNode', () => {
  it('births a child from A with a safe id', () => {
    const result = addLinkedFlowchartNode(FLOW, 'A', 'Review');
    expect(result.ok).toBe(true);
    expect(result.newId).toBe('n1');
    expect(result.source).toMatch(/A --> n1\[Review\]/);
  });

  it('keeps the child inside the same subgraph as A', () => {
    const source = `flowchart TD
  subgraph cluster [Box]
    A[Inside]
  end
`;
    const result = addLinkedFlowchartNode(source, 'A', 'Child');
    expect(result.ok).toBe(true);
    const subgraph = result.source.split('subgraph')[1].split(/\bend\b/)[0];
    expect(subgraph).toMatch(/A --> n1\[Child\]/);
  });

  it('quotes labels that would break Mermaid', () => {
    expect(formatMermaidNodeShape('Cost (est.)')).toBe('["Cost (est.)"]');
    const result = addLinkedFlowchartNode(FLOW, 'A', 'Cost (est.)');
    expect(result.source).toMatch(/n1\["Cost \(est\.\)"\]/);
  });
});

describe('deleteFlowchartNode', () => {
  it('removes the node and every edge that touched it', () => {
    const source = `flowchart TD
  A[Start] --> B[Mid]
  B --> C[End]
`;
    const result = deleteFlowchartNode(source, 'B');
    expect(result.ok).toBe(true);
    expect(result.source).not.toMatch(/\bB\b/);
    expect(result.source).toMatch(/\bA\b/);
    expect(result.source).toMatch(/\bC\b/);
  });
});

describe('deleteFlowchartEdge', () => {
  it('removes A --> B and leaves the nodes', () => {
    const result = deleteFlowchartEdge(FLOW, 'A', 'B');
    expect(result.ok).toBe(true);
    expect(result.source).not.toMatch(/A --> B/);
    expect(result.source).toMatch(/A\[Start\]/);
  });
});

describe('renameFlowchartNode', () => {
  it('rewrites the shape label and keeps the id', () => {
    const result = renameFlowchartNode(FLOW, 'A', 'Kickoff');
    expect(result.ok).toBe(true);
    expect(result.source).toMatch(/A\[Kickoff\]/);
    expect(result.source).not.toMatch(/A\[Start\]/);
  });
});

describe('renameFlowchartEdge', () => {
  it('sets an edge label', () => {
    const result = renameFlowchartEdge(FLOW, 'A', 'B', 'yes');
    expect(result.ok).toBe(true);
    expect(result.source).toMatch(/A\[Start\] -->|yes| B\[End\]/);
  });
});

describe('allocateFlowchartNodeId', () => {
  it('skips ids that already exist', () => {
    const source = `flowchart TD
  n1[One] --> n2[Two]
`;
    expect(allocateFlowchartNodeId(source)).toBe('n3');
  });
});
