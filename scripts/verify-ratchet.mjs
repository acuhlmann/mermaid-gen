#!/usr/bin/env node
/**
 * Quality ratchet: metrics that may only move one way.
 *
 * ADR-0006 already ratchets one metric — a strict-island regression fails `typecheck:strict`.
 * This generalises that mechanism to the numbers nothing was watching: monolith size, lint
 * warning volume, and suite size. Budgets live in docs/agents/ratchet.json.
 *
 *   node scripts/verify-ratchet.mjs              # cheap metrics
 *   node scripts/verify-ratchet.mjs --with-lint  # adds an ESLint pass (~2-3 min)
 *   node scripts/verify-ratchet.mjs --json       # machine-readable, for a routine to act on
 *
 * Deliberately NOT wired into `npm run check`. Two unattended feature automations run daily
 * against this repo, and a quality metric that fails their build at an hour nobody is watching
 * teaches an agent to raise the budget rather than fix the code. The `improve` routine owns this
 * instead: it reads the numbers, records the trend, and a wrong-way move becomes its next task.
 *
 * To loosen a budget: raise it in ratchet.json **in the same PR** and add a `reason`. A budget
 * that differs from its `initial` without a reason is itself a failure — that is what stops the
 * ratchet being quietly unwound to make a red build green.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');
export const RATCHET_PATH = 'docs/agents/ratchet.json';

/** Metrics whose measured value must stay at or below budget; the rest must stay at or above. */
export const DESCENDING_METRICS = new Set(['monolithLoc', 'lintWarnings']);

const TEST_CASE_RE = /\b(?:it|test)(?:\.\w+)*\s*(?:<[^>]*>)?\s*\(/g;

/**
 * @param {string} source
 * @returns {number}
 */
export function countTestCases(source) {
  const matches = source.match(TEST_CASE_RE);
  return matches ? matches.length : 0;
}

/**
 * @param {string} root
 * @param {string[]} files
 * @returns {Record<string, number>}
 */
export function measureFileLoc(root, files) {
  /** @type {Record<string, number>} */
  const out = {};
  for (const file of files) {
    const abs = path.join(root, file);
    // A deleted monolith is a win, not a crash — a split can remove the file outright.
    if (!fs.existsSync(abs)) continue;
    // Newline count, so the number matches `wc -l` and anyone can verify it by hand.
    out[file] = (fs.readFileSync(abs, 'utf8').match(/\n/g) ?? []).length;
  }
  return out;
}

/**
 * @param {string} root
 * @param {string[]} configs
 * @returns {Record<string, number>}
 */
export function measureStrictIslands(root, configs) {
  /** @type {Record<string, number>} */
  const out = {};
  for (const config of configs) {
    const abs = path.join(root, config);
    if (!fs.existsSync(abs)) continue;
    const raw = fs.readFileSync(abs, 'utf8').replace(/^\s*\/\/.*$/gm, '');
    /** @type {{ include?: string[] }} */
    const parsed = JSON.parse(raw);
    out[config] = (parsed.include ?? []).length;
  }
  return out;
}

/**
 * @param {string} root
 * @returns {{ files: number, cases: number }}
 */
export function measureTests(root) {
  const listed = execFileSync(
    'find',
    [
      'apps',
      'packages',
      'scripts',
      '-name',
      '*.test.*',
      '-not',
      '-path',
      '*/node_modules/*',
      '-type',
      'f'
    ],
    { cwd: root, encoding: 'utf8' }
  )
    .split('\n')
    .filter(Boolean);
  let cases = 0;
  for (const file of listed)
    cases += countTestCases(fs.readFileSync(path.join(root, file), 'utf8'));
  return { files: listed.length, cases };
}

/**
 * @param {string} root
 * @param {string[]} workspaces
 * @returns {Record<string, number>}
 */
export function measureLintWarnings(root, workspaces) {
  /** @type {Record<string, number>} */
  const out = {};
  for (const workspace of workspaces) {
    const json = execFileSync('npx', ['eslint', '--format', 'json', '.'], {
      cwd: path.join(root, workspace),
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore']
    });
    /** @type {{ warningCount: number, errorCount: number }[]} */
    const results = JSON.parse(json);
    out[workspace] = results.reduce((sum, file) => sum + file.warningCount + file.errorCount, 0);
  }
  return out;
}

/**
 * A budget that has drifted away from where it started must say why. Without this, the ratchet
 * can be unwound one silent bump at a time and still look green.
 * @param {Record<string, any>} baseline
 * @returns {string[]}
 */
export function validateBaselineShape(baseline) {
  /** @type {string[]} */
  const errors = [];
  for (const [metric, entries] of Object.entries(baseline.metrics ?? {})) {
    const descending = DESCENDING_METRICS.has(metric);
    for (const [key, entry] of Object.entries(/** @type {Record<string, any>} */ (entries))) {
      if (typeof entry?.budget !== 'number' || typeof entry?.initial !== 'number') {
        errors.push(`${metric}.${key} needs numeric "budget" and "initial"`);
        continue;
      }
      const loosened = descending ? entry.budget > entry.initial : entry.budget < entry.initial;
      if (loosened && !String(entry.reason ?? '').trim()) {
        errors.push(
          `${metric}.${key} was loosened (${entry.initial} → ${entry.budget}) with no "reason"`
        );
      }
    }
  }
  return errors;
}

/**
 * @param {Record<string, any>} baseline
 * @param {Record<string, Record<string, number>>} measured
 * @returns {{ ok: boolean, violations: string[], improvements: string[] }}
 */
export function compareRatchet(baseline, measured) {
  /** @type {string[]} */
  const violations = [];
  /** @type {string[]} */
  const improvements = [];
  for (const [metric, entries] of Object.entries(baseline.metrics ?? {})) {
    const observed = measured[metric];
    if (!observed) continue;
    const descending = DESCENDING_METRICS.has(metric);
    for (const [key, entry] of Object.entries(/** @type {Record<string, any>} */ (entries))) {
      const value = observed[key];
      if (value === undefined) continue;
      const regressed = descending ? value > entry.budget : value < entry.budget;
      if (regressed) {
        violations.push(
          `${metric}: ${key} is ${value}, budget ${entry.budget} (${descending ? 'may only fall' : 'may only rise'})`
        );
      } else if (descending ? value < entry.budget : value > entry.budget) {
        improvements.push(`${metric}: ${key} ${entry.budget} → ${value}`);
      }
    }
  }
  return { ok: violations.length === 0, violations, improvements };
}

/**
 * @param {string} root
 * @param {Record<string, any>} baseline
 * @param {{ withLint?: boolean }} [options]
 */
export function measureAll(root, baseline, options = {}) {
  const metrics = baseline.metrics ?? {};
  const tests = measureTests(root);
  /** @type {Record<string, Record<string, number>>} */
  const measured = {
    monolithLoc: measureFileLoc(root, Object.keys(metrics.monolithLoc ?? {})),
    strictIslandFiles: measureStrictIslands(root, Object.keys(metrics.strictIslandFiles ?? {})),
    suite: { files: tests.files, cases: tests.cases }
  };
  if (options.withLint) {
    measured.lintWarnings = measureLintWarnings(root, Object.keys(metrics.lintWarnings ?? {}));
  }
  return measured;
}

function main() {
  const args = process.argv.slice(2);
  const withLint = args.includes('--with-lint');
  const asJson = args.includes('--json');
  const abs = path.join(ROOT, RATCHET_PATH);
  if (!fs.existsSync(abs)) {
    console.error(`verify:ratchet: missing ${RATCHET_PATH}`);
    process.exit(1);
  }
  /** @type {Record<string, any>} */
  const baseline = JSON.parse(fs.readFileSync(abs, 'utf8'));

  const shapeErrors = validateBaselineShape(baseline);
  if (shapeErrors.length) {
    console.error('verify:ratchet: budget file is not self-consistent');
    for (const error of shapeErrors) console.error(`  ${error}`);
    process.exit(1);
  }

  const measured = measureAll(ROOT, baseline, { withLint });
  const result = compareRatchet(baseline, measured);

  if (asJson) {
    // Exit 0 either way: a routine reading this wants the numbers, not a build verdict.
    console.log(JSON.stringify({ updated: baseline.updated, measured, ...result }, null, 2));
    return;
  }

  for (const improvement of result.improvements) {
    console.log(`  improved — ${improvement}`);
  }
  if (result.ok) {
    const scope = withLint ? 'all metrics' : 'cheap metrics (add --with-lint for the rest)';
    console.log(`verify:ratchet: OK (${scope})`);
    if (result.improvements.length) {
      console.log(`  ${result.improvements.length} budget(s) can be tightened in ${RATCHET_PATH}`);
    }
    return;
  }
  console.error('verify:ratchet: a quality metric moved the wrong way');
  for (const violation of result.violations) console.error(`  ${violation}`);
  console.error(
    `\nThis gates no build. Fix the code, or — when the growth is warranted — raise the budget in ` +
      `${RATCHET_PATH} with a written "reason".`
  );
  process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
