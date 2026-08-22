import { describe, expect, it } from 'vitest';
import {
  addLinkedSequenceNode,
  allocateSequenceParticipantId,
  connectSequenceNodes,
  deleteSequenceEdge,
  deleteSequenceNode,
  isSequenceFamilySource,
  parseSequenceMessage,
  renameSequenceEdge,
  renameSequenceNode
} from '../src/utils/mermaidSequenceEdit.js';

const SEQUENCE = `sequenceDiagram
  participant Alice
  participant Bob as Robert
  Alice->>Bob: Hello
  Bob-->>Alice: Hi there
`;

describe('isSequenceFamilySource', () => {
  it('accepts sequenceDiagram and rejects flowchart', () => {
    expect(isSequenceFamilySource('sequenceDiagram\n  Alice->>Bob: hi')).toBe(true);
    expect(isSequenceFamilySource('flowchart TD\n  A --> B')).toBe(false);
  });
});

describe('parseSequenceMessage', () => {
  it('parses message lines and ignores declarations', () => {
    expect(parseSequenceMessage('  Alice->>Bob: Hello')).toEqual({
      from: 'Alice',
      to: 'Bob',
      text: 'Hello'
    });
    expect(parseSequenceMessage('  participant Alice')).toBeNull();
  });
});

describe('connectSequenceNodes', () => {
  it('inserts a message after the source participant activity', () => {
    const result = connectSequenceNodes(SEQUENCE, 'Alice', 'Bob');
    expect(result.ok).toBe(true);
    expect(result.source).toMatch(/Alice->>Bob: Hello[\s\S]*Alice->>Bob: Item 1/);
  });

  it('refuses self messages', () => {
    expect(connectSequenceNodes(SEQUENCE, 'Alice', 'Alice')).toEqual({ ok: false, reason: 'self' });
  });

  it('refuses missing participants', () => {
    expect(connectSequenceNodes(SEQUENCE, 'Alice', 'Missing')).toEqual({
      ok: false,
      reason: 'missing'
    });
  });
});

describe('addLinkedSequenceNode', () => {
  it('declares a new participant and links a message from the source', () => {
    const result = addLinkedSequenceNode(SEQUENCE, 'Alice', 'Charlie');
    expect(result.ok).toBe(true);
    expect(result.newId).toBe('p1');
    expect(result.source).toMatch(/participant p1 as Charlie/);
    expect(result.source).toMatch(/Alice->>p1: Charlie/);
  });

  it('allocates safe ids', () => {
    expect(allocateSequenceParticipantId(SEQUENCE)).toBe('p1');
  });
});

describe('deleteSequenceNode', () => {
  it('removes a participant declaration and all related messages', () => {
    const result = deleteSequenceNode(SEQUENCE, 'Bob');
    expect(result.ok).toBe(true);
    expect(result.source).not.toMatch(/Bob/);
  });

  it('refuses missing participants', () => {
    expect(deleteSequenceNode(SEQUENCE, 'Missing')).toEqual({ ok: false, reason: 'missing' });
  });
});

describe('deleteSequenceEdge', () => {
  it('removes the first matching message line', () => {
    const result = deleteSequenceEdge(SEQUENCE, 'Alice', 'Bob');
    expect(result.ok).toBe(true);
    expect(result.source).not.toMatch(/Alice->>Bob: Hello/);
    expect(result.source).toMatch(/Bob-->>Alice: Hi there/);
  });

  it('removes the message that matches the label when duplicates exist', () => {
    const duplicate = `sequenceDiagram
  participant Alice
  participant Bob
  Alice->>Bob: first
  Alice->>Bob: second
`;
    const result = deleteSequenceEdge(duplicate, 'Alice', 'Bob', 'second');
    expect(result.ok).toBe(true);
    expect(result.source).toMatch(/Alice->>Bob: first/);
    expect(result.source).not.toMatch(/: second/);
  });

  it('refuses delete when the label no longer matches the source', () => {
    const duplicate = `sequenceDiagram
  participant Alice
  participant Bob
  Alice->>Bob: first
  Alice->>Bob: second
`;
    expect(deleteSequenceEdge(duplicate, 'Alice', 'Bob', 'missing')).toEqual({
      ok: false,
      reason: 'missing'
    });
  });
});

describe('renameSequenceNode', () => {
  it('updates an existing alias declaration', () => {
    const result = renameSequenceNode(SEQUENCE, 'Bob', 'Bobby');
    expect(result.ok).toBe(true);
    expect(result.source).toMatch(/participant Bob as Bobby/);
    expect(result.source).not.toMatch(/as Robert/);
  });

  it('adds a declaration for an implicit participant', () => {
    const implicit = 'sequenceDiagram\n  Alice->>Bob: hi';
    const result = renameSequenceNode(implicit, 'Bob', 'Robert');
    expect(result.ok).toBe(true);
    expect(result.source).toMatch(/participant Bob as Robert/);
  });

  it('refuses empty labels', () => {
    expect(renameSequenceNode(SEQUENCE, 'Alice', '   ')).toEqual({ ok: false, reason: 'empty' });
  });
});

describe('renameSequenceEdge', () => {
  it('updates a message label', () => {
    const result = renameSequenceEdge(SEQUENCE, 'Alice', 'Bob', 'Howdy');
    expect(result.ok).toBe(true);
    expect(result.source).toMatch(/Alice->>Bob: Howdy/);
    expect(result.source).not.toMatch(/: Hello/);
  });

  it('refuses rename when the label no longer matches the source', () => {
    const duplicate = `sequenceDiagram
  participant Alice
  participant Bob
  Alice->>Bob: first
  Alice->>Bob: second
`;
    expect(renameSequenceEdge(duplicate, 'Alice', 'Bob', 'changed', 'missing')).toEqual({
      ok: false,
      reason: 'missing'
    });
  });

  it('updates the message that matches the label when duplicates exist', () => {
    const duplicate = `sequenceDiagram
  participant Alice
  participant Bob
  Alice->>Bob: first
  Alice->>Bob: second
`;
    const result = renameSequenceEdge(duplicate, 'Alice', 'Bob', 'changed', 'second');
    expect(result.ok).toBe(true);
    expect(result.source).toMatch(/Alice->>Bob: first/);
    expect(result.source).toMatch(/Alice->>Bob: changed/);
    expect(result.source).not.toMatch(/: second/);
  });

  it('refuses a missing message', () => {
    expect(renameSequenceEdge(SEQUENCE, 'Bob', 'Charlie', 'Nope')).toEqual({
      ok: false,
      reason: 'missing'
    });
  });
});

describe('sequence edit guards', () => {
  const flowchart = 'flowchart TD\n  A --> B';

  it('refuses non-sequence sources', () => {
    expect(addLinkedSequenceNode(flowchart, 'Alice')).toEqual({
      ok: false,
      reason: 'not-sequence'
    });
    expect(connectSequenceNodes(flowchart, 'Alice', 'Bob')).toEqual({
      ok: false,
      reason: 'not-sequence'
    });
    expect(deleteSequenceNode(flowchart, 'Alice')).toEqual({ ok: false, reason: 'not-sequence' });
    expect(renameSequenceNode(flowchart, 'Alice', 'Ann')).toEqual({
      ok: false,
      reason: 'not-sequence'
    });
  });

  it('refuses malformed participant ids', () => {
    expect(connectSequenceNodes(SEQUENCE, '9bad', 'Bob')).toEqual({ ok: false, reason: 'bad-id' });
    expect(addLinkedSequenceNode(SEQUENCE, 'bad id')).toEqual({ ok: false, reason: 'bad-id' });
  });

  it('returns missing when the participant does not exist', () => {
    expect(deleteSequenceNode(SEQUENCE, 'Missing')).toEqual({ ok: false, reason: 'missing' });
    expect(deleteSequenceEdge(SEQUENCE, 'Alice', 'Missing')).toEqual({
      ok: false,
      reason: 'missing'
    });
  });

  it('is a no-op when rename label is unchanged', () => {
    expect(renameSequenceNode(SEQUENCE, 'Bob', 'Robert')).toEqual({ ok: true, source: SEQUENCE });
  });
});

describe('parseSequenceMessage arrow variants', () => {
  it('parses dashed reply arrows', () => {
    expect(parseSequenceMessage('  Bob-->>Alice: Hi there')).toEqual({
      from: 'Bob',
      to: 'Alice',
      text: 'Hi there'
    });
  });
});

describe('deleteSequenceNode lifecycle lines', () => {
  it('removes activate and deactivate lines for the participant', () => {
    const withActivate = `sequenceDiagram
  participant Alice
  participant Bob
  Alice->>Bob: ping
  activate Bob
  Bob-->>Alice: pong
  deactivate Bob
`;
    const result = deleteSequenceNode(withActivate, 'Bob');
    expect(result.ok).toBe(true);
    expect(result.source).not.toMatch(/\bBob\b/);
    expect(result.source).not.toMatch(/activate|deactivate/);
  });

  it('removes create, destroy, and note lines for the participant', () => {
    const withLifecycle = `sequenceDiagram
  participant Alice
  participant Bob
  create participant Alice
  Alice->>Bob: hi
  note over Bob: waiting
  destroy Bob
`;
    const result = deleteSequenceNode(withLifecycle, 'Bob');
    expect(result.ok).toBe(true);
    expect(result.source).not.toMatch(/\bBob\b/);
    expect(result.source).not.toMatch(/destroy|note over/);
    expect(result.source).toMatch(/create participant Alice/);
  });
});

describe('sequence edit guard precedence', () => {
  const flowchart = 'flowchart TD\n  A --> B';

  /** Mutators that guard a single participant id before doing any work. */
  const singleIdMutators = [
    ['addLinkedSequenceNode', (source, id) => addLinkedSequenceNode(source, id)],
    ['renameSequenceNode', (source, id) => renameSequenceNode(source, id, 'Renamed')],
    ['deleteSequenceNode', (source, id) => deleteSequenceNode(source, id)]
  ];

  /** Mutators that guard both endpoints of a message before doing any work. */
  const edgeMutators = [
    ['connectSequenceNodes', (source, from, to) => connectSequenceNodes(source, from, to)],
    ['deleteSequenceEdge', (source, from, to) => deleteSequenceEdge(source, from, to)],
    ['renameSequenceEdge', (source, from, to) => renameSequenceEdge(source, from, to, 'Label')]
  ];

  it('covers every guarded mutator', () => {
    expect(singleIdMutators).toHaveLength(3);
    expect(edgeMutators).toHaveLength(3);
  });

  it.each(singleIdMutators)('%s rejects in the order sequence, id shape, existence', (_, run) => {
    expect(run(flowchart, '9bad')).toEqual({ ok: false, reason: 'not-sequence' });
    expect(run(SEQUENCE, '9bad')).toEqual({ ok: false, reason: 'bad-id' });
    expect(run(SEQUENCE, 'Missing')).toEqual({ ok: false, reason: 'missing' });
  });

  it.each(edgeMutators)('%s rejects in the order sequence, id shape, existence', (_, run) => {
    expect(run(flowchart, '9bad', 'Bob')).toEqual({ ok: false, reason: 'not-sequence' });
    expect(run(SEQUENCE, '9bad', 'Bob')).toEqual({ ok: false, reason: 'bad-id' });
    expect(run(SEQUENCE, 'Alice', '9bad')).toEqual({ ok: false, reason: 'bad-id' });
    expect(run(SEQUENCE, 'Missing', 'Bob')).toEqual({ ok: false, reason: 'missing' });
    expect(run(SEQUENCE, 'Alice', 'Missing')).toEqual({ ok: false, reason: 'missing' });
  });

  it.each(edgeMutators)('%s checks both id shapes before either existence', (_, run) => {
    // Grouping the guards per-argument instead would report the missing `from`
    // before the malformed `to`; the shared chain checks both shapes first.
    expect(run(SEQUENCE, 'Missing', '9bad')).toEqual({ ok: false, reason: 'bad-id' });
  });
});
