import assert from 'node:assert/strict';
import test from 'node:test';
import { filterPrettierFiles } from './prettier-files.mjs';

test('filterPrettierFiles keeps source files and skips ignored paths', () => {
  const files = [
    'apps/web/src/App.jsx',
    'package-lock.json',
    'node_modules/foo.js',
    '.claude/worktrees/wt/apps/web/src/App.jsx',
    'docs/guide/coding-agents.md'
  ];
  assert.deepEqual(filterPrettierFiles(files), [
    'apps/web/src/App.jsx',
    'docs/guide/coding-agents.md'
  ]);
});
