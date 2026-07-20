/**
 * Shared helpers for diff-scoped Prettier (check-affected, format-affected).
 * Keep PRETTIER_SKIP in sync with `.prettierignore`.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(__dirname, '..');

/** Mirrors `.prettierignore` — keep in sync when that file changes. */
export const PRETTIER_EXT = /\.(js|jsx|ts|tsx|mjs|cjs|css|json|md|mdx|yml|yaml|html)$/;
export const PRETTIER_SKIP = [
  /^node_modules\//,
  /^\.agents\//,
  /^\.claude\/worktrees\//,
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
export function filterExistingFiles(files) {
  return files.filter((f) => existsSync(resolve(repoRoot, f)));
}

/** @param {string[]} files */
export function filterPrettierFiles(files) {
  return filterExistingFiles(files).filter(
    (f) => PRETTIER_EXT.test(f) && !PRETTIER_SKIP.some((re) => re.test(f))
  );
}

function gitLines(args) {
  const out = spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
  if (out.status !== 0) return [];
  return out.stdout
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

/**
 * @param {string} [baseRef='origin/main']
 * @returns {string[]}
 */
export function changedFiles(baseRef = 'origin/main') {
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
