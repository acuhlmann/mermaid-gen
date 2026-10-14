import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  GOD_DSH_PATCH,
  buildDshEnv,
  dshVersion,
  isProcessGroupAlive,
  readDshVersions,
  startDsh,
  turnEndKind
} from './dsh.mjs';

/** A stand-in `dsh` binary: echoes how it was launched, then behaves as the task says. */
const FAKE_DSH = `
const { spawn } = require('node:child_process');
let task = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => (task += c));
process.stdin.on('end', () => {
  const out = (o) => process.stdout.write(JSON.stringify(o) + '\\n');
  out({ type: 'launch', args: process.argv.slice(2), env: process.env });
  out({ type: 'session', sessionId: 's', cwd: process.cwd() });
  if (task.startsWith('hang')) {
    spawn(process.execPath, ['-e', 'setTimeout(() => {}, 600000)'], { stdio: 'ignore' });
    setTimeout(() => {}, 600000);
    return;
  }
  out({ type: 'text', text: 'task was: ' + task });
  process.stdout.write('x'.repeat(40000) + '\\n');
  process.stdout.write('{not json\\n');
  out({ type: 'status', phase: 'turn_end', turn: 1, reason: { kind: 'completed' } });
  out({ type: 'final', text: 'done' });
  process.exitCode = task.startsWith('fail') ? 1 : 0;
});
`;

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'god-fake-dsh-'));
  const entry = path.join(dir, 'fake-dsh.cjs');
  fs.writeFileSync(entry, FAKE_DSH);
  const home = path.join(dir, 'home');
  const events = [];
  const start = (task) =>
    startDsh({
      task,
      cwd: dir,
      permissionMode: 'workspace-write',
      baseUrl: 'http://127.0.0.1:1234/anthropic',
      apiKey: 'god-proxy-token',
      model: 'deepseek-v4-pro',
      home,
      entry,
      onEvent: (raw) => events.push(raw)
    });
  return { dir, events, start, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

test('the child environment is an allowlist: no runner secrets, telemetry off, proxy as endpoint', () => {
  process.env.GOD_TEST_RUNNER_SECRET = 'leak-me';
  try {
    const env = buildDshEnv({
      home: '/tmp/h',
      permissionMode: 'read-only',
      baseUrl: 'http://127.0.0.1:1/anthropic',
      apiKey: 'proxy-token',
      model: 'deepseek-v4-pro'
    });
    assert.equal(env.GOD_TEST_RUNNER_SECRET, undefined);
    assert.equal(env.DEEPSEEK_API_KEY, 'proxy-token');
    assert.equal(env.DEEPSEEK_BASE_URL, 'http://127.0.0.1:1/anthropic');
    assert.equal(env.DSH_PERMISSION_MODE, 'read-only');
    assert.equal(env.DSH_TELEMETRY_MODE, 'DISABLED');
    assert.deepEqual(Object.keys(env).sort(), [
      'CI',
      'DEEPSEEK_API_KEY',
      'DEEPSEEK_BASE_URL',
      'DSH_HOME',
      'DSH_PERMISSION_MODE',
      'DSH_TELEMETRY_MODE',
      'DSH_TELEMETRY_OTLP_URL',
      'GOD_DSH_MODEL',
      'HOME',
      'LANG',
      'NO_COLOR',
      'PATH',
      'TERM',
      'npm_config_update_notifier'
    ]);
  } finally {
    delete process.env.GOD_TEST_RUNNER_SECRET;
  }
});

test('startDsh launches headless with the God overlay, feeds the task on stdin and parses events', async () => {
  const { events, start, cleanup } = setup();
  try {
    const exit = await start('fix the parser').exit;
    assert.equal(exit.code, 0);
    assert.equal(exit.sawFinal, true);
    assert.equal(exit.turnEndReason, 'completed');
    assert.equal(exit.skippedLines, 2, 'an oversize line and a malformed line are skipped');
    const launch = events.find((e) => e.type === 'launch');
    assert.deepEqual(launch.args, [
      '--profile',
      'headless',
      '--patch',
      GOD_DSH_PATCH,
      '--json',
      '-'
    ]);
    assert.equal(launch.env.DEEPSEEK_API_KEY, 'god-proxy-token');
    assert.equal(events.find((e) => e.type === 'text').text, 'task was: fix the parser');
  } finally {
    cleanup();
  }
});

test('a failing harness reports its exit code', async () => {
  const { start, cleanup } = setup();
  try {
    const exit = await start('fail please').exit;
    assert.equal(exit.code, 1);
  } finally {
    cleanup();
  }
});

test('kill takes down the whole process group, grandchildren included', async () => {
  const { events, start, cleanup } = setup();
  try {
    const handle = start('hang forever');
    while (!events.some((e) => e.type === 'session')) await new Promise((r) => setTimeout(r, 20));
    assert.equal(isProcessGroupAlive(handle.pid), true);
    handle.kill('SIGKILL');
    const exit = await handle.exit;
    assert.equal(exit.signal, 'SIGKILL');
    for (let i = 0; i < 50 && isProcessGroupAlive(handle.pid); i++) {
      await new Promise((r) => setTimeout(r, 20));
    }
    assert.equal(isProcessGroupAlive(handle.pid), false);
  } finally {
    cleanup();
  }
});

test('turn_end reasons are read from dsh 0.2 objects or plain strings', () => {
  assert.equal(turnEndKind({ kind: 'completed' }), 'completed');
  assert.equal(turnEndKind('aborted'), 'aborted');
  assert.equal(turnEndKind(null), 'unknown');
});

test('versions are exact pins and the overlay switches off every phone-home path', () => {
  const versions = readDshVersions();
  for (const [name, version] of Object.entries(versions.packages)) {
    assert.match(version, /^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/, `${name} must be an exact version`);
  }
  assert.equal(dshVersion(), versions.packages['@deepseek-ai/dsh']);
  const overlay = fs.readFileSync(GOD_DSH_PATCH, 'utf8');
  for (const id of [
    'session-log-deepseek',
    'session-telemetry-otel',
    'otel',
    'plugin-package-inventory-deepseek',
    'web-search-deepseek',
    'tool-web',
    'tool-subagent',
    'tool-goal'
  ]) {
    assert.match(overlay, new RegExp(`- id: ${id}\\n  disabled: true`), id);
  }
});
