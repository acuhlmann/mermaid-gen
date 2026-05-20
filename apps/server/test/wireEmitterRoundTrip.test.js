import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAgentStreamEmitter } from '../../../packages/shared/src/agentStreamEmitter.js';
import { AGUI_CUSTOM_NAME_PLAN_BEAT } from '../../../packages/shared/src/agUiWireConstants.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = JSON.parse(
  readFileSync(
    join(__dirname, '../../../packages/shared/test/fixtures/wire/legacy-events.json'),
    'utf8'
  )
);

test('wire server: emitter maps fixture plan_beat to AG-UI CUSTOM', () => {
  const legacy = FIXTURES.plan_beat_server;
  const wire = [];
  const emit = createAgentStreamEmitter({
    rawEmit: (e) => wire.push(e),
    threadId: 'thr_srv',
    runId: 'run_srv',
    contentType: 'mermaid'
  });
  emit(legacy);
  assert.equal(wire.length, 1);
  assert.equal(wire[0].type, 'CUSTOM');
  assert.equal(wire[0].name, AGUI_CUSTOM_NAME_PLAN_BEAT);
  assert.equal(wire[0].value.text, legacy.text);
});
