import { buildExplainSectionsArtifact } from '@archislop/shared';
import type { LegacyStreamEvent } from '@archislop/shared';

export type StreamEmit = (evt: LegacyStreamEvent) => void;

/** Emits structured explain sections before `final` on explain analyze streams. */
export function emitExplainSectionsBeforeFinal(
  emit: StreamEmit | undefined,
  input: { kind?: string; analyzeText?: string; contentType?: string }
): void {
  if (typeof emit !== 'function') return;
  if (input?.kind !== 'explain') return;
  const text = input.analyzeText;
  if (typeof text !== 'string' || !text.trim()) return;
  const contentType = input.contentType === 'infographic' ? 'infographic' : 'mermaid';
  const artifact = buildExplainSectionsArtifact(text, contentType);
  if (!artifact) return;
  emit(artifact);
}
