/** All diagram slots external MCP tools must treat as first-class. */
export const MCP_SLOT_CONTENT_TYPES = [
  'mermaid',
  'infographic',
  'metaphor3d',
  'chart',
  'anything',
  'forms'
];

/**
 * @param {{ getSlot: (contentType: string) => { revisionId: number, diagramSource?: string, updatedAt?: string } }} stateStore
 */
export function collectSlotRevisions(stateStore) {
  /** @type {Record<string, number>} */
  const revisions = {};
  for (const contentType of MCP_SLOT_CONTENT_TYPES) {
    revisions[contentType] = stateStore.getSlot(contentType).revisionId;
  }
  return revisions;
}

/**
 * @param {{ getSlot: (contentType: string) => { revisionId: number, diagramSource?: string, updatedAt?: string } }} stateStore
 */
export function collectSlotPayloads(stateStore) {
  /** @type {Record<string, { revisionId: number, diagramSource: string, updatedAt: string | null }>} */
  const slots = {};
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
