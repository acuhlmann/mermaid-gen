import test from 'node:test';
import assert from 'node:assert/strict';
import {
  convertHubRelationToHierarchy,
  dedupeThemePalette,
  sanitizeInfographicDsl,
  stripInvalidThemeKeys
} from '../src/infographicSanitizer.js';

const HAMBURG_RELATION = `infographic relation-dagre-flow-tb-simple-circle-node
data
  title Hamburg Overview
  desc Key aspects of the city
  nodes
    - id A
      label Hamburg
      icon city
    - id B
      label Port & Trade
      icon ship
    - id C
      label Culture & Landmarks
      icon landmark
    - id D
      label Economy & Industry
      icon chart line
    - id E
      label Transport & Mobility
      icon bus
    - id F
      label Education & Research
      icon book
  relations
    - A - connects to -> B
    - A - connects to -> C
    - A - connects to -> D
    - A - connects to -> E
    - A - connects to -> F
theme
  palette #58cc02 #1cb0f6 #ffc800 #1cb0f6 #ffc800 #1cb0f6`;

test('dedupeThemePalette keeps first unique hex colors only', () => {
  const { text, applied } = dedupeThemePalette(
    'theme\n  palette #58cc02 #1cb0f6 #ffc800 #1cb0f6 #ffc800 #1cb0f6'
  );
  assert.ok(applied.includes('dedupe-theme-palette'));
  assert.match(text, /palette #58cc02 #1cb0f6 #ffc800$/);
});

test('convertHubRelationToHierarchy rewrites star graphs with generic edge labels', () => {
  const { text, applied } = convertHubRelationToHierarchy(HAMBURG_RELATION);
  assert.ok(applied.includes('convert-hub-relation-to-hierarchy'));
  assert.match(text, /^infographic hierarchy-tree-curved-line-rounded-rect-node/m);
  assert.match(text, /root\n\s+label Hamburg/);
  assert.match(text, /label Port & Trade/);
  assert.match(text, /label Education & Research/);
  assert.doesNotMatch(text, /relations/);
  assert.match(text, /palette #58cc02 #1cb0f6 #ffc800/);
});

test('sanitizeInfographicDsl applies hub rewrite and palette dedupe for Hamburg overview', () => {
  const { text, applied } = sanitizeInfographicDsl(HAMBURG_RELATION);
  assert.ok(applied.includes('convert-hub-relation-to-hierarchy'));
  assert.ok(applied.includes('dedupe-theme-palette'));
  assert.match(text, /hierarchy-tree-curved-line-rounded-rect-node/);
});

test('stripInvalidThemeKeys removes invented theme keys but keeps palette', () => {
  const dsl =
    'infographic list-grid-simple\n' +
    'data\n' +
    '  lists\n' +
    '    - label A\n' +
    'theme\n' +
    '  palette #1cb0f6 #58cc02\n' +
    '  node-border-colors #1cb0f6';
  const { text, applied } = stripInvalidThemeKeys(dsl);
  assert.ok(applied.includes('strip-invalid-theme-keys'));
  assert.match(text, /palette #1cb0f6/);
  assert.ok(!text.includes('node-border-colors'));
});
