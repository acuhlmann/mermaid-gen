#!/usr/bin/env node
/**
 * Budget enforcement for scheduled NFR routines (docs/routines/).
 *
 * Routines run unattended, so their safety cannot rest on the model having read the prose.
 * This script re-reads the playbook's declared budget and checks the actual diff against it.
 *
 *   node scripts/routine-guard.mjs --preflight <name>   (reads open PRs via `gh`)
 *   node scripts/routine-guard.mjs --postflight <name> [--base origin/main]
 *   node scripts/routine-guard.mjs --reachable <path>   (which routine may write this file?)
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
 *
 * `report` is enforced, not described: such a routine declares no `allowedPaths` and no
 * `maxFiles`, and postflight fails on a non-empty diff. Until 2026-08-30 the tier was validated as
 * if it wrote code — it had to name a budget it was forbidden to spend — so nothing anywhere
 * actually stopped a `report` routine from committing.
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
  '**/*.tsbuildinfo',
  // This file. The budget is the safety model, so the thing that reads the budget cannot be inside
  // any routine's reach — `allowedPaths` is what a routine may widen, and a routine that can edit
  // the enforcer can edit everything. Issue #461 named the gap; ADR-0017 closes it.
  'scripts/routine-guard.mjs'
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

const LEDGER_PATH_RE = /^docs\/(routines|automations)\/ledger\/([^/]+)\.md$/;
const SHELF_DOC_RE = /^docs\/(routines|automations)\/[^/]+\.md$/;

/**
 * The one routine allowed to change a playbook's budget. ADR-0016 made it the quality owner;
 * ADR-0017 made that mechanical, because until this rule a routine whose `allowedPaths` contained
 * `docs/**` could raise its own `maxFiles` and pass its own postflight — the safety property
 * `docs/routines/README.md` § 2 states as enforced ("it is not advisory and it does not read the
 * prose") existed only in the prose of the file being edited (issue #461).
 */
export const BUDGET_OWNERS = ['improve'];

/**
 * Playbook and contract files are owned, not shared. A routine may always append to its **own**
 * ledger (README rule 7), and may never touch another routine's ledger, any playbook's front-matter,
 * or either shelf's README.
 *
 * @param {{ routineName: string, file: string }} input
 * @returns {string | null} a violation message, or null when this routine owns the edit
 */
export function shelfOwnershipViolation({ routineName, file }) {
  const ledger = LEDGER_PATH_RE.exec(file);
  if (ledger) {
    if (ledger[2] === routineName || BUDGET_OWNERS.includes(routineName)) return null;
    return (
      `shelf ownership: ${file} is \`${ledger[2]}\`'s ledger — append to your own and route ` +
      'anything that belongs to another routine through `improve`.'
    );
  }
  if (!SHELF_DOC_RE.test(file)) return null;
  if (BUDGET_OWNERS.includes(routineName)) return null;
  return (
    `shelf ownership: ${file} is not "${routineName}"'s to edit. Playbooks, their budgets, ` +
    'and the shelf READMEs belong to `improve` (ADR-0016, ADR-0017): a routine that widens its ' +
    'own budget passes its own check, which is exactly the failure this rule prevents. ' +
    'File an issue, or record it in your ledger for `improve` to pick up.'
  );
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
  const routineName = String(playbook.name ?? '');
  /** @type {string[]} */
  const violations = [];
  const allowed = toList(playbook.allowedPaths);
  const forbidden = toList(playbook.forbiddenPaths);
  const maxFiles = Number(playbook.maxFiles ?? 0);
  const files = changes.map((change) => change.file);

  if (String(playbook.tier) === 'report') {
    if (files.length) {
      violations.push(
        `report tier: ${files.length} file(s) changed (${files.slice(0, 3).join(', ')}). ` +
          'A `report` routine writes nothing to the repository — its output is the report itself.'
      );
    }
    return { ok: violations.length === 0, violations };
  }

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
    const ownership = shelfOwnershipViolation({ routineName, file });
    if (ownership) {
      violations.push(ownership);
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
  if (String(playbook.tier) === 'report') {
    if (Number(playbook.maxFiles)) {
      errors.push(`${rel} is tier "report" and must not declare a maxFiles budget it cannot spend`);
    }
    if (toList(playbook.allowedPaths).length) {
      errors.push(`${rel} is tier "report" and must not declare allowedPaths — it writes nothing`);
    }
  } else {
    if (!Number(playbook.maxFiles)) {
      errors.push(`${rel} must declare a positive maxFiles budget`);
    }
    if (!toList(playbook.allowedPaths).length) {
      errors.push(`${rel} must declare at least one allowedPaths entry`);
    }
  }
  const ledger = path.join(shelf.ledgerDir, `${name}.md`);
  if (!fs.existsSync(path.join(root, ledger))) {
    errors.push(`missing ledger ${ledger}`);
  }
  return { playbook, errors, rel, ledger };
}

/**
 * Every playbook on both shelves, read from disk. `report`-tier playbooks come back too — they
 * simply own no paths, so they never appear as an owner.
 * @param {string} [root]
 * @returns {{ name: string, playbook: Record<string, string | string[]> }[]}
 */
export function collectPlaybooks(root = ROOT) {
  /** @type {{ name: string, playbook: Record<string, string | string[]> }[]} */
  const found = [];
  for (const shelf of PLAYBOOK_SHELVES) {
    const dir = path.join(root, shelf.dir);
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir).sort()) {
      if (!entry.endsWith('.md') || entry === 'README.md') continue;
      const name = entry.replace(/\.md$/, '');
      const { playbook, errors } = loadPlaybook(root, name);
      if (errors.length) continue;
      found.push({ name, playbook });
    }
  }
  return found;
}

/**
 * Which routines are allowed to write a given path.
 *
 * This is the question a filer must answer before it labels an issue `ready-for-agent`, and the
 * answer used to be unknowable without reading four playbooks by hand — so issues got labelled for
 * an agent that mechanically could not reach them. #461 (`scripts/routine-guard.mjs`), #462 and
 * #473 (`scripts/test-affected-lib.mjs`) sat in exactly that state: correctly scoped, correctly
 * labelled, permanently stuck, and invisible to a gather step that trusted its own label.
 *
 * `ALWAYS_FORBIDDEN` paths return no owner by design. Those are not gaps to widen around; they are
 * surfaces deliberately outside every budget, and `--reachable` prints them as `frozen` so the
 * watchdog does not propose "fix" them.
 * @param {string} filePath
 * @param {{ name: string, playbook: Record<string, string | string[]> }[]} [playbooks]
 * @returns {string[]}
 */
export function ownersOfPath(filePath, playbooks = collectPlaybooks()) {
  if (matchesAny(filePath, ALWAYS_FORBIDDEN)) return [];
  return playbooks
    .filter(({ playbook }) => {
      const allowed = toList(playbook.allowedPaths);
      const forbidden = toList(playbook.forbiddenPaths);
      if (!allowed.length) return false;
      if (matchesAny(filePath, forbidden)) return false;
      return matchesAny(filePath, allowed);
    })
    .map(({ name }) => name);
}

/**
 * Which open PRs belong to a routine. Branch names are generated by the cloud runner
 * (`claude/eager-hopper-74jcfu`), so the branch alone cannot identify the routine that opened a
 * PR — the *title* prefix can, and every shipped playbook already enforces one. A playbook may
 * declare either; both default from the routine name.
 * @param {string} name
 * @param {Record<string, string | string[]>} playbook
 * @returns {{ titlePrefixes: string[], branchPrefixes: string[] }}
 */
export function routinePrMatchers(name, playbook) {
  const titlePrefixes = toList(playbook.prTitlePrefix);
  const branchPrefixes = toList(playbook.branchPrefix);
  return {
    titlePrefixes: titlePrefixes.length ? titlePrefixes : [`${name}:`],
    branchPrefixes: branchPrefixes.length ? branchPrefixes : [`${name}/`]
  };
}

/**
 * The open-PR half of preflight, kept pure so it can be tested without a network or a `gh` login.
 * @param {object} input
 * @param {string} input.name
 * @param {Record<string, string | string[]>} input.playbook
 * @param {{ number: number, title: string, headRefName: string }[]} input.openPrs
 * @returns {{ number: number, title: string, headRefName: string }[]}
 */
export function matchOpenRoutinePrs({ name, playbook, openPrs }) {
  const { titlePrefixes, branchPrefixes } = routinePrMatchers(name, playbook);
  const lower = (value) => String(value ?? '').toLowerCase();
  return openPrs.filter((pr) => {
    const title = lower(pr.title);
    const head = lower(pr.headRefName);
    return (
      titlePrefixes.some((prefix) => title.startsWith(lower(prefix))) ||
      branchPrefixes.some((prefix) => head.startsWith(lower(prefix)))
    );
  });
}

/**
 * `git@github.com:owner/repo.git` and `https://github.com/owner/repo` both become `owner/repo`.
 * @param {string} remoteUrl
 * @returns {string | null}
 */
export function parseRepoSlug(remoteUrl) {
  const match = /(?:github\.com[:/])([^/\s]+)\/([^/\s]+?)(?:\.git)?\s*$/.exec(
    String(remoteUrl ?? '')
  );
  return match ? `${match[1]}/${match[2]}` : null;
}

/**
 * @param {unknown} parsed
 * @returns {{ number: number, title: string, headRefName: string }[] | null}
 */
function normalizePrList(parsed) {
  if (!Array.isArray(parsed)) return null;
  return parsed.map((pr) => ({
    number: Number(pr?.number),
    title: String(pr?.title ?? ''),
    // `gh --json headRefName` and the REST API's `head.ref` are the same field, named differently.
    headRefName: String(pr?.headRefName ?? pr?.head?.ref ?? '')
  }));
}

/**
 * Reads open PRs, through `gh` when it is logged in and through the REST API when it is not.
 *
 * The fallback is load-bearing, not a nicety: **`gh` is unauthenticated in the cloud sandbox these
 * routines actually run in.** Measured on the digest routine's first live firing — preflight
 * printed its "could not read open PRs" warning and skipped the one-branch-at-a-time check
 * entirely, which is the whole property this function exists to provide. The routines have always
 * reached GitHub through MCP tools rather than `gh`; the `gh` snippets in the playbooks are
 * aspirational.
 *
 * Listing open PRs on a public repository needs no credentials, so the fallback works with none.
 * `GH_TOKEN` / `GITHUB_TOKEN` are used when present, for a private repo and for the higher rate
 * limit; one call per run sits far inside the 60/hour unauthenticated budget either way.
 *
 * Returns `null` — not `[]` — when neither route answers, so the caller can warn instead of
 * silently reporting "no open PR". An absent answer and an empty answer mean opposite things here.
 * @param {{ runGh?: (args: string[]) => string, runCurl?: (args: string[]) => string, remoteUrl?: string }} [deps]
 * @returns {{ number: number, title: string, headRefName: string }[] | null}
 */
export function fetchOpenPrs(deps = {}) {
  const runGh =
    deps.runGh ??
    ((args) =>
      execFileSync('gh', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  try {
    const viaGh = normalizePrList(
      JSON.parse(
        runGh([
          'pr',
          'list',
          '--state',
          'open',
          '--limit',
          '100',
          '--json',
          'number,title,headRefName'
        ])
      )
    );
    if (viaGh) return viaGh;
  } catch {
    // fall through to REST
  }

  const runCurl =
    deps.runCurl ??
    ((args) =>
      execFileSync('curl', args, {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
      }));
  try {
    const remoteUrl = deps.remoteUrl ?? git(['remote', 'get-url', 'origin']);
    const slug = parseRepoSlug(remoteUrl);
    if (!slug) return null;
    const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
    const args = [
      '-sS',
      '--max-time',
      '20',
      '-H',
      'Accept: application/vnd.github+json',
      ...(token ? ['-H', `Authorization: Bearer ${token}`] : []),
      `https://api.github.com/repos/${slug}/pulls?state=open&per_page=100`
    ];
    return normalizePrList(JSON.parse(runCurl(args)));
  } catch {
    return null;
  }
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
 * @param {{ openPrs?: { number: number, title: string, headRefName: string }[] | null }} [deps]
 * @returns {{ problems: string[], warnings: string[] }}
 */
export function preflightProblems(name, deps = {}) {
  const { playbook, errors } = loadPlaybook(ROOT, name);
  const problems = [...errors];
  const warnings = [];
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
  if (branch === 'main' || branch === 'master') {
    problems.push(`on ${branch} — routines work on a branch, never the default branch`);
  }

  const openPrs = deps.openPrs === undefined ? fetchOpenPrs() : deps.openPrs;
  if (openPrs === null) {
    warnings.push(
      'could not read open PRs (`gh` missing, unauthenticated or offline) — the one-branch-at-a-time ' +
        'check did not run. Confirm by hand that this routine has no open PR before pushing.'
    );
  } else {
    for (const pr of matchOpenRoutinePrs({ name, playbook, openPrs })) {
      problems.push(
        `open PR #${pr.number} (${pr.headRefName}) already belongs to "${name}": ${pr.title}. ` +
          'Finish or close it — do not start a second branch (docs/routines/README.md rule 5).'
      );
    }
  }
  return { problems, warnings };
}

function main() {
  const args = process.argv.slice(2);

  // `--reachable` is a query, not a flight check: "which routine may write this file?" It exists so
  // a filer can answer that without reading four playbooks, and so the digest can ask it of every
  // open issue. Exits 1 when a path has no owner — that is a stuck issue, not a style note.
  if (args.includes('--reachable')) {
    const targets = args
      .slice(args.indexOf('--reachable') + 1)
      .filter((arg) => !arg.startsWith('-'));
    if (targets.length === 0) {
      console.error('usage: routine-guard.mjs --reachable <path> [<path>…]');
      process.exit(2);
    }
    const playbooks = collectPlaybooks();
    let unowned = 0;
    for (const target of targets) {
      const owners = ownersOfPath(target, playbooks);
      if (owners.length) {
        console.log(`${target} -> ${owners.join(', ')}`);
      } else if (matchesAny(target, ALWAYS_FORBIDDEN)) {
        console.log(`${target} -> frozen (always-forbidden; outside every routine by design)`);
      } else {
        unowned += 1;
        console.log(`${target} -> NONE (no routine's allowedPaths reaches it)`);
      }
    }
    if (unowned) {
      console.error(
        `routine-guard: ${unowned} path(s) unowned. File it against \`improve\` (it owns every ` +
          'playbook budget) — do not label the issue `ready-for-agent`.'
      );
      process.exit(1);
    }
    return;
  }

  const mode = args.find((arg) => arg === '--preflight' || arg === '--postflight');
  const name = readFlag(args, mode ?? '');
  if (!mode || !name) {
    console.error(
      'usage: routine-guard.mjs --preflight|--postflight <name> [--base <ref>]\n' +
        '       routine-guard.mjs --reachable <path> [<path>…]'
    );
    process.exit(2);
  }

  if (mode === '--preflight') {
    const { problems, warnings } = preflightProblems(name);
    for (const warning of warnings) console.warn(`  warning: ${warning}`);
    if (problems.length === 0) {
      console.log(`routine-guard: preflight OK for "${name}"`);
      return;
    }
    console.error(`routine-guard: preflight FAILED for "${name}"`);
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
    // A `report` routine has no maxFiles to spend, so "0/undefined files" is the wrong shape of
    // proof — and this line IS the proof an unattended run prints that it stayed in budget.
    console.log(
      String(playbook.tier) === 'report'
        ? `routine-guard: postflight OK for "${name}" (report tier, ${changes.length} files changed)`
        : `routine-guard: postflight OK for "${name}" (${changes.length}/${String(playbook.maxFiles)} files)`
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
