import test from 'node:test';
import assert from 'node:assert/strict';
import { createPatchToolStreamTracker } from '../src/agents/streamPatchToolTelemetry.js';

test('createPatchToolStreamTracker streams patch reason as plan_beat', () => {
  const captured = [];
  const tracker = createPatchToolStreamTracker({
    emit: (e) => captured.push(e),
    patchToolName: 'apply_mermaid_patch',
    contentType: 'mermaid',
    emitDraftPreview: false
  });
  tracker.processToolCallChunks([
    {
      id: 'tc1',
      name: 'apply_mermaid_patch',
      args: '{"reason":"Adding auth gate before API","diagramSource":"flow'
    }
  ]);
  assert.equal(captured.length, 1);
  assert.equal(captured[0].type, 'plan_beat');
  assert.equal(captured[0].source, 'agent');
  assert.ok(captured[0].text.includes('auth gate'));
});
