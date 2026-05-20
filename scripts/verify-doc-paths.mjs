#!/usr/bin/env node
/**
 * Verify repo-relative paths cited in AGENTS.md, STRUCTURE.md, and docs/recipes/.
 * Exits 1 when a cited source file is missing (with .js → .ts/.tsx fallback for migrated modules).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const DOC_GLOBS = [
  'STRUCTURE.md',
  'AGENTS.md',
  'CLAUDE.md',
  'docs/recipes/**/*.md'
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

function walkMdFiles() {
  const files = [];
  for (const rel of ['STRUCTURE.md', 'AGENTS.md', 'CLAUDE.md']) {
    const p = path.join(ROOT, rel);
    if (fs.existsSync(p)) files.push(p);
  }
  const recipesDir = path.join(ROOT, 'docs/recipes');
  if (fs.existsSync(recipesDir)) {
    for (const name of fs.readdirSync(recipesDir)) {
      if (name.endsWith('.md')) files.push(path.join(recipesDir, name));
    }
  }
  return files;
}

function extractPaths(content, sourceFile) {
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
    found.push({ path: p.replace(/^\//, ''), source: sourceFile });
  }
  return found;
}

function shouldSkip(relPath) {
  if (SKIP_PREFIXES.some((p) => relPath.startsWith(p))) return true;
  if (SKIP_PATTERNS.some((re) => re.test(relPath))) return true;
  if (!relPath.match(/^(apps|packages|scripts)\//)) return true;
  if (!/\.(js|jsx|ts|tsx|md)$/.test(relPath) && !relPath.includes('/')) return true;
  return false;
}

function resolveExisting(relPath) {
  const abs = path.join(ROOT, relPath);
  if (fs.existsSync(abs)) return relPath;

  if (relPath.endsWith('.js')) {
    const ts = relPath.replace(/\.js$/, '.ts');
    if (fs.existsSync(path.join(ROOT, ts))) return ts;
  }
  if (relPath.endsWith('.jsx')) {
    const tsx = relPath.replace(/\.jsx$/, '.tsx');
    if (fs.existsSync(path.join(ROOT, tsx))) return tsx;
  }

  return null;
}

function relFromRoot(filePath) {
  return path.relative(ROOT, filePath);
}

const allRefs = [];
for (const file of walkMdFiles()) {
  const rel = relFromRoot(file);
  const content = fs.readFileSync(file, 'utf8');
  for (const { path: p, source } of extractPaths(content, rel)) {
    if (!shouldSkip(p)) allRefs.push({ cited: p, source });
  }
}

const missing = [];
const seen = new Set();
for (const { cited, source } of allRefs) {
  const key = `${source}:${cited}`;
  if (seen.has(key)) continue;
  seen.add(key);

  const resolved = resolveExisting(cited);
  if (!resolved) {
    missing.push({ cited, source });
  }
}

if (missing.length === 0) {
  console.log(`verify-doc-paths: OK (${seen.size} unique repo paths checked)`);
  process.exit(0);
}

console.error(`verify-doc-paths: ${missing.length} broken path(s):\n`);
for (const { cited, source } of missing) {
  console.error(`  ${cited}\n    cited in ${source}`);
}
process.exit(1);
