import { describe, expect, it } from 'vitest';
import {
  addLinkedInfographicNode,
  connectInfographicNodes,
  deleteInfographicEdge,
  deleteInfographicNode,
  infographicGraphAllowsLink,
  infographicGraphFamily,
  infographicLabelRef,
  isInfographicGraphSource,
  renameInfographicNode
} from '../src/utils/infographicGraphEdit.js';

const TREE = `infographic hierarchy-tree-curved-line-rounded-rect-node
data
  title Company
  root
    label Company
    children
      - label Engineering
        children
          - label Platform
      - label Sales
theme
  palette #3b82f6 #8b5cf6
`;

const DAGRE = `infographic relation-dagre-flow-tb-simple-circle-node
data
  title System map
  nodes
    - id api
      label API
    - id db
      label Postgres
  relations
    api -> db
`;

const NETWORK = `infographic relation-network-simple-circle-node
data
  title Topics
  nodes
    - label Hamburg
    - label Port
    - label Culture
`;

describe('infographicGraphFamily', () => {
  it('accepts hierarchy trees, relation maps, lists, and sequences', () => {
    expect(infographicGraphFamily(TREE)).toBe('hierarchy');
    expect(infographicGraphFamily(DAGRE)).toBe('relation');
    expect(isInfographicGraphSource(NETWORK)).toBe(true);
    expect(
      isInfographicGraphSource(`infographic list-grid-simple
data
  lists
    - label A
`)
    ).toBe(true);
    expect(
      infographicGraphFamily(`infographic sequence-steps-simple
data
  sequences
    - label Step 1
`)
    ).toBe('sequence');
    expect(
      isInfographicGraphSource(`infographic hierarchy-structure
data
  items
    - label Engineering
`)
    ).toBe(true);
    expect(
      infographicGraphFamily(`infographic chart-bar-plain-text
data
  values
    - label Q1
      value 10
`)
    ).toBe('flat');
    expect(
      isInfographicGraphSource(`infographic compare-swot-simple
data
  compares
    - label Strengths
`)
    ).toBe(false);
    expect(infographicGraphAllowsLink(DAGRE)).toBe(true);
    expect(infographicGraphAllowsLink(NETWORK)).toBe(false);
    expect(infographicGraphAllowsLink(TREE)).toBe(false);
  });
});

describe('hierarchy Connect / Delete / Rename', () => {
  it('adds a child under the selected node using AntV indexes', () => {
    const result = addLinkedInfographicNode(TREE, '0,0', 'Mobile');
    expect(result.ok).toBe(true);
    expect(result.newId).toBe('0,0,1');
    expect(result.source).toMatch(
      /- label Engineering[\s\S]*- label Platform[\s\S]*- label Mobile/
    );
    const engineeringBlock = result.source.split('- label Sales')[0];
    expect(engineeringBlock).toMatch(/- label Mobile/);
  });

  it('adds a child of the root as 0,N', () => {
    const result = addLinkedInfographicNode(TREE, '0', 'Legal');
    expect(result.ok).toBe(true);
    expect(result.newId).toBe('0,2');
    expect(result.source).toMatch(/- label Sales\n\s+- label Legal/);
  });

  it('resolves a title-anchored click by label', () => {
    const result = addLinkedInfographicNode(TREE, infographicLabelRef('Engineering'), 'QA');
    expect(result.ok).toBe(true);
    expect(result.source).toMatch(/- label Engineering[\s\S]*- label QA/);
  });

  it('renames a nested node in place', () => {
    const result = renameInfographicNode(TREE, '0,0,0', 'Platforms');
    expect(result.ok).toBe(true);
    expect(result.source).toMatch(/- label Platforms/);
    expect(result.source).not.toMatch(/- label Platform\n/);
  });

  it('deletes a node and its descendants, leaving siblings', () => {
    const result = deleteInfographicNode(TREE, '0,0');
    expect(result.ok).toBe(true);
    expect(result.source).not.toMatch(/Engineering/);
    expect(result.source).not.toMatch(/Platform/);
    expect(result.source).toMatch(/- label Sales/);
    expect(result.source).toMatch(/label Company/);
  });

  it('refuses to delete the tree root', () => {
    expect(deleteInfographicNode(TREE, '0')).toEqual({ ok: false, reason: 'root' });
  });
});

describe('relation dagre Connect / Delete / Rename', () => {
  it('adds a linked node and an unlabeled edge', () => {
    const result = addLinkedInfographicNode(DAGRE, '0', 'Cache');
    expect(result.ok).toBe(true);
    expect(result.newId).toBe('2');
    expect(result.source).toMatch(/- id n1\n\s+label Cache/);
    expect(result.source).toMatch(/api -> n1/);
  });

  it('links two existing nodes', () => {
    const result = connectInfographicNodes(DAGRE, '1', '0');
    expect(result.ok).toBe(true);
    expect(result.source).toMatch(/db -> api/);
    expect(connectInfographicNodes(DAGRE, '0', '1')).toEqual({ ok: false, reason: 'duplicate' });
  });

  it('does not invent a link on a star-network template', () => {
    expect(connectInfographicNodes(NETWORK, '0', '1')).toEqual({ ok: false, reason: 'no-link' });
  });

  it('renames a node with an explicit id without rewriting the id', () => {
    const result = renameInfographicNode(DAGRE, '1', 'Cloud SQL');
    expect(result.ok).toBe(true);
    expect(result.source).toMatch(/- id db\n\s+label Cloud SQL/);
    expect(result.source).toMatch(/api -> db/);
  });

  it('deletes a node and every edge that mentioned it', () => {
    const result = deleteInfographicNode(DAGRE, infographicLabelRef('Postgres'));
    expect(result.ok).toBe(true);
    expect(result.source).not.toMatch(/Postgres/);
    expect(result.source).not.toMatch(/api -> db/);
    expect(result.source).toMatch(/label API/);
  });

  it('deletes a directed edge and keeps the nodes', () => {
    const result = deleteInfographicEdge(DAGRE, '0', '1');
    expect(result.ok).toBe(true);
    expect(result.source).not.toMatch(/api -> db/);
    expect(result.source).toMatch(/label API/);
    expect(result.source).toMatch(/label Postgres/);
  });
});

describe('relation network add', () => {
  it('appends a spoke item on a network template', () => {
    const result = addLinkedInfographicNode(NETWORK, '0', 'Education');
    expect(result.ok).toBe(true);
    expect(result.source).toMatch(/- label Education/);
    expect(result.source).not.toMatch(/- id /);
    expect(result.source).not.toMatch(/relations/i);
  });
});

const LIST = `infographic list-row-simple-horizontal-arrow
data
  title Steps
  lists
    - label Acquire
      desc Multi-channel
    - label Convert
      desc Reduce drop-off
`;

const SEQUENCE = `infographic sequence-steps-simple
data
  title Flow
  sequences
    - label Step 1
    - label Step 2
`;

describe('list and sequence Connect / Delete / Rename', () => {
  it('adds a sibling after the selected list item', () => {
    const result = addLinkedInfographicNode(LIST, '0', 'Retain');
    expect(result.ok).toBe(true);
    expect(result.newId).toBe('1');
    expect(result.source).toMatch(/- label Acquire[\s\S]*- label Retain[\s\S]*- label Convert/);
  });

  it('adds a sibling after the last list item', () => {
    const result = addLinkedInfographicNode(LIST, '1', 'Delight');
    expect(result.ok).toBe(true);
    expect(result.newId).toBe('2');
    expect(result.source).toMatch(/- label Convert[\s\S]*- label Delight/);
  });

  it('renames a list item in place', () => {
    const result = renameInfographicNode(LIST, '1', 'Close');
    expect(result.ok).toBe(true);
    expect(result.source).toMatch(/- label Close/);
    expect(result.source).not.toMatch(/- label Convert\n/);
    expect(result.source).toMatch(/desc Reduce drop-off/);
  });

  it('deletes a list item and leaves siblings', () => {
    const result = deleteInfographicNode(LIST, '0');
    expect(result.ok).toBe(true);
    expect(result.source).not.toMatch(/Acquire/);
    expect(result.source).toMatch(/- label Convert/);
  });

  it('refuses to delete the only list item', () => {
    const solo = `infographic list-grid-simple
data
  lists
    - label Only
`;
    expect(deleteInfographicNode(solo, '0')).toEqual({ ok: false, reason: 'last' });
  });

  it('works on sequence templates via the sequences field', () => {
    const result = addLinkedInfographicNode(SEQUENCE, '0', 'Step 1b');
    expect(result.ok).toBe(true);
    expect(result.newId).toBe('1');
    expect(result.source).toMatch(/- label Step 1[\s\S]*- label Step 1b[\s\S]*- label Step 2/);
    const renamed = renameInfographicNode(SEQUENCE, '1', 'Step 2 renamed');
    expect(renamed.ok).toBe(true);
    expect(renamed.source).toMatch(/- label Step 2 renamed/);
  });
});

const CHART = `infographic chart-bar-plain-text
data
  title Revenue
  values
    - label Q1
      value 10
    - label Q2
      value 18
`;

const HIERARCHY_STRUCTURE = `infographic hierarchy-structure
data
  title Org units
  items
    - label Engineering
    - label Product
`;

describe('chart and hierarchy-structure flat arrays', () => {
  it('adds a sibling chart value with a default numeric value', () => {
    const result = addLinkedInfographicNode(CHART, '0', 'Q3');
    expect(result.ok).toBe(true);
    expect(result.newId).toBe('1');
    expect(result.source).toMatch(/- label Q3[\s\S]*value 0[\s\S]*- label Q2/);
  });

  it('renames a chart value label', () => {
    const result = renameInfographicNode(CHART, '1', 'Quarter 2');
    expect(result.ok).toBe(true);
    expect(result.source).toMatch(/- label Quarter 2/);
    expect(result.source).toMatch(/value 18/);
  });

  it('works on hierarchy-structure items', () => {
    const result = addLinkedInfographicNode(HIERARCHY_STRUCTURE, '0', 'Sales');
    expect(result.ok).toBe(true);
    expect(result.source).toMatch(/- label Engineering[\s\S]*- label Sales[\s\S]*- label Product/);
    const deleted = deleteInfographicNode(HIERARCHY_STRUCTURE, '1');
    expect(deleted.ok).toBe(true);
    expect(deleted.source).not.toMatch(/Product/);
  });
});
