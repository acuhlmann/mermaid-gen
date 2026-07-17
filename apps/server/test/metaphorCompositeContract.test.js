import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { METAPHOR_SYSTEM_PROMPT } from '../src/prompts/metaphorSystemPrompt.js';
import { METAPHOR_SELF_CHECK } from '../src/prompts/metaphorSyntaxGuard.js';
import {
  validateAndPrepareMetaphorPatch,
  validateMetaphorStrict
} from '../src/tools/metaphorDslTool.js';

const FUSED_SOURCE = JSON.stringify({
  metaphor: 'composite',
  scene: { title: 'Commerce current' },
  layout: 'fused',
  seed: 'commerce-v1',
  novelty: 0.62,
  motionIntensity: 0.72,
  layers: [
    {
      id: 'domains',
      as: 'archipelago',
      items: [{ id: 'checkout', label: 'Checkout', mass: 12, relief: 0.8 }]
    },
    {
      id: 'services',
      as: 'city',
      items: [{ id: 'payments-api', label: 'Payments API', height: 14, footprint: 3 }]
    }
  ],
  items: [],
  links: [{ from: 'checkout', to: 'payments-api', kind: 'flow' }]
});

test('metaphor prompt defines fused composition without a fixed pair matrix', () => {
  assert.match(METAPHOR_SYSTEM_PROMPT, /one integrated kinetic world/i);
  assert.match(METAPHOR_SYSTEM_PROMPT, /without a fixed pair matrix/i);
  assert.match(METAPHOR_SYSTEM_PROMPT, /layout: "fused"/);
  assert.match(METAPHOR_SYSTEM_PROMPT, /Preserve exact user nouns/i);
  assert.match(METAPHOR_SYSTEM_PROMPT, /Align grouping nouns across layers/i);
  assert.match(METAPHOR_SYSTEM_PROMPT, /binds by those affinities/i);
  assert.doesNotMatch(METAPHOR_SYSTEM_PROMPT, /Prefer `layout: "adjacent"`/);
  assert.match(METAPHOR_SELF_CHECK, /globally unique across layers/i);
});

test('metaphor tool accepts Composite v2 planner controls and exposes the validator result', async () => {
  const strict = validateMetaphorStrict(FUSED_SOURCE);
  assert.equal(strict.valid, true);
  assert.equal(strict.metaphor, 'composite');

  const result = await validateAndPrepareMetaphorPatch({
    currentState: { revisionId: 4 },
    proposedDiagramSource: FUSED_SOURCE,
    reason: 'Fuse commerce world'
  });
  assert.equal(result.accepted, true);
  assert.equal(result.patch?.nextRevisionId, 5);
  assert.equal(result.metadata?.metaphor, 'composite');
});

test('manual Composite v2 walkthrough fixtures all pass strict validation', async () => {
  const fixtureNames = [
    'composite-commerce-platform.json',
    'composite-music-festival-logistics.json',
    'composite-sentient-toaster-memory-palace.json'
  ];
  for (const fixtureName of fixtureNames) {
    const source = await readFile(
      new URL(`../../../docs/fixtures/metaphor3d/${fixtureName}`, import.meta.url),
      'utf8'
    );
    const result = validateMetaphorStrict(source);
    assert.equal(result.valid, true, `${fixtureName}: ${result.error ?? 'invalid'}`);
  }
});
