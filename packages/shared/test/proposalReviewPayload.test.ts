import assert from 'node:assert/strict';
import test from 'node:test';
import { enrichProposalForReview } from '../src/proposalReviewPayload.js';

test('enrichProposalForReview adds diffSummary', () => {
  const enriched = enrichProposalForReview({
    proposal: {
      proposalId: 'p1',
      contentType: 'mermaid',
      diagramSource: 'flowchart LR\n  B --> C'
    },
    currentDiagramSource: 'flowchart LR\n  A --> B',
    sessionId: 'sess-1',
    webCanvasUrl: 'http://localhost:5173/sessions/sess-1'
  });
  assert.equal(enriched.sessionId, 'sess-1');
  assert.ok(enriched.diffSummary);
  assert.equal((enriched.diffSummary as { linesChanged: number }).linesChanged >= 0, true);
});
