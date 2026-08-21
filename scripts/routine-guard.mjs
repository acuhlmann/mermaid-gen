#!/usr/bin/env node
/**
 * Budget enforcement for scheduled NFR routines (docs/routines/).
 *
 * Routines run unattended, so their safety cannot rest on the model having read the prose.
 * This script re-reads the playbook's declared budget and checks the actual diff against it.
 *
 *   node scripts/routine-guard.mjs --preflight <name>
 *   node scripts/routine-guard.mjs --postflight <name> [--base origin/main]
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');

/**
 * `report` writes no code at all; `code-writing` may edit within its declared paths. There is no
 * third "opens a PR and waits" tier — both shipped routines merge their own green PR, and what
 * keeps that safe is the budget below, not a human in the loop.
 */
export const ROUTINE_TIERS = ['report', 'code-writing'];

/** Paths no routine may touch, whatever its playbook says. Mirrors AGENTS.md § Don't-touch list. */
export const ALWAYS_FORBIDDEN = [
  '.agents/**',
  '.env',
  '.env.*',
  'package-lock.json',
  'skills-lock.json',
  'scripts/deploy-*.sh',
  'scripts/push-*-secret-cloud-run.sh',
  'apps/server/bench-results/**',
  'apps/web/src/assets/audio/**',
  'apps/server/src/mcp/apps/**',
  '**/dist/**',
  '**/*.tsbuildinfo'
];

const TEST_PATH_RE = /(^|\/)test\/|\.test\.[cm]?[jt]sx?$/;

/**
 * Minimal YAML front-matter reader for the shapes playbooks are allowed to use:
 * `key: scalar` and `key:` followed by `  - item` lines. Deliberately not a YAML parser —
 * a routine budget that needs anchors or nested maps has outgrown this format.
 * @param {string} markdown
 * @returns {Record<string, string | string[]> | null}
 */
export function parseFrontmatter(markdown) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(markdown);
  if (!match) return null;
  /** @type {Record<string, string | string[]>} */
  const out = {};
  let currentKey = null;
  for (const rawLine of match[1].split(/\r?\n/)) {
    if (!rawLine.trim() || rawLine.trim().startsWith('#')) continue;
    const item = /^\s+-\s+(.*)$/.exec(rawLine);
    if (item && currentKey) {
      const list = out[currentKey];
      if (Array.isArray(list)) list.push(unquote(item[1]));
      continue;
    }
    const pair = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(rawLine);
    if (!pair) continue;
    currentKey = pair[1];
    out[currentKey] = pair[2] === '' ? [] : unquote(pair[2]);
  }
  return out;
}

/** @param {string} value */
function unquote(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * `**` crosses directory separators, `*` does not — so `docs/**` covers nested files while
 * `*.md` stays top-level and `scripts/verify-*.mjs` cannot reach into a subdirectory.
 * @param {string} pattern
 * @returns {RegExp}
 */
export function globToRegExp(pattern) {
  let out = '';
  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i];
    if (char === '*') {
      if (pattern[i + 1] === '*') {
        const slashSuffix = pattern[i + 2] === '/';
        out += slashSuffix ? '(?:.*/)?' : '.*';
        i += slashSuffix ? 2 : 1;
      } else {
        out += '[^/]*';
      }
      continue;
    }
    if (char === '?') {
      out += '[^/]';
      continue;
    }
    out += char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${out}$`);
}

/**
 * @param {string} filePath
 * @param {string[]} patterns
 * @returns {boolean}
 */
export function matchesAny(filePath, patterns) {
  return patterns.some((pattern) => globToRegExp(pattern).test(filePath));
}

/**
 * Counts test cases so a routine cannot quietly shrink the suite. Covers vitest (`it`/`test`)
 * and node:test (`test`), including `.each` / `.skip` / `.only` chains.
 * @param {string} source
 * @returns {number}
 */
export function countTestCases(source) {
  const matches = source.match(/\b(?:it|test)(?:\.\w+)*\s*(?:<[^>]*>)?\s*\(/g);
  return matches ? matches.length : 0;
}

/**
 * @param {string} filePath
 * @returns {boolean}
 */
export function isTestPath(filePath) {
  return TEST_PATH_RE.test(filePath);
}

/**
 * The whole postflight decision, kept pure so it can be tested without a git repository.
 * @param {object} input
 * @param {Record<string, string | string[]>} input.playbook
 * @param {{ status: string, file: string }[]} input.changes
 * @param {{ file: string, before: number, after: number }[]} [input.testCounts]
 * @returns {{ ok: boolean, violations: string[] }}
 */
export function checkRoutineDiff({ playbook, changes, testCounts = [] }) {
  /** @type {string[]} */
  const violations = [];
  const allowed = toList(playbook.allowedPaths);
  const forbidden = toList(playbook.forbiddenPaths);
  const maxFiles = Number(playbook.maxFiles ?? 0);
  const files = changes.map((change) => change.file);

  if (maxFiles > 0 && files.length > maxFiles) {
    violations.push(
      `budget: ${files.length} files changed, playbook allows ${maxFiles}. ` +
        'Do the smallest useful slice and write the rest to the ledger.'
    );
  }

  for (const file of files) {
    if (matchesAny(file, ALWAYS_FORBIDDEN)) {
      violations.push(`don't-touch: ${file} (AGENTS.md § Don't-touch list)`);
      continue;
    }
    if (forbidden.length && matchesAny(file, forbidden)) {
      violations.push(`forbidden path: ${file} (playbook forbiddenPaths)`);
      continue;
    }
    if (allowed.length && !matchesAny(file, allowed)) {
      violations.push(
        `outside budget: ${file} matches no allowedPaths entry. ` +
          'If the task needs this path, it belongs to a different routine.'
      );
    }
  }

  for (const change of changes) {
    if (change.status === 'D' && isTestPath(change.file)) {
      violations.push(
        `deleted test: ${change.file}. Removing a test needs a written reason in the PR body, ` +
          'and at most one per run — see docs/routines/README.md rule 1.'
      );
    }
  }

  for (const entry of testCounts) {
    if (entry.after < entry.before) {
      violations.push(
        `test cases fell in ${entry.file}: ${entry.before} → ${entry.after}. ` +
          'NFR work adds tests; it does not remove them.'
      );
    }
  }

  return { ok: violations.length === 0, violations };
}

/** @param {string | string[] | undefined} value */
function toList(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value) return [value];
  return [];
}

/** @type {readonly { dir: string, ledgerDir: string }[]} */
export const PLAYBOOK_SHELVES = [
  { dir: 'docs/routines', ledgerDir: 'docs/routines/ledger' },
  { dir: 'docs/automations', ledgerDir: 'docs/automations/ledger' }
];

/**
 * @param {string} root
 * @param {string} name
 * @returns {{ playbook: Record<string, string | string[]>, errors: string[], rel: string, ledger: string } | { playbook: Record<string, string | string[]>, errors: string[], rel?: undefined, ledger?: undefined }}
 */
export function loadPlaybook(root, name) {
  /** @type {string[]} */
  const errors = [];
  /** @type {{ dir: string, ledgerDir: string } | undefined} */
  let shelf;
  /** @type {string | undefined} */
  let rel;
  for (const candidate of PLAYBOOK_SHELVES) {
    const candidateRel = path.join(candidate.dir, `${name}.md`);
    if (fs.existsSync(path.join(root, candidateRel))) {
      shelf = candidate;
      rel = candidateRel;
      break;
    }
  }
  if (!shelf || !rel) {
    const expected = PLAYBOOK_SHELVES.map((entry) => path.join(entry.dir, `${name}.md`)).join(
      ' or '
    );
    return { playbook: {}, errors: [`missing playbook ${expected}`] };
  }
  const abs = path.join(root, rel);
  const playbook = parseFrontmatter(fs.readFileSync(abs, 'utf8'));
  if (!playbook) {
    return { playbook: {}, errors: [`${rel} has no YAML front-matter block`] };
  }
  if (playbook.name !== name) {
    errors.push(`${rel} declares name "${String(playbook.name)}", expected "${name}"`);
  }
  if (!ROUTINE_TIERS.includes(String(playbook.tier))) {
    errors.push(`${rel} tier must be one of ${ROUTINE_TIERS.join(', ')}`);
  }
  if (!Number(playbook.maxFiles)) {
    errors.push(`${rel} must declare a positive maxFiles budget`);
  }
  if (!toList(playbook.allowedPaths).length) {
    errors.push(`${rel} must declare at least one allowedPaths entry`);
  }
  const ledger = path.join(shelf.ledgerDir, `${name}.md`);
  if (!fs.existsSync(path.join(root, ledger))) {
    errors.push(`missing ledger ${ledger}`);
  }
  return { playbook, errors, rel, ledger };
}

/**
 * @param {string[]} args
 * @param {string} flag
 * @returns {string | undefined}
 */
function readFlag(args, flag) {
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  return args[index + 1];
}

/** @param {string[]} args */
function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });
}

/**
 * @param {string} base
 * @returns {{ status: string, file: string }[]}
 */
function collectChanges(base) {
  const raw = git(['diff', '--name-status', `${base}...HEAD`]);
  const staged = git(['status', '--porcelain']);
  /** @type {Map<string, string>} */
  const changes = new Map();
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    const [status, ...rest] = line.split('\t');
    changes.set(rest[rest.length - 1], status[0]);
  }
  for (const line of staged.split('\n')) {
    if (!line.trim()) continue;
    const status = line.slice(0, 2).trim();
    const file = line.slice(3).trim();
    changes.set(file, status.includes('D') ? 'D' : status[0] === '?' ? 'A' : status[0]);
  }
  return [...changes].map(([file, status]) => ({ file, status }));
}

/**
 * @param {string} base
 * @param {{ status: string, file: string }[]} changes
 */
function collectTestCounts(base, changes) {
  /** @type {{ file: string, before: number, after: number }[]} */
  const counts = [];
  for (const change of changes) {
    if (change.status !== 'M' || !isTestPath(change.file)) continue;
    let before = 0;
    try {
      before = countTestCases(git(['show', `${base}:${change.file}`]));
    } catch {
      continue;
    }
    const abs = path.join(ROOT, change.file);
    if (!fs.existsSync(abs)) continue;
    counts.push({ file: change.file, before, after: countTestCases(fs.readFileSync(abs, 'utf8')) });
  }
  return counts;
}

/**
 * @param {string} name
 * @returns {string[]}
 */
function preflightProblems(name) {
  const { errors } = loadPlaybook(ROOT, name);
  const problems = [...errors];
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
  if (branch === 'main' || branch === 'master') {
    problems.push(`on ${branch} — routines work on a branch, never the default branch`);
  }
  return problems;
}

function main() {
  const args = process.argv.slice(2);
  const mode = args.find((arg) => arg === '--preflight' || arg === '--postflight');
  const name = readFlag(args, mode ?? '');
  if (!mode || !name) {
    console.error('usage: routine-guard.mjs --preflight|--postflight <name> [--base <ref>]');
    process.exit(2);
  }

  if (mode === '--preflight') {
    const problems = preflightProblems(name);
    if (problems.length === 0) {
      console.log(`routine-guard: preflight OK for "${name}"`);
      return;
    }
    for (const problem of problems) console.error(`  ${problem}`);
    process.exit(1);
  }

  const base = readFlag(args, '--base') ?? process.env.ROUTINE_GUARD_BASE ?? 'origin/main';
  const { playbook, errors } = loadPlaybook(ROOT, name);
  if (errors.length) {
    for (const error of errors) console.error(`  ${error}`);
    process.exit(1);
  }
  const changes = collectChanges(base);
  const result = checkRoutineDiff({
    playbook,
    changes,
    testCounts: collectTestCounts(base, changes)
  });
  if (result.ok) {
    console.log(
      `routine-guard: postflight OK for "${name}" (${changes.length}/${String(playbook.maxFiles)} files)`
    );
    return;
  }
  console.error(`routine-guard: postflight FAILED for "${name}"`);
  for (const violation of result.violations) console.error(`  ${violation}`);
  process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
