#!/usr/bin/env node
/**
 * Verify repo-relative paths cited in operator docs.
 * Scans STRUCTURE.md, AGENTS.md, CLAUDE.md, docs/recipes/, docs/guide/, docs/agents/, and docs/routines/.
 * Exits 1 when a cited source file is missing (with .js → .ts/.tsx fallback for migrated modules).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');

/** @type {string[]} */
const ROOT_MD_FILES = ['STRUCTURE.md', 'AGENTS.md', 'CLAUDE.md'];

/** @type {string[]} */
const DOC_DIRS = [
  'docs/recipes',
  'docs/guide',
  'docs/agents',
  'docs/routines',
  'docs/routines/ledger',
  'docs/automations',
  'docs/automations/ledger'
];

const SKIP_PREFIXES = [
  'node_modules/',
  'http://',
  'https://',
  'file://',
  'ui://',
  '.agents/',
  'dist/',
  'bench-results/'
];

const SKIP_PATTERNS = [
  /\*/,
  /\{[^}]+\}/,
  /<[^>]+>/,
  /\.test\.js$/,
  /Slopitect\*\.jsx/,
  /node_modules/
];

/** Repo-relative paths in docs always use POSIX separators, even on Windows. */
export function toPosixPath(relPath) {
  return String(relPath ?? '')
    .split(path.sep)
    .join('/');
}

/**
 * @param {string} dir
 * @returns {string[]}
 */
function walkMdFilesInDir(dir) {
  /** @type {string[]} */
  const files = [];
  if (!fs.existsSync(dir)) return files;

  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name);
    const stat = fs.statSync(abs);
    if (stat.isDirectory()) {
      files.push(...walkMdFilesInDir(abs));
    } else if (name.endsWith('.md')) {
      files.push(abs);
    }
  }
  return files;
}

/** @returns {string[]} absolute paths */
export function collectDocMarkdownFiles(root = ROOT) {
  /** @type {string[]} */
  const files = [];
  for (const rel of ROOT_MD_FILES) {
    const abs = path.join(root, rel);
    if (fs.existsSync(abs)) files.push(abs);
  }
  for (const rel of DOC_DIRS) {
    files.push(...walkMdFilesInDir(path.join(root, rel)));
  }
  return files;
}

/**
 * @param {string} content
 * @param {string} sourceFile repo-relative
 */
export function extractPaths(content, sourceFile) {
  /** @type {{ path: string, source: string }[]} */
  const found = [];
  const backtickRe = /`((?:apps|packages|scripts|docs)\/[^`\s]+)`/g;
  const linkRe = /\]\(((?:\.\.\/)*(?:apps|packages|scripts)[^)]+)\)/g;

  let m;
  while ((m = backtickRe.exec(content)) !== null) {
    found.push({ path: m[1], source: sourceFile });
  }
  while ((m = linkRe.exec(content)) !== null) {
    let p = m[1];
    if (p.startsWith('../')) {
      const base = path.dirname(sourceFile);
      p = path.normalize(path.join(base, p));
    }
    found.push({
      path: toPosixPath(p.replace(/^\//, '')),
      source: toPosixPath(sourceFile)
    });
  }
  return found.map((ref) => ({
    path: toPosixPath(ref.path),
    source: toPosixPath(ref.source)
  }));
}

/** @param {string} relPath */
export function shouldSkip(relPath) {
  if (SKIP_PREFIXES.some((p) => relPath.startsWith(p))) return true;
  if (SKIP_PATTERNS.some((re) => re.test(relPath))) return true;
  if (!relPath.match(/^(apps|packages|scripts)\//)) return true;
  if (!/\.(js|jsx|ts|tsx|md)$/.test(relPath) && !relPath.includes('/')) return true;
  return false;
}

/** @param {string} relPath */
export function resolveExisting(relPath, root = ROOT) {
  const abs = path.join(root, relPath);
  if (fs.existsSync(abs)) return relPath;

  if (relPath.endsWith('.js')) {
    const ts = relPath.replace(/\.js$/, '.ts');
    if (fs.existsSync(path.join(root, ts))) return ts;
  }
  if (relPath.endsWith('.jsx')) {
    const tsx = relPath.replace(/\.jsx$/, '.tsx');
    if (fs.existsSync(path.join(root, tsx))) return tsx;
  }

  return null;
}

/** @param {string} filePath */
function relFromRoot(filePath) {
  return path.relative(ROOT, filePath);
}

/**
 * @param {string} [root]
 * @returns {{ ok: boolean, checked: number, missing: { cited: string, source: string }[] }}
 */
export function verifyDocPaths(root = ROOT) {
  /** @type {{ cited: string, source: string }[]} */
  const allRefs = [];
  for (const file of collectDocMarkdownFiles(root)) {
    const rel = toPosixPath(path.relative(root, file));
    const content = fs.readFileSync(file, 'utf8');
    for (const { path: p, source } of extractPaths(content, rel)) {
      if (!shouldSkip(p)) allRefs.push({ cited: p, source });
    }
  }

  /** @type {{ cited: string, source: string }[]} */
  const missing = [];
  const seen = new Set();
  for (const ref of allRefs) {
    const key = `${ref.source}:${ref.cited}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const resolved = resolveExisting(ref.cited, root);
    if (!resolved) {
      missing.push(ref);
    }
  }

  return { ok: missing.length === 0, checked: seen.size, missing };
}

function main() {
  const { ok, checked, missing } = verifyDocPaths();

  if (ok) {
    console.log(`verify-doc-paths: OK (${checked} unique repo paths checked)`);
    process.exit(0);
  }

  console.error(`verify-doc-paths: ${missing.length} broken path(s):\n`);
  for (const { cited, source } of missing) {
    console.error(`  ${cited}\n    cited in ${source}`);
  }
  process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
