#!/usr/bin/env node
/**
 * Candidate finder for the `prune` routine — docs/routines/prune.md.
 *
 * Answers one question cheaply: **which tracked file does nothing else in this repository refer
 * to?** That is the only question a cleanup run can ask of the whole tree by itself; deciding that
 * a hit is genuinely unneeded is the playbook's proof ladder, and a human merge is its end.
 *
 * It is a **report, not a gate**. It exits 0 whether it finds three files or three hundred, and it
 * is deliberately absent from `npm run check` — same reasoning as `verify:ratchet` (README §
 * "Scheduled NFR routines"): a reachability number that reddens a build teaches whoever is red to
 * silence the sensor instead of reading it. A repository with zero unreachable docs is not a clean
 * repository, it is a scanner with a blind spot.
 *
 *   node scripts/prune-scan.mjs                 # grouped summary + proof commands
 *   node scripts/prune-scan.mjs --json          # machine-readable, for the routine
 *   node scripts/prune-scan.mjs --list          # paths only, for piping
 *
 * Direction of bias is stated because it matters: every ambiguity here resolves toward "referenced",
 * i.e. toward *not* proposing a deletion. A false positive costs the owner a review they did not
 * need; a false negative costs nothing until next run.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { globToRegExp } from './routine-guard.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');

/** Extensions whose *contents* are searched for references. */
const TEXT_EXT = new Set([
  '.md',
  '.mdx',
  '.mdc',
  '.txt',
  '.js',
  '.cjs',
  '.mjs',
  '.jsx',
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.json',
  '.jsonc',
  '.yml',
  '.yaml',
  '.toml',
  '.html',
  '.htm',
  '.css',
  '.scss',
  '.sh',
  '.py',
  '.graphql'
]);

/** Extensions a reference can point at, i.e. the tail of a mention token. */
const MENTION_EXT =
  'md|mdx|mdc|txt|js|cjs|mjs|jsx|ts|tsx|mts|cts|json|jsonc|yml|yaml|toml|html|css|scss|sh|py|svg|mp3|glb|gltf|usda';

/** A mention: a path-ish token ending in a known extension. Bare names count (`officeCadence.js`). */
const MENTION_RE = new RegExp(`[A-Za-z0-9_.\\-/@]*\\.(?:${MENTION_EXT})\\b`, 'g');

/**
 * A module specifier, extensionless or not. Vite and the bundlers here both accept `../utils/thing`
 * for `thing.tsx`, and this repository writes it that way — so a finder that recognises only
 * `thing.tsx` reports a live, imported module as unreferenced and offers it for deletion. Measured
 * on the first run of this script: it proposed deleting `thinkingMarkdownTable.tsx`, which
 * `InsightsPane.jsx:15` imports. Specifier forms are therefore resolved as a bundler would, not
 * matched as strings.
 */
const SPECIFIER_RE =
  /(?:\bfrom|\brequire|\bimport)\s*\(?\s*['"]([^'"]+)['"]|(?:^|\n)\s*import\s+['"]([^'"]+)['"]/g;

/** How a bundler completes an extensionless relative specifier. */
const RESOLVE_EXT = ['', '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.json'];

/**
 * The two mechanisms that genuinely load a file **without naming it**: a bundler glob and a
 * directory scan. Deliberately narrow — a `tsconfig` `include` of every `.ts`, or a
 * dependency-cruiser rule, says *a tool reads these*, not *something needs them*, and treating
 * either as reachability would mark the entire tree alive and make the source half of this scan
 * worthless. That is the difference between "the compiler can see it" and "the product uses it".
 */
const IMPORT_GLOB_RE = /(?:import\.meta\.glob|require\.context)\s*\(\s*['"`]([^'"`]+)['"`]/g;
const READDIR_RE = /readdirSync\s*\(([^)]*)\)/g;
const PATH_FRAGMENT_RE = /['"`]([^'"`]*)['"`]/g;

/**
 * Never a candidate, whatever the graph says. These are entry points and loading surfaces: an agent
 * reaches them by *convention* (a filename it opens first, a glob rule it applies), so a link graph
 * built from this repository's own files cannot see the reference that keeps them alive.
 */
export const NEVER_CANDIDATE = [
  // Human/agent entry points, loaded by name rather than by link.
  'README.md',
  'CLAUDE.md',
  'AGENTS.md',
  'STRUCTURE.md',
  'GLOSSARY.md',
  '**/CLAUDE.md',
  '**/AGENTS.md',
  '**/SKILL.md',
  '**/index.html',
  '**/main.js',
  '**/main.jsx',
  '**/main.ts',
  '**/main.tsx',
  // The loading surfaces themselves — the scanner reads these, so they are roots, not leaves.
  '.cursor/**',
  '.claude/**',
  '.qwen/**',
  '.github/**',
  '.husky/**',
  '.vscode/**',
  '.agents/**',
  'docs/decisions/**',
  // Regenerable or externally-owned assets; AGENTS.md § Don't-touch list.
  'apps/web/src/assets/**',
  'apps/server/bench-results/**',
  'apps/server/src/mcp/apps/**',
  '**/dist/**',
  '**/node_modules/**'
];

/**
 * Files that must never count as a **reference**: the deletion routine's own notes about what it
 * found.
 *
 * Found the day this shipped. Writing the candidate list into `docs/routines/prune.md` and its ledger
 * made all twelve source candidates and the orphan document vanish from the scan — because a file
 * named in any document is, correctly, referenced by it. Any cleanup tool whose memory names its
 * targets would otherwise sterilise its own queue on the day it is written down: the next run finds
 * an empty tree, reports "nothing to prune", and the debris stays forever.
 *
 * Narrow by design — these two paths and no others. Everywhere else a mention is real evidence that a
 * file is wanted: a guide that still describes a module is exactly the thing that should block
 * deleting it.
 */
export const NON_REFERENCING_FILES = ['docs/routines/prune.md', 'docs/routines/ledger/prune.md'];

/** Files whose *only* job is to be found by a test runner or a tool, so "nothing imports me" is their normal state. */
const TEST_PATH_RE = /(^|\/)test\/|\.test\.[cm]?[jt]sx?$|\.spec\.[cm]?[jt]sx?$/;
const FIXTURE_PATH_RE = /(^|\/)(fixtures?|__tests?__|snapshots?)(\/|$)|[.-]fixture\.[^/]+$/;

/**
 * `git ls-files` is the corpus: tracked, plus untracked-and-not-ignored. That makes `.gitignore` the
 * single source of truth for what counts as repository content, which is also what the owner sees in
 * `git status` — an fs walk would scan `node_modules` and the generated `.agents/` skill tree, and a
 * scanner that reads generated files finds references that no human ever wrote.
 * @param {string} root
 * @returns {string[]} repo-relative POSIX paths
 */
export function collectTrackedFiles(root) {
  try {
    // `-c` is explicit, not implied: `ls-files` defaults to `--cached` only when *neither* `-c` nor
    // `-o` nor `-i` is given, so asking for untracked files alone silently drops the whole repo.
    const out = execFileSync('git', ['ls-files', '-z', '-c', '-o', '--exclude-standard'], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024
    });
    return out
      .split('\0')
      .filter(Boolean)
      .map((p) => p.replace(/\\/g, '/'));
  } catch {
    const found = [];
    const walk = (dir, rel) => {
      for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
        if (entry.name === '.git' || entry.name === 'node_modules') continue;
        const rel2 = rel ? `${rel}/${entry.name}` : entry.name;
        if (entry.isDirectory()) walk(rel2, rel2);
        else if (entry.isFile()) found.push(rel2);
      }
    };
    walk('', '');
    return found;
  }
}

/** @param {string} p repo-relative POSIX path */
function extOf(p) {
  return path.extname(p).toLowerCase();
}

/** @param {string} p */
function basenameOf(p) {
  return p.slice(p.lastIndexOf('/') + 1);
}

/** @param {string} p repo-relative POSIX */
export function isTestPath(p) {
  return TEST_PATH_RE.test(p);
}

/**
 * The TypeScript convention this repo resolves daily: an importer writes `./foo.js` for a file named
 * `foo.ts`. Without the twin map, every migrated module reads as unreferenced — and
 * `docs/agents/sensors.md` § the `vi.mock` note says so explicitly.
 * @param {string} base
 * @returns {string[]}
 */
export function basenameVariants(base) {
  const out = [base];
  if (/\.js$/.test(base)) {
    const stem = base.slice(0, -3);
    out.push(`${stem}.ts`, `${stem}.tsx`, `${stem}.mjs`, `${stem}.cjs`, `${stem}.jsx`);
  }
  if (/\.jsx$/.test(base)) out.push(base.slice(0, -4) + '.tsx');
  return out;
}

/**
 * @param {string} text
 * @returns {string[]} mention tokens, in order, deduplicated
 */
export function extractMentions(text) {
  const seen = new Set();
  for (const match of text.matchAll(MENTION_RE)) seen.add(match[0]);
  return [...seen];
}

/**
 * Resolve one mention token to the tracked paths it can mean.
 *
 * A token with a directory part resolves against the mentioner's directory first, then the repo
 * root. A bare basename resolves against **every** tracked file with that name: over-counting a
 * reference is the safe error, and the alternative (picking one) guesses.
 * @param {string} token
 * @param {string} mentionerRel
 * @param {Map<string, string[]>} byBasename
 * @returns {string[]}
 */
export function resolveMention(token, mentionerRel, byBasename) {
  const clean = token.replace(/^\.\//, '').replace(/^\.?\.\.\//, (m) => m);
  const named = [];
  for (const variant of basenameVariants(basenameOf(clean))) {
    const dir = path.posix.dirname(clean);
    if (dir !== '.' && !token.startsWith('/')) {
      for (const candidate of [
        path.posix.normalize(`${path.posix.dirname(mentionerRel)}/${dir}/${variant}`),
        path.posix.normalize(`${dir}/${variant}`),
        path.posix.normalize(variant)
      ]) {
        for (const hit of byBasename.get(basenameOf(candidate)) ?? []) {
          if (hit === candidate) named.push(hit);
        }
      }
    }
    for (const hit of byBasename.get(variant) ?? []) {
      if (basenameOf(hit) === variant) named.push(hit);
    }
  }
  return [...new Set(named)];
}

/**
 * Resolve a module specifier the way the bundler does, so an extensionless `from '../x/thing'`
 * still counts as a reference to `thing.tsx`.
 * @param {string} spec
 * @param {string} mentionerRel
 * @param {Set<string>} fileSet
 * @param {Map<string, string[]>} byBasename
 * @param {string} root
 * @returns {string[]}
 */
export function resolveSpecifier(spec, mentionerRel, fileSet, byBasename, root) {
  if (!spec || spec.startsWith('\0') || spec.length > 200) return [];
  const hits = [];
  const add = (candidate) => {
    const clean = candidate.replace(/^\.\//, '');
    if (fileSet.has(clean)) hits.push(clean);
  };
  if (spec.startsWith('.')) {
    const base = path.posix.normalize(`${path.posix.dirname(mentionerRel)}/${spec}`);
    for (const ext of RESOLVE_EXT) {
      add(base + ext);
      for (const index of ['index', 'mod']) add(`${base}/${index}${ext}`);
    }
    for (const variant of basenameVariants(basenameOf(base)))
      add(path.posix.join(path.posix.dirname(base), variant));
    return [...new Set(hits)];
  }
  // A bare specifier: a workspace package (`@archislop/shared`) or a bare relative module
  // (`'setupMonaco.js'`), the form the web tests actually write.
  const owner = packageOwnerOf(spec, byBasename, fileSet, root);
  if (owner.length) return owner;
  for (const variant of basenameVariants(basenameOf(spec))) {
    for (const hit of byBasename.get(variant) ?? []) hits.push(hit);
  }
  return [...new Set(hits)];
}

/**
 * Which files a package name points at. Only **workspace-local** packages, never a published
 * dependency: an app importing `react` is not referencing a file in this repository, and marking
 * every file whose basename appears in some `node_modules` import would keep the whole tree alive.
 * @param {string} spec
 * @param {Map<string, string[]>} byBasename
 * @returns {string[]}
 */
function packageOwnerOf(spec, byBasename, fileSet, root) {
  const segments = spec.split('/');
  const name = spec.startsWith('@') ? segments.slice(0, 2).join('/') : segments[0];
  if (!name || name.includes('.')) return [];
  const hits = [];
  for (const manifest of byBasename.get('package.json') ?? []) {
    const dir = path.posix.dirname(manifest);
    if (dir === '.' || manifest.includes('node_modules')) continue;
    let pkg;
    try {
      pkg = JSON.parse(fs.readFileSync(path.join(root, manifest), 'utf8'));
    } catch {
      continue;
    }
    if (pkg.name !== name) continue;
    const declared = [pkg.main, pkg.module, pkg.browser]
      .filter((v) => typeof v === 'string' && v.startsWith('.'))
      .concat(typeof pkg.exports === 'string' ? [pkg.exports] : []);
    const entries = declared.length ? declared : ['src/index.js', 'index.js', 'src/index.ts'];
    for (const entry of entries) {
      for (const ext of ['', '.js', '.ts', '.mjs', '.cjs', '.jsx', '.tsx']) {
        const candidate = path.posix.normalize(`${dir}/${entry}${ext}`);
        if (fileSet.has(candidate)) hits.push(candidate);
      }
    }
  }
  return [...new Set(hits)];
}

/**
 * @param {string} text
 * @returns {{ globs: string[], dirs: string[] }} patterns that load files without naming them
 */
export function extractLoaders(text) {
  const globs = new Set();
  const dirs = new Set();
  for (const match of text.matchAll(IMPORT_GLOB_RE)) {
    if (match[1].length <= 120) globs.add(match[1]);
  }
  for (const match of text.matchAll(READDIR_RE)) {
    for (const fragment of match[1].matchAll(PATH_FRAGMENT_RE)) {
      const value = fragment[1];
      if (!value || value.includes('*') || value.length > 120) continue;
      dirs.add(value);
    }
  }
  return { globs: [...globs], dirs: [...dirs] };
}

/**
 * Which files a glob pattern covers, resolved relative to the mentioner's directory.
 * @param {string} pattern
 * @param {string} mentionerRel
 * @param {string[]} allFiles
 * @returns {string[]}
 */
export function expandGlob(pattern, mentionerRel, allFiles) {
  let re;
  try {
    re = globToRegExp(resolveRelative(pattern, mentionerRel));
  } catch {
    return [];
  }
  return allFiles.filter((file) => re.test(file));
}

/**
 * `./foo/*.jsx` inside `apps/web/src/x/y.js` means `apps/web/src/x/foo/*.jsx`; a pattern that does
 * not start with `.` is already repo-relative.
 * @param {string} value
 * @param {string} mentionerRel
 * @returns {string}
 */
export function resolveRelative(value, mentionerRel) {
  if (!value.startsWith('.')) return value;
  const dir = path.posix.dirname(mentionerRel);
  return dir === '.' ? value.replace(/^\.\//, '') : path.posix.normalize(`${dir}/${value}`);
}

/**
 * @param {string} dir
 * @param {string} mentionerRel
 * @param {string[]} allFiles
 * @returns {string[]} every tracked file under that directory
 */
export function filesUnder(dir, mentionerRel, allFiles) {
  const base = path.posix.dirname(mentionerRel);
  const joined = path.posix.normalize(base === '.' ? dir : `${base}/${dir}`);
  // A `readdirSync` fragment is nearly always `path.join(__dirname, 'x')`, i.e. mentioner-relative
  // with no leading `.`. Trying the repo-root reading as well costs one prefix test and keeps the
  // scanner generous, which is the only safe direction for a tool that proposes deletions.
  const prefixes = [joined, dir]
    .map((value) => `${value.replace(/\/$/, '')}/`)
    .filter((value) => value !== '/');
  return allFiles.filter((file) => prefixes.some((prefix) => file.startsWith(prefix)));
}

/**
 * @typedef {{ path: string, kind: 'doc'|'source'|'script', status: string, lines: number,
 *   inbound: string[], addedAt: string|null, why: string, proof: string }} Candidate
 */

/**
 * The whole scan, kept pure over a root so the tests can point it at a fixture tree.
 * @param {string} root
 * @returns {{ candidates: Candidate[], notes: Record<string, number|string[]>, scanned: number }}
 */
export function runScan(root = ROOT) {
  const allFiles = collectTrackedFiles(root);
  const fileSet = new Set(allFiles);
  /** @type {Map<string, string[]>} */
  const byBasename = new Map();
  for (const file of allFiles) {
    const base = basenameOf(file);
    const bucket = byBasename.get(base);
    if (bucket) bucket.push(file);
    else byBasename.set(base, [file]);
  }

  /** @type {Map<string, string>} rel path -> contents */
  const texts = new Map();
  for (const file of allFiles) {
    if (!TEXT_EXT.has(extOf(file))) continue;
    try {
      const abs = path.join(root, file);
      if (fs.statSync(abs).size > 2 * 1024 * 1024) continue;
      texts.set(file, fs.readFileSync(abs, 'utf8'));
    } catch {
      /* unreadable: treated as containing no references, which is the safe direction for its referrers */
    }
  }

  // mentioner -> set of files it points at
  /** @type {Map<string, Set<string>>} */
  const refsFrom = new Map();
  /** @type {Map<string, Set<string>>} target -> mentioners */
  const inbound = new Map();
  /** @type {Set<string>} */
  const globCovered = new Set();

  for (const [mentioner, text] of texts) {
    // The deletion routine's own notes about what it found must not keep those files alive.
    if (NON_REFERENCING_FILES.includes(mentioner)) continue;
    const targets = refsFrom.get(mentioner) ?? new Set();
    refsFrom.set(mentioner, targets);
    const link = (hit) => {
      if (hit === mentioner) return;
      targets.add(hit);
      const set = inbound.get(hit) ?? new Set();
      inbound.set(hit, set);
      set.add(mentioner);
    };
    for (const token of extractMentions(text)) {
      for (const hit of resolveMention(token, mentioner, byBasename)) link(hit);
    }
    for (const match of text.matchAll(SPECIFIER_RE)) {
      for (const hit of resolveSpecifier(
        match[1] ?? match[2],
        mentioner,
        fileSet,
        byBasename,
        root
      )) {
        link(hit);
      }
    }
    const loaders = extractLoaders(text);
    for (const pattern of loaders.globs) {
      for (const hit of expandGlob(pattern, mentioner, allFiles)) {
        if (hit !== mentioner) globCovered.add(hit);
      }
    }
    for (const dir of loaders.dirs) {
      for (const hit of filesUnder(dir, mentioner, allFiles)) {
        if (hit !== mentioner) globCovered.add(hit);
      }
    }
  }

  const candidates = [];

  // --- 1. docs unreachable from any loading surface ------------------------------------------
  // A document stays alive three ways, and the third is why this is not just a link check: code,
  // config and CI that name a `.md` mean something loads it (a workflow publishing a page, a test
  // fixture, a route serving a guide), and no prose link is involved.
  const reachable = new Set();
  const queue = allFiles.filter((file) => isRootDoc(file));
  for (const file of queue) reachable.add(file);
  const frontier = [...queue];
  while (frontier.length) {
    const from = frontier.shift();
    for (const to of refsFrom.get(from) ?? []) {
      if (extOf(to) !== '.md' && extOf(to) !== '.mdx') continue;
      if (reachable.has(to)) continue;
      reachable.add(to);
      frontier.push(to);
    }
  }

  for (const file of allFiles) {
    if (!isDocCandidate(file)) continue;
    const inb = [...(inbound.get(file) ?? [])];
    if (reachable.has(file)) continue;
    if (inb.some((from) => !isDocCandidate(from) && !isRootDoc(from))) continue;
    candidates.push({
      path: file,
      kind: 'doc',
      status: inb.length ? 'unreachable-cluster' : 'orphan',
      lines: countLines(texts.get(file)),
      inbound: inb,
      addedAt: null,
      why: inb.length
        ? `cited only by ${inb.length} document(s) that are themselves unreachable from a root: ${inb.slice(0, 3).join(', ')}`
        : 'no file in the repository names it, and it is not reachable from README.md / AGENTS.md / CLAUDE.md / STRUCTURE.md or a loaded rule'
    });
  }

  // --- 2. source nothing imports -------------------------------------------------------------
  for (const file of allFiles) {
    if (!isSourceCandidate(file)) continue;
    const inb = [...(inbound.get(file) ?? [])];
    const nonTest = inb.filter((from) => !isTestPath(from));
    if (nonTest.length || globCovered.has(file)) continue;
    candidates.push({
      path: file,
      kind: 'source',
      status: inb.length ? 'test-only' : 'unreferenced',
      lines: countLines(texts.get(file)),
      inbound: inb,
      addedAt: null,
      why: inb.length
        ? `only ${inb.length} test file(s) name it — nothing in the shipped tree imports it. The guard forbids deleting a test, so this one is an issue, not a PR`
        : 'no import, no config entry, no glob covers it, and it is not an entry point'
    });
  }

  // --- 3. root npm scripts nothing runs ------------------------------------------------------
  const rootPkg = path.join(root, 'package.json');
  if (fs.existsSync(rootPkg)) {
    let scripts = {};
    try {
      scripts = JSON.parse(fs.readFileSync(rootPkg, 'utf8')).scripts ?? {};
    } catch {
      scripts = {};
    }
    for (const name of Object.keys(scripts)) {
      if (LIFECYCLE.has(name)) continue;
      const needle = new RegExp(`npm\\s+run\\s+${escapeRe(name)}(?![\\w:-])`);
      let runners = 0;
      for (const [mentioner, text] of texts) {
        if (mentioner === 'package.json') {
          // Count only *other* scripts that call this one.
          for (const [key, value] of Object.entries(scripts)) {
            if (key === name) continue;
            if (needle.test(String(value))) runners += 1;
          }
          continue;
        }
        if (needle.test(text)) runners += 1;
      }
      if (runners) continue;
      candidates.push({
        path: `package.json#${name}`,
        kind: 'script',
        status: 'unrouted',
        lines: String(scripts[name]).split('\n').length,
        inbound: [],
        addedAt: null,
        why:
          'no doc, playbook, workflow, or other script invokes `npm run ' +
          name +
          '` — and `package.json` belongs to `deps`, so prune reports this and does not open a PR for it'
      });
    }
  }

  const historyTruncated = isShallowRepository(root);

  return {
    candidates: candidates.map((candidate) => ({
      ...candidate,
      addedAt: firstCommitDate(root, candidate.path.split('#')[0]),
      proof: proofCommand(candidate)
    })),
    scanned: allFiles.length,
    notes: {
      textFiles: texts.size,
      globCovered: globCovered.size,
      neverCandidate: allFiles.filter((file) => isNeverCandidate(file)).length,
      ...(historyTruncated ? { historyTruncated: true } : {})
    }
  };
}

/**
 * The command that re-derives the finding in one step, printed next to it. A candidate whose proof
 * a reviewer cannot reproduce in ten seconds is a claim, not a finding — and this routine's whole
 * output is a request to delete something.
 * @param {Candidate} candidate
 * @returns {string}
 */
export function proofCommand(candidate) {
  if (candidate.kind === 'script') {
    return `git grep -n "npm run ${candidate.path.split('#')[1]}"`;
  }
  return `git grep -ln ${escapeRe(basenameOf(candidate.path))} -- ':!${candidate.path}'`;
}

/**
 * Whether `root` is a shallow clone. In that case `git log --follow` attributes every file to the
 * graft boundary commit, so `addedAt` would read as ~0–2 days forever — gate 4 would park every
 * candidate as in-flight work and the routine could never propose a deletion from a cloud session.
 * @param {string} root
 * @returns {boolean}
 */
export function isShallowRepository(root) {
  try {
    const out = execFileSync('git', ['rev-parse', '--is-shallow-repository'], {
      cwd: root,
      encoding: 'utf8'
    }).trim();
    return out === 'true';
  } catch {
    return false;
  }
}

/**
 * The date the path first landed, for `prune`'s age gate (§ 2 gate 4): three feature automations
 * ship code nightly, so a file younger than a fortnight is somebody's in-flight work, not debris.
 * Returns null outside a git checkout, when history is truncated, or when the add date is unknowable
 * — distinct from "answered no", which is what a shallow clone's graft date falsely looked like.
 * @param {string} root
 * @param {string} relPath
 * @returns {string|null}
 */
export function firstCommitDate(root, relPath) {
  if (isShallowRepository(root)) return null;
  try {
    const out = execFileSync(
      'git',
      ['log', '--diff-filter=A', '--format=%cs', '--follow', '--', relPath],
      { cwd: root, encoding: 'utf8' }
    ).trim();
    const lines = out.split('\n').filter(Boolean);
    return lines.length ? lines[lines.length - 1] : null;
  } catch {
    return null;
  }
}

const LIFECYCLE = new Set([
  'prepare',
  'preinstall',
  'postinstall',
  'prepublish',
  'prepack',
  'postpack'
]);

/** @param {string|undefined} text */
function countLines(text) {
  if (!text) return 0;
  return text.split('\n').length;
}

/** @param {string} file */
function escapeRe(file) {
  return file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * A document is worth proposing only if it is a *prose* file the repository owns, outside the
 * loading surfaces and outside the shelf machinery (a ledger is read by routine name, not by link —
 * every ledger in this repo would read as an orphan).
 * @param {string} file
 */
export function isDocCandidate(file) {
  if (extOf(file) !== '.md' && extOf(file) !== '.mdx') return false;
  if (isNeverCandidate(file)) return false;
  if (file.endsWith('/ledger/README.md')) return false;
  // A routine's ledger is read by *routine name* out of its playbook, never linked from prose, so
  // every ledger in the repository would read as an orphan. A ledger whose routine is gone is
  // `improve`'s to retire — it owns the shelf, this one does not.
  if (globToRegExp('docs/*/ledger/**').test(file)) return false;
  return file.startsWith('docs/') || !file.includes('/');
}

/** @param {string} file */
export function isRootDoc(file) {
  return (
    file === 'README.md' ||
    file === 'AGENTS.md' ||
    file === 'CLAUDE.md' ||
    file === 'STRUCTURE.md' ||
    file === 'GLOSSARY.md' ||
    file.endsWith('/CLAUDE.md') ||
    file.endsWith('/AGENTS.md') ||
    file.endsWith('/README.md') ||
    file.endsWith('SKILL.md') ||
    file.startsWith('.cursor/rules/')
  );
}

/**
 * A source file prune may ever propose: real shipped code, not a test, fixture, or config, and not
 * one of the convention-loaded surfaces in `NEVER_CANDIDATE`.
 * @param {string} file
 */
export function isSourceCandidate(file) {
  if (!/\.[cm]?[jt]sx?$/.test(file)) return false;
  if (isNeverCandidate(file)) return false;
  if (isTestPath(file)) return false;
  if (FIXTURE_PATH_RE.test(file)) return false;
  if (
    /(^|\/)(vite|vitest|webpack|rollup|eslint|postcss|tailwind|babel|nodemon)\.config\./.test(file)
  )
    return false;
  if (/\.config\.[cm]?[jt]s$/.test(file)) return false;
  if (file === 'service-worker.js' || file.endsWith('/sw.js')) return false;
  return (
    /^apps\/[^/]+\/(src|scripts)\//.test(file) ||
    /^packages\/[^/]+\/(src|scripts)\//.test(file) ||
    /^scripts\//.test(file) ||
    /^packages\/eslint-config\//.test(file)
  );
}

/** @param {string} file */
export function isNeverCandidate(file) {
  return NEVER_CANDIDATE.some((pattern) => globToRegExp(pattern).test(file));
}

/**
 * @param {ReturnType<typeof runScan>} result
 * @returns {string}
 */
export function formatReport(result) {
  const byKind = group(result.candidates);
  const lines = [];
  lines.push(
    `prune-scan: ${result.candidates.length} candidate(s) across ${result.scanned} tracked files — a report, not a gate.`
  );
  for (const [kind, list] of byKind) {
    lines.push('');
    lines.push(`${kind} (${list.length})`);
    for (const candidate of list) {
      const age = candidate.addedAt ? `, added ${candidate.addedAt}` : '';
      lines.push(`  ${candidate.path}  [${candidate.status}, ${candidate.lines} lines${age}]`);
      lines.push(`      ${candidate.why}`);
      lines.push(`      proof: ${candidate.proof}`);
    }
  }
  if (!result.candidates.length)
    lines.push('  none — nothing in the tree is unreferenced right now.');
  lines.push('');
  const noteParts = [
    `${result.notes.textFiles} text files read`,
    `${result.notes.globCovered} kept alive by a glob`,
    `${result.notes.neverCandidate} excluded as a loading surface or don't-touch path`
  ];
  if (result.notes.historyTruncated) {
    noteParts.push(
      'git history truncated (shallow clone) — addedAt is null for every candidate, so gate 4 cannot evaluate age here'
    );
  }
  lines.push(`notes: ${noteParts.join(', ')}.`);
  lines.push(
    'See docs/routines/prune.md § 2 for what a candidate still has to survive before it ships.'
  );
  return lines.join('\n');
}

/** @param {Candidate[]} list */
function group(list) {
  /** @type {Map<string, Candidate[]>} */
  const map = new Map();
  for (const candidate of list) {
    const bucket = map.get(candidate.kind) ?? [];
    map.set(candidate.kind, bucket);
    bucket.push(candidate);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function main() {
  const args = process.argv.slice(2);
  const result = runScan(ROOT);
  if (args.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (args.includes('--list')) {
    for (const candidate of result.candidates) console.log(candidate.path);
    return;
  }
  console.log(formatReport(result));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
