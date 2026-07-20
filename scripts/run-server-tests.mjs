#!/usr/bin/env node
/**
 * Run server tests, optionally skipping slow Anything integration files.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listAllServerTestFiles } from './test-affected-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fast = process.argv.includes('--fast');

const testFiles = listAllServerTestFiles(ROOT, !fast).map((f) => f.replace(/^apps\/server\//, ''));

const args = [
  '--import',
  '../../scripts/register-antv-layout-esm.mjs',
  '--import',
  'tsx',
  '--test',
  ...testFiles
];

const label = fast ? `test:fast (${testFiles.length} files)` : `test (${testFiles.length} files)`;
console.log(`→ ${label}`);

const out = spawnSync('node', args, {
  cwd: path.join(ROOT, 'apps/server'),
  stdio: 'inherit',
  shell: process.platform === 'win32'
});

process.exit(out.status ?? 1);
