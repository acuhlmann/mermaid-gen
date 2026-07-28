import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INFOGRAPHIC_TRANSFORM_INSTRUCTIONS,
  buildInfographicRussEscalation,
  buildInfographicTransformUserContent
} from '../src/agents/infographicTransformPrompts.js';

const DSL =
  'infographic list-row-simple-horizontal-arrow\n' + 'data\n' + '  lists\n' + '    - label A';

test('gilfoyle instructions require keeping template', () => {
  assert.match(INFOGRAPHIC_TRANSFORM_INSTRUCTIONS.gilfoyle, /KEEP the exact same/i);
  assert.match(INFOGRAPHIC_TRANSFORM_INSTRUCTIONS.gilfoyle, /at most 2 new items/i);
});

test('erlich prefers current template first', () => {
  assert.match(INFOGRAPHIC_TRANSFORM_INSTRUCTIONS.erlich, /CURRENT template/i);
});

test('russ tier 1 escalation keeps template', () => {
  const text = buildInfographicRussEscalation(2, DSL);
  assert.match(text, /KEEP template/i);
  assert.doesNotMatch(text, /OFF-LIMITS/);
});

test('russ tier 3 escalation requires family switch', () => {
  const text = buildInfographicRussEscalation(3, DSL);
  assert.match(text, /Switch template family/i);
});

test('buildInfographicTransformUserContent includes advisor prompt', () => {
  const body = buildInfographicTransformUserContent({
    mode: 'gilfoyle',
    currentDsl: DSL,
    advisorPrompt: 'Rename A → Acquire'
  });
  assert.match(body, /Stakeholder suggestion/);
  assert.match(body, /Acquire/);
});
