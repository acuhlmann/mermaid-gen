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
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

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
  const out = spawnSync(cmd, args, { cwd: repoRoot, stdio: 'inherit', shell: false });
  if (out.status !== 0) process.exit(out.status ?? 1);
}

function gitLines(args) {
  const out = spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
  if (out.status !== 0) return [];
  return out.stdout
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

/** @param {string[]} files */
function classify(files) {
  const flags = {
    shared: false,
    server: false,
    web: false,
    wire: false,
    docs: false,
    root: false
  };
  for (const f of files) {
    if (f.startsWith('packages/shared/')) flags.shared = true;
    if (f.startsWith('apps/server/')) flags.server = true;
    if (f.startsWith('apps/web/')) flags.web = true;
    if (
      f.startsWith('packages/shared/src/') &&
      /agUi|legacyStream|agentStreamEmitter|diagramSchema|wire/i.test(f)
    ) {
      flags.wire = true;
    }
    if (
      f.startsWith('apps/server/src/') &&
      /routes\/copilot|agents\/|mcp\/|state\/sessionEventBus|tools\//.test(f)
    ) {
      flags.wire = true;
    }
    if (f.startsWith('apps/web/src/state/') || f.includes('agUiTranslator')) {
      flags.wire = true;
    }
    if (
      f.startsWith('docs/') ||
      f === 'STRUCTURE.md' ||
      f === 'AGENTS.md' ||
      f === 'CLAUDE.md' ||
      f.startsWith('docs/recipes/')
    ) {
      flags.docs = true;
    }
    if (
      f === 'package.json' ||
      f.startsWith('scripts/') ||
      f.startsWith('.github/') ||
      f.endsWith('tsconfig') ||
      f.includes('tsconfig.')
    ) {
      flags.root = true;
    }
  }
  return flags;
}

function changedFiles() {
  const mergeBase = spawnSync('git', ['merge-base', 'HEAD', baseRef], {
    cwd: repoRoot,
    encoding: 'utf8'
  });
  const diffBase =
    mergeBase.status === 0 && mergeBase.stdout.trim()
      ? mergeBase.stdout.trim()
      : baseRef;

  const committed = gitLines(['diff', '--name-only', `${diffBase}...HEAD`]);
  const unstaged = gitLines(['diff', '--name-only']);
  const staged = gitLines(['diff', '--name-only', '--cached']);
  return [...new Set([...committed, ...unstaged, ...staged])];
}

function main() {
  const files = changedFiles();
  if (files.length === 0) {
    console.log('check-affected: no changed files; running check:fast');
    run('npm', ['run', 'check:fast'], 'check:fast');
    return;
  }

  console.log(`check-affected: ${files.length} file(s) vs ${baseRef}`);
  const flags = classify(files);

  if (flags.root) {
    console.log('check-affected: root/tooling change → full check');
    run('npm', ['run', 'check'], 'check');
    return;
  }

  let ran = false;

  if (flags.docs) {
    run('npm', ['run', 'verify:doc-paths'], 'verify:doc-paths');
    ran = true;
  }

  if (flags.shared) {
    run('npm', ['run', 'check:fast'], 'check:fast (packages/shared)');
    // tsconfig.build.json differs from tsconfig.json (e.g. types: []),
    // so typecheck alone can miss errors that fail the CI build.
    run('npm', ['run', 'build', '-w', 'packages/shared'], 'build (packages/shared)');
    ran = true;
  }

  if (flags.server) {
    run('npm', ['run', 'typecheck', '-w', 'apps/server'], 'typecheck (apps/server)');
    run('npm', ['run', 'test', '-w', 'apps/server'], 'test (apps/server)');
    ran = true;
  }

  if (flags.web) {
    run('npm', ['run', 'typecheck', '-w', 'apps/web'], 'typecheck (apps/web)');
    run('npm', ['run', 'test', '-w', 'apps/web'], 'test (apps/web)');
    ran = true;
  }

  if (flags.wire) {
    run('npm', ['run', 'check:wire'], 'check:wire');
    ran = true;
  }

  if (!flags.shared && !flags.server && !flags.web && !flags.wire && !flags.docs) {
    console.log('check-affected: no workspace match; running verify:boundaries');
    run('npm', ['run', 'verify:boundaries'], 'verify:boundaries');
    ran = true;
  }

  if (ran) {
    console.log('\ncheck-affected: OK');
  }
}

main();
