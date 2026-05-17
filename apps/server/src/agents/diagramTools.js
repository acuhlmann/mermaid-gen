import { tool } from 'langchain';
import { z } from 'zod';

export function createDiagramTools({ stateStore }) {
  const getDiagramState = tool(
    async () => {
      const state = stateStore.getSlot('mermaid');
      return JSON.stringify({
        revisionId: state.revisionId,
        diagramSource: state.diagramSource,
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
    async ({ diagramSource, reason }) => {
      const result = await stateStore.applyDiagramSource({
        contentType: 'mermaid',
        diagramSource,
        reason: reason || 'LangChain agent update'
      });

      return JSON.stringify(result);
    },
    {
      name: 'apply_mermaid_patch',
      description:
        'Validate and apply a complete Mermaid source update. The server runs mermaid.parse() strictly before accepting; common rejections to avoid: missing diagram-type prefix on the first non-blank line; comma-separated style targets (style A,B,C fails — one node per line); unquoted labels containing (, ), :, /, #, %, or smart quotes; classDef applied to [*] in stateDiagram; "\\n" inside state transition labels; ";" inside sequenceDiagram Note text; ER attribute order must be `type name`, not `name type`. Returns {accepted, revisionId} or {accepted: false, error}.',
      schema: z.object({
        diagramSource: z
          .string()
          .min(1)
          .describe('The full replacement Mermaid diagram source.'),
        reason: z.string().min(1).describe('Short reason for this diagram update.')
      })
    }
  );

  return [getDiagramState, applyMermaidPatch];
}

export function createInfographicTools({ stateStore }) {
  const getInfographicDsl = tool(
    async () => {
      const state = stateStore.getSlot('infographic');
      return JSON.stringify({
        revisionId: state.revisionId,
        diagramSource: state.diagramSource,
        updatedAt: state.updatedAt
      });
    },
    {
      name: 'get_infographic_dsl',
      description: 'Read the current AntV Infographic DSL, including revision id and source.',
      schema: z.object({})
    }
  );

  const applyInfographicPatch = tool(
    async ({ diagramSource, reason }) => {
      const result = await stateStore.applyDiagramSource({
        contentType: 'infographic',
        diagramSource,
        reason: reason || 'LangChain agent update'
      });

      return JSON.stringify(result);
    },
    {
      name: 'apply_infographic_patch',
      description:
        'Validate and apply a complete AntV Infographic DSL update. Use this when the user asks to change infographic content.',
      schema: z.object({
        diagramSource: z
          .string()
          .min(1)
          .describe('The full replacement AntV Infographic DSL.'),
        reason: z.string().min(1).describe('Short reason for this infographic update.')
      })
    }
  );

  return [getInfographicDsl, applyInfographicPatch];
}
