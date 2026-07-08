/**
 * Structural diff between two chart DSL sources (row indices in spec.data.values).
 */

import { parseChartDsl } from './chartSchema.js';

export type ChartStructuralDiff = {
  addedIds: string[];
  modifiedIds: string[];
  removedIds: string[];
};

function extractChartRows(source: string | null | undefined): Record<string, unknown>[] {
  if (typeof source !== 'string' || !source.trim()) return [];
  const parsed = parseChartDsl(source);
  if (!parsed.ok) return [];
  const data = parsed.dsl.spec?.data;
  if (!data || typeof data !== 'object') return [];
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  const rows = (data as { values?: unknown }).values;
  return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
}

function rowFingerprint(row: Record<string, unknown>) {
  return Object.keys(row)
    .sort()
    .map((key) => `${key}:${String(row[key] ?? '').trim().toLowerCase()}`)
    .join('||');
}

export function diffChartSources(
  previousSource: string | null | undefined,
  nextSource: string | null | undefined
): ChartStructuralDiff {
  const beforeRows = extractChartRows(previousSource);
  const afterRows = extractChartRows(nextSource);
  const max = Math.max(beforeRows.length, afterRows.length);
  const added: string[] = [];
  const modified: string[] = [];
  const removed: string[] = [];

  for (let i = 0; i < max; i += 1) {
    const id = String(i);
    const before = beforeRows[i];
    const after = afterRows[i];
    if (before == null && after != null) {
      added.push(id);
      continue;
    }
    if (after == null && before != null) {
      removed.push(id);
      continue;
    }
    if (before != null && after != null && rowFingerprint(before) !== rowFingerprint(after)) {
      modified.push(id);
    }
  }

  const sort = (arr: string[]) => arr.sort((a, b) => Number(a) - Number(b));
  return {
    addedIds: sort(added),
    modifiedIds: sort(modified),
    removedIds: sort(removed)
  };
}
