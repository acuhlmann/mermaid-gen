import assert from 'node:assert/strict';
import test from 'node:test';
import { emitExplainSectionsBeforeFinal } from '../src/agents/explainSectionsStream.js';

test('emitExplainSectionsBeforeFinal emits explain_sections artifact', () => {
  const out = [];
  const md = `## Explanation\n\nOverview.\n\n## Takeaways\n\nRemember.`;
  emitExplainSectionsBeforeFinal((e) => out.push(e), {
    kind: 'explain',
    analyzeText: md,
    contentType: 'mermaid'
  });
  assert.equal(out.length, 1);
  assert.equal(out[0].kind, 'explain_sections');
  assert.equal(out[0].sections.length, 2);
});

test('emitExplainSectionsBeforeFinal skips critique', () => {
  const out = [];
  emitExplainSectionsBeforeFinal((e) => out.push(e), {
    kind: 'critique',
    analyzeText: '## Explanation\n\nA.\n\n## Takeaways\n\nB.'
  });
  assert.equal(out.length, 0);
});
