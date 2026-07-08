/** @typedef {import('@archislop/shared').ToolApplyResultSummary} PatchApplyStats */

/**
 * @param {number | undefined | null} ms
 * @returns {string}
 */
export function formatActionDurationMs(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  return seconds < 10 ? `${seconds.toFixed(1)}s` : `${Math.round(seconds)}s`;
}

/**
 * Human-readable patch outcome for the insights tool trace.
 *
 * @param {PatchApplyStats & { durationMs?: number }} stats
 * @returns {string}
 */
export function formatPatchApplyDetail(stats = {}) {
  const parts = [];
  const duration = formatActionDurationMs(stats.durationMs);
  if (duration) parts.push(duration);

  const linesAdded = Number(stats.linesAdded) || 0;
  const linesRemoved = Number(stats.linesRemoved) || 0;
  if (linesAdded > 0 || linesRemoved > 0) {
    parts.push(`+${linesAdded}/−${linesRemoved} lines`);
  }

  const graphParts = [];
  const nodesAdded = Number(stats.nodesAdded) || 0;
  const nodesRemoved = Number(stats.nodesRemoved) || 0;
  const edgesAdded = Number(stats.edgesAdded) || 0;
  const edgesRemoved = Number(stats.edgesRemoved) || 0;
  if (nodesAdded > 0) graphParts.push(`+${nodesAdded} node${nodesAdded === 1 ? '' : 's'}`);
  if (nodesRemoved > 0) graphParts.push(`−${nodesRemoved} node${nodesRemoved === 1 ? '' : 's'}`);
  if (edgesAdded > 0) graphParts.push(`+${edgesAdded} edge${edgesAdded === 1 ? '' : 's'}`);
  if (edgesRemoved > 0) graphParts.push(`−${edgesRemoved} edge${edgesRemoved === 1 ? '' : 's'}`);
  if (graphParts.length > 0) parts.push(graphParts.join(', '));

  if (Array.isArray(stats.sanitizerApplied) && stats.sanitizerApplied.length > 0) {
    parts.push('sanitizer rescue');
  } else if (typeof stats.validator === 'string' && stats.validator.trim()) {
    const validator = stats.validator.trim();
    if (validator !== 'local-parser') {
      parts.push(validator.replaceAll('-', ' '));
    }
  }

  if (Number.isFinite(stats.revisionId)) {
    parts.push(`rev ${stats.revisionId}`);
  }

  return parts.join(' · ');
}
