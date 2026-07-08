import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyStyleEditsToStyleConfig,
  buildStyleEditsArtifact,
  canApplyStyleEditsDeterministically,
  parseStyleEditsFromText,
  styleEditsToPrompt
} from '../src/styleEdits.js';

const EARTH_IMPACTS = `Earth Impacts
5. Replace ::icon(fa fa-fire) with 🔥
6. Darken tertiary text from #4b3b00 to something like #3a2a00`;

test('parseStyleEditsFromText parses Earth Impacts sample', () => {
  const edits = parseStyleEditsFromText(EARTH_IMPACTS);
  assert.equal(edits.length, 2);
  assert.equal(edits[0].kind, 'icon_replace');
  assert.equal(edits[0].from, 'fa fa-fire');
  assert.equal(edits[0].to, '🔥');
  assert.equal(edits[1].kind, 'color_shift');
  assert.equal(edits[1].from, '#4b3b00');
  assert.equal(edits[1].to, '#3a2a00');
});

test('buildStyleEditsArtifact returns null when no visual edits', () => {
  assert.equal(buildStyleEditsArtifact('Hello world only prose.'), null);
});

test('buildStyleEditsArtifact emits artifact shape', () => {
  const art = buildStyleEditsArtifact(EARTH_IMPACTS);
  assert.equal(art?.kind, 'style_edits');
  assert.equal(art?.edits.length, 2);
});

test('applyStyleEditsToStyleConfig updates theme variables deterministically', () => {
  const edits = parseStyleEditsFromText('1. Shift background from #f7f7f7 to #ddf4ff');
  assert.equal(edits.length, 1);
  const next = applyStyleEditsToStyleConfig(edits);
  assert.equal(next.themeVariables.background, '#ddf4ff');
  assert.equal(canApplyStyleEditsDeterministically(edits), true);
});

test('canApplyStyleEditsDeterministically rejects icon replace edits', () => {
  const edits = parseStyleEditsFromText(EARTH_IMPACTS);
  assert.equal(canApplyStyleEditsDeterministically(edits), false);
});

test('styleEditsToPrompt builds an apply prompt', () => {
  const edits = parseStyleEditsFromText('1. Shift background from #d7ffb8 to #ddf4ff');
  const prompt = styleEditsToPrompt(edits);
  assert.match(prompt, /Apply these style tweaks/);
  assert.match(prompt, /background/);
});
