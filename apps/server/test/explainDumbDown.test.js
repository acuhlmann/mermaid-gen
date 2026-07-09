import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  buildExplainDumbDownSystemPrompt,
  buildExplainDumbDownUserPrompt,
  sanitizeExplainDumbDownMarkdown
} from '../src/agents/explainDumbDown.js';

describe('explainDumbDown prompts', () => {
  test('buildExplainDumbDownSystemPrompt targets kid mode at level 3', () => {
    const sys = buildExplainDumbDownSystemPrompt(3);
    assert.match(sys, /10-year-old/i);
    assert.match(sys, /SAME Markdown ## section headings/i);
  });

  test('buildExplainDumbDownUserPrompt quotes previous explain', () => {
    const user = buildExplainDumbDownUserPrompt({
      previousExplain: '## Explanation\n\nAuth gate.',
      contentType: 'mermaid',
      simpleLevel: 1
    });
    assert.match(user, /PREVIOUS EXPLANATION/);
    assert.match(user, /Auth gate/);
  });

  test('gibberish user prompt asks for babble bodies', () => {
    const user = buildExplainDumbDownUserPrompt({
      previousExplain: '## Explanation\n\nReal words.',
      contentType: 'mermaid',
      style: 'gibberish'
    });
    assert.match(user, /baby babble/i);
  });

  test('sanitizeExplainDumbDownMarkdown strips fences', () => {
    const out = sanitizeExplainDumbDownMarkdown('```markdown\n## Explanation\n\nHi.\n```');
    assert.match(out, /^## Explanation/);
    assert.doesNotMatch(out, /```/);
  });
});
