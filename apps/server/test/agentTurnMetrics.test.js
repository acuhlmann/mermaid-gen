import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyAgentTurnError, recordAgentTurn } from '../src/metrics/agentTurnMetrics.js';

test('recordAgentTurn emits nothing when MERMAID_METRICS is unset', () => {
  const lines = [];
  const out = recordAgentTurn(
    { mode: 'go', accepted: true, durationMs: 12 },
    { env: {}, sink: (line) => lines.push(line) }
  );
  assert.equal(out, null);
  assert.equal(lines.length, 0);
});

test('recordAgentTurn emits structured line when enabled', () => {
  const lines = [];
  const out = recordAgentTurn(
    {
      mode: 'goMad',
      model: 'qwen/qwen3-235b-a22b',
      profile: 'quality',
      durationMs: 1287.4,
      accepted: true,
      validator: 'sanitizer-rescue',
      repairAttempts: 0,
      sanitizerHits: 2,
      errorClass: null,
      validatorTimings: { local: 4, mcp: 0 }
    },
    { env: { MERMAID_METRICS: '1' }, sink: (line) => lines.push(line) }
  );
  assert.equal(lines.length, 1);
  const parsed = JSON.parse(lines[0]);
  assert.equal(parsed.tag, 'agent_turn');
  assert.equal(parsed.mode, 'goMad');
  assert.equal(parsed.durationMs, 1287);
  assert.equal(parsed.validator, 'sanitizer-rescue');
  assert.equal(parsed.sanitizerHits, 2);
  assert.deepEqual(parsed.validatorTimings, { local: 4, mcp: 0 });
  assert.equal(out.accepted, true);
});

test('classifyAgentTurnError buckets common failures', () => {
  assert.equal(classifyAgentTurnError(null), null);
  assert.equal(
    classifyAgentTurnError('Proposed source is not valid Mermaid syntax (missing known diagram type).'),
    'missing-diagram-type'
  );
  assert.equal(classifyAgentTurnError('Mermaid parser rejected source: Parse error on line 3'), 'parser-rejected');
  assert.equal(classifyAgentTurnError('MCP returned 500'), 'mcp-error');
  assert.equal(classifyAgentTurnError('Your previous response did not apply a diagram patch.'), 'no-patch');
  assert.equal(classifyAgentTurnError('something unexpected'), 'other');
});

test('recordAgentTurn never throws even if sink fails', () => {
  assert.doesNotThrow(() => {
    recordAgentTurn(
      { mode: 'go', accepted: false, durationMs: 1 },
      {
        env: { MERMAID_METRICS: '1' },
        sink: () => {
          throw new Error('disk full');
        }
      }
    );
  });
});
