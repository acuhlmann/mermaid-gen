import { emitCritiqueA2uiBeforeFinal } from './critiqueA2uiStream.js';
import { emitExplainSectionsBeforeFinal } from './explainSectionsStream.js';
import { emitStyleEditsBeforeFinal } from './styleEditsStream.js';
import type { StreamEmit } from './critiqueA2uiStream.js';

/** Shared pre-final Gen UI emits for critique/explain analyze streams (Mermaid + Infographic agents). */
export function emitAnalyzeStreamArtifactsBeforeFinal(
  emit: StreamEmit | undefined,
  input: {
    kind?: string;
    analyzeText?: string;
    contentType?: string;
  }
): void {
  emitCritiqueA2uiBeforeFinal(emit, { kind: input.kind, analyzeText: input.analyzeText });
  emitExplainSectionsBeforeFinal(emit, {
    kind: input.kind,
    analyzeText: input.analyzeText,
    contentType: input.contentType
  });
  emitStyleEditsBeforeFinal(emit, { analyzeText: input.analyzeText });
}
