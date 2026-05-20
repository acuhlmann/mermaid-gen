import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildExplainSectionsArtifact,
  parseExplainMarkdownSections
} from '../src/explainSections.js';

test('parseExplainMarkdownSections splits mermaid explain headings', () => {
  const md = `Intro line.

## Explanation
Overview here.

## Main flows
Flow A to B.

## Key entities
Node X.

## Takeaways
Remember Y.`;
  const { preamble, sections } = parseExplainMarkdownSections(md, 'mermaid');
  assert.equal(preamble, 'Intro line.');
  assert.equal(sections.length, 4);
  assert.equal(sections[0].id, 'explanation');
  assert.equal(sections[1].id, 'main_flows');
  assert.match(sections[0].body, /Overview/);
});

test('buildExplainSectionsArtifact returns null with fewer than two sections', () => {
  assert.equal(buildExplainSectionsArtifact('## Explanation\n\nOnly one.', 'mermaid'), null);
});

test('buildExplainSectionsArtifact emits artifact shape', () => {
  const md = `## Explanation\n\nA.\n\n## Takeaways\n\nB.`;
  const art = buildExplainSectionsArtifact(md, 'mermaid');
  assert.ok(art);
  assert.equal(art?.kind, 'explain_sections');
  assert.equal(art?.sections.length, 2);
});
