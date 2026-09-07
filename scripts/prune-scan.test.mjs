import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  basenameVariants,
  expandGlob,
  extractLoaders,
  extractMentions,
  firstCommitDate,
  isDocCandidate,
  isShallowRepository,
  isSourceCandidate,
  NON_REFERENCING_FILES,
  proofCommand,
  resolveSpecifier,
  runScan
} from './prune-scan.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * A miniature repository on disk. `runScan` reads the tree it is pointed at, so the fixture is the
 * whole test — and for a tool whose output is a request to delete a file, the interesting cases are
 * the ones where it must stay quiet.
 * @param {Record<string, string>} files
 * @returns {string}
 */
function fixture(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prune-scan-'));
  for (const [rel, contents] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, contents);
  }
  return dir;
}

/** @param {ReturnType<typeof runScan>} result @returns {Set<string>} */
function paths(result) {
  return new Set(result.candidates.map((candidate) => candidate.path));
}

test('an unreferenced document is a candidate; a linked one is not', () => {
  const dir = fixture({
    'README.md': '# Hub\n\nSee [the guide](docs/guide.md).\n',
    'docs/guide.md': 'A guide that is linked.\n',
    'docs/forgotten.md': 'Nobody names this file.\n'
  });
  const found = paths(runScan(dir));
  assert.ok(found.has('docs/forgotten.md'), 'the orphan should surface');
  assert.ok(!found.has('docs/guide.md'), 'a linked doc must never surface');
  assert.ok(!found.has('README.md'), 'a root is never a candidate');
});

test('a document cited only by another orphan is reported as a cluster, not as a live page', () => {
  const dir = fixture({
    'README.md': '# Hub\n',
    'docs/a.md': 'links [b](./b.md)\n',
    'docs/b.md': 'links back [a](./a.md)\n'
  });
  const result = runScan(dir);
  const a = result.candidates.find((candidate) => candidate.path === 'docs/a.md');
  assert.ok(a, 'a self-supporting pair is still unreachable from a root');
  assert.equal(a.status, 'unreachable-cluster');
});

test('a document named only by code stays alive — link checks alone would delete it', () => {
  const dir = fixture({
    'README.md': '# Hub\n',
    'docs/license.md': 'text\n',
    'apps/server/src/routes/legal.js': "const DOC = 'docs/license.md';\nexport default DOC;\n"
  });
  assert.equal(paths(runScan(dir)).has('docs/license.md'), false);
});

test('a module imported without an extension is NOT a candidate', () => {
  // The regression this scanner earned on its first run against the real tree: it offered
  // `thinkingMarkdownTable.tsx` for deletion while InsightsPane.jsx imports it extensionlessly.
  const dir = fixture({
    'README.md': '# Hub\n',
    'apps/web/src/App.jsx': "import { T } from './utils/thinking';\nexport default T;\n",
    'apps/web/src/utils/thinking.tsx': 'export const T = 1;\n'
  });
  assert.equal(paths(runScan(dir)).has('apps/web/src/utils/thinking.tsx'), false);
});

test('a module reached only through its own test is reported as test-only, never as unreferenced', () => {
  const dir = fixture({
    'README.md': '# Hub\n',
    'apps/web/src/utils/dead.js': 'export const x = 1;\n',
    'apps/web/test/dead.test.js': "import { x } from '../src/utils/dead.js';\nassert(x);\n"
  });
  const candidate = runScan(dir).candidates.find((c) => c.path === 'apps/web/src/utils/dead.js');
  assert.ok(candidate, 'a test-only module is still a finding worth the owner knowing about');
  assert.equal(candidate.status, 'test-only');
  assert.match(candidate.why, /issue, not a PR/);
});

test('a bundler glob keeps a scene file alive that nothing names', () => {
  const dir = fixture({
    'README.md': '# Hub\n',
    'apps/web/src/gallery.jsx':
      "const modules = import.meta.glob('./scenes/*.jsx', { eager: true });\nexport default modules;\n",
    'apps/web/src/scenes/one.jsx': 'export default 1;\n'
  });
  assert.equal(paths(runScan(dir)).has('apps/web/src/scenes/one.jsx'), false);
  assert.deepEqual(
    expandGlob('./scenes/*.jsx', 'apps/web/src/gallery.jsx', [
      'apps/web/src/scenes/one.jsx',
      'apps/web/src/scenes/two.jsx',
      'apps/web/src/other/three.jsx'
    ]),
    ['apps/web/src/scenes/one.jsx', 'apps/web/src/scenes/two.jsx'],
    'a single `*` must not cross a directory boundary'
  );
});

test('a directory scan keeps its contents alive', () => {
  const dir = fixture({
    'README.md': '# Hub\n',
    'apps/web/src/sceneLoader.js':
      "import fs from 'node:fs';\nimport path from 'node:path';\nconst names = fs.readdirSync(path.join(__dirname, 'scenes'));\nexport default names;\n",
    'apps/web/src/scenes/one.js': 'export const one = 1;\n'
  });
  assert.equal(
    paths(runScan(dir)).has('apps/web/src/scenes/one.js'),
    false,
    'nothing names it, but the loader reads the directory at runtime'
  );
  assert.deepEqual(extractLoaders("fs.readdirSync(path.join(here, 'themes'))").dirs, ['themes']);
});

test('entry points and loading surfaces are never candidates', () => {
  const dir = fixture({
    'README.md': '# Hub\n',
    'apps/web/src/main.jsx': 'import "./index.css";\n',
    'apps/web/src/index.css': 'body{}\n',
    'apps/web/index.html': '<html></html>\n',
    '.cursor/rules/thing.mdc': 'globs: anything\n',
    'apps/web/src/components/metaphorScenes/CLAUDE.md': 'nested agent context\n'
  });
  const found = paths(runScan(dir));
  for (const live of [
    'apps/web/src/main.jsx',
    'apps/web/src/index.css',
    'apps/web/index.html',
    '.cursor/rules/thing.mdc',
    'apps/web/src/components/metaphorScenes/CLAUDE.md'
  ]) {
    assert.equal(found.has(live), false, `${live} is loaded by convention, not by link`);
  }
});

test('a test helper under a test directory is never a deletion candidate', () => {
  const dir = fixture({
    'README.md': '# Hub\n',
    'apps/web/test/helpers/render.js': 'export const render = 1;\n'
  });
  assert.equal(paths(runScan(dir)).has('apps/web/test/helpers/render.js'), false);
  assert.equal(isSourceCandidate('apps/web/test/helpers/render.js'), false);
});

test('basenameVariants maps a .js specifier onto the TypeScript file it resolves to', () => {
  assert.ok(basenameVariants('foo.js').includes('foo.ts'));
  assert.ok(basenameVariants('foo.js').includes('foo.tsx'));
});

test('extractMentions finds paths and bare names alike', () => {
  const found = extractMentions('See `docs/guide/setup.md` and also officeCadence.js and x.md.');
  assert.ok(found.includes('docs/guide/setup.md'));
  assert.ok(found.includes('officeCadence.js'));
  assert.ok(found.includes('x.md'));
});

test('resolveSpecifier ignores a published dependency', () => {
  const dir = fixture({});
  const byBasename = new Map([['react.js', ['node_modules/react/index.js']]]);
  const fileSet = new Set();
  assert.deepEqual(resolveSpecifier('react', 'apps/web/src/App.jsx', fileSet, byBasename, dir), []);
});

test('a root npm script nothing invokes is reported, and its proof names the script', () => {
  const dir = fixture({
    'README.md': '# Hub\n',
    'package.json': JSON.stringify({
      name: 'fixture-root',
      scripts: { 'used:somewhere': 'node a.mjs', 'nobody-runs-this': 'node b.mjs' }
    }),
    'CLAUDE.md': 'Run `npm run used:somewhere`.\n'
  });
  const result = runScan(dir);
  const found = result.candidates.filter((c) => c.kind === 'script');
  assert.deepEqual(
    found.map((c) => c.path),
    ['package.json#nobody-runs-this']
  );
  assert.equal(
    proofCommand(found[0]),
    'git grep -n "npm run nobody-runs-this"',
    'the proof has to be copy-pasteable against the finding'
  );
});

test('the deletion routine naming a candidate in its own notes does not sterilise its queue', () => {
  // Found the day this shipped: writing the candidate list into prune's playbook and ledger made
  // every source candidate vanish, because a document that names a file references it.
  const dir = fixture({
    'README.md': '# Hub\n',
    'docs/routines/README.md': 'Routines: [prune](prune.md).\n',
    'docs/routines/prune.md': 'Candidate: `apps/web/src/utils/dead.js` — see `docs/gone.md`.\n',
    'docs/routines/ledger/prune.md': 'Batch 2: `apps/web/src/utils/dead.js`.\n',
    'apps/web/src/utils/dead.js': 'export const x = 1;\n',
    'docs/gone.md': 'A stale page.\n'
  });
  const found = paths(runScan(dir));
  assert.ok(found.has('apps/web/src/utils/dead.js'), 'the module is still dead');
  assert.ok(found.has('docs/gone.md'), 'and so is the doc the playbook happens to cite');
  assert.equal(
    found.has('docs/routines/prune.md'),
    false,
    'the playbook is reachable through the shelf README that registers it'
  );
});

test('isDocCandidate covers docs and top-level prose only', () => {
  assert.equal(isDocCandidate('docs/anything.md'), true);
  assert.equal(isDocCandidate('anything.md'), true);
  assert.equal(
    isDocCandidate('apps/web/README.md'),
    false,
    'a package readme is not prune surface'
  );
  assert.equal(isDocCandidate('docs/decisions/0014-x.md'), false, 'ADRs are append-only history');
  assert.equal(isDocCandidate('docs/routines/ledger/review.md'), false, 'a ledger is read by name');
  assert.equal(isDocCandidate('notes.txt'), false, 'not a document type this scanner judges');
});

test('against the real repository: known-live files stay out, known-dead ones surface', () => {
  const result = runScan(ROOT);
  const found = paths(result);
  assert.ok(result.scanned > 1000, `the sweep must read the real tree, saw ${result.scanned}`);
  for (const live of [
    'apps/web/src/ArchiSlop.jsx',
    'apps/web/src/utils/thinkingMarkdownTable.tsx',
    'scripts/routine-guard.mjs',
    'docs/routines/README.md'
  ]) {
    assert.equal(found.has(live), false, `${live} is imported or linked and must never be offered`);
  }
  // Deliberately no "file X must be reported dead" assertion. This test once pinned
  // `AdvisorThinkingIndicator.jsx` as a known-dead example — and by naming it, the test became the
  // only thing keeping it alive, which both flipped its verdict to `test-only` and would have broken
  // CI on the day the owner merged the deletion. A finder's test may assert what it must *not*
  // report; asserting what it must report belongs one level down, in the invariant below: every
  // candidate a real run does produce, cross-checked against git's own grep.
  for (const candidate of result.candidates.filter((c) => c.kind === 'source')) {
    const stem = candidate.path.slice(candidate.path.lastIndexOf('/') + 1).replace(/\.[^.]+$/, '');
    let namers = [];
    try {
      // `git grep` exits 1 on no match, and a module need not contain its own name.
      namers = execFileSync('git', ['grep', '-l', stem, '--', ':!package-lock.json'], {
        cwd: ROOT,
        encoding: 'utf8'
      })
        .trim()
        .split('\n')
        .filter(Boolean);
    } catch {
      namers = [];
    }
    // The cross-check must model the same exemption the scanner does, or it contradicts the design:
    // prune's own ledger names most of these paths, and that is deliberate (§ 1's self-reference rule).
    namers = namers.filter(
      (file) => file !== candidate.path && !NON_REFERENCING_FILES.includes(file)
    );
    assert.ok(
      namers.every((file) => /(^|\/)test\/|\.test\.[cm]?[jt]sx?$/.test(file)),
      `${candidate.path} was reported as ${candidate.status}, but non-test files name it: ${namers.join(', ')}`
    );
  }
});

test('the scan reports nothing it cannot prove, and exits clean on an empty result', () => {
  const dir = fixture({ 'README.md': '# Hub\n' });
  const result = runScan(dir);
  assert.deepEqual(result.candidates, []);
  for (const candidate of runScan(ROOT).candidates) {
    assert.ok(candidate.proof.length > 8, `${candidate.path} has no reproducible proof`);
    assert.ok(
      candidate.lines > 0,
      `${candidate.path} has no size, so the budget claim is unverifiable`
    );
  }
});

test('firstCommitDate returns null in a shallow clone rather than a graft-boundary date', () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'prune-scan-parent-'));
  execFileSync('git', ['init'], { cwd: parent });
  execFileSync('git', ['config', 'user.email', 'prune-scan@test'], { cwd: parent });
  execFileSync('git', ['config', 'user.name', 'prune-scan'], { cwd: parent });
  fs.writeFileSync(path.join(parent, 'README.md'), '# parent\n');
  execFileSync('git', ['add', 'README.md'], { cwd: parent });
  execFileSync('git', ['commit', '-m', 'parent init'], { cwd: parent });
  fs.writeFileSync(path.join(parent, 'old.js'), 'export const old = 1;\n');
  execFileSync('git', ['add', 'old.js'], { cwd: parent });
  execFileSync('git', ['commit', '-m', 'add old.js'], { cwd: parent });

  const shallow = fs.mkdtempSync(path.join(os.tmpdir(), 'prune-scan-shallow-'));
  execFileSync('git', ['clone', '--depth', '1', `file://${parent}`, shallow]);
  assert.equal(isShallowRepository(shallow), true, 'fixture must be a shallow clone');

  const date = firstCommitDate(shallow, 'README.md');
  assert.equal(date, null, 'shallow history must not produce a graft date as addedAt');

  const scan = runScan(shallow);
  assert.equal(scan.notes.historyTruncated, true);
  for (const candidate of scan.candidates) {
    assert.equal(candidate.addedAt, null, `${candidate.path} must not carry a graft date`);
  }
});
