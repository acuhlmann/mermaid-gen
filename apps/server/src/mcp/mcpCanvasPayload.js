import { buildWebCanvasUrl } from './diagramDiffSummary.js';

/**
 * Canvas preview payload for open_diagram_canvas / get_session_state enrichment.
 * @param {{ stateStore: { getSessionState: () => { activeContentType?: string }, getSlot: (t: string) => { revisionId: number, diagramSource?: string, updatedAt?: string } } }} services
 * @param {string} sessionId
 * @param {'mermaid' | 'infographic' | 'metaphor3d' | 'chart' | undefined} [contentType]
 */
export function buildCanvasPreviewPayload(services, sessionId, contentType) {
  const session = services.stateStore.getSessionState();
  const activeContentType = contentType ?? session.activeContentType ?? 'mermaid';
  const mermaidSlot = services.stateStore.getSlot('mermaid');
  const infographicSlot = services.stateStore.getSlot('infographic');
  const metaphor3dSlot = services.stateStore.getSlot('metaphor3d');
  const chartSlot = services.stateStore.getSlot('chart');
  const activeSlot = services.stateStore.getSlot(activeContentType);

  return {
    sessionId,
    activeContentType,
    contentType: activeContentType,
    webCanvasUrl: buildWebCanvasUrl(sessionId),
    revisions: {
      mermaid: mermaidSlot.revisionId,
      infographic: infographicSlot.revisionId,
      metaphor3d: metaphor3dSlot.revisionId,
      chart: chartSlot.revisionId
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
      },
      metaphor3d: {
        revisionId: metaphor3dSlot.revisionId,
        diagramSource: metaphor3dSlot.diagramSource ?? '',
        updatedAt: metaphor3dSlot.updatedAt ?? null
      },
      chart: {
        revisionId: chartSlot.revisionId,
        diagramSource: chartSlot.diagramSource ?? '',
        updatedAt: chartSlot.updatedAt ?? null
      }
    }
  };
}
