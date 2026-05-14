import { z } from 'zod';
import {
  DEFAULT_DIAGRAM_STYLE,
  DiagramStyleSchema,
  applyMermaidStyleDirective,
  parseMermaidStyleConfig
} from './mermaidStyle.js';

export const ContentTypeSchema = z.enum(['mermaid', 'infographic']);

/** Optional sibling-slot source for mode-switch conversion (intent only). */
export const IntentPeerContextSchema = z.object({
  contentType: ContentTypeSchema,
  diagramSource: z.string().max(200_000)
});

const DEFAULT_INFOGRAPHIC_SOURCE =
  'infographic list-row-simple-horizontal-arrow\n' +
  '  data\n' +
  '    lists\n' +
  '      - label Step 1\n' +
  '        desc Start\n' +
  '      - label Step 2\n' +
  '        desc Build\n' +
  '      - label Step 3\n' +
  '        desc Ship';

const DEFAULT_MERMAID_SOURCE = 'flowchart TD\n  A["AI Tinkerers HK"] --> B[Hackathon]';

export const DiagramPatchSchema = z.object({
  previousRevisionId: z.number().int().nonnegative(),
  nextRevisionId: z.number().int().positive(),
  diagramSource: z.string().min(1),
  styleConfig: DiagramStyleSchema.nullable().default(DEFAULT_DIAGRAM_STYLE),
  reason: z.string().min(1).default('Agent update'),
  contentType: ContentTypeSchema.default('mermaid')
});

export const DiagramStateSchema = z.object({
  revisionId: z.number().int().nonnegative(),
  diagramSource: z.string().min(1),
  styleConfig: DiagramStyleSchema.nullable().default(DEFAULT_DIAGRAM_STYLE),
  contentType: ContentTypeSchema.default('mermaid'),
  updatedAt: z.string(),
  history: z.array(DiagramPatchSchema),
  lastUserPrompt: z.string().max(4000).nullable().optional().default(null)
});

export const SessionDiagramStateSchema = z.object({
  activeContentType: ContentTypeSchema.default('mermaid'),
  mermaid: DiagramStateSchema,
  infographic: DiagramStateSchema
});

export const FocusNodeSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().optional(),
    /** When omitted, servers treat the focus as a flowchart vertex (legacy behavior). */
    selectionKind: z.enum(['node', 'cluster', 'edge', 'infographic-region']).optional(),
    edgeFrom: z.string().min(1).optional(),
    edgeTo: z.string().min(1).optional(),
    dataId: z.string().optional(),
    /** Text the user tapped (e.g. one line of a multi-line node label), when distinct from aggregate `label`. */
    clickedLabel: z.string().max(240).optional()
  })
  .superRefine((val, ctx) => {
    if (val.selectionKind === 'edge') {
      if (!val.edgeFrom?.trim() || !val.edgeTo?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'edge focus requires edgeFrom and edgeTo',
          path: ['edgeFrom']
        });
      }
    }
  });

/** Server resolves this to an OpenRouter model id via env (OPENROUTER_MODEL_FAST / OPENROUTER_MODEL_QUALITY). */
export const ModelProfileSchema = z.enum(['fast', 'quality']);

export const IntentSettingsSchema = z
  .object({
    temperature: z.number().min(0).max(3).default(0.7),
    topP: z.number().min(0).max(1).default(1),
    maxNodes: z.number().int().min(1).max(200).default(25),
    styleGuide: z.enum(['concise', 'balanced', 'bold']).default('balanced'),
    persona: z.string().min(1).max(120).default('creative architect')
  })
  .default({});

export const DiagramIntentSchema = z
  .object({
    prompt: z.string().min(1),
    revisionId: z.number().int().nonnegative(),
    /** Empty string is allowed when starting from a cleared canvas; agent applies a full diagram patch. */
    diagramSource: z.string(),
    contentType: ContentTypeSchema.default('mermaid'),
    settings: IntentSettingsSchema,
    focusNode: FocusNodeSchema.optional(),
    modelProfile: ModelProfileSchema.optional(),
    peerContext: IntentPeerContextSchema.optional()
  })
  .superRefine((val, ctx) => {
    if (!val.peerContext) return;
    if (val.peerContext.contentType === val.contentType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'peerContext.contentType must differ from intent contentType',
        path: ['peerContext', 'contentType']
      });
    }
  });

export const TransformModeSchema = z.enum(['refine', 'innovate', 'goMad']);

/** Escalation tier for repeated Go Mad transforms (1 = first click). Ignored unless mode is goMad. */
export const GoMadDepthSchema = z.number().int().min(1).max(12).optional();

export const DiagramTransformIntentSchema = z.object({
  revisionId: z.number().int().nonnegative(),
  diagramSource: z.string().min(1),
  contentType: ContentTypeSchema.default('mermaid'),
  mode: TransformModeSchema,
  focusNode: FocusNodeSchema.optional(),
  modelProfile: ModelProfileSchema.optional(),
  goMadDepth: GoMadDepthSchema
});

export const DiagramAnalyzeSchema = z.object({
  revisionId: z.number().int().nonnegative(),
  diagramSource: z.string().min(1),
  contentType: ContentTypeSchema.default('mermaid'),
  kind: z.enum(['critique', 'explain']),
  focusNode: FocusNodeSchema.optional(),
  modelProfile: ModelProfileSchema.optional()
});

export const AgentStreamPayloadSchema = z.discriminatedUnion('operation', [
  z
    .object({
      operation: z.literal('intent'),
      prompt: z.string().min(1),
      revisionId: z.number().int().nonnegative(),
      diagramSource: z.string(),
      contentType: ContentTypeSchema.default('mermaid'),
      settings: IntentSettingsSchema,
      focusNode: FocusNodeSchema.optional(),
      modelProfile: ModelProfileSchema.optional(),
      peerContext: IntentPeerContextSchema.optional()
    })
    .superRefine((val, ctx) => {
      if (!val.peerContext) return;
      if (val.peerContext.contentType === val.contentType) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'peerContext.contentType must differ from intent contentType',
          path: ['peerContext', 'contentType']
        });
      }
    }),
  z.object({
    operation: z.literal('transform'),
    revisionId: z.number().int().nonnegative(),
    diagramSource: z.string().min(1),
    contentType: ContentTypeSchema.default('mermaid'),
    mode: TransformModeSchema,
    focusNode: FocusNodeSchema.optional(),
    modelProfile: ModelProfileSchema.optional(),
    goMadDepth: GoMadDepthSchema
  }),
  z.object({
    operation: z.literal('analyze'),
    revisionId: z.number().int().nonnegative(),
    diagramSource: z.string().min(1),
    contentType: ContentTypeSchema.default('mermaid'),
    kind: z.enum(['critique', 'explain']),
    focusNode: FocusNodeSchema.optional(),
    modelProfile: ModelProfileSchema.optional()
  })
]);

/** Style intents are Mermaid-only. The route handler should reject contentType !== 'mermaid'. */
export const StyleIntentSchema = DiagramIntentSchema.extend({
  stylePrompt: z.string().min(1).optional()
});

export function createInitialDiagramState(contentType = 'mermaid') {
  const now = new Date().toISOString();

  if (contentType === 'infographic') {
    return {
      revisionId: 0,
      diagramSource: DEFAULT_INFOGRAPHIC_SOURCE,
      styleConfig: null,
      contentType: 'infographic',
      updatedAt: now,
      history: [],
      lastUserPrompt: null
    };
  }

  const styled = applyMermaidStyleDirective({
    mermaidSource: DEFAULT_MERMAID_SOURCE,
    styleConfig: DEFAULT_DIAGRAM_STYLE
  });

  return {
    revisionId: 0,
    diagramSource: styled.mermaidSource,
    styleConfig: styled.styleConfig,
    contentType: 'mermaid',
    updatedAt: now,
    history: [],
    lastUserPrompt: null
  };
}

export function createInitialSessionState() {
  return {
    activeContentType: 'mermaid',
    mermaid: createInitialDiagramState('mermaid'),
    infographic: createInitialDiagramState('infographic')
  };
}

export function applyPatch(state, patch) {
  const parsedPatch = DiagramPatchSchema.parse(patch);

  if (parsedPatch.previousRevisionId !== state.revisionId) {
    return {
      accepted: false,
      error: `Revision mismatch. Expected ${state.revisionId}, got ${parsedPatch.previousRevisionId}.`
    };
  }

  if (parsedPatch.contentType !== state.contentType) {
    return {
      accepted: false,
      error: `Content type mismatch. Slot is ${state.contentType}, patch is ${parsedPatch.contentType}.`
    };
  }

  const nextState = {
    ...state,
    revisionId: parsedPatch.nextRevisionId,
    diagramSource: parsedPatch.diagramSource,
    styleConfig: parsedPatch.styleConfig,
    contentType: parsedPatch.contentType,
    updatedAt: new Date().toISOString(),
    history: [...state.history, parsedPatch]
  };

  return {
    accepted: true,
    state: DiagramStateSchema.parse(nextState)
  };
}

export function deriveStyleConfigFromSource(mermaidSource) {
  return parseMermaidStyleConfig(mermaidSource);
}
