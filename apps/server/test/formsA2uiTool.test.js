import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFormsSeedDoc } from '@archislop/shared';
import { validateAndPrepareFormsPatch, validateFormsStrict } from '../src/tools/formsA2uiTool.js';

const currentState = { revisionId: 4 };

test('validateAndPrepareFormsPatch accepts the shared seed document', async () => {
  const result = await validateAndPrepareFormsPatch({
    currentState,
    proposedDiagramSource: buildFormsSeedDoc(),
    reason: 'test'
  });
  assert.equal(result.accepted, true);
  assert.equal(result.patch.contentType, 'forms');
  assert.equal(result.patch.previousRevisionId, 4);
  assert.equal(result.patch.nextRevisionId, 5);
  assert.equal(result.metadata.validator, 'forms-a2ui-allowlist');
  assert.ok(result.metadata.formTitle);
});

test('validateAndPrepareFormsPatch rejects non-string input', async () => {
  const result = await validateAndPrepareFormsPatch({
    currentState,
    proposedDiagramSource: null,
    reason: 'test'
  });
  assert.equal(result.accepted, false);
  assert.match(result.error, /must be a string/i);
});

test('validateAndPrepareFormsPatch rejects disallowed components', async () => {
  const bad = JSON.stringify({
    archislopFormsVersion: 1,
    formTitle: 'Bad',
    messages: [
      {
        createSurface: {
          surfaceId: 'x',
          catalogId: 'https://a2ui.org/specification/v0_9/basic_catalog.json'
        }
      },
      {
        updateComponents: {
          surfaceId: 'x',
          components: [{ id: 'root', component: 'Wormhole' }]
        }
      }
    ]
  });
  const result = await validateAndPrepareFormsPatch({
    currentState,
    proposedDiagramSource: bad,
    reason: 'test'
  });
  assert.equal(result.accepted, false);
  assert.match(result.error, /Wormhole/);
});

test('validateFormsStrict mirrors validateAndPrepareFormsPatch accept path', () => {
  const result = validateFormsStrict(buildFormsSeedDoc());
  assert.equal(result.valid, true);
  assert.equal(result.validator, 'forms-a2ui-allowlist');
  assert.ok(result.formTitle);
});

test('validateFormsStrict reports allowlist failures', () => {
  const result = validateFormsStrict('{"archislopFormsVersion":1,"messages":[]}');
  assert.equal(result.valid, false);
  assert.equal(result.validator, 'forms-a2ui-allowlist');
});
