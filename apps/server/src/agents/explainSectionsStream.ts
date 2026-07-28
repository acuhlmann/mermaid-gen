import { buildExplainSectionsArtifact } from '@archislop/shared';
import type { LegacyStreamEvent } from '@archislop/shared';

export type StreamEmit = (evt: LegacyStreamEvent) => void;

/** Emits structured explain sections before `final` on explain analyze streams. */
export function emitExplainSectionsBeforeFinal(
  emit: StreamEmit | undefined,
  input: { kind?: string; analyzeText?: string; contentType?: string }
): void {
  if (typeof emit !== 'function') return;
  if (input?.kind !== 'richard') return;
  const text = input.analyzeText;
  if (typeof text !== 'string' || !text.trim()) return;
  // Explain artifacts require per-content-type heading tables (mermaid, infographic).
  // Metaphor mode falls through as plain prose for now.
  const contentType = input.contentType === 'infographic' ? 'infographic' : 'mermaid';
  if (input.contentType && input.contentType !== 'mermaid' && input.contentType !== 'infographic') {
    return;
  }
  const artifact = buildExplainSectionsArtifact(text, contentType);
  if (!artifact) return;
  emit(artifact);
}
