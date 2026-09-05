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
 *   node scripts/routine-guard.mjs --filings [--window <h>] [--json]
 *       (who filed what into the backlog, against each playbook's maxIssues?)
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
    if (String(playbook.maxIssues ?? '') !== '') {
      errors.push(
        `${rel} is tier "report" and must not declare maxIssues — a reporter that files becomes a ` +
          'second backlog owner (digest.md § 3: never open an issue, never label one, never close one)'
      );
    }
  } else {
    if (!Number(playbook.maxFiles)) {
      errors.push(`${rel} must declare a positive maxFiles budget`);
    }
    if (!toList(playbook.allowedPaths).length) {
      errors.push(`${rel} must declare at least one allowedPaths entry`);
    }
    // `0` is a real budget here (resolve files nothing and closes instead), so the truthiness test
    // that suits maxFiles would reject it. `maxFiles` must be positive because a code-writing
    // routine that may change no files is not code-writing; `maxIssues` may legitimately be zero.
    if (!/^\d+$/.test(String(playbook.maxIssues ?? ''))) {
      errors.push(
        `${rel} must declare maxIssues as a whole number (issues it may open per rolling ` +
          `${FILING_WINDOW_HOURS}h; 0 to forbid filing). maxFiles bounds a diff; nothing else on ` +
          'either shelf bounds a ticket, and filing is the half that grew the backlog.'
      );
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
    .filter(({ name, playbook }) => {
      const allowed = toList(playbook.allowedPaths);
      const forbidden = toList(playbook.forbiddenPaths);
      if (!allowed.length) return false;
      if (matchesAny(filePath, forbidden)) return false;
      if (!matchesAny(filePath, allowed)) return false;
      // `allowedPaths` is only half of who may write a file since ADR-0017. Reporting a routine that
      // postflight would refuse is the same wrong promise `ready-for-agent` used to make: #476's
      // remaining item names a playbook path, and `resolve` must not be told it can reach it.
      return shelfOwnershipViolation({ routineName: name, file: filePath }) === null;
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
 * The machine-readable filer line every routine must put in the body of an issue it opens.
 *
 * Without it, a filing has no author. Every issue in this tracker — human-filed and routine-filed —
 * is authored by the same account, because the routines reach GitHub through the owner's own
 * credentials (README rule 9). So "who filed this?" could only be answered by reading each body as
 * prose, which is why nothing in the fleet could see its own inflow: nine open issues in one week
 * carried no number that connected them to the run that created them.
 *
 * `maxIssues` is unenforceable until this line exists, and the digest cannot report filings by
 * routine until it does.
 */
export const FILED_BY_RE = /^filed-by:[ \t]*([A-Za-z0-9_-]+)[ \t]*$/im;

/** The rolling window a filing budget is counted over: one day covers a nightly rung's one run. */
export const FILING_WINDOW_HOURS = 24;

/**
 * Pay-before-file, and deliberately NOT a playbook key.
 *
 * `maxIssues` alone only slows the inflow — a ceiling of eight filings a night across seven rungs
 * does not bind on a shelf measured at 3.3 a night. What actually stops growth is making a filing
 * cost the filer: a rung already carrying this many of its own issues, each older than the age
 * below, must close one before it opens another. Six rungs are contractually required to file and
 * one consumer is capped at one pick a night, so the asymmetry has to be closed on the filing side.
 *
 * It lives here rather than in front-matter for the reason ADR-0017 gave for everything else on this
 * shelf: the routine that spends a budget is not the one that should set it. A `maxOwnOpenIssues` in
 * a playbook would be a number every overworked rung has an incentive to widen, and widening it
 * unblocks nothing except the tracker.
 */
export const OWN_OPEN_ISSUE_LIMIT = 3;

/** How many days a rung's own filing gets before it counts against that limit. */
export const OWN_OPEN_ISSUE_AGE_DAYS = 5;

/**
 * @param {string | undefined | null} body
 * @returns {string | null} the routine named by the body, lowercased, or null when it names none
 */
export function parseFiledBy(body) {
  const match = FILED_BY_RE.exec(String(body ?? ''));
  return match ? match[1].toLowerCase() : null;
}

/**
 * @param {unknown} parsed
 * @returns {{ number: number, title: string, createdAt: string, closedAt: string, state: string, labels: string[], filedBy: string | null }[] | null}
 */
function normalizeIssueList(parsed) {
  if (!Array.isArray(parsed)) return null;
  return parsed
    .filter((issue) => issue && !('pull_request' in issue))
    .map((issue) => ({
      number: Number(issue?.number),
      title: String(issue?.title ?? ''),
      createdAt: String(issue?.createdAt ?? issue?.created_at ?? ''),
      closedAt: String(issue?.closedAt ?? issue?.closed_at ?? ''),
      // `gh --json state` answers `OPEN`; the REST API answers `open`. Measured on both routes, and
      // read here rather than by each caller — a case-sensitive `=== 'open'` silently reports a
      // backlog of zero through the `gh` route while the REST route reports the true number, which
      // is the "present in the tests, absent in production" shape README rule 5 names.
      state: String(issue?.state ?? '').toLowerCase(),
      // `gh --json labels` gives `[{id,name,description}]`, REST gives the same but a caller that
      // forgets to map it gets objects where a `includes('log')` expects strings.
      labels: (Array.isArray(issue?.labels) ? issue.labels : [])
        .map((label) => (typeof label === 'string' ? label : String(label?.name ?? '')))
        .filter(Boolean),
      filedBy: parseFiledBy(issue?.body)
    }));
}

/**
 * `log` marks an append-only thread, never work — today #452, the digest's own standing comment
 * stream. Every routine that reads the backlog excludes it (`docs/agents/triage-labels.md`), and this
 * sensor counts the same queue, so it must count the same way: a backlog figure that includes the
 * thread reporting on the backlog is one that can never reach zero.
 *
 * @param {{ labels?: string[] }} issue
 * @returns {boolean}
 */
export function isLogIssue(issue) {
  return (issue?.labels ?? []).includes('log');
}

/**
 * Recently created issues, newest first. Same two routes and the same `null`-on-failure contract as
 * {@link fetchOpenPrs}: an absent answer and an empty answer mean opposite things, and a filing cap
 * that read "could not reach GitHub" as "filed nothing" is a cap that disappears whenever the
 * network does.
 *
 * `state=all` because the budget is about inflow, not backlog: a rung that files an issue and closes
 * it an hour later has still spent a filing.
 *
 * @param {{ runGh?: (args: string[]) => string, runCurl?: (args: string[]) => string, remoteUrl?: string }} [deps]
 * @returns {{ number: number, title: string, createdAt: string, closedAt: string, state: string, filedBy: string | null }[] | null}
 */
export function fetchRecentIssues(deps = {}) {
  const runGh =
    deps.runGh ??
    ((args) =>
      execFileSync('gh', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  try {
    const viaGh = normalizeIssueList(
      JSON.parse(
        runGh([
          'issue',
          'list',
          '--state',
          'all',
          '--limit',
          '200',
          '--json',
          'number,title,createdAt,closedAt,state,labels,body'
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
      `https://api.github.com/repos/${slug}/issues?state=all&sort=created&direction=desc&per_page=200`
    ];
    return normalizeIssueList(JSON.parse(runCurl(args)));
  } catch {
    return null;
  }
}

/**
 * The filing half of postflight, kept pure so it can be tested without a network or a `gh` login.
 *
 * `maxIssues` exists because `maxFiles` does not bound this. A routine may change nine files and is
 * refused at its tenth; it may open nine issues and costs itself nothing, because filing needs no
 * diff at all. With six rungs contractually required to file and one consumer capped at one pick per
 * night, the tracker was the only unbounded budget on the shelf (measured: 36 issues opened and 13
 * closed across 11 days). Same safety model as every other budget here: a small declared number,
 * checked against the real world by the guard rather than by the prose.
 *
 * @param {object} input
 * @param {string} input.name
 * @param {Record<string, string | string[]>} input.playbook
 * @param {{ number: number, title: string, createdAt: string, state: string, labels: string[], filedBy: string | null }[] | null} input.issues
 * @param {number} [input.now]
 * @param {number} [input.windowHours]
 * @returns {{ readable: boolean, filings: number, budget: number | null, unattributed?: number, ownOpen?: number, violations: string[], warning?: string }}
 */
export function checkFilings({
  name,
  playbook,
  issues,
  now = Date.now(),
  windowHours = FILING_WINDOW_HOURS
}) {
  if (String(playbook.tier) === 'report') {
    return { readable: issues !== null, filings: 0, budget: null, unattributed: 0, violations: [] };
  }
  if (issues === null) {
    return {
      readable: false,
      filings: 0,
      budget: null,
      unattributed: 0,
      violations: [],
      warning:
        'could not read recent issues (gh missing, unauthenticated or offline) — the filing budget ' +
        'did not run. A routine whose only output is a GitHub write must confirm it landed (README rule 9).'
    };
  }
  const budget = Number(playbook.maxIssues);
  const cutoff = now - windowHours * 3600e3;
  const recent = issues.filter(
    (issue) => !isLogIssue(issue) && Date.parse(issue.createdAt) >= cutoff
  );
  const lower = String(name).toLowerCase();
  const mine = recent.filter((issue) => issue.filedBy === lower);
  const unattributed = recent.filter((issue) => !issue.filedBy).length;
  const debt = ownOpenDebt({ name, issues, now });
  /** @type {string[]} */
  const violations = [];
  if (Number.isFinite(budget) && mine.length > budget) {
    violations.push(
      `filing budget: ${mine.length} issues opened by \`${lower}\` in the last ${windowHours}h, ` +
        `playbook allows ${budget} (${mine.map((i) => `#${i.number}`).join(', ')}). ` +
        'Append to a standing issue instead of minting a number, or fix one you filed earlier — ' +
        'see docs/routines/README.md rule 12.'
    );
  }
  if (mine.length && debt.count > OWN_OPEN_ISSUE_LIMIT) {
    violations.push(
      `pay-before-file: \`${lower}\` filed ${mine.length} while ${debt.count} of its own findings ` +
        `are still open past ${OWN_OPEN_ISSUE_AGE_DAYS} days (${debt.numbers.join(', ')}). ` +
        `Resolve one of those instead — a filer that also clears its own backlog is the only thing ` +
        'that bounds it, because the one routine scheduled to clear backlogs takes one issue a night.'
    );
  }
  return {
    readable: true,
    filings: mine.length,
    budget: Number.isFinite(budget) ? budget : null,
    unattributed,
    ownOpen: debt.count,
    violations
  };
}

/**
 * The filings a rung still owes: open, attributed to it, and older than the grace period.
 *
 * Only bodies carrying the `filed-by:` trailer can answer this. Issues filed before the trailer
 * existed are nobody's debt rather than everyone's — attribution is not recoverable from prose at
 * this scale, and guessing it would let the guard blame a rung for a filing it never made.
 *
 * @param {{ name: string, issues: { number: number, createdAt: string, state: string, filedBy: string | null }[], now?: number }} input
 * @returns {{ count: number, numbers: number[] }}
 */
export function ownOpenDebt({ name, issues, now = Date.now() }) {
  const lower = String(name).toLowerCase();
  const graceMs = OWN_OPEN_ISSUE_AGE_DAYS * 86400e3;
  const owed = issues.filter(
    (issue) =>
      !isLogIssue(issue) &&
      issue.filedBy === lower &&
      issue.state === 'open' &&
      now - Date.parse(issue.createdAt) >= graceMs
  );
  return { count: owed.length, numbers: owed.map((issue) => `#${issue.number}`) };
}

/**
 * The aggregate the shelf was built without.
 *
 * Every existing watchdog asks about one thing: this job did not run, this PR is old, this issue is
 * unowned. None asks how big the queue is, so a backlog can double while every item-level check
 * correctly reports nothing to act on — which is how the tracker reached 24 open with a digest whose
 * first line read "nothing needs you tonight". This is the counterpart to `--reachable`: that answers
 * "can any agent take this?", this answers "is anything taking them".
 *
 * Kept pure so the arithmetic is testable without GitHub.
 *
 * @param {object} input
 * @param {{ number: number, title: string, createdAt: string, closedAt: string, state: string, labels: string[], filedBy: string | null }[]} input.issues
 * @param {{ name: string, playbook: Record<string, string | string[]> }[]} input.playbooks
 * @param {number} [input.now]
 * @param {number} [input.windowHours]
 */
export function summarizeBacklog({
  issues,
  playbooks,
  now = Date.now(),
  windowHours = FILING_WINDOW_HOURS
}) {
  issues = issues.filter((issue) => !isLogIssue(issue));
  const cutoff = now - windowHours * 3600e3;
  const days = (iso) => Math.floor((now - Date.parse(iso)) / 86400e3);
  const open = issues.filter((issue) => issue.state === 'open');
  const created = issues.filter((issue) => Date.parse(issue.createdAt) >= cutoff);
  const closed = issues.filter((issue) => issue.closedAt && Date.parse(issue.closedAt) >= cutoff);
  const aged = open
    .filter((issue) => Number.isFinite(Date.parse(issue.createdAt)))
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const oldest = aged.length ? { ...aged[0], ageDays: days(aged[0].createdAt) } : null;
  const perRoutine = [];
  for (const entry of playbooks) {
    if (String(entry.playbook.tier) === 'report') continue;
    const lower = String(entry.name).toLowerCase();
    const filings = created.filter((issue) => issue.filedBy === lower);
    const budget = Number(entry.playbook.maxIssues);
    const debt = ownOpenDebt({ name: entry.name, issues, now });
    perRoutine.push({
      name: entry.name,
      filings: filings.length,
      numbers: filings.map((issue) => issue.number),
      budget: Number.isFinite(budget) ? budget : null,
      ownOpen: debt.count,
      over: Number.isFinite(budget) && filings.length > budget,
      owes: filings.length > 0 && debt.count > OWN_OPEN_ISSUE_LIMIT
    });
  }
  return {
    windowHours,
    open: open.length,
    oldest,
    created: created.length,
    closed: closed.length,
    net: created.length - closed.length,
    unattributed: created.filter((issue) => !issue.filedBy).length,
    perRoutine,
    anyOver: perRoutine.some((entry) => entry.over || entry.owes)
  };
}

/**
 * Whether a queried path actually exists, as an annotation on the `--reachable` answer.
 *
 * Ownership and existence are different questions and this script answered only the first, which is
 * how two incidents happened in one week. #531: `canvas-graph-edit`'s `allowedPaths` globbed
 * `apps/web/src/hooks/useFlowchartGraphEdit.js` — a directory that has never existed — and
 * `--reachable` reported it owned by that automation, confidently, while the real file at
 * `apps/web/src/features/canvas/` was reported as *not* owned by it. #545: the `deps` routine ran
 * `--reachable .github/dependabot.yml`, got `NONE`, and filed an ownership-gap issue asserting the
 * file exists, is 464 bytes, and is guarded by three CI jobs — it has never existed on any branch,
 * `ci.yml` contains no `dependabot` reference at all, and the very ledger that routine had just read
 * says so in its own words (its todo is even named `no-dependabot-yml`).
 *
 * The answer is not to fail on a missing path: "may I create this file?" is a legitimate question, and
 * a routine deciding whether to author something must be able to ask it. So the owner list is
 * unchanged and this rides alongside it. The trap being closed is an agent reading an ownership answer
 * as a file listing.
 *
 * @param {string} root
 * @param {string} file
 * @returns {string} `''` when the path is on disk, otherwise a trailing note
 */
export function missingPathNote(root, file) {
  if (fs.existsSync(path.join(root, file))) return '';
  return ' [no such path on disk — an owner here is a budget match, not a file]';
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

  // `--filings` is the inflow half of the same question, for the digest and for `improve`: how many
  // issues did each rung open in the window, against the budget it declared, and how big is the
  // queue that results? Exits 1 when any rung is over its `maxIssues`, the way `--reachable` exits 1
  // when a path has no owner — both are "the shelf is stuck in a way nobody is scheduled to notice".
  if (args.includes('--filings')) {
    const issues = fetchRecentIssues();
    if (issues === null) {
      console.error(
        'routine-guard: --filings needs GitHub (a logged-in `gh`, or the REST API with GH_TOKEN). ' +
          'Unlike postflight this does not warn and pass: an absent answer is not "filed nothing".'
      );
      process.exit(1);
    }
    const windowHours = Number(readFlag(args, '--window')) || FILING_WINDOW_HOURS;
    const summary = summarizeBacklog({ issues, playbooks: collectPlaybooks(), windowHours });
    if (args.includes('--json')) {
      console.log(JSON.stringify(summary, null, 2));
      process.exit(summary.anyOver ? 1 : 0);
    }
    console.log(
      `backlog: ${summary.open} open` +
        (summary.oldest
          ? `, oldest #${summary.oldest.number} (${summary.oldest.ageDays}d) — ${summary.oldest.title.slice(0, 58)}`
          : '')
    );
    console.log(
      `window: ${summary.created} filed / ${summary.closed} closed in ${windowHours}h ` +
        `(net ${summary.net >= 0 ? '+' : ''}${summary.net})` +
        (summary.unattributed
          ? `, ${summary.unattributed} unattributed (no \`filed-by:\` line)`
          : '')
    );
    for (const entry of summary.perRoutine) {
      const flag = entry.over ? 'OVER-BUDGET' : entry.owes ? 'OWES' : 'ok';
      console.log(
        `  ${entry.name.padEnd(18)} filed ${entry.filings}/${entry.budget ?? '?'}  ` +
          `own-open ${entry.ownOpen}  ${flag}` +
          (entry.numbers.length ? `  ${entry.numbers.map((n) => `#${n}`).join(' ')}` : '')
      );
    }
    if (summary.anyOver) {
      console.error(
        'routine-guard: a rung is over its filing budget or owes backlog of its own. It must append ' +
          'to a standing issue or work one it already filed (docs/routines/README.md rule 12); ' +
          '`improve` owns the number.'
      );
      process.exit(1);
    }
    return;
  }

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
      const note = missingPathNote(ROOT, target);
      if (owners.length) {
        console.log(`${target} -> ${owners.join(', ')}${note}`);
      } else if (matchesAny(target, ALWAYS_FORBIDDEN)) {
        console.log(
          `${target} -> frozen (always-forbidden; outside every routine by design)${note}`
        );
      } else {
        unowned += 1;
        console.log(`${target} -> NONE (no routine's allowedPaths reaches it)${note}`);
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
  let filingNote = '';
  if (String(playbook.tier) !== 'report') {
    const filing = checkFilings({ name, playbook, issues: fetchRecentIssues() });
    if (!filing.readable) {
      console.warn(`  warning: ${filing.warning}`);
    } else {
      filingNote = `, ${filing.filings}/${filing.budget} issues filed in ${FILING_WINDOW_HOURS}h`;
      if (filing.unattributed) {
        filingNote += ` (${filing.unattributed} unattributed — no \`filed-by:\` line)`;
      }
    }
    result.violations.push(...filing.violations);
  }
  if (result.ok) {
    console.log(postflightOkMessage({ name, playbook, fileCount: changes.length, filingNote }));
    return;
  }
  console.error(`routine-guard: postflight FAILED for "${name}"`);
  for (const violation of result.violations) console.error(`  ${violation}`);
  process.exit(1);
}

/**
 * The line an unattended run prints as proof it stayed inside its budget.
 *
 * Extracted from `main()` because #475 found the test named for it could not fail on it: when a
 * change's entire deliverable *is* a printed string, asserting through `checkRoutineDiff()` never
 * reaches the thing that shipped. Both branches are now asserted directly. The `report` branch is the
 * one that matters — a report routine declares no `maxFiles`, so collapsing the ternary renders the
 * proof as `0/undefined files`, which is a message that reads like a pass while proving nothing.
 *
 * @param {{ name: string, playbook: Record<string, string | string[]>, fileCount: number, filingNote?: string }} input
 * @returns {string}
 */
export function postflightOkMessage({ name, playbook, fileCount, filingNote = '' }) {
  if (String(playbook.tier) === 'report') {
    return `routine-guard: postflight OK for "${name}" (report tier, ${fileCount} files changed)`;
  }
  return `routine-guard: postflight OK for "${name}" (${fileCount}/${String(playbook.maxFiles)} files${filingNote})`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
