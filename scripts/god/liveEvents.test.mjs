import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clipCommand,
  clipText,
  createLiveEventStream,
  describeRawEvent,
  toRepoPath
} from './liveEvents.mjs';

const CWD = '/home/runner/work/mermaid-gen/mermaid-gen';

test('a tool result never leaves the runner — only the tool name and an exit status', () => {
  const stream = createLiveEventStream({ cwd: CWD, now: () => new Date('2026-10-14T07:00:00Z') });
  stream.push({
    type: 'tool_call',
    callId: 'c1',
    tool: 'read',
    input: { file_path: `${CWD}/a.js` }
  });
  const result = stream.push({
    type: 'tool_result',
    callId: 'c1',
    status: 'completed',
    result: 'DEEPSEEK_API_KEY=sk-live-should-never-ship'
  });
  assert.deepEqual(result, {
    seq: 1,
    ts: '2026-10-14T07:00:00.000Z',
    type: 'tool',
    tool: 'read',
    exitCode: 0
  });
  assert.equal(JSON.stringify(result).includes('sk-live'), false);
});

test('tool calls keep a repo-relative path and a clipped command', () => {
  const ctx = { cwd: CWD };
  assert.deepEqual(
    describeRawEvent(
      { type: 'tool_call', tool: 'edit', input: { file_path: `${CWD}/apps/server/x.js` } },
      ctx
    ),
    { type: 'tool', tool: 'edit', path: 'apps/server/x.js', command: undefined }
  );
  const bash = describeRawEvent(
    {
      type: 'tool_call',
      tool: 'bash',
      input: { command: `npm test\nrm -rf /\u0007${'x'.repeat(400)}` }
    },
    ctx
  );
  assert.equal(bash.command, 'npm test');
  assert.equal(bash.path, undefined);
});

test('paths outside the workspace or with odd characters are dropped', () => {
  assert.equal(toRepoPath('/etc/passwd', CWD), undefined);
  assert.equal(toRepoPath('../../secrets.txt', CWD), undefined);
  assert.equal(toRepoPath(`${CWD}/has space.js`, CWD), undefined);
  assert.equal(toRepoPath('apps/web/src/x.jsx', CWD), 'apps/web/src/x.jsx');
  assert.equal(toRepoPath(42, CWD), undefined);
});

test('narration is flattened and clipped; odd tool names are anonymised', () => {
  assert.equal(clipText('line one\nline two\u0000', 280), 'line one line two');
  assert.equal(clipText('x'.repeat(300), 280).length, 280);
  assert.equal(clipText('   ', 280), undefined);
  assert.equal(clipCommand('echo é'), 'echo ?');
  const event = describeRawEvent({ type: 'tool_call', tool: 'rm -rf /', input: {} }, { cwd: CWD });
  assert.equal(event.tool, 'tool');
});

test('thinking, step bookkeeping and unknown event types are not forwarded', () => {
  const stream = createLiveEventStream({ cwd: CWD });
  assert.equal(stream.push({ type: 'thinking', text: 'private reasoning' }), null);
  assert.equal(stream.push({ type: 'status', phase: 'step_start', turn: 1, step: 1 }), null);
  assert.equal(stream.push({ type: 'something_new', secret: 'x' }), null);
  assert.equal(stream.count(), 0);
  const turnEnd = stream.push({ type: 'status', phase: 'turn_end', reason: { kind: 'completed' } });
  assert.equal(turnEnd.text, 'turn ended: completed');
  assert.equal(stream.count(), 1);
});

test('proxy events become model and status events', () => {
  const ctx = { cwd: CWD };
  assert.deepEqual(
    describeRawEvent(
      { type: 'model', inputTokens: 10, outputTokens: 2, cacheHitTokens: 5, totalUsd: 0.12 },
      ctx
    ),
    { type: 'model', inputTokens: 10, outputTokens: 2, cacheHitTokens: 5, usd: 0.12 }
  );
  assert.equal(describeRawEvent({ type: 'budget' }, ctx).reason, 'budget');
  assert.equal(describeRawEvent({ type: 'balance' }, ctx).reason, 'balance');
  assert.match(
    describeRawEvent({ type: 'blocked', method: 'POST', path: '/v1/files' }, ctx).text,
    /proxy refused POST \/v1\/files/
  );
});

test('a candidate that fails the schema is dropped whole', () => {
  const stream = createLiveEventStream({ cwd: CWD });
  assert.equal(stream.push({ type: 'model', inputTokens: -5, outputTokens: 1, totalUsd: 1 }), null);
  assert.equal(stream.count(), 0);
});
