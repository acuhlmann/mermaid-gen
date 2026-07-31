#!/usr/bin/env node
/**
 * Run server tests, optionally skipping slow Anything integration files.
 * Slow files spawn jsdom child processes; they run in a second batch with
 * concurrency 1 so a full-suite run does not contend with parallel workers.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listAllServerTestFiles, SERVER_SLOW_TEST_FILES } from './test-affected-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fast = process.argv.includes('--fast');

const SERVER_CWD = path.join(ROOT, 'apps/server');
const IMPORTS = [
  '--import',
  '../../scripts/register-antv-layout-esm.mjs',
  '--import',
  'tsx',
  '--test'
];

function relServerPaths(repoPaths) {
  return repoPaths.map((f) => f.replace(/^apps\/server\//, ''));
}

function runNodeTest(testFiles, { label, testConcurrency }) {
  if (testFiles.length === 0) return 0;
  const args = [...IMPORTS];
  if (testConcurrency != null) {
    args.push(`--test-concurrency=${testConcurrency}`);
  }
  args.push(...testFiles);
  console.log(`→ ${label}`);
  const out = spawnSync('node', args, {
    cwd: SERVER_CWD,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });
  return out.status ?? 1;
}

const allFiles = listAllServerTestFiles(ROOT, !fast);
const slowRepoSet = new Set(SERVER_SLOW_TEST_FILES);
const slowFiles = relServerPaths(allFiles.filter((f) => slowRepoSet.has(f)));
const fastFiles = relServerPaths(allFiles.filter((f) => !slowRepoSet.has(f)));

let status = runNodeTest(fastFiles, {
  label: fast
    ? `test:fast (${fastFiles.length} file(s))`
    : `test (${fastFiles.length} fast file(s))`
});

if (!fast && slowFiles.length > 0) {
  const slowStatus = runNodeTest(slowFiles, {
    label: `test (${slowFiles.length} slow Anything file(s), serial)`,
    testConcurrency: 1
  });
  if (slowStatus !== 0) status = slowStatus;
}

process.exit(status);
