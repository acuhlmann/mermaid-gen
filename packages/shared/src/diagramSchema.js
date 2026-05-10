import { z } from 'zod';
import {
  DEFAULT_DIAGRAM_STYLE,
  DiagramStyleSchema,
  applyMermaidStyleDirective,
  parseMermaidStyleConfig
} from './mermaidStyle.js';

export const DiagramPatchSchema = z.object({
  previousRevisionId: z.number().int().nonnegative(),
  nextRevisionId: z.number().int().positive(),
  mermaidSource: z.string().min(1),
  styleConfig: DiagramStyleSchema.default(DEFAULT_DIAGRAM_STYLE),
  reason: z.string().min(1).default('Agent update')
});

export const DiagramStateSchema = z.object({
  revisionId: z.number().int().nonnegative(),
  mermaidSource: z.string().min(1),
  styleConfig: DiagramStyleSchema.default(DEFAULT_DIAGRAM_STYLE),
  updatedAt: z.string(),
  history: z.array(DiagramPatchSchema)
});

export const FocusNodeSchema = z.object({
  id: z.string().min(1),
  label: z.string().optional()
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

export const DiagramIntentSchema = z.object({
  prompt: z.string().min(1),
  revisionId: z.number().int().nonnegative(),
  /** Empty string is allowed when starting from a cleared canvas; agent applies a full diagram patch. */
  mermaidSource: z.string(),
  settings: IntentSettingsSchema,
  focusNode: FocusNodeSchema.optional(),
  modelProfile: ModelProfileSchema.optional()
});

export const TransformModeSchema = z.enum(['refine', 'innovate', 'goMad']);

export const DiagramTransformIntentSchema = z.object({
  revisionId: z.number().int().nonnegative(),
  mermaidSource: z.string().min(1),
  mode: TransformModeSchema,
  focusNode: FocusNodeSchema.optional(),
  modelProfile: ModelProfileSchema.optional()
});

export const DiagramAnalyzeSchema = z.object({
  revisionId: z.number().int().nonnegative(),
  mermaidSource: z.string().min(1),
  kind: z.enum(['critique', 'explain']),
  focusNode: FocusNodeSchema.optional(),
  modelProfile: ModelProfileSchema.optional()
});

export const AgentStreamPayloadSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z.literal('intent'),
    prompt: z.string().min(1),
    revisionId: z.number().int().nonnegative(),
    mermaidSource: z.string(),
    settings: IntentSettingsSchema,
    focusNode: FocusNodeSchema.optional(),
    modelProfile: ModelProfileSchema.optional()
  }),
  z.object({
    operation: z.literal('transform'),
    revisionId: z.number().int().nonnegative(),
    mermaidSource: z.string().min(1),
    mode: TransformModeSchema,
    focusNode: FocusNodeSchema.optional(),
    modelProfile: ModelProfileSchema.optional()
  }),
  z.object({
    operation: z.literal('analyze'),
    revisionId: z.number().int().nonnegative(),
    mermaidSource: z.string().min(1),
    kind: z.enum(['critique', 'explain']),
    focusNode: FocusNodeSchema.optional(),
    modelProfile: ModelProfileSchema.optional()
  })
]);

export const StyleIntentSchema = DiagramIntentSchema.extend({
  stylePrompt: z.string().min(1).optional()
});

export function createInitialDiagramState() {
  const now = new Date().toISOString();
  const styled = applyMermaidStyleDirective({
    mermaidSource: 'flowchart TD\n  A["AI Tinkerers HK"] --> B[Hackathon]',
    styleConfig: DEFAULT_DIAGRAM_STYLE
  });

  return {
    revisionId: 0,
    mermaidSource: styled.mermaidSource,
    styleConfig: styled.styleConfig,
    updatedAt: now,
    history: []
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

  const nextState = {
    ...state,
    revisionId: parsedPatch.nextRevisionId,
    mermaidSource: parsedPatch.mermaidSource,
    styleConfig: parsedPatch.styleConfig,
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
