import { describe, expect, it } from 'vitest';
import {
  addLinkedPieNode,
  deletePieNode,
  isPieFamilySource,
  parsePieDoc,
  parsePieSliceLine,
  renamePieNode,
  pieLabelRef
} from '../src/utils/mermaidPieEdit.js';

const PIE = `pie showData
  title Pets adopted
  "Dogs" : 386
  "Cats" : 85
  "Rats" : 15
`;

describe('isPieFamilySource', () => {
  it('accepts pie diagrams only', () => {
    expect(isPieFamilySource(PIE)).toBe(true);
    expect(isPieFamilySource('timeline\n  title T\n  A : 1')).toBe(false);
  });
});

describe('parsePieSliceLine', () => {
  it('parses quoted and bare labels with numeric values', () => {
    expect(parsePieSliceLine('"Dogs" : 386')).toEqual({ label: 'Dogs', value: '386' });
    expect(parsePieSliceLine('Birds : 3')).toEqual({ label: 'Birds', value: '3' });
    expect(parsePieSliceLine('title Pets')).toBeNull();
  });
});

describe('pie Connect / Delete / Rename', () => {
  it('adds a sibling slice after the selected row', () => {
    const result = addLinkedPieNode(PIE, '1', 'Hamsters');
    expect(result.ok).toBe(true);
    expect(result.newId).toBe('2');
    expect(result.source).toMatch(/"Cats" : 85\n\s+"Hamsters" : 85/);
  });

  it('resolves clicks by label', () => {
    const result = addLinkedPieNode(PIE, pieLabelRef('Dogs'), 'Puppies');
    expect(result.ok).toBe(true);
    expect(result.source).toMatch(/"Dogs" : 386\n\s+"Puppies" : 386/);
  });

  it('refuses deleting the last remaining slice', () => {
    const single = `pie title Solo\n  "Only" : 1`;
    expect(deletePieNode(single, '0')).toMatchObject({ ok: false, reason: 'last' });
  });

  it('deletes a selected slice', () => {
    const result = deletePieNode(PIE, '2');
    expect(result.ok).toBe(true);
    expect(result.source).not.toMatch(/"Rats" : 15/);
  });

  it('renames a slice label and keeps its value', () => {
    const result = renamePieNode(PIE, '0', 'Canines');
    expect(result.ok).toBe(true);
    expect(result.source).toMatch(/"Canines" : 386/);
    expect(result.source).not.toMatch(/"Dogs" : 386/);
  });

  it('refuses rename when the label is empty', () => {
    expect(renamePieNode(PIE, '0', '  ')).toMatchObject({ ok: false, reason: 'empty' });
  });

  it('parses slices in source order', () => {
    const doc = parsePieDoc(PIE);
    expect(doc?.slices.map((slice) => slice.label)).toEqual(['Dogs', 'Cats', 'Rats']);
  });
});
