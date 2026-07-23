import { describe, expect, it } from 'vitest';
import {
  buildAdvisorIntentPrompt,
  buildOfficeBatchIntentPrompt,
  focusNodeFromAdvisorDescriptor,
  resolveAdvisorFocusNode
} from '../src/utils/advisorActionContext.js';

describe('advisorActionContext', () => {
  it('strips source from advisor focus descriptors', () => {
    expect(
      focusNodeFromAdvisorDescriptor({
        id: 'A',
        label: 'Alpha',
        selectionKind: 'node',
        source: 'hover'
      })
    ).toEqual({ id: 'A', label: 'Alpha', selectionKind: 'node' });
  });

  it('prefers advisor focus over canvas selection', () => {
    const node = resolveAdvisorFocusNode({
      advisorFocusDescriptor: { id: 'H', selectionKind: 'node', source: 'hover' },
      selectedNode: { id: 'S', kind: 'node', label: 'Selected' }
    });
    expect(node).toEqual({ id: 'H', selectionKind: 'node' });
  });

  it('wraps suggestion text for scoped intent prompts', () => {
    const prompt = buildAdvisorIntentPrompt('Rename Cache to Redis');
    expect(prompt).toContain('stakeholder suggestion');
    expect(prompt).toContain('Rename Cache to Redis');
    expect(prompt).toContain('do not rewrite unrelated');
  });

  it('batches multiple office action items into one intent prompt', () => {
    const prompt = buildOfficeBatchIntentPrompt([
      'Label the Retail node',
      'Add an owner to Consumption'
    ]);
    expect(prompt).toContain('stakeholder suggestions');
    expect(prompt).toContain('Label the Retail node');
    expect(prompt).toContain('Add an owner to Consumption');
  });
});
