import { describe, expect, it } from 'vitest';
import {
  addLinkedErNode,
  connectErNodes,
  deleteErEdge,
  deleteErNode,
  isErFamilySource,
  parseErRelation,
  renameErNode
} from '../src/utils/mermaidErEdit.js';

const SAMPLE = `erDiagram
  CUSTOMER ||--o{ ORDER : places
  CUSTOMER {
    string id PK
    string name
  }
  ORDER {
    uuid id PK
  }
`;

describe('isErFamilySource', () => {
  it('recognizes erDiagram headers', () => {
    expect(isErFamilySource(SAMPLE)).toBe(true);
    expect(isErFamilySource('classDiagram\n  A --> B')).toBe(false);
  });
});

describe('parseErRelation', () => {
  it('parses cardinality and relationship labels', () => {
    expect(parseErRelation('  CUSTOMER ||--o{ ORDER : places')).toEqual({
      from: 'CUSTOMER',
      cardinality: '||--o{',
      to: 'ORDER',
      label: 'places'
    });
    expect(parseErRelation('  ORDER ||--|{ LINE_ITEM : contains')).toEqual({
      from: 'ORDER',
      cardinality: '||--|{',
      to: 'LINE_ITEM',
      label: 'contains'
    });
    expect(parseErRelation('  CUSTOMER ||--o{ ORDER')).toEqual({
      from: 'CUSTOMER',
      cardinality: '||--o{',
      to: 'ORDER',
      label: ''
    });
  });
});

describe('er diagram graph edit', () => {
  it('adds a linked entity with an attribute stub', () => {
    const result = addLinkedErNode(SAMPLE, 'CUSTOMER', 'Invoice');
    expect(result.ok).toBe(true);
    expect(result.newId).toBe('Entity1');
    expect(result.source).toMatch(/CUSTOMER \|\|--o\{ Entity1 : Invoice/);
    expect(result.source).toMatch(/Entity1 \{/);
    expect(result.source).toMatch(/string id/);
  });

  it('connects two existing entities', () => {
    const linked = connectErNodes(SAMPLE, 'CUSTOMER', 'ORDER');
    expect(linked.ok).toBe(false);
    expect(linked.reason).toBe('duplicate');

    const extra = addLinkedErNode(SAMPLE, 'ORDER', 'Line');
    const second = connectErNodes(extra.source, 'CUSTOMER', 'Entity1');
    expect(second.ok).toBe(true);
    expect(second.source).toMatch(/CUSTOMER \|\|--o\{ Entity1/);
  });

  it('deletes an entity, its block, and incident relations', () => {
    const result = deleteErNode(SAMPLE, 'ORDER');
    expect(result.ok).toBe(true);
    expect(result.source).not.toMatch(/ORDER/);
    expect(result.source).toMatch(/CUSTOMER \{/);
  });

  it('renames an entity everywhere it appears', () => {
    const result = renameErNode(SAMPLE, 'ORDER', 'Purchase');
    expect(result.ok).toBe(true);
    expect(result.newId).toBe('Purchase');
    expect(result.source).toMatch(/CUSTOMER \|\|--o\{ Purchase : places/);
    expect(result.source).toMatch(/Purchase \{/);
    expect(result.source).not.toMatch(/\bORDER\b/);
  });

  it('refuses duplicate rename targets', () => {
    expect(renameErNode(SAMPLE, 'ORDER', 'CUSTOMER')).toEqual({ ok: false, reason: 'duplicate' });
  });

  it('deletes one parallel relation when two exist', () => {
    const parallel = `erDiagram
  CUSTOMER ||--o{ ORDER : first
  CUSTOMER ||--o{ ORDER : second
`;
    const result = deleteErEdge(parallel, 'CUSTOMER', 'ORDER', 'second');
    expect(result.ok).toBe(true);
    expect(result.source).toMatch(/first/);
    expect(result.source).not.toMatch(/second/);
  });

  it('refuses stale relationship labels', () => {
    const parallel = `erDiagram
  CUSTOMER ||--o{ ORDER : first
  CUSTOMER ||--o{ ORDER : second
`;
    expect(deleteErEdge(parallel, 'CUSTOMER', 'ORDER', 'missing')).toEqual({
      ok: false,
      reason: 'missing'
    });
  });

  it('deletes and renames through colon-less relations', () => {
    const colonless = `erDiagram
  CUSTOMER ||--o{ ORDER
  CUSTOMER {
    string id
  }
  ORDER {
    uuid id
  }
`;
    const deleted = deleteErNode(colonless, 'CUSTOMER');
    expect(deleted.ok).toBe(true);
    expect(deleted.source).not.toMatch(/CUSTOMER/);

    const renamed = renameErNode(colonless, 'ORDER', 'Purchase');
    expect(renamed.ok).toBe(true);
    expect(renamed.source).toMatch(/CUSTOMER \|\|--o\{ Purchase/);
    expect(renamed.source).toMatch(/Purchase \{/);
    expect(renamed.source).not.toMatch(/\bORDER\b/);
  });
});
