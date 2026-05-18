import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INFOGRAPHIC_TRANSFORM_INSTRUCTIONS,
  buildInfographicGoMadEscalation,
  buildInfographicTransformUserContent
} from '../src/agents/infographicTransformPrompts.js';

const DSL =
  'infographic list-row-simple-horizontal-arrow\n' +
  'data\n' +
  '  lists\n' +
  '    - label A';

test('refine instructions require keeping template', () => {
  assert.match(INFOGRAPHIC_TRANSFORM_INSTRUCTIONS.refine, /KEEP the exact same/i);
  assert.match(INFOGRAPHIC_TRANSFORM_INSTRUCTIONS.refine, /at most 2 new items/i);
});

test('innovate prefers current template first', () => {
  assert.match(INFOGRAPHIC_TRANSFORM_INSTRUCTIONS.innovate, /CURRENT template/i);
});

test('goMad tier 1 escalation keeps template', () => {
  const text = buildInfographicGoMadEscalation(2, DSL);
  assert.match(text, /KEEP template/i);
  assert.doesNotMatch(text, /OFF-LIMITS/);
});

test('goMad tier 3 escalation requires family switch', () => {
  const text = buildInfographicGoMadEscalation(3, DSL);
  assert.match(text, /Switch template family/i);
});

test('buildInfographicTransformUserContent includes advisor prompt', () => {
  const body = buildInfographicTransformUserContent({
    mode: 'refine',
    currentDsl: DSL,
    advisorPrompt: 'Rename A → Acquire'
  });
  assert.match(body, /Stakeholder suggestion/);
  assert.match(body, /Acquire/);
});
