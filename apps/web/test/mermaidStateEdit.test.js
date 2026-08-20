import { describe, expect, it } from 'vitest';
import {
  addLinkedStateNode,
  allocateStateNodeId,
  connectStateNodes,
  deleteStateEdge,
  deleteStateNode,
  isStateFamilySource,
  parseStateTransition,
  renameStateEdge,
  renameStateNode
} from '../src/utils/mermaidStateEdit.js';

const STATE = `stateDiagram-v2
  [*] --> Draft
  Draft --> PendingReview : submit
  PendingReview --> Approved : approve
  PendingReview : Waiting for approval
`;

describe('isStateFamilySource', () => {
  it('accepts stateDiagram-v2 and rejects flowchart', () => {
    expect(isStateFamilySource('stateDiagram-v2\n  [*] --> A')).toBe(true);
    expect(isStateFamilySource('stateDiagram\n  [*] --> A')).toBe(true);
    expect(isStateFamilySource('flowchart TD\n  A --> B')).toBe(false);
  });
});

describe('parseStateTransition', () => {
  it('parses transitions and ignores state descriptions', () => {
    expect(parseStateTransition('  Draft --> PendingReview : submit')).toEqual({
      from: 'Draft',
      to: 'PendingReview',
      text: 'submit'
    });
    expect(parseStateTransition('  PendingReview : Waiting for approval')).toBeNull();
  });
});

describe('connectStateNodes', () => {
  it('adds Approved --> Draft and refuses duplicates', () => {
    expect(connectStateNodes(STATE, 'Draft', 'PendingReview')).toEqual({
      ok: false,
      reason: 'duplicate'
    });
    const added = connectStateNodes(STATE, 'Approved', 'Draft');
    expect(added.ok).toBe(true);
    expect(added.source).toMatch(/Approved --> Draft/);
  });

  it('refuses self-links', () => {
    expect(connectStateNodes(STATE, 'Draft', 'Draft')).toEqual({ ok: false, reason: 'self' });
  });

  it('refuses missing endpoints', () => {
    expect(connectStateNodes(STATE, 'Draft', 'Missing')).toEqual({ ok: false, reason: 'missing' });
  });
});

describe('addLinkedStateNode', () => {
  it('births a child state with a transition and description', () => {
    const result = addLinkedStateNode(STATE, 'Draft', 'Revision');
    expect(result.ok).toBe(true);
    expect(result.newId).toBe('n1');
    expect(result.source).toMatch(/Draft --> n1/);
    expect(result.source).toMatch(/n1 : Revision/);
  });

  it('allocates safe ids', () => {
    expect(allocateStateNodeId(STATE)).toBe('n1');
  });
});

describe('deleteStateNode', () => {
  it('removes a state, its transitions, and its description', () => {
    const result = deleteStateNode(STATE, 'PendingReview');
    expect(result.ok).toBe(true);
    expect(result.source).not.toMatch(/PendingReview/);
  });

  it('refuses the start/end pseudo-state', () => {
    expect(deleteStateNode(STATE, '[*]')).toEqual({ ok: false, reason: 'special' });
  });
});

describe('deleteStateEdge', () => {
  it('removes one transition', () => {
    const result = deleteStateEdge(STATE, 'Draft', 'PendingReview');
    expect(result.ok).toBe(true);
    expect(result.source).not.toMatch(/Draft --> PendingReview/);
    expect(result.source).toMatch(/PendingReview --> Approved/);
  });
});

describe('renameStateNode', () => {
  it('updates an existing description line', () => {
    const result = renameStateNode(STATE, 'PendingReview', 'In review');
    expect(result.ok).toBe(true);
    expect(result.source).toMatch(/PendingReview : In review/);
    expect(result.source).not.toMatch(/Waiting for approval/);
  });

  it('adds a description when the state only appeared in transitions', () => {
    const result = renameStateNode(STATE, 'Draft', 'Work in progress');
    expect(result.ok).toBe(true);
    expect(result.source).toMatch(/Draft : Work in progress/);
  });

  it('refuses empty labels', () => {
    expect(renameStateNode(STATE, 'Draft', '   ')).toEqual({ ok: false, reason: 'empty' });
  });
});

describe('renameStateEdge', () => {
  it('updates a transition label', () => {
    const result = renameStateEdge(STATE, 'Draft', 'PendingReview', 'send for review');
    expect(result.ok).toBe(true);
    expect(result.source).toMatch(/Draft --> PendingReview : send for review/);
    expect(result.source).not.toMatch(/: submit/);
  });
});
