/**
 * Compute structural diagram diffs for thinking-pane canvas highlights.
 */

import { diffChartSources, diffInfographicSources, diffMetaphorSources } from '@archislop/shared';
import { diffMermaidFlowcharts } from './mermaidFlowchartDiff.js';

export type DiagramStructuralDiff = {
  addedIds: string[];
  modifiedIds: string[];
  removedIds: string[];
};

export const EMPTY_DIFF: DiagramStructuralDiff = {
  addedIds: [],
  modifiedIds: [],
  removedIds: []
};

export function computeDiagramStructuralDiff(
  contentType: string | null | undefined,
  baselineSource: string | null | undefined,
  afterSource: string | null | undefined
): DiagramStructuralDiff | null {
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
