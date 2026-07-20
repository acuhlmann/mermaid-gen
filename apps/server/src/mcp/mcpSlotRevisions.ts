import type { ContentType } from '@archislop/shared';
import type { DiagramStateStore } from '../state/diagramStateStore.js';

/** All diagram slots external MCP tools must treat as first-class. */
export const MCP_SLOT_CONTENT_TYPES: readonly ContentType[] = [
  'mermaid',
  'infographic',
  'metaphor3d',
  'chart',
  'anything',
  'forms'
];

export function collectSlotRevisions(stateStore: DiagramStateStore): Record<ContentType, number> {
  const revisions = {} as Record<ContentType, number>;
  for (const contentType of MCP_SLOT_CONTENT_TYPES) {
    revisions[contentType] = stateStore.getSlot(contentType).revisionId;
  }
  return revisions;
}

export function collectSlotPayloads(
  stateStore: DiagramStateStore
): Record<ContentType, { revisionId: number; diagramSource: string; updatedAt: string | null }> {
  const slots = {} as Record<
    ContentType,
    { revisionId: number; diagramSource: string; updatedAt: string | null }
  >;
  for (const contentType of MCP_SLOT_CONTENT_TYPES) {
    const slot = stateStore.getSlot(contentType);
    slots[contentType] = {
      revisionId: slot.revisionId,
      diagramSource: slot.diagramSource ?? '',
      updatedAt: slot.updatedAt ?? null
    };
  }
  return slots;
}
