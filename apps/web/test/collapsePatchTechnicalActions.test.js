import { describe, expect, it } from 'vitest';
import { collapseConsecutiveApplyPatchActions } from '../src/utils/collapsePatchTechnicalActions.js';

function formatLabel(name, repeatCount) {
  const base = name === 'apply_mermaid_patch' ? 'Apply diagram update' : name;
  if (name === 'apply_mermaid_patch' && repeatCount > 1) {
    const shown = Math.min(repeatCount, 3);
    return `${base} (×${shown})`;
  }
  return base;
}

describe('collapseConsecutiveApplyPatchActions', () => {
  it('returns unchanged when fewer than two actions', () => {
    const one = [
      { id: 'a', name: 'apply_mermaid_patch', label: 'Apply diagram update', status: 'done' }
    ];
    expect(collapseConsecutiveApplyPatchActions(one, formatLabel)).toBe(one);
    expect(collapseConsecutiveApplyPatchActions([], formatLabel)).toEqual([]);
  });

  it('merges two consecutive successful patch rows', () => {
    const actions = [
      { id: 'p1', name: 'apply_mermaid_patch', label: 'Apply diagram update', status: 'done' },
      { id: 'p2', name: 'apply_mermaid_patch', label: 'Apply diagram update', status: 'done' }
    ];
    const next = collapseConsecutiveApplyPatchActions(actions, formatLabel);
    expect(next).toHaveLength(1);
    expect(next[0].id).toBe('p1');
    expect(next[0].count).toBe(2);
    expect(next[0].label).toBe('Apply diagram update (×2)');
  });

  it('does not merge when another tool sits between patches', () => {
    const actions = [
      { id: 'p1', name: 'apply_mermaid_patch', label: 'Apply diagram update', status: 'done' },
      { id: 'g1', name: 'get_diagram_state', label: 'Read diagram snapshot', status: 'done' },
      { id: 'p2', name: 'apply_mermaid_patch', label: 'Apply diagram update', status: 'done' }
    ];
    expect(collapseConsecutiveApplyPatchActions(actions, formatLabel)).toEqual(actions);
  });

  it('merges incrementally for three consecutive completions', () => {
    let actions = [
      { id: 'p1', name: 'apply_mermaid_patch', label: 'Apply diagram update', status: 'done' }
    ];
    actions = [
      ...actions,
      { id: 'p2', name: 'apply_mermaid_patch', label: 'Apply diagram update', status: 'done' }
    ];
    actions = collapseConsecutiveApplyPatchActions(actions, formatLabel);
    expect(actions).toHaveLength(1);
    expect(actions[0].count).toBe(2);

    actions = [
      ...actions,
      { id: 'p3', name: 'apply_mermaid_patch', label: 'Apply diagram update', status: 'done' }
    ];
    actions = collapseConsecutiveApplyPatchActions(actions, formatLabel);
    expect(actions).toHaveLength(1);
    expect(actions[0].count).toBe(3);
    expect(actions[0].label).toBe('Apply diagram update (×3)');
  });

  it('caps merged patch label display at ×3 while preserving numeric count', () => {
    let actions = [
      { id: 'p1', name: 'apply_mermaid_patch', label: 'Apply diagram update', status: 'done' }
    ];
    for (let i = 2; i <= 4; i += 1) {
      actions = [
        ...actions,
        { id: `p${i}`, name: 'apply_mermaid_patch', label: 'Apply diagram update', status: 'done' }
      ];
      actions = collapseConsecutiveApplyPatchActions(actions, formatLabel);
    }
    expect(actions).toHaveLength(1);
    expect(actions[0].count).toBe(4);
    expect(actions[0].label).toBe('Apply diagram update (×3)');
  });
});
