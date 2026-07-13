import { tool } from 'langchain';
import { z } from 'zod';
import { ToolApplyResultSchema } from '@archislop/shared';
import { applySearchReplaceEdits } from './_lib/searchReplaceEdits.js';

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
        diagramSource: z.string().min(1).describe('The full replacement Mermaid diagram source.'),
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
        diagramSource: z.string().min(1).describe('The full replacement AntV Infographic DSL.'),
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
        diagramSource: z.string().min(1).describe('The full chart DSL wrapper as a JSON string.'),
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

  const applyAnythingEdit = tool(
    async ({ edits, reason }) => {
      const current = stateStore.getSlot('anything').diagramSource ?? '';
      if (!current.trim()) {
        return encodeApplyResult({
          accepted: false,
          error:
            'There is no current document to edit — call apply_anything_patch with a full HTML document instead.'
        });
      }

      const applied = applySearchReplaceEdits(current, edits);
      if (!applied.ok) {
        return encodeApplyResult({
          accepted: false,
          error: `${applied.error} No edits were applied.`
        });
      }
      if (applied.text === current) {
        return encodeApplyResult({
          accepted: false,
          error:
            'The edits produced no change (SEARCH and REPLACE are identical). Nothing was applied.'
        });
      }

      // The edited document goes through stateStore.applyDiagramSource, i.e.
      // the exact same validation ladder as a full rewrite (shape, policy,
      // quality, runtime check). Incremental edits never bypass a gate.
      const result = await stateStore.applyDiagramSource({
        contentType: 'anything',
        diagramSource: applied.text,
        reason: reason || 'LangChain agent edit'
      });

      return encodeApplyResult(result);
    },
    {
      name: 'apply_anything_edit',
      description:
        'Apply targeted search/replace edits to the CURRENT Anything-mode HTML document instead of ' +
        'rewriting it. Preferred for small, scoped changes (Refine / Exec / Fix): faster, cheaper, ' +
        'and it cannot accidentally drop unrelated parts of the page. Each SEARCH block must be ' +
        'copied verbatim from the current document and match exactly once; edits apply in order and ' +
        'the whole call is atomic — if any block fails to match, nothing is applied. The edited ' +
        'result is validated exactly like a full patch (sandbox policy, structure, runtime check). ' +
        'If a block will not match or the change is sweeping, fall back to apply_anything_patch ' +
        'with the full document. Returns {accepted, revisionId} or {accepted: false, error}.',
      schema: z.object({
        edits: z
          .array(
            z.object({
              search: z
                .string()
                .min(1)
                .describe(
                  'Exact text to find in the current document — copy it verbatim, including ' +
                    'whitespace, with enough surrounding lines to match exactly once.'
                ),
              replace: z
                .string()
                .describe('Replacement text. An empty string deletes the matched text.')
            })
          )
          .min(1)
          .max(20)
          .describe('Search/replace blocks applied in order to the current document.'),
        reason: z.string().min(1).describe('Short reason for this edit.')
      })
    }
  );

  return [getAnythingHtml, applyAnythingPatch, applyAnythingEdit];
}

export function createFormsTools({ stateStore }) {
  const getFormsDoc = tool(
    async () => {
      const state = stateStore.getSlot('forms');
      return JSON.stringify({
        revisionId: state.revisionId,
        diagramSource: state.diagramSource,
        updatedAt: state.updatedAt
      });
    },
    {
      name: 'get_forms_doc',
      description:
        'Read the current forms document (a model-authored A2UI v0.9 JSON document rendered as an interactive form), including revision id and source.',
      schema: z.object({})
    }
  );

  const applyFormsPatch = tool(
    async ({ diagramSource, reason }) => {
      const result = await stateStore.applyDiagramSource({
        contentType: 'forms',
        diagramSource,
        reason: reason || 'LangChain agent update'
      });

      return encodeApplyResult(result);
    },
    {
      name: 'apply_forms_patch',
      description:
        'Validate and apply a complete forms document. The source is a JSON object you author directly: ' +
        '{"archislopFormsVersion":1,"formTitle":"…","formCode":"…","messages":[…A2UI v0.9 messages…]}. ' +
        'The messages array must contain exactly one createSurface message, then updateComponents (one ' +
        'component MUST have id "root"), then updateDataModel with the initial field values. Only basic-catalog ' +
        'components are allowed (Text, Column, Row, Card, Divider, TextField, CheckBox, ChoicePicker, Slider, ' +
        'DateTimeInput, Button, Image, Icon, List, Tabs, Modal). Every Button needs action:{"event":{"name":"…"}} ' +
        '(no functionCall). Include at least one input control and at least one Button. Returns {accepted, revisionId} ' +
        'or {accepted:false, error}.',
      schema: z.object({
        diagramSource: z.string().min(1).describe('The full forms document as a JSON string.'),
        reason: z.string().min(1).describe('Short reason for this update.')
      })
    }
  );

  return [getFormsDoc, applyFormsPatch];
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
        'Read the current 3D metaphor DSL (city/layercake/galaxy/tree/terrain/orrery/river/garden/archipelago), including revision id and source.',
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
        '{"metaphor":"city|layercake|galaxy|tree|terrain|orrery|river|garden|archipelago","scene":{"theme":"whiteboard|noir|arcade|blueprint","camera":"orbit|isometric|cinematic"},"items":[...]}. ' +
        'For city: items are {id, label, height (1-100), footprint (1-20), district?, lighting?, condition?}. ' +
        'For layercake: items are {id, label, thickness (1-10), components?: string[], cracks?, tilt?}. ' +
        'For galaxy: items are {id, label, magnitude (1-20), cluster?, binary?}. ' +
        'For tree: items are {id, label, parent?, weight? (1-20), kind?}. Items without parent are roots. ' +
        'For terrain: items are {id, label, elevation (-10..20), intensity (0.1..10)}; optional scene.surface={metric,baseline}. ' +
        'For orrery: items are {id, label, orbit (0-12; 0 = central sun), size (0.1-10), moon?}. ' +
        'For river: items are {id, label, stage (0-100, source→mouth order), flow (0.1-20, channel width), hazard? (0-1, rapids)}. ' +
        'For garden: items are {id, label, maturity (0-1), impact (0.1-10), bed?, health? (thriving|steady|at-risk)}. ' +
        'For archipelago: items are {id, label, mass (0.5-20, island size), relief (0-1, peak height), chain?}. ' +
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
