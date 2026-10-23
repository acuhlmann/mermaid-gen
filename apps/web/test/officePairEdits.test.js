import { describe, expect, it } from 'vitest';
import {
  PAIR_LULL_BASE_MS,
  describePairEdit,
  isComposingText,
  pairLullDelayMs
} from '../src/utils/officePairEdits.js';

const before = {
  diagramSource: 'flowchart TD\n  Auth --> Billing',
  labels: ['Auth', 'Billing'],
  ids: ['flowchart-Auth-0', 'flowchart-Billing-1']
};

describe('describePairEdit', () => {
  it('names a box you added and points at it', () => {
    const after = {
      diagramSource: 'flowchart TD\n  Auth --> Billing\n  Billing --> Cache',
      labels: ['Auth', 'Billing', 'Cache'],
      ids: ['flowchart-Auth-0', 'flowchart-Billing-1', 'flowchart-Cache-2']
    };
    expect(describePairEdit(before, after)).toEqual({
      text: 'added a box "Cache"',
      focusId: 'flowchart-Cache-2',
      kind: 'boxes'
    });
  });

  it('reads one box out and one in as a rename', () => {
    const after = {
      diagramSource: 'flowchart TD\n  Auth --> Payments',
      labels: ['Auth', 'Payments'],
      ids: ['flowchart-Auth-0', 'flowchart-Payments-1']
    };
    expect(describePairEdit(before, after)).toEqual({
      text: 'renamed "Billing" to "Payments"',
      focusId: 'flowchart-Payments-1',
      kind: 'rename'
    });
  });

  it('names removals, and caps a long list', () => {
    const many = {
      diagramSource: 'flowchart TD\n  A\n  B\n  C\n  D\n  E',
      labels: ['A', 'B', 'C', 'D', 'E'],
      ids: []
    };
    const empty = { diagramSource: 'flowchart TD', labels: [], ids: [] };
    expect(describePairEdit(many, empty)).toEqual({
      text: 'removed the boxes "A", "B", "C" and 2 more',
      focusId: null,
      kind: 'boxes'
    });
  });

  it('falls back to the new source lines when no box changed', () => {
    const after = {
      ...before,
      diagramSource: 'flowchart TD\n  Auth --> Billing\n  Billing -.-> Auth'
    };
    expect(describePairEdit(before, after)).toEqual({
      text: 'edited the diagram: `Billing -.-> Auth`',
      focusId: null,
      kind: 'source'
    });
  });

  it('says nothing about a change that is only whitespace', () => {
    expect(
      describePairEdit(before, { ...before, diagramSource: `${before.diagramSource}\n\n` })
    ).toBeNull();
  });
});

describe('pairLullDelayMs', () => {
  it('doubles each time, with jitter either side', () => {
    expect(pairLullDelayMs(0, () => 0.5)).toBe(PAIR_LULL_BASE_MS);
    expect(pairLullDelayMs(1, () => 0.5)).toBe(PAIR_LULL_BASE_MS * 2);
    expect(pairLullDelayMs(0, () => 0)).toBe(PAIR_LULL_BASE_MS * 0.8);
    expect(pairLullDelayMs(0, () => 1)).toBe(PAIR_LULL_BASE_MS * 1.2);
  });
});

describe('isComposingText', () => {
  it('is true only for a text field with something typed in it', () => {
    const doc = (activeElement) => ({ activeElement });
    expect(isComposingText(doc(null))).toBe(false);
    expect(isComposingText(doc({ tagName: 'INPUT', value: '  ' }))).toBe(false);
    expect(isComposingText(doc({ tagName: 'INPUT', value: 'why' }))).toBe(true);
    expect(isComposingText(doc({ tagName: 'BUTTON', value: 'x' }))).toBe(false);
    expect(isComposingText(doc({ isContentEditable: true }))).toBe(true);
    // Monaco always keeps text in its hidden textarea; that is not a sentence.
    expect(
      isComposingText(doc({ tagName: 'TEXTAREA', value: 'flowchart', closest: () => ({}) }))
    ).toBe(false);
  });
});
