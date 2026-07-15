import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFormsSeedDoc } from '@archislop/shared';
import { repairFormsWithFixer } from '../src/agents/formsSyntaxFixer.js';

function fakeModel(responseText) {
  return {
    async invoke() {
      return { content: responseText };
    }
  };
}

const VALID_DOC = buildFormsSeedDoc();

test('repairFormsWithFixer accepts model output that passes validateFormsStrict', async () => {
  const result = await repairFormsWithFixer({
    brokenSource: '{"archislopFormsVersion":1,"formTitle":"Broken"',
    parseError: 'JSON parse failed',
    modelOverride: fakeModel(`\`\`\`json\n${VALID_DOC}\n\`\`\``)
  });
  assert.equal(result.accepted, true);
  assert.match(result.diagramSource, /"archislopFormsVersion": 1/);
  assert.equal(result.metadata.validator, 'forms-syntax-fixer');
});

test('repairFormsWithFixer rejects disallowed components from the fixer', async () => {
  const bad = JSON.stringify({
    archislopFormsVersion: 1,
    formTitle: 'Bad form',
    messages: [
      { createSurface: {} },
      {
        updateComponents: {
          components: [
            { id: 'root', component: 'Column', children: ['x'] },
            { id: 'x', component: 'Wormhole' }
          ]
        }
      }
    ]
  });
  const result = await repairFormsWithFixer({
    brokenSource: bad,
    parseError: 'Wormhole not allowed',
    modelOverride: fakeModel(`\`\`\`json\n${bad}\n\`\`\``)
  });
  assert.equal(result.accepted, false);
  assert.match(String(result.error), /Wormhole/);
});

test('repairFormsWithFixer reports empty output', async () => {
  const result = await repairFormsWithFixer({
    brokenSource: VALID_DOC,
    parseError: 'test',
    modelOverride: fakeModel('')
  });
  assert.equal(result.accepted, false);
  assert.match(String(result.error), /empty/i);
});

test('repairFormsWithFixer rejects empty broken source', async () => {
  const result = await repairFormsWithFixer({
    brokenSource: '  ',
    modelOverride: fakeModel(VALID_DOC)
  });
  assert.equal(result.accepted, false);
  assert.match(String(result.error), /No broken source/);
});
