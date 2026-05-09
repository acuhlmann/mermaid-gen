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

export const DiagramIntentSchema = z.object({
  prompt: z.string().min(1),
  revisionId: z.number().int().nonnegative(),
  mermaidSource: z.string().min(1),
  settings: z
    .object({
      temperature: z.number().min(0).max(3).default(0.7),
      topP: z.number().min(0).max(1).default(1),
      maxNodes: z.number().int().min(1).max(200).default(25),
      styleGuide: z.enum(['concise', 'balanced', 'bold']).default('balanced'),
      persona: z.string().min(1).max(120).default('creative architect')
    })
    .default({})
});

export const CoAuthorIntentSchema = DiagramIntentSchema.extend({
  trigger: z.literal('manual')
});

export const StyleIntentSchema = DiagramIntentSchema.extend({
  stylePrompt: z.string().min(1).optional()
});

export function createInitialDiagramState() {
  const now = new Date().toISOString();
  const styled = applyMermaidStyleDirective({
    mermaidSource: 'flowchart TD\n  Start[Start] --> End[End]',
    styleConfig: DEFAULT_DIAGRAM_STYLE
  });

  return {
    revisionId: 0,
    mermaidSource: 'flowchart TD\n  Start[Start] --> EndNode[End]',
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
