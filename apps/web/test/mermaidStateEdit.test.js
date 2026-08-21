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

  it('refuses a missing transition', () => {
    expect(renameStateEdge(STATE, 'Approved', 'Draft', 'reopen')).toEqual({
      ok: false,
      reason: 'missing'
    });
  });
});

describe('state edit guards', () => {
  const flowchart = 'flowchart TD\n  A --> B';

  it('refuses non-state sources', () => {
    expect(addLinkedStateNode(flowchart, 'Draft')).toEqual({ ok: false, reason: 'not-state' });
    expect(connectStateNodes(flowchart, 'Draft', 'PendingReview')).toEqual({
      ok: false,
      reason: 'not-state'
    });
    expect(deleteStateNode(flowchart, 'Draft')).toEqual({ ok: false, reason: 'not-state' });
    expect(renameStateNode(flowchart, 'Draft', 'Work')).toEqual({ ok: false, reason: 'not-state' });
  });

  it('refuses the start/end pseudo-state for mutating ops', () => {
    expect(deleteStateNode(STATE, '[*]')).toEqual({ ok: false, reason: 'special' });
    expect(renameStateNode(STATE, '[*]', 'Start')).toEqual({ ok: false, reason: 'special' });
    expect(addLinkedStateNode(STATE, '[*]')).toEqual({ ok: false, reason: 'special' });
    expect(connectStateNodes(STATE, '[*]', 'Draft')).toEqual({ ok: false, reason: 'special' });
  });

  it('returns missing when the state does not exist', () => {
    expect(deleteStateNode(STATE, 'Missing')).toEqual({ ok: false, reason: 'missing' });
    expect(deleteStateEdge(STATE, 'Draft', 'Missing')).toEqual({ ok: false, reason: 'missing' });
  });

  it('is a no-op when rename label is unchanged', () => {
    expect(renameStateNode(STATE, 'PendingReview', 'Waiting for approval')).toEqual({
      ok: true,
      source: STATE
    });
  });
});

describe('state alias declarations', () => {
  const ALIAS = `stateDiagram-v2
  state "Work in progress" as Draft
  [*] --> Draft
  Draft --> Done
`;

  it('renames through the alias line', () => {
    const result = renameStateNode(ALIAS, 'Draft', 'Editing');
    expect(result.ok).toBe(true);
    expect(result.source).toMatch(/state "Editing" as Draft/);
    expect(result.source).not.toMatch(/Work in progress/);
  });

  it('collects aliased ids for connect and delete', () => {
    expect(connectStateNodes(ALIAS, 'Draft', 'Done')).toEqual({ ok: false, reason: 'duplicate' });
    const removed = deleteStateNode(ALIAS, 'Draft');
    expect(removed.ok).toBe(true);
    expect(removed.source).not.toMatch(/\bDraft\b/);
  });
});
