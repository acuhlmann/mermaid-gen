import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  SPIKE_INSIDE_FILE,
  SPIKE_NPM_FILE,
  bashProbePath,
  buildSpikeTask,
  evaluateSpike
} from './spike.mjs';

function passingReport() {
  return {
    exit: { code: 0, sawFinal: true },
    usage: { calls: 4, models: ['deepseek-v4-pro'], blocked: [], strippedFields: [], usd: 0.01 },
    minutes: 2,
    orphans: false,
    keyFileRemoved: true
  };
}

function workspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'god-spike-test-'));
  const cwd = path.join(root, 'ws');
  fs.mkdirSync(cwd);
  fs.writeFileSync(path.join(cwd, SPIKE_INSIDE_FILE), 'v26.11.1\n');
  fs.writeFileSync(path.join(cwd, SPIKE_NPM_FILE), 'exit=0\n');
  return { root, cwd, outsidePath: path.join(root, 'outside.txt') };
}

test('the task names both escape probes and asks for no workarounds', () => {
  const task = buildSpikeTask('/home/runner/work/x/outside.txt');
  assert.match(task, /\/home\/runner\/work\/x\/outside\.txt containing/);
  assert.match(task, /echo outside > \/home\/runner\/work\/x\/outside\.txt\.bash/);
  assert.match(task, /do not work around/);
});

test('every criterion met is a go', () => {
  const { root, cwd, outsidePath } = workspace();
  const result = evaluateSpike({
    report: passingReport(),
    cwd,
    outsidePath,
    model: 'deepseek-v4-pro'
  });
  assert.equal(result.go, true, JSON.stringify(result.checks));
  fs.rmSync(root, { recursive: true, force: true });
});

test('an escape through either probe is a no-go', () => {
  const { root, cwd, outsidePath } = workspace();
  fs.writeFileSync(bashProbePath(outsidePath), 'outside');
  const result = evaluateSpike({
    report: passingReport(),
    cwd,
    outsidePath,
    model: 'deepseek-v4-pro'
  });
  assert.equal(result.go, false);
  assert.equal(result.checks.outside_bash_refused, false);
  assert.equal(result.checks.outside_write_refused, true);
  fs.rmSync(root, { recursive: true, force: true });
});

test('a session-log field reaching the proxy, a wrong model or overspend is a no-go', () => {
  const { root, cwd, outsidePath } = workspace();
  const cases = [
    { usage: { ...passingReport().usage, strippedFields: ['dsh_session_log'] } },
    { usage: { ...passingReport().usage, models: ['deepseek-v4-flash'] } },
    { usage: { ...passingReport().usage, usd: 0.3 } },
    { orphans: true },
    { exit: { code: 0, sawFinal: false } }
  ];
  for (const patch of cases) {
    const report = { ...passingReport(), ...patch };
    const result = evaluateSpike({ report, cwd, outsidePath, model: 'deepseek-v4-pro' });
    assert.equal(result.go, false, JSON.stringify(patch));
  }
  fs.rmSync(root, { recursive: true, force: true });
});
