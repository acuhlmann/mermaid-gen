#!/usr/bin/env node
/**
 * Run the smallest test loop for the current git diff.
 *
 * Usage:
 *   npm run test:affected
 *   npm run test:affected -- --base origin/main
 *   TEST_AFFECTED_SLOW=1 npm run test:affected
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { changedFiles, repoRoot } from './prettier-files.mjs';
import {
  listAllServerTestFiles,
  resolveAffectedTests,
  summarizeAffectedTestPlan,
  WIRE_TEST_FILES
} from './test-affected-lib.mjs';

const ROOT = repoRoot ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const argv = process.argv.slice(2);
const baseFlag = argv.find((a) => a.startsWith('--base='));
const baseIdx = argv.indexOf('--base');
const baseRef =
  (baseFlag ? baseFlag.slice('--base='.length) : null) ??
  (baseIdx >= 0 ? argv[baseIdx + 1] : null) ??
  process.env.TEST_AFFECTED_BASE ??
  process.env.CHECK_AFFECTED_BASE ??
  'origin/main';

const includeSlow = process.env.TEST_AFFECTED_SLOW === '1' || argv.includes('--slow');

const SERVER_TEST_CMD = [
  '--import',
  '../../scripts/register-antv-layout-esm.mjs',
  '--import',
  'tsx',
  '--test'
];

function run(cmd, args, label) {
  console.log(`\n→ ${label}`);
  const out = spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });
  if (out.status !== 0) process.exit(out.status ?? 1);
}

function runServerTests(testFiles, label) {
  if (testFiles.length === 0) return;
  runWithCwd(
    'node',
    [...SERVER_TEST_CMD, ...testFiles.map((f) => f.replace(/^apps\/server\//, ''))],
    label,
    'apps/server'
  );
}

function runSharedTests(testFiles, label) {
  if (testFiles.length === 0) return;
  runWithCwd(
    'node',
    [...SERVER_TEST_CMD, ...testFiles.map((f) => f.replace(/^packages\/shared\//, ''))],
    label,
    'packages/shared'
  );
}

function runWebTests(testFiles, label) {
  if (testFiles.length === 0) return;
  const rel = testFiles.map((f) => f.replace(/^apps\/web\//, ''));
  runWithCwd('npx', ['vitest', 'run', ...rel], label, 'apps/web');
}

function runWithCwd(cmd, args, label, cwd) {
  console.log(`\n→ ${label}`);
  const out = spawnSync(cmd, args, {
    cwd: path.join(ROOT, cwd),
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });
  if (out.status !== 0) process.exit(out.status ?? 1);
}

function partitionTests(testFiles) {
  /** @type {{ shared: string[], server: string[], web: string[], scripts: string[] }} */
  const buckets = { shared: [], server: [], web: [], scripts: [] };
  for (const file of testFiles) {
    if (file.startsWith('packages/shared/')) buckets.shared.push(file);
    else if (file.startsWith('apps/server/')) buckets.server.push(file);
    else if (file.startsWith('apps/web/')) buckets.web.push(file);
    else if (file.startsWith('scripts/')) buckets.scripts.push(file);
  }
  return buckets;
}

function main() {
  const files = changedFiles(baseRef);
  if (files.length === 0) {
    console.log('test:affected: no changed files; running check:fast');
    run('npm', ['run', 'check:fast'], 'check:fast');
    return;
  }

  const plan = resolveAffectedTests(files, { root: ROOT, includeSlow });
  console.log(`test:affected: ${files.length} file(s) vs ${baseRef}`);
  console.log(`test:affected: ${summarizeAffectedTestPlan(plan)}`);

  const buckets = partitionTests(plan.tests);

  if (buckets.scripts.length > 0) {
    runWithCwd(
      'node',
      ['--test', ...buckets.scripts.map((f) => f.replace(/^scripts\//, ''))],
      'test (scripts)',
      'scripts'
    );
  } else if (plan.fallbacks.includes('scripts')) {
    run('npm', ['run', 'test:scripts'], 'test (scripts — fallback)');
  }

  if (plan.fallbacks.includes('shared') && buckets.shared.length === 0) {
    run('npm', ['run', 'test', '-w', 'packages/shared'], 'test (packages/shared — fallback)');
  } else {
    runSharedTests(buckets.shared, `test (packages/shared — ${buckets.shared.length} file(s))`);
  }

  if (plan.fallbacks.includes('server') && buckets.server.length === 0) {
    if (includeSlow || plan.anythingTouched) {
      run('npm', ['run', 'test', '-w', 'apps/server'], 'test (apps/server — fallback full)');
    } else {
      const fastFiles = listAllServerTestFiles(ROOT, false);
      runServerTests(fastFiles, `test (apps/server — fallback fast, ${fastFiles.length} file(s))`);
    }
  } else {
    runServerTests(buckets.server, `test (apps/server — ${buckets.server.length} file(s))`);
  }

  if (plan.fallbacks.includes('web') && buckets.web.length === 0) {
    run('npm', ['run', 'test', '-w', 'apps/web'], 'test (apps/web — fallback)');
  } else {
    runWebTests(buckets.web, `test (apps/web — ${buckets.web.length} file(s))`);
  }

  if (plan.runWire) {
    const wireBuckets = partitionTests(WIRE_TEST_FILES);
    runSharedTests(wireBuckets.shared, 'test:wire (packages/shared)');
    runServerTests(wireBuckets.server, 'test:wire (apps/server)');
    runWebTests(wireBuckets.web, 'test:wire (apps/web)');
  }

  console.log('\ntest:affected: OK');
}

main();
