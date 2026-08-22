import { describe, expect, it } from 'vitest';
import { sanitizeMetaphorDsl } from '@archislop/shared';
import {
  addLinkedTreeNode,
  connectTreeNodes,
  deleteTreeEdge,
  deleteTreeNode,
  isTreeFamilySource,
  renameTreeEdge,
  renameTreeNode
} from '../src/utils/metaphorTreeEdit.js';

const TREE = JSON.stringify(
  {
    metaphor: 'tree',
    scene: { theme: 'whiteboard', camera: 'orbit' },
    items: [
      { id: 'ceo', label: 'CEO', weight: 8 },
      { id: 'cto', label: 'CTO', parent: 'ceo', weight: 6 },
      { id: 'platform', label: 'Platform Team', parent: 'cto', weight: 4 },
      { id: 'infra', label: 'Infra', parent: 'platform', weight: 2 }
    ],
    links: []
  },
  null,
  2
);

describe('isTreeFamilySource', () => {
  it('recognises tree metaphor JSON only', () => {
    expect(isTreeFamilySource(TREE)).toBe(true);
    expect(isTreeFamilySource('{"metaphor":"city","items":[]}')).toBe(false);
    expect(isTreeFamilySource('not json')).toBe(false);
  });
});

describe('metaphor tree graph edit', () => {
  it('adds a child item under the selected parent', () => {
    const result = addLinkedTreeNode(TREE, 'cto', 'New branch');
    expect(result).toMatchObject({ ok: true, newId: 'n1', newLabel: 'New branch' });
    const parsed = JSON.parse(result.source);
    expect(parsed.items).toContainEqual({
      id: 'n1',
      label: 'New branch',
      parent: 'cto',
      weight: 3
    });
    expect(sanitizeMetaphorDsl(result.source).dsl).toBeTruthy();
  });

  it('deletes a node and its descendants', () => {
    const result = deleteTreeNode(TREE, 'cto');
    expect(result.ok).toBe(true);
    const ids = JSON.parse(result.source).items.map((item) => item.id);
    expect(ids).toEqual(['ceo']);
  });

  it('refuses to delete a root node', () => {
    expect(deleteTreeNode(TREE, 'ceo')).toEqual({ ok: false, reason: 'root' });
  });

  it('renames an item label', () => {
    const result = renameTreeNode(TREE, 'platform', 'Platform');
    expect(result.ok).toBe(true);
    const item = JSON.parse(result.source).items.find((row) => row.id === 'platform');
    expect(item.label).toBe('Platform');
  });

  it('refuses empty rename labels', () => {
    expect(renameTreeNode(TREE, 'platform', '   ')).toEqual({ ok: false, reason: 'empty' });
  });

  it('does not support link verbs', () => {
    expect(connectTreeNodes(TREE, 'ceo', 'cto')).toEqual({ ok: false, reason: 'no-link' });
    expect(deleteTreeEdge(TREE, 'ceo', 'cto')).toEqual({ ok: false, reason: 'not-graph' });
    expect(renameTreeEdge(TREE, 'ceo', 'cto', 'x')).toEqual({ ok: false, reason: 'not-graph' });
  });
});
