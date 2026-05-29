const CANONICAL_TYPES: Record<string, string> = {
  flowchart: 'flowchart',
  graph: 'flowchart',
  sequencediagram: 'sequenceDiagram',
  classdiagram: 'classDiagram',
  'statediagram-v2': 'stateDiagram-v2',
  statediagram: 'stateDiagram-v2',
  erdiagram: 'erDiagram',
  gantt: 'gantt',
  journey: 'journey',
  mindmap: 'mindmap',
  timeline: 'timeline',
  gitgraph: 'gitGraph',
  pie: 'pie',
  quadrantchart: 'quadrantChart',
  requirementdiagram: 'requirementDiagram',
  'block-beta': 'block-beta',
  c4context: 'C4Context',
  c4container: 'C4Container',
  c4component: 'C4Component',
  c4dynamic: 'C4Dynamic',
  c4deployment: 'C4Deployment',
  kanban: 'kanban',
  zenuml: 'zenuml',
  'sankey-beta': 'sankey-beta',
  'xychart-beta': 'xychart-beta'
};

/**
 * Canonical Mermaid diagram type from the first non-blank, non-comment line of
 * the source. Returns `null` if no known type appears.
 */
export function inferDiagramType(source: string | null | undefined): string | null {
  if (typeof source !== 'string') return null;
  const text = source.trim();
  if (!text) return null;

  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith('%%')) continue; // init directive or comment

    const token = t.split(/[\s:]+/)[0] ?? '';
    if (!token) continue;
    const key = token.toLowerCase().replace(/[`'":]+$/, '');
    return CANONICAL_TYPES[key] ?? null;
  }
  return null;
}
