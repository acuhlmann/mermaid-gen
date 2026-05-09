import { tool } from 'langchain';
import { z } from 'zod';

export function createDiagramTools({ stateStore }) {
  const getDiagramState = tool(
    async () => {
      const state = stateStore.getState();
      return JSON.stringify({
        revisionId: state.revisionId,
        mermaidSource: state.mermaidSource,
        styleConfig: state.styleConfig,
        updatedAt: state.updatedAt
      });
    },
    {
      name: 'get_diagram_state',
      description: 'Read the current Mermaid diagram state, including revision id and source.',
      schema: z.object({})
    }
  );

  const applyMermaidPatch = tool(
    async ({ mermaidSource, reason }) => {
      const result = await stateStore.applyMermaidSource({
        mermaidSource,
        reason: reason || 'LangChain agent update'
      });

      return JSON.stringify(result);
    },
    {
      name: 'apply_mermaid_patch',
      description:
        'Validate and apply a complete Mermaid source update. Use this when the user asks to change diagram content or styling.',
      schema: z.object({
        mermaidSource: z.string().min(1).describe('The full replacement Mermaid diagram source.'),
        reason: z.string().min(1).describe('Short reason for this diagram update.')
      })
    }
  );

  return [getDiagramState, applyMermaidPatch];
}
