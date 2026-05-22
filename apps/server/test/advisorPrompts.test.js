import test from 'node:test';
import assert from 'node:assert/strict';
import { ADVISOR_PERSONAS, parseAdvisorReply } from '../src/agents/advisorPrompts.js';

test('every advisor persona has a non-trivial persona prompt', () => {
  for (const [key, spec] of Object.entries(ADVISOR_PERSONAS)) {
    assert.ok(typeof spec.persona === 'string' && spec.persona.length > 40, `persona text for ${key}`);
    assert.ok(spec.temperature > 0 && spec.temperature <= 2, `temperature for ${key}`);
  }
});

test('parseAdvisorReply defaults kind to suggestion', () => {
  const reply = parseAdvisorReply('{"suggestion": "Split Gateway.", "highlightIds": ["G"]}');
  assert.equal(reply.kind, 'suggestion');
  assert.equal(reply.suggestion, 'Split Gateway.');
  assert.deepEqual(reply.highlightIds, ['G']);
});

test('parseAdvisorReply preserves explicit comment kind', () => {
  const reply = parseAdvisorReply(
    '{"suggestion": "Gateway gives me vibes.", "kind": "comment", "highlightIds": []}'
  );
  assert.equal(reply.kind, 'comment');
});

test('parseAdvisorReply coerces explain persona to comment regardless of model output', () => {
  // Even when the model leaks an actionable-looking suggestion, the Wise Architect
  // must never surface a Do-it button.
  const reply = parseAdvisorReply(
    '{"suggestion": "Rename Auth → Auth Gate.", "kind": "suggestion"}',
    { persona: 'explain' }
  );
  assert.equal(reply.kind, 'comment');
});

test('parseAdvisorReply coerces refine persona to suggestion regardless of model output', () => {
  // THE Engineer is action-only — even if the model emits kind:"comment", the bubble
  // must always offer a Do-it button so the user gets a concrete next step.
  const reply = parseAdvisorReply(
    '{"suggestion": "Add a Cool-down step.", "kind": "comment"}',
    { persona: 'refine' }
  );
  assert.equal(reply.kind, 'suggestion');
});

test('parseAdvisorReply unknown kind falls back to suggestion', () => {
  const reply = parseAdvisorReply('{"suggestion": "X.", "kind": "shouting"}');
  assert.equal(reply.kind, 'suggestion');
});

test('parseAdvisorReply tolerates malformed json and missing suggestion', () => {
  assert.equal(parseAdvisorReply(''), null);
  assert.equal(parseAdvisorReply('not json'), null);
  assert.equal(parseAdvisorReply('{"kind": "comment"}'), null);
});
