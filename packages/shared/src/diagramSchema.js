import { z } from 'zod';

export const DiagramPatchSchema = z.object({
  previousRevisionId: z.number().int().nonnegative(),
  nextRevisionId: z.number().int().positive(),
  mermaidSource: z.string().min(1),
  reason: z.string().min(1).default('Agent update')
});

export const DiagramStateSchema = z.object({
  revisionId: z.number().int().nonnegative(),
  mermaidSource: z.string().min(1),
  updatedAt: z.string(),
  history: z.array(DiagramPatchSchema)
});

export const DiagramIntentSchema = z.object({
  prompt: z.string().min(1),
  revisionId: z.number().int().nonnegative(),
  mermaidSource: z.string().min(1),
  temperature: z.number().min(0).max(2).default(0.7)
});

export function createInitialDiagramState() {
  const now = new Date().toISOString();
  return {
    revisionId: 0,
    mermaidSource: 'flowchart TD\n  Start[Start] --> End[End]',
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
    updatedAt: new Date().toISOString(),
    history: [...state.history, parsedPatch]
  };

  return {
    accepted: true,
    state: DiagramStateSchema.parse(nextState)
  };
}
