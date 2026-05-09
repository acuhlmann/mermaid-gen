import { applyPatch, createInitialDiagramState } from '@mermaid-architect/shared';
import { validateAndPreparePatch } from '../tools/mermaidDiffTool.js';

export function createDiagramStateStore(initialState = createInitialDiagramState()) {
  let state = initialState;

  return {
    getState() {
      return state;
    },

    async applyMermaidSource({ mermaidSource, reason }) {
      const prepared = await validateAndPreparePatch({
        currentState: state,
        proposedMermaidSource: mermaidSource,
        reason
      });

      if (!prepared.accepted) {
        return prepared;
      }

      const applied = applyPatch(state, prepared.patch);
      if (!applied.accepted) {
        return applied;
      }

      state = applied.state;

      return {
        accepted: true,
        patch: prepared.patch,
        state,
        metadata: prepared.metadata
      };
    }
  };
}
