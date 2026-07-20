import { buildWebCanvasUrl } from './diagramDiffSummary.js';
import { collectSlotPayloads, collectSlotRevisions } from './mcpSlotRevisions.js';

/**
 * Canvas preview payload for open_diagram_canvas / get_session_state enrichment.
 * @param {{ stateStore: { getSessionState: () => { activeContentType?: string }, getSlot: (t: string) => { revisionId: number, diagramSource?: string, updatedAt?: string } } }} services
 * @param {string} sessionId
 * @param {'mermaid' | 'infographic' | 'metaphor3d' | 'chart' | 'anything' | 'forms' | undefined} [contentType]
 */
export function buildCanvasPreviewPayload(services, sessionId, contentType) {
  const session = services.stateStore.getSessionState();
  const activeContentType = contentType ?? session.activeContentType ?? 'mermaid';
  const revisions = collectSlotRevisions(services.stateStore);
  const slots = collectSlotPayloads(services.stateStore);
  const activeSlot = services.stateStore.getSlot(activeContentType);

  return {
    sessionId,
    activeContentType,
    contentType: activeContentType,
    webCanvasUrl: buildWebCanvasUrl(sessionId),
    revisions,
    revisionId: activeSlot.revisionId,
    diagramSource: activeSlot.diagramSource ?? '',
    updatedAt: activeSlot.updatedAt ?? null,
    slots
  };
}
