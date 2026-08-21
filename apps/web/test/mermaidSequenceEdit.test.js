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
});
