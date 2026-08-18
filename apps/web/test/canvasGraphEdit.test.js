import { describe, expect, it } from 'vitest';
import { graphEditAdapterFor, graphEditIdFromDescriptor } from '../src/utils/canvasGraphEdit.js';

const FLOWCHART = `flowchart TD
  A[Start] --> B[End]
`;

const TREE = `infographic hierarchy-tree-curved-line-rounded-rect-node
data
  root
    label Company
    children
      - label Engineering
`;

const DAGRE = `infographic relation-dagre-flow-tb-simple-circle-node
data
  nodes
    - label API
    - label DB
  relations
    API -> DB
`;

const LIST = `infographic list-grid-simple
data
  lists
    - label A
`;

describe('graphEditAdapterFor', () => {
  it('returns the flowchart adapter for mermaid flowcharts only', () => {
    const adapter = graphEditAdapterFor('mermaid', FLOWCHART);
    expect(adapter?.contentType).toBe('mermaid');
    expect(adapter?.canLink).toBe(true);
    expect(graphEditAdapterFor('mermaid', 'sequenceDiagram\nA->>B: hi')).toBeNull();
  });

  it('enables infographic trees without Link and dagre with Link', () => {
    const tree = graphEditAdapterFor('infographic', TREE);
    expect(tree?.contentType).toBe('infographic');
    expect(tree?.canLink).toBe(false);
    const dagre = graphEditAdapterFor('infographic', DAGRE);
    expect(dagre?.canLink).toBe(true);
    expect(graphEditAdapterFor('infographic', LIST)).toBeNull();
  });
});

describe('graphEditIdFromDescriptor', () => {
  it('prefers AntV indexes, then ~label:, then mermaid id', () => {
    expect(
      graphEditIdFromDescriptor({ kind: 'infographic-item', indexes: '0,0', label: 'Eng' })
    ).toBe('0,0');
    expect(graphEditIdFromDescriptor({ kind: 'infographic-item', label: 'Eng' })).toBe(
      '~label:Eng'
    );
    expect(graphEditIdFromDescriptor({ dataId: 'A', partName: 'Start' })).toBe('A');
    expect(graphEditIdFromDescriptor({ kind: 'edge', dataId: 'A_B' })).toBeNull();
  });
});
