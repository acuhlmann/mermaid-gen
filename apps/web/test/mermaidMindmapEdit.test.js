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

describe('mindmap edit guards', () => {
  it('refuses non-mindmap sources', () => {
    const flowchart = 'flowchart TD\n  A --> B';
    expect(addLinkedMindmapNode(flowchart, '0')).toEqual({ ok: false, reason: 'not-mindmap' });
    expect(deleteMindmapNode(flowchart, '0,0')).toEqual({ ok: false, reason: 'not-mindmap' });
    expect(renameMindmapNode(flowchart, '0,0', 'X')).toEqual({ ok: false, reason: 'not-mindmap' });
  });

  it('returns missing when the node id does not exist', () => {
    expect(addLinkedMindmapNode(MINDMAP, '9,9')).toEqual({ ok: false, reason: 'missing' });
    expect(deleteMindmapNode(MINDMAP, '9,9')).toEqual({ ok: false, reason: 'missing' });
    expect(renameMindmapNode(MINDMAP, '9,9', 'Ghost')).toEqual({ ok: false, reason: 'missing' });
  });

  it('is a no-op when rename label is unchanged', () => {
    const result = renameMindmapNode(MINDMAP, '0,0', 'Child1');
    expect(result).toEqual({ ok: true, source: MINDMAP });
  });
});

describe('parseMindmapNodeText shaped nodes', () => {
  it.each([
    ['nodeA[Square]', { kind: 'square-id', nodeId: 'nodeA', label: 'Square' }],
    ['[Plain square]', { kind: 'square', nodeId: null, label: 'Plain square' }],
    ['nodeB(Round)', { kind: 'round-id', nodeId: 'nodeB', label: 'Round' }],
    ['nodeC))Cloud((', { kind: 'cloud-id', nodeId: 'nodeC', label: 'Cloud' }],
    ['nodeD{Hexagon}', { kind: 'hex-id', nodeId: 'nodeD', label: 'Hexagon' }]
  ])('parses %s', (line, expected) => {
    expect(parseMindmapNodeText(line)).toMatchObject(expected);
    expect(formatMindmapNodeText(parseMindmapNodeText(line), expected.label)).toBe(line);
  });

  it('ignores meta and decoration lines', () => {
    expect(parseMindmapNodeText('classDef foo fill:#fff')).toBeNull();
    expect(parseMindmapNodeText('::icon(fa fa-star)')).toBeNull();
  });
});
