/**
 * One rule for picking a single edge out of a set of parallel ones.
 *
 * The flowchart and state families both collect every link between the same
 * ordered pair and then have to decide which one the canvas meant. They had
 * byte-identical copies of the decision (`pickFlowchartEdgeRef` /
 * `pickStateEdgeRef`); it lives here so the two families cannot drift.
 *
 * The sequence family's `findSequenceMessageRange` in `mermaidSourceLocate.js`
 * is a deliberately separate third implementation — see
 * `docs/canvas-graph-edit.md` § Traps.
 */

/**
 * A collected link between one ordered pair, in source order.
 *
 * @typedef {{ lineIndex: number, edgeIndex: number, text: string }} ParallelEdgeRef
 */

/**
 * Pick one edge among parallel links: Mermaid's per-pair index wins, then an
 * explicit label, then the first match when the label is absent — and a
 * provided label that no longer matches the source refuses rather than
 * silently editing a neighbouring link.
 *
 * @template {ParallelEdgeRef} T
 * @param {T[]} refs
 * @param {{ edgeLabel?: string, edgeIndex?: number }} opts
 * @returns {T | null}
 */
export function pickParallelEdgeRef(refs, { edgeLabel, edgeIndex }) {
  if (refs.length === 0) return null;
  if (typeof edgeIndex === 'number' && Number.isInteger(edgeIndex) && edgeIndex >= 0) {
    return refs[edgeIndex] ?? null;
  }
  const wanted = typeof edgeLabel === 'string' ? edgeLabel.trim() : '';
  if (wanted.length > 0) {
    return refs.find((ref) => ref.text === wanted) ?? null;
  }
  return refs[0];
}
