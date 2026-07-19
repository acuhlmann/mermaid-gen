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
  // Windows resolves npm via npm.cmd; spawn without shell yields ENOENT in husky pre-push.
  const out = spawnSync(cmd, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });
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

const LINTABLE_RE = /\.(js|jsx|ts|tsx|mjs|cjs)$/;

/** Mirrors `.prettierignore` — keep in sync when that file changes. */
const PRETTIER_EXT = /\.(js|jsx|ts|tsx|mjs|cjs|css|json|md|mdx|yml|yaml|html)$/;
const PRETTIER_SKIP = [
  /^node_modules\//,
  /^\.agents\//,
  /^dist\//,
  /^build\//,
  /^coverage\//,
  /^apps\/web\/dist/,
  /^apps\/web\/dist-main/,
  /^apps\/web\/dist-hackathon/,
  /^apps\/server\/bench-results\//,
  /^packages\/shared\/src\/vendor\//,
  /^package-lock\.json$/,
  /^skills-lock\.json$/,
  /\.min\.js$/,
  /\.min\.css$/,
  /^\.env/,
  /^\.env\./
];

/** @param {string[]} files */
function filterPrettierFiles(files) {
  return files.filter((f) => PRETTIER_EXT.test(f) && !PRETTIER_SKIP.some((re) => re.test(f)));
}

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
    console.error('\nformat:check failed — run: npm run format');
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
  const flags = {
    shared: false,
    server: false,
    web: false,
    wire: false,
    docs: false,
    root: false,
    deps: false,
    // Per-workspace lint trigger: only when a lintable file actually changed
    // in that workspace's src tree. Avoids running ESLint for pure doc edits
    // inside a workspace.
    lintShared: false,
    lintServer: false,
    lintWeb: false
  };
  for (const f of files) {
    if (f.startsWith('packages/shared/')) flags.shared = true;
    if (f.startsWith('apps/server/')) flags.server = true;
    if (f.startsWith('apps/web/')) flags.web = true;
    if (f.startsWith('packages/shared/src/') && LINTABLE_RE.test(f)) flags.lintShared = true;
    if (f.startsWith('apps/server/src/') && LINTABLE_RE.test(f)) flags.lintServer = true;
    if (f.startsWith('apps/web/src/') && LINTABLE_RE.test(f)) flags.lintWeb = true;
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
    // Anything that could change the dependency graph or the boundary config
    // re-runs the graph check.
    if (f === '.dependency-cruiser.cjs' || f === 'package.json' || f === 'package-lock.json') {
      flags.deps = true;
    }
    if (
      f === 'package.json' ||
      f.startsWith('scripts/') ||
      f.startsWith('.github/') ||
      f === 'tsconfig.base.json' ||
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
    mergeBase.status === 0 && mergeBase.stdout.trim() ? mergeBase.stdout.trim() : baseRef;

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
