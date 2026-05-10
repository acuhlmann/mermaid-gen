import { DiagramPatchSchema, applyMermaidStyleDirective, parseMermaidStyleConfig } from '@mermaid-architect/shared';
import { validateMermaidStrict } from '../agents/mermaidReliabilitySkill.js';
import { redactSecrets } from '../utils/redactSecrets.js';

export async function validateAndPreparePatch({ currentState, proposedMermaidSource, reason }) {
  const candidate = proposedMermaidSource?.trim();

  const parsedStyle = parseMermaidStyleConfig(candidate);
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

  const strictValidation = await validateMermaidStrict(styled.mermaidSource);
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
