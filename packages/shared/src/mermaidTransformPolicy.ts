import { countMermaidGraphElements, inferMermaidTopKeyword } from './mermaidGraphMetrics.js';

const TRANSFORM_MODES = new Set(['refine', 'erlich', 'goMad', 'barker']);

const BARKER_MAX_NODES = 8;
const BARKER_MAX_EDGES = 10;

/**
 * @param {string | null | undefined} message
 */
export function isMermaidTransformConstraintError(message: string | null | undefined) {
  if (!message || typeof message !== 'string') return false;
  return /executive simplify|subtractive only|may add at most|must keep (?:diagram type|template)|go mad tier/i.test(
    message
  );
}

/**
 * Validate a Mermaid patch against stakeholder transform semantics.
 *
 * @param {{
 *   transformMode?: string | null,
 *   goMadDepth?: number | null,
 *   beforeSource?: string,
 *   afterSource?: string
 * }} opts
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function validateMermaidTransformConstraint(opts: {
  transformMode?: string | null;
  goMadDepth?: number | null;
  beforeSource?: string;
  afterSource?: string;
}): { ok: true } | { ok: false; error: string } {
  const mode = opts.transformMode;
  if (!mode || !TRANSFORM_MODES.has(mode)) return { ok: true };

  const before = opts.beforeSource ?? '';
  const after = opts.afterSource ?? '';
  const beforeType = inferMermaidTopKeyword(before);
  const afterType = inferMermaidTopKeyword(after);
  const beforeGraph = countMermaidGraphElements(before);
  const afterGraph = countMermaidGraphElements(after);
  const depth = Math.min(12, Math.max(1, Math.trunc(Number(opts.goMadDepth) || 1)));

  if (mode === 'barker') {
    if (beforeType !== 'diagram' && afterType !== 'diagram' && beforeType !== afterType) {
      return {
        ok: false,
        error: `Executive simplify must keep diagram type "${beforeType}" (got "${afterType}").`
      };
    }
    if (afterGraph.nodes > BARKER_MAX_NODES) {
      return {
        ok: false,
        error: `Executive simplify targets at most ${BARKER_MAX_NODES} nodes (got ${afterGraph.nodes}).`
      };
    }
    if (afterGraph.edges > BARKER_MAX_EDGES) {
      return {
        ok: false,
        error: `Executive simplify targets at most ${BARKER_MAX_EDGES} edges (got ${afterGraph.edges}).`
      };
    }
    if (afterGraph.nodes > beforeGraph.nodes) {
      return {
        ok: false,
        error: `Executive simplify is subtractive only (had ${beforeGraph.nodes} nodes, now ${afterGraph.nodes}).`
      };
    }
    if (afterGraph.edges > beforeGraph.edges) {
      return {
        ok: false,
        error: `Executive simplify is subtractive only (had ${beforeGraph.edges} edges, now ${afterGraph.edges}).`
      };
    }
    const large = beforeGraph.nodes > 4 || beforeGraph.edges > 5;
    const shrank = afterGraph.nodes < beforeGraph.nodes || afterGraph.edges < beforeGraph.edges;
    if (large && !shrank) {
      return {
        ok: false,
        error: `Executive simplify must remove nodes or edges for a board-deck skim (had ${beforeGraph.nodes} nodes / ${beforeGraph.edges} edges; merge or drop stragglers).`
      };
    }
    return { ok: true };
  }

  if (mode === 'refine') {
    if (beforeType !== 'diagram' && afterType !== 'diagram' && beforeType !== afterType) {
      return {
        ok: false,
        error: `Refine must keep diagram type "${beforeType}" (got "${afterType}").`
      };
    }
    if (afterGraph.nodes > beforeGraph.nodes + 4) {
      return {
        ok: false,
        error: `Refine may add at most 4 nodes (had ${beforeGraph.nodes}, now ${afterGraph.nodes}).`
      };
    }
    if (afterGraph.edges > beforeGraph.edges + 6) {
      return {
        ok: false,
        error: `Refine may add at most 6 edges (had ${beforeGraph.edges}, now ${afterGraph.edges}).`
      };
    }
    return { ok: true };
  }

  if (mode === 'erlich') {
    if (afterGraph.nodes > beforeGraph.nodes + 10) {
      return {
        ok: false,
        error: `Erlich may add at most 10 nodes (had ${beforeGraph.nodes}, now ${afterGraph.nodes}).`
      };
    }
    if (afterGraph.edges > beforeGraph.edges + 14) {
      return {
        ok: false,
        error: `Erlich may add at most 14 edges (had ${beforeGraph.edges}, now ${afterGraph.edges}).`
      };
    }
    return { ok: true };
  }

  if (mode === 'goMad') {
    if (depth <= 2) {
      if (beforeType !== 'diagram' && afterType !== 'diagram' && beforeType !== afterType) {
        return {
          ok: false,
          error: `Go Mad tier ${depth}: keep diagram type "${beforeType}" — wild labels and styling only.`
        };
      }
      return { ok: true };
    }
    if (beforeType !== 'diagram' && afterType !== 'diagram' && beforeType === afterType) {
      return {
        ok: false,
        error: `Go Mad tier ${depth}: switch diagram type (still "${beforeType}").`
      };
    }
    return { ok: true };
  }

  return { ok: true };
}
