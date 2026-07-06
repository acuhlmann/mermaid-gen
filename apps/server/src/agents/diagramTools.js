import { tool } from 'langchain';
import { z } from 'zod';
import { ToolApplyResultSchema } from '@archislop/shared';

/**
 * Validate the state-store envelope before stringifying so a future shape drift
 * fails loudly with a Zod error at the tool boundary instead of leaking confusing
 * JSON to the LLM (and through to the agent's error-extraction path).
 */
function encodeApplyResult(result) {
  return JSON.stringify(ToolApplyResultSchema.parse(result));
}

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

      return encodeApplyResult(result);
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

      return encodeApplyResult(result);
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

export function createChartTools({ stateStore }) {
  const getChartDsl = tool(
    async () => {
      const state = stateStore.getSlot('chart');
      return JSON.stringify({
        revisionId: state.revisionId,
        diagramSource: state.diagramSource,
        updatedAt: state.updatedAt
      });
    },
    {
      name: 'get_chart_dsl',
      description:
        'Read the current chart DSL (archislop wrapper around a Vega-Lite spec), including revision id and source.',
      schema: z.object({})
    }
  );

  const applyChartPatch = tool(
    async ({ diagramSource, reason }) => {
      const result = await stateStore.applyDiagramSource({
        contentType: 'chart',
        diagramSource,
        reason: reason || 'LangChain agent update'
      });

      return encodeApplyResult(result);
    },
    {
      name: 'apply_chart_patch',
      description:
        'Validate and apply a complete chart DSL update. The DSL is a JSON wrapper: ' +
        '{"archislopVersion":1,"theme":"whiteboard|noir|arcade|blueprint","spec":{...Vega-Lite v5 spec...}}. ' +
        'The inner spec must include $schema, and either (mark + encoding) or one of (layer, hconcat, vconcat, facet, repeat). ' +
        'Every encoding channel needs both field and type (quantitative|ordinal|nominal|temporal). ' +
        'Data lives inline as spec.data.values (an array of plain objects). ' +
        'Returns {accepted, revisionId} or {accepted: false, error}.',
      schema: z.object({
        diagramSource: z
          .string()
          .min(1)
          .describe('The full chart DSL wrapper as a JSON string.'),
        reason: z.string().min(1).describe('Short reason for this chart update.')
      })
    }
  );

  return [getChartDsl, applyChartPatch];
}

export function createAnythingTools({ stateStore }) {
  const getAnythingHtml = tool(
    async () => {
      const state = stateStore.getSlot('anything');
      return JSON.stringify({
        revisionId: state.revisionId,
        diagramSource: state.diagramSource,
        updatedAt: state.updatedAt
      });
    },
    {
      name: 'get_anything_html',
      description:
        'Read the current Anything-mode HTML document (freeform HTML/CSS/JS), including revision id and source.',
      schema: z.object({})
    }
  );

  const applyAnythingPatch = tool(
    async ({ diagramSource, reason }) => {
      const result = await stateStore.applyDiagramSource({
        contentType: 'anything',
        diagramSource,
        reason: reason || 'LangChain agent update'
      });

      return encodeApplyResult(result);
    },
    {
      name: 'apply_anything_patch',
      description:
        'Validate and apply a complete Anything-mode HTML document update. The source is a single ' +
        'self-contained HTML document with all CSS in <style> tags and all JS in <script> tags. ' +
        'It is rendered in a sandboxed iframe with NO network access, NO cookies/storage, and NO ' +
        'access to the host page — every asset must be inline (data: URIs for images). ' +
        'Returns {accepted, revisionId} or {accepted: false, error}.',
      schema: z.object({
        diagramSource: z
          .string()
          .min(1)
          .describe('The full replacement HTML document as a string.'),
        reason: z.string().min(1).describe('Short reason for this update.')
      })
    }
  );

  return [getAnythingHtml, applyAnythingPatch];
}

export function createMetaphorTools({ stateStore }) {
  const getMetaphorDsl = tool(
    async () => {
      const state = stateStore.getSlot('metaphor3d');
      return JSON.stringify({
        revisionId: state.revisionId,
        diagramSource: state.diagramSource,
        updatedAt: state.updatedAt
      });
    },
    {
      name: 'get_metaphor_dsl',
      description:
        'Read the current 3D metaphor DSL (city/layercake/galaxy/tree/terrain), including revision id and source.',
      schema: z.object({})
    }
  );

  const applyMetaphorPatch = tool(
    async ({ diagramSource, reason }) => {
      const result = await stateStore.applyDiagramSource({
        contentType: 'metaphor3d',
        diagramSource,
        reason: reason || 'LangChain agent update'
      });

      return encodeApplyResult(result);
    },
    {
      name: 'apply_metaphor_patch',
      description:
        'Validate and apply a complete 3D metaphor DSL update. The DSL is a JSON object: ' +
        '{"metaphor":"city|layercake|galaxy|tree|terrain","scene":{"theme":"whiteboard|noir|arcade|blueprint","camera":"orbit|isometric|cinematic"},"items":[...]}. ' +
        'For city: items are {id, label, height (1-100), footprint (1-20), district?, lighting?, condition?}. ' +
        'For layercake: items are {id, label, thickness (1-10), components?: string[], cracks?, tilt?}. ' +
        'For galaxy: items are {id, label, magnitude (1-20), cluster?, binary?}. ' +
        'For tree: items are {id, label, parent?, weight? (1-20), kind?}. Items without parent are roots. ' +
        'For terrain: items are {id, label, elevation (-10..20), intensity (0.1..10)}; optional scene.surface={metric,baseline}. ' +
        'Item ids must be stable lowercase-kebab strings (e.g. auth-service). Returns {accepted, revisionId} or {accepted: false, error}.',
      schema: z.object({
        diagramSource: z
          .string()
          .min(1)
          .describe('The full replacement metaphor DSL as a JSON string.'),
        reason: z.string().min(1).describe('Short reason for this metaphor update.')
      })
    }
  );

  return [getMetaphorDsl, applyMetaphorPatch];
}
