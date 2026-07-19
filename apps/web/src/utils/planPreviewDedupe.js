/**
 * Deduplicate identical diagram previews across Thinking-pane plan beats.
 * Later beats keep their prose but point at the first preview instead of
 * re-mounting another InsightsEmbeddedDiagram.
 */

import { tryExtractDiagramPreviewFromText } from './insightsEmbeddedDiagramSplit.js';

/**
 * @param {string} source
 * @returns {string}
 */
export function normalizePlanPreviewSource(source) {
  const text = String(source ?? '')
    .replace(/\r\n?/g, '\n')
    .trim();
  if (!text) return '';

  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      return JSON.stringify(JSON.parse(text));
    } catch {
      // Fall through to whitespace-normalized text.
    }
  }

  return text
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
}

/**
 * @param {{ kind?: string | null, source?: string | null } | null | undefined} preview
 * @returns {string | null}
 */
export function planPreviewIdentityKey(preview) {
  if (!preview?.kind || typeof preview.source !== 'string') return null;
  const normalized = normalizePlanPreviewSource(preview.source);
  if (!normalized) return null;
  return `${preview.kind}\0${normalized}`;
}

/**
 * Walk plan beats in order and map each duplicate preview back to the first
 * beat index that already rendered that same diagram.
 *
 * @param {Array<{ text?: string } | null | undefined> | null | undefined} beats
 * @returns {Map<number, number>} duplicate beatIndex → first beatIndex
 */
export function buildPlanPreviewReuseByBeatIndex(beats) {
  /** @type {Map<number, number>} */
  const reuseByBeatIndex = new Map();
  if (!Array.isArray(beats) || beats.length === 0) return reuseByBeatIndex;

  /** @type {Map<string, number>} */
  const firstByKey = new Map();

  beats.forEach((beat, beatIndex) => {
    const text = String(beat?.text ?? '').trim();
    if (!text) return;
    const preview = tryExtractDiagramPreviewFromText(text);
    const key = planPreviewIdentityKey(preview);
    if (!key) return;

    const firstIndex = firstByKey.get(key);
    if (firstIndex == null) {
      firstByKey.set(key, beatIndex);
      return;
    }
    reuseByBeatIndex.set(beatIndex, firstIndex);
  });

  return reuseByBeatIndex;
}
