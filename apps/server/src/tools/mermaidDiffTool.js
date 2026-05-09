import { DiagramPatchSchema } from '@mermaid-architect/shared';
import { validateMermaidStrict } from '../agents/mermaidReliabilitySkill.js';

export async function validateAndPreparePatch({ currentState, proposedMermaidSource, reason }) {
  const candidate = proposedMermaidSource?.trim();
  const strictValidation = await validateMermaidStrict(candidate);
  if (!strictValidation.valid) {
    return {
      accepted: false,
      error: strictValidation.error
    };
  }

  const patch = DiagramPatchSchema.parse({
    previousRevisionId: currentState.revisionId,
    nextRevisionId: currentState.revisionId + 1,
    mermaidSource: styled.mermaidSource,
    styleConfig: styled.styleConfig,
    reason
  });

  return {
    accepted: true,
    patch,
    metadata: {
      validator: strictValidation.validator,
      warnings: strictValidation.warnings ?? []
    }
  };
}
