import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = path.resolve(__dirname, '../scripts');

/**
 * A bench script's `Usage:` block is the first thing anybody reads when the command they
 * copied out of CLAUDE.md crashes, so it must match what the script's import graph actually
 * needs. Plain `node` does not honour the TypeScript `.js`-specifier convention Vite and tsx
 * resolve, so a bench whose relative import graph reaches a file that only exists as `.ts`
 * dies with ERR_MODULE_NOT_FOUND before a single case runs (issue #349: `benchMermaid.js`
 * reaches `src/utils/redactSecrets.ts` and `src/mcp/diagramDiffSummary.ts` through its own
 * subject, `mermaidDiffTool.js`).
 *
 * The rule this pins is symmetric, so it stays true in both directions: a bench that plain
 * `node` can run must document plain `node`, and one that cannot must name the loader flags
 * instead of a command that crashes.
 */
const LOADER_FLAGS = '--import ./scripts/register-antv-layout-esm.mjs --import tsx';

const SPECIFIER_PATTERNS = [
  /\bfrom\s*['"]([^'"]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\bimport\s*['"]([^'"]+)['"]/g
];

function relativeSpecifiers(source) {
  const found = new Set();
  for (const pattern of SPECIFIER_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(source)) !== null) {
      const specifier = match[1];
      if (specifier.startsWith('./') || specifier.startsWith('../')) found.add(specifier);
    }
  }
  return [...found];
}

/**
 * Walks the relative-import graph the way bare `node` would: a specifier must name a file
 * that exists on disk exactly as written. Bare specifiers are skipped — those go through
 * node_modules resolution, which is a different failure mode.
 */
function walkRelativeGraph(entryFile) {
  const visited = new Set();
  const missing = [];
  const queue = [entryFile];

  while (queue.length > 0) {
    const file = queue.shift();
    if (visited.has(file)) continue;
    visited.add(file);

    for (const specifier of relativeSpecifiers(fs.readFileSync(file, 'utf8'))) {
      const resolved = path.resolve(path.dirname(file), specifier);
      if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
        missing.push(`${path.relative(SCRIPTS_DIR, file)} -> ${specifier}`);
        continue;
      }
      queue.push(resolved);
    }
  }

  return { missing, visitedCount: visited.size };
}

/** Entry scripts only — corpora and probes are imported, never invoked, so they carry no usage. */
const BENCH_ENTRIES = fs
  .readdirSync(SCRIPTS_DIR)
  .filter((name) => /^bench.*\.js$/.test(name))
  .filter((name) => /^\/\/\s*Usage/m.test(fs.readFileSync(path.join(SCRIPTS_DIR, name), 'utf8')));

test('bench entry scripts are found at all', () => {
  // A sweep over a set nothing joined passes while examining nothing.
  assert.ok(
    BENCH_ENTRIES.length >= 5,
    `expected at least 5 bench entry scripts, found ${BENCH_ENTRIES.length}`
  );
  assert.ok(BENCH_ENTRIES.includes('benchMermaid.js'));
});

test('every bench usage block matches what its import graph needs', () => {
  for (const script of BENCH_ENTRIES) {
    const entry = path.join(SCRIPTS_DIR, script);
    const source = fs.readFileSync(entry, 'utf8');
    const { missing, visitedCount } = walkRelativeGraph(entry);
    assert.ok(visitedCount > 1, `${script}: walked no imports at all`);

    const documentsBareNode = new RegExp(
      `^//\\s*node\\s+apps/server/scripts/${script.replace('.', '\\.')}\\b`,
      'm'
    ).test(source);

    if (missing.length === 0) {
      assert.equal(
        documentsBareNode,
        true,
        `${script}: runs under bare \`node\` but its usage block does not document that`
      );
      continue;
    }

    assert.equal(
      documentsBareNode,
      false,
      `${script}: documents a bare \`node\` invocation that crashes — unresolvable under ` +
        `plain node: ${missing.join(', ')}`
    );
    assert.ok(
      source.includes(LOADER_FLAGS),
      `${script}: needs loader flags (${missing.join(', ')}) but its usage block omits ` +
        `"${LOADER_FLAGS}"`
    );
  }
});
