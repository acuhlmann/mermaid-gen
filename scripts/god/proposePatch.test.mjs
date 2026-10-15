import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  branchForRun,
  filterPatchFiles,
  main,
  proposePrText,
  shouldPackPatch
} from './proposePatch.mjs';

test('shouldPackPatch only after a completed propose run', () => {
  assert.equal(shouldPackPatch({ tier: 'propose', stopReason: 'completed' }), true);
  assert.equal(shouldPackPatch({ tier: 'observe', stopReason: 'completed' }), false);
  assert.equal(shouldPackPatch({ tier: 'propose', stopReason: 'budget' }), false);
  assert.equal(shouldPackPatch({ tier: 'ship', stopReason: 'completed' }), false);
});

test('filterPatchFiles drops the brief staging dir, god-log, and dependency trees', () => {
  assert.deepEqual(
    filterPatchFiles([
      'apps/server/src/prompts/mermaidSyntaxGuard.js',
      'god-run/brief.json',
      'god-log/runs/1.json',
      'node_modules/zod/index.js',
      '../etc/passwd',
      ''
    ]),
    ['apps/server/src/prompts/mermaidSyntaxGuard.js']
  );
});

test('branchForRun and proposePrText stay inside the run-record and title shapes', () => {
  assert.equal(branchForRun('12345'), 'god/12345');
  assert.throws(() => branchForRun(''));
  const text = proposePrText({
    runId: '99',
    narration: 'finding:mermaid.accept_rate Accept rate fell five points.'
  });
  assert.equal(text.title, 'god: mermaid.accept_rate');
  assert.match(text.body, /Accept rate fell five points/);
  assert.match(text.body, /does not auto-merge/);
  const waiting = proposePrText({ runId: '99', narration: 'waiting' });
  assert.equal(waiting.title, 'god: run-99');
  assert.equal(waiting.hypothesis, null);
});

test('the CLI writes a title file from events', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'god-pr-'));
  const events = path.join(dir, 'events.ndjson');
  fs.writeFileSync(
    events,
    `${JSON.stringify({ type: 'text', text: 'finding:chart.failure_rate Compile failures clustered.' })}\n`
  );
  const titleOut = path.join(dir, 'title');
  const bodyOut = path.join(dir, 'body');
  main(['--run-id', '7', '--events', events, '--title-out', titleOut, '--body-out', bodyOut]);
  assert.equal(fs.readFileSync(titleOut, 'utf8'), 'god: chart.failure_rate');
  assert.match(fs.readFileSync(bodyOut, 'utf8'), /Compile failures clustered/);
});
