import assert from 'node:assert/strict';
import test from 'node:test';
import { buildStyleEditsArtifact, parseStyleEditsFromText } from '../src/styleEdits.js';

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
