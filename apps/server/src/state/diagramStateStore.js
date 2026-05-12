import { applyPatch, createInitialDiagramState } from '@mermaid-architect/shared';
import { redactSecrets } from '../utils/redactSecrets.js';
import { applyMermaidStyleDirective, parseMermaidStyleConfig } from '@mermaid-architect/shared';
import { validateAndPreparePatch } from '../tools/mermaidDiffTool.js';
import { validateMermaidStrict } from '../agents/mermaidReliabilitySkill.js';

export function createDiagramStateStore(initialState = createInitialDiagramState()) {
  let state = initialState;

  return {
    getState() {
      return state;
    },

    async syncClientMermaidSource({ mermaidSource, styleConfig }) {
      const candidate = mermaidSource?.trim();
      if (!candidate) {
        if (state.mermaidSource === '') {
          return { accepted: true, state };
        }
        state = {
          ...state,
          revisionId: state.revisionId + 1,
          mermaidSource: '',
          updatedAt: new Date().toISOString()
        };
        return {
          accepted: true,
          state
        };
      }

      // Short-circuit: if the client is syncing the exact source we already hold (and no new
      // styleConfig is requested), skip strict JSDOM validation entirely. The current source
      // was validated when it was accepted; the agent's apply_mermaid_patch will revalidate
      // before any real change. This removes a full validator round trip from every thinking
      // action when the user hasn't edited the diagram since the last accept.
      if (!styleConfig && state.mermaidSource && candidate === state.mermaidSource.trim()) {
        return { accepted: true, state };
      }

      const parsedStyle = styleConfig ? { accepted: true, styleConfig } : parseMermaidStyleConfig(candidate);
      if (!parsedStyle.accepted) {
        return parsedStyle;
      }

      let styled;
      try {
        styled = applyMermaidStyleDirective({
          mermaidSource: candidate,
          styleConfig: parsedStyle.styleConfig
        });
      } catch (error) {
        return {
          accepted: false,
          error: redactSecrets(error instanceof Error ? error.message : String(error))
        };
      }

      const validation = await validateMermaidStrict(styled.mermaidSource);
      if (!validation.valid) {
        return {
          accepted: false,
          error: validation.error
        };
      }

      state = {
        ...state,
        revisionId: state.revisionId + 1,
        mermaidSource: styled.mermaidSource,
        styleConfig: styled.styleConfig,
        updatedAt: new Date().toISOString()
      };

      return {
        accepted: true,
        state
      };
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
