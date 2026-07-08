/**
 * Compute structural diagram diffs for thinking-pane canvas highlights.
 */

import {
  diffChartSources,
  diffInfographicSources,
  diffMetaphorSources
} from '@archislop/shared';
import { diffMermaidFlowcharts } from './mermaidFlowchartDiff.js';

const EMPTY_DIFF = { addedIds: [], modifiedIds: [], removedIds: [] };

/**
 * @param {string | null | undefined} contentType
 * @param {string | null | undefined} baselineSource
 * @param {string | null | undefined} afterSource
 */
export function computeDiagramStructuralDiff(contentType, baselineSource, afterSource) {
  if (typeof baselineSource !== 'string' || typeof afterSource !== 'string') return null;
  try {
    if (contentType === 'mermaid') {
      return diffMermaidFlowcharts(baselineSource, afterSource);
    }
    if (contentType === 'infographic') {
      return diffInfographicSources(baselineSource, afterSource);
    }
    if (contentType === 'chart') {
      return diffChartSources(baselineSource, afterSource);
    }
    if (contentType === 'metaphor3d') {
      return diffMetaphorSources(baselineSource, afterSource);
    }
  } catch {
    return null;
  }
  return null;
}

export { EMPTY_DIFF };
