import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLabelExplainerSystemPrompt,
  buildLabelExplainerUserPrompt,
  sanitizeLabelExplanation
} from '../src/agents/labelExplainer.js';

test('system prompt instructs to explain content, not element type', () => {
  const sys = buildLabelExplainerSystemPrompt();
  assert.match(sys, /CONTENT/);
  assert.match(sys, /not explain what a "node" or "edge"/);
  assert.match(sys, /ONE plain-text sentence/i);
});

test('user prompt names the clicked label and respects context limits', () => {
  const user = buildLabelExplainerUserPrompt({
    partKind: 'label',
    partName: 'Auth Service',
    label: 'Auth Service',
    contentType: 'mermaid',
    diagramSource: 'flowchart TB\n  Auth["Auth Service"] --> Worker',
    visibleLabels: ['Auth Service', 'Worker', 'Queue']
  });
  assert.match(user, /Label text clicked: "Auth Service"/);
  assert.match(user, /Element type clicked: label/);
  assert.match(user, /Nearby labels/);
  assert.match(user, /Reply with ONE short plain-text sentence/);
});

test('user prompt prefers partName over label when both differ', () => {
  const user = buildLabelExplainerUserPrompt({
    partKind: 'label',
    partName: 'POST /sessions',
    label: 'Sessions API',
    contentType: 'mermaid'
  });
  assert.match(user, /Label text clicked: "POST \/sessions"/);
  assert.match(user, /Containing element label: "Sessions API"/);
});

test('sanitizer strips quotes, code fences and preambles', () => {
  assert.equal(
    sanitizeLabelExplanation('```\n"The component that authenticates users."\n```'),
    'The component that authenticates users.'
  );
  assert.equal(
    sanitizeLabelExplanation('It refers to: the API gateway routing layer.'),
    'the API gateway routing layer.'
  );
  assert.equal(
    sanitizeLabelExplanation('This means the cache stores recent results.'),
    'the cache stores recent results.'
  );
});

test('sanitizer keeps only the first sentence', () => {
  const out = sanitizeLabelExplanation(
    'The Auth Service validates credentials. It also issues JWT tokens.'
  );
  assert.equal(out, 'The Auth Service validates credentials.');
});

test('sanitizer returns empty string for unusable input', () => {
  assert.equal(sanitizeLabelExplanation(''), '');
  assert.equal(sanitizeLabelExplanation('   \n  '), '');
  assert.equal(sanitizeLabelExplanation(null), '');
  assert.equal(sanitizeLabelExplanation(undefined), '');
});

test('sanitizer clamps overly long answers', () => {
  const long = 'A'.repeat(400) + ' something';
  const out = sanitizeLabelExplanation(long);
  assert.ok(out.length <= 281, `expected clamped length, got ${out.length}`);
  assert.ok(out.endsWith('…'), 'expected ellipsis');
});

test('simple-style system prompt drops jargon and trims word budget', () => {
  const sys = buildLabelExplainerSystemPrompt('simple');
  assert.match(sys, /dumb it down/i);
  assert.match(sys, /no jargon|no acronyms/i);
  assert.match(sys, /Max 25 words/);
});

test('simple-style user prompt asks for plain-language reply', () => {
  const user = buildLabelExplainerUserPrompt({
    partKind: 'label',
    partName: 'OAuth',
    contentType: 'mermaid',
    style: 'simple'
  });
  assert.match(user, /plain-language/);
  assert.match(user, /max 25 words/i);
});

test('brief style remains the default when no style is passed', () => {
  const sys = buildLabelExplainerSystemPrompt();
  assert.match(sys, /Max 30 words/);
  const user = buildLabelExplainerUserPrompt({
    partKind: 'label',
    partName: 'OAuth',
    contentType: 'mermaid'
  });
  assert.match(user, /max 30 words/i);
});
