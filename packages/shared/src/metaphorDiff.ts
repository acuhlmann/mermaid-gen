/**
 * Structural diff between two metaphor3d DSL JSON sources (item ids).
 */

import { sanitizeMetaphorDsl } from './metaphorSanitizer.js';

export type MetaphorStructuralDiff = {
  addedIds: string[];
  modifiedIds: string[];
  removedIds: string[];
};

type MetaphorItem = Record<string, unknown>;

function parseMetaphorItems(source: string | null | undefined): MetaphorItem[] {
  if (typeof source !== 'string' || !source.trim()) return [];
  const sanitized = sanitizeMetaphorDsl(source, { allowStructureRewrite: true });
  if (!sanitized.dsl?.items || !Array.isArray(sanitized.dsl.items)) return [];
  return sanitized.dsl.items as MetaphorItem[];
}

function itemFingerprint(item: MetaphorItem) {
  const { id: _id, ...rest } = item;
  return JSON.stringify(rest);
}

function itemsById(items: MetaphorItem[]) {
  const map = new Map<string, MetaphorItem>();
  for (const item of items) {
    const id = item?.id;
    if (typeof id === 'string' && id.trim()) map.set(id, item);
  }
  return map;
}

export function diffMetaphorSources(
  previousSource: string | null | undefined,
  nextSource: string | null | undefined
): MetaphorStructuralDiff {
  const beforeMap = itemsById(parseMetaphorItems(previousSource));
  const afterMap = itemsById(parseMetaphorItems(nextSource));
  const added: string[] = [];
  const modified: string[] = [];
  const removed: string[] = [];

  for (const [id, item] of afterMap) {
    if (!beforeMap.has(id)) {
      added.push(id);
      continue;
    }
    if (itemFingerprint(beforeMap.get(id)!) !== itemFingerprint(item)) {
      modified.push(id);
    }
  }
  for (const id of beforeMap.keys()) {
    if (!afterMap.has(id)) removed.push(id);
  }

  const sort = (arr: string[]) => arr.sort((a, b) => a.localeCompare(b));
  return {
    addedIds: sort(added),
    modifiedIds: sort(modified),
    removedIds: sort(removed)
  };
}
