import assert from 'node:assert/strict';
import test from 'node:test';
import {
  filterExistingFiles,
  filterPrettierFiles,
  mergeChangedFileSets
} from './prettier-files.mjs';

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

test('filterExistingFiles drops deleted paths from rename diffs', () => {
  const files = ['package.json', 'this-path-does-not-exist-in-repo.xyz'];
  assert.deepEqual(filterExistingFiles(files), ['package.json']);
});

test('mergeChangedFileSets includes untracked paths and dedupes', () => {
  assert.deepEqual(
    mergeChangedFileSets(
      ['apps/web/src/ArchiSlop.jsx'],
      ['apps/web/src/ArchiSlop.jsx', 'apps/web/src/features/desk/useOfficeBoot.js'],
      [],
      ['apps/web/src/features/desk/useOfficeBoot.js']
    ),
    ['apps/web/src/ArchiSlop.jsx', 'apps/web/src/features/desk/useOfficeBoot.js']
  );
});
