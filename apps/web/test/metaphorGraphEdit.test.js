import { describe, expect, it } from 'vitest';
import { metaphorItemDescriptor } from '../src/utils/metaphorGraphEdit.js';

describe('metaphorItemDescriptor', () => {
  it('returns null without an item id', () => {
    expect(metaphorItemDescriptor(null, 'tree')).toBeNull();
    expect(metaphorItemDescriptor({}, 'tree')).toBeNull();
    expect(metaphorItemDescriptor({ label: 'CEO' }, 'tree')).toBeNull();
  });

  it('builds the canvas graph-edit descriptor shape', () => {
    expect(metaphorItemDescriptor({ id: 'ceo', label: ' CEO ' }, 'tree')).toEqual({
      kind: 'metaphor-item',
      id: 'metaphor3d-ceo',
      dataId: 'ceo',
      partName: 'CEO',
      label: 'CEO',
      metaphor: 'tree'
    });
  });

  it('falls back to the id for label and defaults metaphor to tree', () => {
    expect(metaphorItemDescriptor({ id: 'ceo' })).toMatchObject({
      label: 'ceo',
      partName: 'ceo',
      metaphor: 'tree'
    });
  });

  it('preserves the scene metaphor kind on the descriptor', () => {
    expect(metaphorItemDescriptor({ id: 'n1', label: 'Branch' }, 'city')).toMatchObject({
      dataId: 'n1',
      metaphor: 'city'
    });
  });
});
