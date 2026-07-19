#!/usr/bin/env node
/**
 * Auto-format the current git diff with Prettier.
 * Cloud agents and other environments without Husky should run this before commit.
 *
 * Usage:
 *   npm run format:affected
 *   npm run format:affected -- --base origin/main
 */
import { spawnSync } from 'node:child_process';
import { changedFiles, filterPrettierFiles, repoRoot } from './prettier-files.mjs';

const argv = process.argv.slice(2);
const baseFlag = argv.find((a) => a.startsWith('--base='));
const baseIdx = argv.indexOf('--base');
const baseRef =
  (baseFlag ? baseFlag.slice('--base='.length) : null) ??
  (baseIdx >= 0 ? argv[baseIdx + 1] : null) ??
  process.env.CHECK_AFFECTED_BASE ??
  'origin/main';

function main() {
  const files = changedFiles(baseRef);
  const pretty = filterPrettierFiles(files);

  if (pretty.length === 0) {
    console.log('format-affected: no Prettier-eligible files in diff');
    return;
  }

  const label =
    pretty.length > 40
      ? 'format (full repo — large diff)'
      : `format (${pretty.length} changed file(s))`;
  console.log(`→ ${label}`);

  const args =
    pretty.length > 40
      ? ['prettier', '--write', '.', '--ignore-unknown']
      : ['prettier', '--write', ...pretty, '--ignore-unknown'];

  const out = spawnSync('npx', args, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });

  if (out.status !== 0) {
    process.exit(out.status ?? 1);
  }

  console.log('format-affected: OK — re-stage formatted files before commit');
}

main();
