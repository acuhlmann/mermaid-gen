import { describe, expect, it } from 'vitest';
import {
  addLinkedMindmapNode,
  deleteMindmapNode,
  formatMindmapNodeText,
  isMindmapFamilySource,
  parseMindmapNodeText,
  parseMindmapTree,
  renameMindmapNode,
  connectMindmapNodes
} from '../src/utils/mermaidMindmapEdit.js';

const MINDMAP = `mindmap
  root((Root Topic))
    Child1
    Child2
      Grandchild
`;

describe('isMindmapFamilySource', () => {
  it('accepts mindmap and rejects flowchart', () => {
    expect(isMindmapFamilySource(MINDMAP)).toBe(true);
    expect(isMindmapFamilySource('flowchart TD\n  A --> B')).toBe(false);
  });
});

describe('parseMindmapTree', () => {
  it('assigns AntV-style indent paths', () => {
    const tree = parseMindmapTree(MINDMAP);
    expect(tree?.root.path).toBe('0');
    expect(tree?.flat.map((node) => node.path)).toEqual(['0', '0,0', '0,1', '0,1,0']);
    expect(tree?.flat.map((node) => node.label)).toEqual([
      'Root Topic',
      'Child1',
      'Child2',
      'Grandchild'
    ]);
  });
});

describe('addLinkedMindmapNode', () => {
  it('inserts an indented child under the selected node', () => {
    const result = addLinkedMindmapNode(MINDMAP, '0,0', 'Review');
    expect(result).toMatchObject({ ok: true, newId: '0,0,0', newLabel: 'Review' });
    expect(result.source).toMatch(/Child1\n      Review/);
  });

  it('allocates a default label when none is provided', () => {
    const result = addLinkedMindmapNode(MINDMAP, '0');
    expect(result.ok).toBe(true);
    expect(result.source).toMatch(/Grandchild\n\n    Item 1/);
  });
});

describe('deleteMindmapNode', () => {
  it('removes a node and its descendants', () => {
    const result = deleteMindmapNode(MINDMAP, '0,1');
    expect(result.ok).toBe(true);
    expect(result.source).toMatch(/Child1/);
    expect(result.source).not.toMatch(/Child2/);
    expect(result.source).not.toMatch(/Grandchild/);
  });

  it('refuses to delete the root', () => {
    expect(deleteMindmapNode(MINDMAP, '0')).toEqual({ ok: false, reason: 'root' });
  });
});

describe('renameMindmapNode', () => {
  it('preserves the root circle shape', () => {
    const result = renameMindmapNode(MINDMAP, '0', 'Company');
    expect(result.ok).toBe(true);
    expect(result.source).toMatch(/root\(\(Company\)\)/);
  });

  it('refuses an empty label', () => {
    expect(renameMindmapNode(MINDMAP, '0,0', '   ')).toEqual({ ok: false, reason: 'empty' });
  });

  it('resolves nodes by label ref', () => {
    const result = renameMindmapNode(MINDMAP, '~label:Child1', 'Alpha');
    expect(result.ok).toBe(true);
    expect(result.source).toMatch(/Alpha/);
    expect(result.source).not.toMatch(/\bChild1\b/);
  });
});

describe('parseMindmapNodeText / formatMindmapNodeText', () => {
  it('round-trips shaped nodes', () => {
    const parsed = parseMindmapNodeText('root((Root Topic))');
    expect(parsed).toMatchObject({ nodeId: 'root', label: 'Root Topic', kind: 'circle-id' });
    expect(formatMindmapNodeText(parsed, 'Renamed')).toBe('root((Renamed))');
  });
});

describe('connectMindmapNode', () => {
  it('does not support free linking', () => {
    expect(connectMindmapNodes(MINDMAP, '0', '0,0')).toEqual({ ok: false, reason: 'no-link' });
  });
});
