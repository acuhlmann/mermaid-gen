import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeCritiqueMarkdownForMatch,
  resolveCritiqueAnalyzeFinalText,
  splitCritiqueActionableSections
} from '../src/critiqueActionable.js';

test('splitCritiqueActionableSections extracts bullet items under ## Actionable improvements', () => {
  const md = `## Strengths\n\n- Good.\n\n## Actionable improvements\n\n- First thing\n- Second thing\n\n## Footer\n\nTail.`;
  const r = splitCritiqueActionableSections(md);
  assert.equal(r.hasSection, true);
  assert.deepEqual(r.items, ['First thing', 'Second thing']);
  assert.match(r.prefix.trim(), /Strengths/);
  assert.match(r.suffix.trim(), /Footer/);
  assert.match(r.headingText, /Actionable/i);
});

test('splitCritiqueActionableSections matches actionable headings case-insensitively', () => {
  const md = `## ACTIONABLE FIXES\n\n- Only one\n`;
  const r = splitCritiqueActionableSections(md);
  assert.deepEqual(r.items, ['Only one']);
});

test('splitCritiqueActionableSections parses numbered lines in the actionable section', () => {
  const md = `## Actionable improvements\n\n1. Alpha\n2. Beta\n`;
  const r = splitCritiqueActionableSections(md);
  assert.deepEqual(r.items, ['Alpha', 'Beta']);
});

test('splitCritiqueActionableSections returns full markdown as prefix when no actionable heading', () => {
  const md = `## Strengths\n\n- Only.\n`;
  const r = splitCritiqueActionableSections(md);
  assert.equal(r.hasSection, false);
  assert.deepEqual(r.items, []);
  assert.equal(r.prefix, md);
});

test('splitCritiqueActionableSections parses asterisk bullets', () => {
  const md = `## Actionable improvements\n\n* Star one\n* Star two\n`;
  const r = splitCritiqueActionableSections(md);
  assert.deepEqual(r.items, ['Star one', 'Star two']);
});

test('resolveCritiqueAnalyzeFinalText prefers longer canonical analyze body', () => {
  const stream = '## Summary\n\nPartial.';
  const canonical = '## Summary\n\nFull.\n\n## Actionable improvements\n\n- Fix labels';
  assert.equal(resolveCritiqueAnalyzeFinalText(stream, canonical), canonical);
});

test('normalizeCritiqueMarkdownForMatch collapses whitespace', () => {
  assert.equal(
    normalizeCritiqueMarkdownForMatch('a\n\n  b'),
    normalizeCritiqueMarkdownForMatch('a  b')
  );
});
