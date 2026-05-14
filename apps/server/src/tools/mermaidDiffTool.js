import { DiagramPatchSchema, applyMermaidStyleDirective, parseMermaidStyleConfig } from '@archislop/shared';
import { validateMermaidStrict } from '../agents/mermaidReliabilitySkill.js';
import { sanitizeMermaid } from '../agents/mermaidSanitizer.js';
import { redactSecrets } from '../utils/redactSecrets.js';

export async function validateAndPreparePatch({ currentState, proposedMermaidSource, reason }) {
  const candidate = proposedMermaidSource?.trim();

  let workingInput = candidate;
  let preStyleSanitizerApplied = [];
  let parsedStyle = parseMermaidStyleConfig(workingInput);

  // First rescue path: malformed %%{init: …}%% JSON (single quotes, trailing commas) fails
  // `parseMermaidStyleConfig` before validateMermaidStrict gets a chance to run. Try the
  // sanitizer once and re-parse so trivially-fixable init directives don't get rejected.
  if (!parsedStyle.accepted && typeof workingInput === 'string' && workingInput.length > 0) {
    const { sanitized, applied } = sanitizeMermaid(workingInput, { parseError: parsedStyle.error });
    if (applied.length > 0 && sanitized !== workingInput) {
      const retry = parseMermaidStyleConfig(sanitized);
      if (retry.accepted) {
        workingInput = sanitized;
        parsedStyle = retry;
        preStyleSanitizerApplied = applied;
      }
    }
  }

  if (!parsedStyle.accepted) {
    return parsedStyle;
  }

  let styled;
  try {
    styled = applyMermaidStyleDirective({
      mermaidSource: workingInput,
      styleConfig: parsedStyle.styleConfig
    });
  } catch (error) {
    return {
      accepted: false,
      error: redactSecrets(error instanceof Error ? error.message : String(error))
    };
  }

  let workingSource = styled.mermaidSource;
  const sanitizerApplied = [...preStyleSanitizerApplied];
  let strictValidation = await validateMermaidStrict(workingSource);

  // Parse-fail rescue: try the deterministic sanitizer once and re-validate. Many LLM-emitted
  // failures (smart quotes, unquoted special-char labels, reserved-word IDs, missing `end`)
  // are mechanical and don't need a full LLM repair round-trip.
  if (!strictValidation.valid) {
    const initialError = strictValidation.error;
    const { sanitized, applied } = sanitizeMermaid(workingSource, { parseError: initialError });
    if (applied.length > 0 && sanitized !== workingSource) {
      // Re-derive style config in case sanitizer rewrote the init directive.
      const reparsedStyle = parseMermaidStyleConfig(sanitized);
      let candidateSource = sanitized;
      let candidateStyleConfig = styled.styleConfig;
      if (reparsedStyle.accepted) {
        try {
          const resanitized = applyMermaidStyleDirective({
            mermaidSource: sanitized,
            styleConfig: reparsedStyle.styleConfig
          });
          candidateSource = resanitized.mermaidSource;
          candidateStyleConfig = resanitized.styleConfig;
        } catch {
          candidateSource = sanitized;
        }
      }
      const rescueValidation = await validateMermaidStrict(candidateSource);
      if (rescueValidation.valid) {
        workingSource = candidateSource;
        styled.styleConfig = candidateStyleConfig;
        sanitizerApplied.push(...applied);
        strictValidation = {
          ...rescueValidation,
          rescuedFrom: rescueValidation.validator,
          originalError: initialError
        };
      }
    }
  }

  if (!strictValidation.valid) {
    return {
      accepted: false,
      error: strictValidation.error
    };
  }

  const patch = DiagramPatchSchema.parse({
    previousRevisionId: currentState.revisionId,
    nextRevisionId: currentState.revisionId + 1,
    diagramSource: workingSource,
    styleConfig: styled.styleConfig,
    contentType: 'mermaid',
    reason
  });

  const rescued = sanitizerApplied.length > 0;
  return {
    accepted: true,
    patch,
    metadata: {
      validator: rescued ? 'sanitizer-rescue' : strictValidation.validator,
      warnings: strictValidation.warnings ?? [],
      sanitizerApplied,
      rescuedFrom: rescued ? strictValidation.rescuedFrom ?? strictValidation.validator : null
    }
  };
}
