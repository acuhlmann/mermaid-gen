/**
 * Agent-facing doc and command hygiene checks.
 * Keeps AGENTS.md / blast-radius test pointers aligned with the repo.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const AGENT_DOC_FILES = [
  'AGENTS.md',
  'CLAUDE.md',
  'docs/guide/coding-agents.md',
  'docs/agents/testing.md',
  'docs/agent-blast-radius.md',
  'docs/agents/sensors.md'
];

/** Routine playbooks are agent instructions too, and unattended runs cannot ask what a command was. */
const ROUTINE_DOC_DIR = 'docs/routines';

const NPM_RUN_RE = /npm run ([a-z][\w:-]*)(?=\s|$|`|\.)/gi;
const BLAST_RADIUS_TEST_RE = /`((?:apps|packages)[^`]+\.test\.(?:ts|js|jsx))`/g;

/**
 * Workspace-scoped scripts (`npm run build -w packages/shared`) are not root scripts.
 * @param {string} markdown
 * @returns {Set<string>}
 */
export function extractNpmScriptNames(markdown) {
  const names = new Set();
  for (const match of markdown.matchAll(NPM_RUN_RE)) {
    const start = match.index ?? 0;
    const afterScript = markdown.slice(start + match[0].length, start + match[0].length + 40);
    if (/^\s+-w\b/.test(afterScript)) continue;
    names.add(match[1]);
  }
  return names;
}

/**
 * @param {string} relPath
 * @param {string} root
 * @returns {string | null}
 */
export function resolveTestPath(relPath, root) {
  const abs = path.join(root, relPath);
  if (fs.existsSync(abs)) return relPath;
  if (relPath.endsWith('.ts')) {
    const js = relPath.replace(/\.ts$/, '.js');
    if (fs.existsSync(path.join(root, js))) return js;
  }
  if (relPath.endsWith('.js')) {
    const ts = relPath.replace(/\.js$/, '.ts');
    if (fs.existsSync(path.join(root, ts))) return ts;
  }
  return null;
}

/**
 * @param {string} markdown
 * @returns {string[]}
 */
export function extractBlastRadiusTestPaths(markdown) {
  const paths = [];
  for (const match of markdown.matchAll(BLAST_RADIUS_TEST_RE)) {
    paths.push(match[1]);
  }
  return paths;
}

/**
 * Discovered rather than listed, so a new playbook is checked the day it lands.
 * @param {string} root
 * @returns {string[]}
 */
export function collectRoutineDocs(root) {
  const dir = path.join(root, ROUTINE_DOC_DIR);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((entry) => entry.endsWith('.md') && entry !== 'README.md')
    .map((entry) => `${ROUTINE_DOC_DIR}/${entry}`)
    .sort();
}

/**
 * @param {string} root
 * @returns {Set<string>}
 */
export function collectRootPackageScripts(root) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  return new Set(Object.keys(pkg.scripts ?? {}));
}

/**
 * @param {string} root
 * @param {string[]} [docFiles]
 */
export function verifyAgentInfra(root, docFiles = null) {
  const files = docFiles ?? [
    ...AGENT_DOC_FILES,
    `${ROUTINE_DOC_DIR}/README.md`,
    ...collectRoutineDocs(root)
  ];
  const rootScripts = collectRootPackageScripts(root);
  const missingScripts = [];
  const missingTests = [];
  const checkedScripts = new Set();
  const checkedTests = new Set();

  for (const rel of files) {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) {
      missingScripts.push({ script: `(missing doc ${rel})`, source: rel });
      continue;
    }
    const markdown = fs.readFileSync(abs, 'utf8');

    for (const script of extractNpmScriptNames(markdown)) {
      if (checkedScripts.has(script)) continue;
      checkedScripts.add(script);
      if (!rootScripts.has(script)) {
        missingScripts.push({ script, source: rel });
      }
    }

    if (rel.endsWith('agent-blast-radius.md')) {
      for (const testPath of extractBlastRadiusTestPaths(markdown)) {
        if (checkedTests.has(testPath)) continue;
        checkedTests.add(testPath);
        if (!resolveTestPath(testPath, root)) {
          missingTests.push({ path: testPath, source: rel });
        }
      }
    }
  }

  return {
    ok: missingScripts.length === 0 && missingTests.length === 0,
    missingScripts,
    missingTests,
    scriptCount: checkedScripts.size,
    testPathCount: checkedTests.size
  };
}

function main() {
  const result = verifyAgentInfra(ROOT);
  if (result.ok) {
    console.log(
      `verify:agent-infra: OK (${result.scriptCount} npm script(s), ${result.testPathCount} blast-radius test path(s))`
    );
    return;
  }
  for (const miss of result.missingScripts) {
    console.error(`  missing npm script "${miss.script}" (cited in ${miss.source})`);
  }
  for (const miss of result.missingTests) {
    console.error(`  missing blast-radius test "${miss.path}" (cited in ${miss.source})`);
  }
  process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
