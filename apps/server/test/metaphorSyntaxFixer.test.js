import test from 'node:test';
import assert from 'node:assert/strict';
import { repairMetaphorWithFixer } from '../src/agents/metaphorSyntaxFixer.js';

const VALID_CITY_DSL = JSON.stringify(
  {
    metaphor: 'city',
    scene: { theme: 'whiteboard', camera: 'orbit' },
    items: [{ id: 'auth', label: 'Auth', height: 8, footprint: 2 }]
  },
  null,
  2
);

function fakeModel(responseText) {
  return {
    async invoke() {
      return { content: responseText };
    }
  };
}

test('repairMetaphorWithFixer accepts model output that passes validateMetaphorStrict', async () => {
  const result = await repairMetaphorWithFixer({
    brokenSource: '{"metaphor":"city","items":[{"id":"auth","label":"Auth"}',
    parseError: 'JSON parse failed',
    modelOverride: fakeModel(`\`\`\`json\n${VALID_CITY_DSL}\n\`\`\``)
  });
  assert.equal(result.accepted, true);
  assert.match(result.diagramSource, /"metaphor": "city"/);
  assert.equal(result.metadata.validator, 'metaphor-syntax-fixer');
});

test('repairMetaphorWithFixer rejects invalid fixer output', async () => {
  const result = await repairMetaphorWithFixer({
    brokenSource: '{"metaphor":"city","items":[]}',
    parseError: 'missing labels',
    modelOverride: fakeModel('```json\n{"metaphor":"unknown","items":[]}\n```')
  });
  assert.equal(result.accepted, false);
  // The strict validator's root cause must be relayed, not a generic notice —
  // it seeds the next repair turn.
  assert.match(String(result.error), /metaphor: must be one of/);
  assert.match(String(result.error), /"unknown"/);
});

test('repairMetaphorWithFixer relays per-field Zod issues from invalid output', async () => {
  const result = await repairMetaphorWithFixer({
    brokenSource: '{"metaphor":"city","items":[]}',
    parseError: 'bad height',
    modelOverride: fakeModel(
      '```json\n{"metaphor":"city","scene":{},"items":[{"id":"a","label":"A","height":"tall"}]}\n```'
    )
  });
  assert.equal(result.accepted, false);
  assert.match(String(result.error), /did not match schema/i);
  assert.match(String(result.error), /items\.0\.height/);
});

test('repairMetaphorWithFixer reports empty output', async () => {
  const result = await repairMetaphorWithFixer({
    brokenSource: VALID_CITY_DSL,
    parseError: 'test',
    modelOverride: fakeModel('')
  });
  assert.equal(result.accepted, false);
  assert.match(String(result.error), /empty/i);
});
