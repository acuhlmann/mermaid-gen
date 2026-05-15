import { buildWebCanvasUrl } from './diagramDiffSummary.js';

/**
 * Canvas preview payload for open_diagram_canvas / get_session_state enrichment.
 * @param {{ stateStore: { getSessionState: () => { activeContentType?: string }, getSlot: (t: string) => { revisionId: number, diagramSource?: string, updatedAt?: string } } }} services
 * @param {string} sessionId
 * @param {'mermaid' | 'infographic' | undefined} [contentType]
 */
export function buildCanvasPreviewPayload(services, sessionId, contentType) {
  const session = services.stateStore.getSessionState();
  const activeContentType = contentType ?? session.activeContentType ?? 'mermaid';
  const mermaidSlot = services.stateStore.getSlot('mermaid');
  const infographicSlot = services.stateStore.getSlot('infographic');
  const activeSlot = services.stateStore.getSlot(activeContentType);

  return {
    sessionId,
    activeContentType,
    contentType: activeContentType,
    webCanvasUrl: buildWebCanvasUrl(sessionId),
    revisions: {
      mermaid: mermaidSlot.revisionId,
      infographic: infographicSlot.revisionId
    },
    revisionId: activeSlot.revisionId,
    diagramSource: activeSlot.diagramSource ?? '',
    updatedAt: activeSlot.updatedAt ?? null,
    slots: {
      mermaid: {
        revisionId: mermaidSlot.revisionId,
        diagramSource: mermaidSlot.diagramSource ?? '',
        updatedAt: mermaidSlot.updatedAt ?? null
      },
      infographic: {
        revisionId: infographicSlot.revisionId,
        diagramSource: infographicSlot.diagramSource ?? '',
        updatedAt: infographicSlot.updatedAt ?? null
      }
    }
  };
}
