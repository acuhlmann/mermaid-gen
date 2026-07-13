import test from 'node:test';
import assert from 'assert/strict';
import {
  parseContentTypeClassification,
  inferContentTypeFromPrompt
} from '../src/agents/inferContentType.js';

test('parseContentTypeClassification reads JSON contentType', () => {
  const parsed = parseContentTypeClassification(
    '{"contentType":"chart","reason":"numeric comparison"}'
  );
  assert.equal(parsed.contentType, 'chart');
  assert.match(parsed.reason, /numeric/i);
});

test('parseContentTypeClassification tolerates markdown fences', () => {
  const parsed = parseContentTypeClassification(
    '```json\n{"contentType":"infographic","reason":"KPI story"}\n```'
  );
  assert.equal(parsed.contentType, 'infographic');
});

test('parseContentTypeClassification defaults unknown output to mermaid', () => {
  const parsed = parseContentTypeClassification('nope');
  assert.equal(parsed.contentType, 'mermaid');
});

test('inferContentTypeFromPrompt passes concrete types through', async () => {
  const result = await inferContentTypeFromPrompt({
    prompt: 'anything',
    contentType: 'forms'
  });
  assert.equal(result.contentType, 'forms');
  assert.equal(result.classified, false);
});

test('inferContentTypeFromPrompt uses model override for auto', async () => {
  const model = {
    async invoke() {
      return { content: '{"contentType":"anything","reason":"interactive game"}' };
    }
  };
  const result = await inferContentTypeFromPrompt({
    prompt: 'make a bouncing ball game',
    contentType: 'auto',
    modelOverride: model
  });
  assert.equal(result.contentType, 'anything');
  assert.equal(result.classified, true);
  assert.match(result.reason, /game/i);
});

test('inferContentTypeFromPrompt falls back when model missing', async () => {
  const result = await inferContentTypeFromPrompt({
    prompt: 'architecture of checkout',
    contentType: 'auto',
    modelOverride: null,
    env: {}
  });
  assert.equal(result.contentType, 'mermaid');
  assert.equal(result.classified, true);
});
