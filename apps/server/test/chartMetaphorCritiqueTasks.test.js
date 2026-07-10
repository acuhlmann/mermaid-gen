import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CHART_ANALYSIS_SYSTEM_PROMPT,
  CHART_CRITIQUE_TASK,
  CHART_EXPLAIN_TASK
} from '../src/prompts/chartSyntaxGuard.js';
import {
  METAPHOR_ANALYSIS_SYSTEM_PROMPT,
  METAPHOR_CRITIQUE_TASK,
  METAPHOR_EXPLAIN_TASK
} from '../src/prompts/metaphorSyntaxGuard.js';

test('chart analysis system prompt does not allow mutation', () => {
  assert.match(CHART_ANALYSIS_SYSTEM_PROMPT, /read-only/i);
});

test('chart critique task requires actionable improvements section', () => {
  for (const heading of [
    '## Weaknesses and limits',
    '## Mark and encoding fit',
    '## Visual and accessibility review',
    '## Actionable improvements'
  ]) {
    assert.ok(CHART_CRITIQUE_TASK.includes(heading), `expected ${heading}`);
  }
  assert.match(CHART_CRITIQUE_TASK, /Audit voice/i);
  assert.match(CHART_CRITIQUE_TASK, /AT LEAST 2/);
});

test('chart explain task requires the canonical section headers', () => {
  for (const heading of [
    '## Explanation',
    '## Data story',
    '## Encodings and marks',
    '## Takeaways'
  ]) {
    assert.ok(CHART_EXPLAIN_TASK.includes(heading), `expected ${heading}`);
  }
});

test('metaphor analysis system prompt does not allow mutation', () => {
  assert.match(METAPHOR_ANALYSIS_SYSTEM_PROMPT, /read-only/i);
});

test('metaphor critique task requires actionable improvements section', () => {
  for (const heading of [
    '## Weaknesses and limits',
    '## Metaphor fit',
    '## Spatial and visual review',
    '## Actionable improvements'
  ]) {
    assert.ok(METAPHOR_CRITIQUE_TASK.includes(heading), `expected ${heading}`);
  }
  assert.match(METAPHOR_CRITIQUE_TASK, /Audit voice/i);
  assert.match(METAPHOR_CRITIQUE_TASK, /AT LEAST 2/);
});

test('metaphor explain task requires the canonical section headers', () => {
  for (const heading of ['## Explanation', '## Spatial story', '## Key items', '## Takeaways']) {
    assert.ok(METAPHOR_EXPLAIN_TASK.includes(heading), `expected ${heading}`);
  }
});
