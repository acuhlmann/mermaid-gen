import { describe, expect, it } from 'vitest';

import { pickParallelEdgeRef } from '../src/utils/mermaidEdgeDisambiguation.js';

/** @param {Array<[number, string]>} rows */
const refs = (rows) => rows.map(([edgeIndex, text], lineIndex) => ({ lineIndex, edgeIndex, text }));

const PARALLEL = refs([
  [0, 'first'],
  [1, 'second'],
  [2, 'third']
]);

describe('pickParallelEdgeRef', () => {
  it('refuses when there is nothing to pick', () => {
    expect(pickParallelEdgeRef([], { edgeLabel: 'first', edgeIndex: 0 })).toBeNull();
  });

  it('lets the index win over a label that names a different edge', () => {
    expect(pickParallelEdgeRef(PARALLEL, { edgeLabel: 'third', edgeIndex: 0 })?.text).toBe('first');
  });

  it('treats index 0 as a real index rather than an absent one', () => {
    // `if (edgeIndex)` instead of a typeof check silently demotes the first
    // parallel edge to the label branch.
    expect(pickParallelEdgeRef(PARALLEL, { edgeLabel: 'second', edgeIndex: 0 })?.text).toBe(
      'first'
    );
  });

  it('refuses an index past the end instead of falling back to the first', () => {
    expect(pickParallelEdgeRef(PARALLEL, { edgeIndex: 9 })).toBeNull();
  });

  it('ignores a negative or non-integer index and falls through to the label', () => {
    expect(pickParallelEdgeRef(PARALLEL, { edgeLabel: 'third', edgeIndex: -1 })?.text).toBe(
      'third'
    );
    expect(pickParallelEdgeRef(PARALLEL, { edgeLabel: 'third', edgeIndex: 1.5 })?.text).toBe(
      'third'
    );
  });

  it('matches on the label when no index is known', () => {
    expect(pickParallelEdgeRef(PARALLEL, { edgeLabel: 'second' })?.text).toBe('second');
  });

  it('trims the label before matching', () => {
    expect(pickParallelEdgeRef(PARALLEL, { edgeLabel: '  second  ' })?.text).toBe('second');
  });

  it('refuses a stale label rather than editing a neighbouring edge', () => {
    expect(pickParallelEdgeRef(PARALLEL, { edgeLabel: 'gone' })).toBeNull();
  });

  it('takes the first edge when neither an index nor a label is given', () => {
    expect(pickParallelEdgeRef(PARALLEL, {})?.text).toBe('first');
    expect(pickParallelEdgeRef(PARALLEL, { edgeLabel: '   ' })?.text).toBe('first');
    expect(pickParallelEdgeRef(PARALLEL, { edgeLabel: 42 })?.text).toBe('first');
  });
});
