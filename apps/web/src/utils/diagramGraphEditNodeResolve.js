/**
 * DOM node resolution for canvas graph edit: selection outline, connect-mode source
 * highlighting, and logical-id lookup — one function per family (flowchart, sequence,
 * infographic, mindmap), all operating on the rendered SVG/DOM, not on DSL text.
 *
 * Split out of DiagramCanvas.jsx (ADR-0005 / docs/agents/balanced-coupling-priorities.md §5) —
 * these are pure `(root, id) => Element | null` lookups with no closure over component state.
 */

import { normalizeDiagramElementId } from './mermaidSourceLocate.js';

/** Mermaid often sets `id` on a child shape; selection + CSS need a stable element with `id`. */
export function diagramDomAnchor(group) {
  if (!group) return null;
  if (group.id) return group;
  const direct = group.querySelector?.(':scope > [id]');
  if (direct?.id) return direct;
  const nested = group.querySelector?.('[id]');
  if (nested?.id) return nested;
  return group;
}

/** Prefer outlining `g.node` / `g.cluster` even when the SVG `id` is on an inner shape. */
export function diagramSelectedWrap(root, domId) {
  if (!root || !domId) return null;
  try {
    const hit = root.querySelector(`[id="${CSS.escape(domId)}"]`);
    return (
      hit?.closest?.('g.node') ??
      hit?.closest?.('g.timeline-node') ??
      hit?.closest?.('g.cluster') ??
      hit?.closest?.('[data-et="participant"]') ??
      hit
    );
  } catch {
    return null;
  }
}

export function logicalIdFromNodeWrap(node) {
  const anchor = diagramDomAnchor(node);
  if (!anchor) return null;
  const dataId = anchor.getAttribute?.('data-id');
  if (dataId) return dataId;
  return normalizeDiagramElementId(anchor.id, 'node');
}

export function findInfographicConnectSource(root, connectSourceId) {
  if (!root || !connectSourceId) return null;
  const raw = String(connectSourceId);
  if (!raw.startsWith('~label:')) {
    try {
      const hit = root.querySelector(`[data-indexes="${CSS.escape(raw)}"]`);
      if (hit) return hit;
    } catch {
      // ignore invalid ids
    }
  }
  const label = raw.startsWith('~label:') ? raw.slice('~label:'.length) : '';
  if (!label) return null;
  const titles = root.querySelectorAll('[data-element-type="shape"] > title');
  for (const title of titles) {
    const text = (title.textContent || '').replace(/\s+/g, ' ').trim();
    if (text === label) return title.parentElement;
  }
  return null;
}

export function findMindmapConnectSource(root, connectSourceId) {
  if (!root || !connectSourceId) return null;
  const raw = String(connectSourceId);
  const label = raw.startsWith('~label:') ? raw.slice('~label:'.length) : raw;
  if (!label) return null;
  const nodes = root.querySelectorAll('g.node, g.section-root, g.section--1');
  for (const node of nodes) {
    const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
    if (text === label) return node;
    const title = node.querySelector(':scope > title');
    if (title) {
      const titled = (title.textContent || '').replace(/\s+/g, ' ').trim();
      if (titled === label) return node;
    }
  }
  return null;
}

export function findFlowchartNodeWrapByLogicalId(root, logicalId) {
  if (!root || !logicalId) return null;
  const nodes = root.querySelectorAll('g.node, g.timeline-node');
  for (const node of nodes) {
    if (logicalIdFromNodeWrap(node) === logicalId) return node;
  }
  return null;
}

export function findSequenceParticipantByLogicalId(root, logicalId) {
  if (!root || !logicalId) return null;
  try {
    return root.querySelector(`[data-et="participant"][data-id="${CSS.escape(logicalId)}"]`);
  } catch {
    return null;
  }
}

export function resolveDiagramNodeWrap(root, descriptor) {
  if (!root || !descriptor) return null;
  if (descriptor.id) return diagramSelectedWrap(root, descriptor.id);
  if (descriptor.dataId) {
    return (
      findFlowchartNodeWrapByLogicalId(root, descriptor.dataId) ||
      findSequenceParticipantByLogicalId(root, descriptor.dataId)
    );
  }
  return null;
}
