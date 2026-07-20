#!/usr/bin/env node
/**
 * Run the smallest verification loop for the current git diff.
 * Coding agents: prefer this over guessing workspace scripts.
 *
 * Usage:
 *   npm run check:affected
 *   npm run check:affected -- --base origin/main
 *   CHECK_AFFECTED_BASE=origin/main npm run check:affected
 */
import { spawnSync } from 'node:child_process';
import { changedFiles, filterPrettierFiles, repoRoot } from './prettier-files.mjs';
import { classifyChangedFiles } from './check-affected-lib.mjs';
import { detectWireCoChangeRisks, formatWireCoChangeRisks } from './wire-cochange.mjs';

const argv = process.argv.slice(2);
const baseFlag = argv.find((a) => a.startsWith('--base='));
const baseIdx = argv.indexOf('--base');
const baseRef =
  (baseFlag ? baseFlag.slice('--base='.length) : null) ??
  (baseIdx >= 0 ? argv[baseIdx + 1] : null) ??
  process.env.CHECK_AFFECTED_BASE ??
  'origin/main';

function run(cmd, args, label) {
  console.log(`\n→ ${label}`);
  // Windows resolves npm via npm.cmd; spawn without shell yields ENOENT in husky pre-push.
  const out = spawnSync(cmd, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });
  if (out.status !== 0) process.exit(out.status ?? 1);
}

const LINTABLE_RE = /\.(js|jsx|ts|tsx|mjs|cjs)$/;

/** @param {string[]} files */
function runFormatCheck(files) {
  const pretty = filterPrettierFiles(files);
  if (pretty.length === 0) return;
  const label =
    pretty.length > 40
      ? 'format:check (full repo — large diff)'
      : `format:check (${pretty.length} changed file(s))`;
  console.log(`\n→ ${label}`);
  if (pretty.length > 40) {
    run('npm', ['run', 'format:check'], label);
    return;
  }
  const out = spawnSync('npx', ['prettier', '--check', ...pretty], {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });
  if (out.status !== 0) {
    console.error('\nformat:check failed — run: npm run format:affected');
    console.error(
      'Then re-stage formatted files. Cloud agents: use npm run precommit before every commit.'
    );
    if (process.platform === 'win32') {
      console.error(
        'On Windows, if hundreds of files fail only on line endings: ensure .gitattributes is present, then refresh the working tree with LF (see docs/agents/sensors.md § Line endings).'
      );
    }
    process.exit(out.status ?? 1);
  }
}

/** @param {string[]} files */
function classify(files) {
  return classifyChangedFiles(files);
}

function changedFilesForCheck() {
  return changedFiles(baseRef);
}

function main() {
  const files = changedFilesForCheck();
  if (files.length === 0) {
    console.log('check-affected: no changed files; running check:fast');
    run('npm', ['run', 'check:fast'], 'check:fast');
    return;
  }

  console.log(`check-affected: ${files.length} file(s) vs ${baseRef}`);
  const flags = classify(files);

  const wireRisks = detectWireCoChangeRisks(files);
  if (wireRisks.length > 0) {
    console.warn('\n' + formatWireCoChangeRisks(wireRisks));
    // Soft fail during warm-up: warn loudly with canonical fix, do not exit.
    // Promote to process.exit(1) once agents routinely co-change consumers.
  }

  // CI runs format:check on every PR — catch drift before push (skipped when full check runs below).
  if (!flags.root) {
    runFormatCheck(files);
  }

  if (flags.root) {
    console.log('check-affected: root/tooling change → full check');
    run('npm', ['run', 'check'], 'check');
    return;
  }

  let ran = false;

  if (flags.docs) {
    run('npm', ['run', 'verify:doc-paths'], 'verify:doc-paths');
    run('npm', ['run', 'verify:agent-infra'], 'verify:agent-infra');
    ran = true;
  }

  if (flags.deps) {
    run('npm', ['run', 'verify:deps'], 'verify:deps (override + singleton pins)');
    run('npm', ['run', 'verify:boundaries'], 'verify:boundaries (graph rules)');
    run('npm', ['run', 'typecheck', '-w', 'apps/web'], 'typecheck (apps/web — A2UI imports)');
    ran = true;
  }

  if (flags.shared) {
    run('npm', ['run', 'check:fast'], 'check:fast (packages/shared)');
    // tsconfig.build.json differs from tsconfig.json (e.g. types: []),
    // so typecheck alone can miss errors that fail the CI build.
    run('npm', ['run', 'build', '-w', 'packages/shared'], 'build (packages/shared)');
    if (flags.lintShared) {
      run('npm', ['run', 'lint', '-w', 'packages/shared'], 'lint (packages/shared)');
    }
    ran = true;
  }

  if (flags.server) {
    run('npm', ['run', 'typecheck', '-w', 'apps/server'], 'typecheck (apps/server)');
    // CI runs typecheck:strict via `npm run check`; loose server typecheck alone
    // misses strict-island regressions (see ADR-0006).
    run('npm', ['run', 'typecheck:strict', '-w', 'apps/server'], 'typecheck:strict (apps/server)');
    run('npm', ['run', 'test', '-w', 'apps/server'], 'test (apps/server)');
    if (flags.lintServer) {
      run('npm', ['run', 'lint', '-w', 'apps/server'], 'lint (apps/server)');
    }
    ran = true;
  }

  if (flags.web) {
    run('npm', ['run', 'typecheck', '-w', 'apps/web'], 'typecheck (apps/web)');
    run('npm', ['run', 'test', '-w', 'apps/web'], 'test (apps/web)');
    if (flags.lintWeb) {
      run('npm', ['run', 'lint', '-w', 'apps/web'], 'lint (apps/web)');
    }
    ran = true;
  }

  if (flags.wire) {
    run('npm', ['run', 'check:wire'], 'check:wire');
    ran = true;
  }

  if (!flags.shared && !flags.server && !flags.web && !flags.wire && !flags.docs && !flags.deps) {
    console.log('check-affected: no workspace match; running verify:boundaries');
    run('npm', ['run', 'verify:boundaries'], 'verify:boundaries');
    ran = true;
  }

  if (ran) {
    console.log('\ncheck-affected: OK');
  }
}

main();
