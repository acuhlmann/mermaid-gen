export {
  buildDiagramDiffSummary,
  buildMermaidGraphDiff,
  extractMermaidEdges,
  extractMermaidNodeIds
} from '@archislop/shared';

export function buildWebCanvasUrl(sessionId: string): string {
  const fromWeb = process.env.ARCHISLOP_WEB_URL?.trim();
  const fromPublic = process.env.PUBLIC_BASE_URL?.trim();
  const base = fromWeb || fromPublic || process.env.OPENROUTER_SITE_URL || 'http://localhost:5173';
  const trimmed = base.replace(/\/$/, '');
  return `${trimmed}/sessions/${encodeURIComponent(sessionId)}`;
}
