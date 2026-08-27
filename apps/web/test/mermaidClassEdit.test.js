import { describe, expect, it } from 'vitest';
import {
  addLinkedClassNode,
  connectClassNodes,
  deleteClassEdge,
  deleteClassNode,
  isClassFamilySource,
  parseClassRelation,
  renameClassNode
} from '../src/utils/mermaidClassEdit.js';

const SAMPLE = `classDiagram
  Animal <|-- Duck
  Animal : +int age
  Duck : +swim()
`;

describe('isClassFamilySource', () => {
  it('recognizes classDiagram headers', () => {
    expect(isClassFamilySource(SAMPLE)).toBe(true);
    expect(isClassFamilySource('flowchart TD\n  A --> B')).toBe(false);
  });
});

describe('parseClassRelation', () => {
  it('parses inheritance and association arrows', () => {
    expect(parseClassRelation('  Animal <|-- Duck')).toEqual({
      from: 'Animal',
      arrow: '<|--',
      to: 'Duck'
    });
    expect(parseClassRelation('  Service --> Repository')).toEqual({
      from: 'Service',
      arrow: '-->',
      to: 'Repository'
    });
  });
});

describe('class diagram graph edit', () => {
  it('adds a linked class with a member stub', () => {
    const result = addLinkedClassNode(SAMPLE, 'Animal', 'Goose');
    expect(result.ok).toBe(true);
    expect(result.newId).toBe('Class1');
    expect(result.source).toMatch(/Animal --> Class1/);
    expect(result.source).toMatch(/Class1 : Goose/);
  });

  it('connects two existing classes', () => {
    const linked = connectClassNodes(SAMPLE, 'Animal', 'Duck');
    expect(linked.ok).toBe(true);
    expect(linked.source).toMatch(/Animal --> Duck/);
    expect(linked.source).toMatch(/Animal <\|-- Duck/);
    const extra = addLinkedClassNode(SAMPLE, 'Animal', 'Goose');
    const second = connectClassNodes(extra.source, 'Duck', 'Class1');
    expect(second.ok).toBe(true);
    expect(second.source).toMatch(/Duck --> Class1/);
  });

  it('deletes a class and its relations and members', () => {
    const result = deleteClassNode(SAMPLE, 'Duck');
    expect(result.ok).toBe(true);
    expect(result.source).not.toMatch(/Duck/);
    expect(result.source).toMatch(/Animal : \+int age/);
  });

  it('renames a class everywhere it appears', () => {
    const result = renameClassNode(SAMPLE, 'Duck', 'Mallard');
    expect(result.ok).toBe(true);
    expect(result.newId).toBe('Mallard');
    expect(result.source).toMatch(/Animal <\|-- Mallard/);
    expect(result.source).toMatch(/Mallard : \+swim\(\)/);
    expect(result.source).not.toMatch(/Duck/);
  });

  it('refuses duplicate rename targets', () => {
    expect(renameClassNode(SAMPLE, 'Duck', 'Animal')).toEqual({ ok: false, reason: 'duplicate' });
  });

  it('deletes one parallel relation when two exist', () => {
    const parallel = `classDiagram
  Service --> Repository
  Service --> Repository
`;
    const result = deleteClassEdge(parallel, 'Service', 'Repository', undefined, 1);
    expect(result.ok).toBe(true);
    expect(result.source.match(/Service --> Repository/g)?.length).toBe(1);
  });
});
