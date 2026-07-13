/**
 * Diagram diff for proposal review (web Insights + MCP Apps).
 */

import { diffInfographicSources } from './infographicDiff.js';
import { extractMermaidEdges, extractMermaidNodeIds } from './mermaidGraphMetrics.js';

function edgeKey(e: { from: string; to: string }) {
  return `${e.from}->${e.to}`;
}

export function buildMermaidGraphDiff(before: string, after: string) {
  const beforeNodes = extractMermaidNodeIds(before) as Set<string>;
  const afterNodes = extractMermaidNodeIds(after) as Set<string>;
  const nodesAdded: string[] = [];
  const nodesRemoved: string[] = [];
  let nodesUnchanged = 0;
  for (const id of afterNodes) {
    if (!beforeNodes.has(id)) nodesAdded.push(id);
    else nodesUnchanged += 1;
  }
  for (const id of beforeNodes) {
    if (!afterNodes.has(id)) nodesRemoved.push(id);
  }
  nodesAdded.sort();
  nodesRemoved.sort();

  const beforeEdges = new Map(extractMermaidEdges(before).map((e) => [edgeKey(e), e]));
  const afterEdges = new Map(extractMermaidEdges(after).map((e) => [edgeKey(e), e]));
  const edgesAdded: { from: string; to: string }[] = [];
  const edgesRemoved: { from: string; to: string }[] = [];
  for (const [key, e] of afterEdges) {
    if (!beforeEdges.has(key)) edgesAdded.push(e);
  }
  for (const [key, e] of beforeEdges) {
    if (!afterEdges.has(key)) edgesRemoved.push(e);
  }

  return {
    nodesAdded,
    nodesRemoved,
    nodesUnchanged,
    edgesAdded,
    edgesRemoved
  };
}

export type DiagramDiffSummary = {
  linesAdded: number;
  linesRemoved: number;
  linesChanged: number;
  unified: { kind: string; text: string }[];
  graphDiff:
    ReturnType<typeof buildMermaidGraphDiff> | ReturnType<typeof diffInfographicSources> | null;
  nodesAdded: string[];
  nodesRemoved: string[];
  nodesUnchanged: number;
};

export function buildDiagramDiffSummary(
  before: string,
  after: string,
  { contentType = 'mermaid' }: { contentType?: string } = {}
): DiagramDiffSummary {
  const a = (before ?? '').split('\n');
  const b = (after ?? '').split('\n');
  const max = Math.max(a.length, b.length);
  const unified: { kind: string; text: string }[] = [];
  let linesAdded = 0;
  let linesRemoved = 0;
  let linesChanged = 0;

  for (let i = 0; i < max; i++) {
    const left = a[i];
    const right = b[i];
    if (left === undefined && right !== undefined) {
      unified.push({ kind: 'add', text: right });
      linesAdded += 1;
    } else if (right === undefined && left !== undefined) {
      unified.push({ kind: 'del', text: left });
      linesRemoved += 1;
    } else if (left === right) {
      unified.push({ kind: 'same', text: left });
    } else {
      unified.push({ kind: 'del', text: left });
      unified.push({ kind: 'add', text: right });
      linesChanged += 1;
    }
  }

  const graphDiff =
    contentType === 'mermaid'
      ? buildMermaidGraphDiff(before, after)
      : contentType === 'infographic'
        ? diffInfographicSources(before, after)
        : null;

  const legacyNodes =
    contentType === 'mermaid' && graphDiff && 'nodesAdded' in graphDiff
      ? {
          nodesAdded: graphDiff.nodesAdded as string[],
          nodesRemoved: graphDiff.nodesRemoved as string[],
          nodesUnchanged: graphDiff.nodesUnchanged as number
        }
      : { nodesAdded: [] as string[], nodesRemoved: [] as string[], nodesUnchanged: 0 };

  return {
    linesAdded,
    linesRemoved,
    linesChanged,
    unified,
    graphDiff,
    ...legacyNodes
  };
}
