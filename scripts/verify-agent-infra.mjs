/**
 * Agent-facing doc and command hygiene checks.
 * Keeps AGENTS.md / blast-radius test pointers aligned with the repo.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// Parsed with the guard's own reader, not a second one. `prune.md` § 1b records what two independent
// implementations of the same idea do to a sensor: `prune:scan`'s lenient reference match and
// `verify:boundaries`' strict graph drifted apart invisibly until someone wrote down both lists.
import { collectPlaybooks } from './routine-guard.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const AGENT_DOC_FILES = [
  'AGENTS.md',
  'CLAUDE.md',
  'docs/guide/coding-agents.md',
  'docs/agents/testing.md',
  'docs/agent-blast-radius.md',
  'docs/agents/sensors.md'
];

/** Routine and feature-automation playbooks are agent instructions; unattended runs cannot ask what a command was. */
const PLAYBOOK_DOC_DIRS = ['docs/routines', 'docs/automations'];

/**
 * The night ladder is stated once per playbook (`schedule:` in its front-matter) and then restated in
 * every table that mirrors it. Nine files carried nine copies of nine crons on 2026-09-14, and nothing
 * read any of them — which is how `prune` ended up with a live daily cron behind a playbook that
 * declared it had none, and how four live crons drifted out of sync with their playbooks by 2026-08-30.
 * These are the files whose Markdown **table rows** name a cron; prose is deliberately not parsed,
 * because these playbooks are full of historical crons explained as history.
 */
const LADDER_AUTHORITY = 'docs/routines/review.md';
const LADDER_TABLE_FILES = [
  LADDER_AUTHORITY,
  'docs/routines/README.md',
  'docs/automations/README.md',
  'AGENTS.md',
  'CLAUDE.md'
];

/** Root docs that state how many jobs fire on the night ladder — must match unpaused rung count. */
const LADDER_JOB_COUNT_FILES = ['AGENTS.md', 'CLAUDE.md'];
/** Real root docs spell the count as an English word (`Eight jobs run between`), not a digit. */
const LADDER_JOB_COUNT_RE = /(\d+|[A-Za-z]+) jobs run between/gi;

/** @type {Record<string, number>} */
const JOB_COUNT_WORDS = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12
};

/**
 * @param {string} token digit or English word from ladder prose
 * @returns {number | null}
 */
export function parseLadderJobCountToken(token) {
  if (/^\d+$/.test(token)) return Number(token);
  const n = JOB_COUNT_WORDS[token.toLowerCase()];
  return n === undefined ? null : n;
}

/** Rungs that are scheduled but documented as sitting off the ladder, so they get no row by design. */
const OFF_LADDER_ROUTINES = new Set(['deps']);

/**
 * The ladder window: 15:00 UTC through 01:00 the next day, expressed as an offset from its own start
 * because it wraps midnight — the owner is GMT+8, so the fleet opens at 23:00 HKT and has to be done
 * before they sit down at ~09:00. Measuring from the start rather than from 00:00 is what lets `45 0`
 * (the digest, 08:45 HKT) count as inside: compare it against a midnight-anchored range and the last
 * rung of the ladder is always the one that looks out of bounds. A rung outside the window is either a
 * typo or someone moving unattended work into the owner's day without saying so.
 */
const NIGHT_WINDOW = { startMinute: 15 * 60, spanMinutes: 10 * 60 };
const WINDOW_LABEL = '15:00–01:00';
const HKT_OFFSET_HOURS = 8;

/** @param {number} hour @param {number} minute @returns {number} minutes since the window opened, mod a day */
function windowOffset(hour, minute) {
  return (hour * 60 + minute - NIGHT_WINDOW.startMinute + 1440) % 1440;
}

const CRON_CELL_RE = /^`(\d{1,2}) (\d{1,2}(?:,\d{1,2})*) \* \* \*`$/;
const CLOCK_CELL_RE = /^\d{2}:\d{2}$/;

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
  /** @type {string[]} */
  const docs = [];
  for (const dirRel of PLAYBOOK_DOC_DIRS) {
    const dir = path.join(root, dirRel);
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir)) {
      if (entry.endsWith('.md') && entry !== 'README.md') {
        docs.push(`${dirRel}/${entry}`);
      }
    }
  }
  return docs.sort();
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
 * Read only the keys the ladder check needs. Deliberately not a YAML parser: `routine-guard` owns the
 * real front-matter reader and this file must not drift from it, but importing across scripts for two
 * scalar keys would couple two independent sensors.
 * @param {string} markdown
 * @returns {{name: string|null, schedule: string|null, paused: boolean}}
 */
export function parsePlaybookSchedule(markdown) {
  const fence = /^---\r?\n([\s\S]*?)\r?\n---/;
  const match = markdown.match(fence);
  const body = match ? match[1] : '';
  const scalar = (key) => {
    const line = body.match(new RegExp(`^${key}:[ \\t]*(.*)$`, 'm'));
    if (!line) return null;
    return line[1].trim().replace(/^['"]|['"]$/g, '') || null;
  };
  const pausedRaw = scalar('paused');
  const paused = pausedRaw !== null && pausedRaw !== '' && pausedRaw !== 'false';
  return { name: scalar('name'), schedule: scalar('schedule'), paused };
}

/**
 * Every Markdown table row in `markdown` that names a cron in a cell.
 * @param {string} markdown
 * @param {string} source
 * @returns {{name: string|null, cron: string, hour: number, minute: number, hkt: string|null, parked: boolean, source: string, line: number}[]}
 */
export function extractLadderTableRows(markdown, source) {
  const rows = [];
  const lines = markdown.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    // The authoritative ladder is stated inside a blockquote, so a table row can wear `> ` markers.
    const text = lines[i]
      .trim()
      .replace(/^(?:>\s?)+/, '')
      .trim();
    if (!text.startsWith('|')) continue;
    const cells = text
      .split('|')
      .map((cell) => cell.trim())
      .filter((cell) => cell.length > 0);
    let cronCell = null;
    let cronIndex = -1;
    for (let c = 0; c < cells.length; c++) {
      if (CRON_CELL_RE.test(cells[c])) {
        cronCell = cells[c].match(CRON_CELL_RE);
        cronIndex = c;
        break;
      }
    }
    if (!cronCell) continue;
    let hkt = null;
    let name = null;
    for (let c = 0; c < cells.length; c++) {
      if (c === cronIndex) continue;
      if (CLOCK_CELL_RE.test(cells[c])) {
        if (hkt === null) hkt = cells[c];
        continue;
      }
      if (name !== null) continue;
      const label = cells[c].match(/^\[`?([\w-]+)`?\]\([^)]+\)$/) || cells[c].match(/^`([\w-]+)`$/);
      if (label) name = label[1];
    }
    const parked = cells.some((cell) => /\bparked\b/i.test(cell));
    rows.push({
      name,
      cron: cells[cronIndex].replace(/^`|`$/g, ''),
      hour: Number(cronCell[2].split(',')[0]),
      minute: Number(cronCell[1]),
      hkt,
      parked,
      source,
      line: i + 1
    });
  }
  return rows;
}

/**
 * Rungs whose **forbidden** paths name a concrete file that is not on disk.
 *
 * `allowedPaths` and `forbiddenPaths` are both read as globs, so a path whose file has been renamed or
 * deleted stays perfectly valid, matches nothing, and stops meaning anything — but the two lists fail in
 * opposite directions, and only one of those directions is unsafe.
 *
 * **A stale `allowedPaths` entry grants nothing, which is the benign way to be wrong** — and it is a
 * legitimate pattern here, not always a bug: `canvas-graph-edit` has named
 * `apps/web/src/features/canvas/useCanvasGraphEdit.js` and its test since 2026-08-30 because that is the
 * file the `hook-rename` slice will *create* (`useFlowchartGraphEdit` → `useCanvasGraphEdit`), so the
 * budget pre-authorises the rename's own output. Measured on 2026-09-14: three of its 26 concrete
 * allowed paths were absent, two of them forward declarations and one a genuine extension typo. A
 * check that reports all three identically gets its matcher widened by the next agent who only wants CI
 * green — the failure `verify:doc-paths` documents as "a check that starts passing because it parses
 * nothing stops telling anybody anything".
 *
 * **A stale `forbiddenPaths` entry cannot be that.** There is no future file a don't-touch rule is
 * waiting for, so a missing path there means one of two things, both bad: the file it protected was
 * moved and the gate moved on without it, or the rule was written against a name that never existed.
 * Either way the rung is now free to touch something every other rung is told not to, and nothing
 * downstream notices — `prune` self-merging deletions from 2026-09-14 makes the first branch live
 * business, since a nightly run that removes a file can now retire another rung's safety rule by
 * accident. That asymmetry is the whole scope of this check: it validates one list and stays quiet
 * about the other.
 * @param {string} root
 * @returns {{ok: boolean, errors: string[], checkedCount: number}}
 */
export function verifyPlaybookPaths(root) {
  const errors = [];
  let checked = 0;
  for (const { name, playbook } of collectPlaybooks(root)) {
    const declared = playbook.forbiddenPaths;
    const list = Array.isArray(declared) ? declared : declared ? [declared] : [];
    for (const entry of list) {
      const pattern = String(entry).trim();
      // Globs and bare filenames are not what this looks for — only a repo-relative concrete path.
      if (!pattern.includes('/') || pattern.includes('*')) continue;
      checked++;
      if (fs.existsSync(path.join(root, pattern))) continue;
      errors.push(
        `${name}: forbiddenPaths names \`${pattern}\`, which is not on disk — that gate now ` +
          'blocks nothing. Either the file moved (point the rule at where it went) or it never existed ' +
          '(say so and delete the entry); an answer of "it will exist later" does not apply here'
      );
    }
  }
  return { ok: errors.length === 0, errors, checkedCount: checked };
}

/**
 * The ladder is declared in a playbook and copied into several tables. Nothing checked either copy
 * against the declaration until 2026-09-14, so the drift `digest` spends a nightly watchdog on was
 * invisible to CI — and `digest`'s own source (`claude -p '/schedule list'`) is capped at the newest
 * 20 routines, so it cannot see the oldest rungs at all. This is the repo-vs-repo half of that check;
 * only a live trigger can verify the repo-vs-cron half.
 * @param {string} root
 * @returns {{ok: boolean, errors: string[], rungCount: number, rowCheckCount: number}}
 */
export function verifyNightLadder(root) {
  /** @type {Map<string, {schedule: string, paused: boolean}>} playbook name -> ladder meta */
  const declared = new Map();
  for (const rel of collectRoutineDocs(root)) {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) continue;
    const { name, schedule, paused } = parsePlaybookSchedule(fs.readFileSync(abs, 'utf8'));
    if (!name || !schedule) continue;
    declared.set(name, { schedule, paused });
  }

  let activeRungCount = 0;
  for (const [name, meta] of declared) {
    if (meta.schedule === 'none' || OFF_LADDER_ROUTINES.has(name) || meta.paused) continue;
    activeRungCount++;
  }

  /** @type {string[]} */
  const errors = [];
  if (declared.size === 0) {
    return { ok: true, errors, rungCount: 0, rowCheckCount: 0 };
  }

  /** @type {Map<string, {name: string|null, cron: string, hour: number, minute: number, hkt: string|null, source: string, line: number}[]>} */
  const claimsBySource = new Map();
  const authorityRows = [];
  let authorityPresent = false;
  for (const rel of LADDER_TABLE_FILES) {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) continue;
    const rows = extractLadderTableRows(fs.readFileSync(abs, 'utf8'), rel);
    if (rel === LADDER_AUTHORITY) authorityPresent = true;
    if (rows.length === 0) continue;
    claimsBySource.set(rel, rows);
    if (rel === LADDER_AUTHORITY) authorityRows.push(...rows);
  }

  if (claimsBySource.size === 0) {
    errors.push(
      `no ladder table found in ${LADDER_TABLE_FILES.join(', ')} — ` +
        'a rung with a `schedule:` and no table row is a rung nobody can find'
    );
    return { ok: false, errors, rungCount: declared.size, rowCheckCount: 0 };
  }

  let rowChecks = 0;
  for (const [rel, rows] of claimsBySource) {
    for (const row of rows) {
      if (!row.name) {
        errors.push(`${rel}:${row.line} — a table row names cron \`${row.cron}\` but no routine`);
        continue;
      }
      const meta = declared.get(row.name);
      if (meta === undefined) {
        errors.push(
          `${rel}:${row.line} — table row for \`${row.name}\` matches no playbook ` +
            `(playbooks declare: ${[...declared.keys()].sort().join(', ')})`
        );
        continue;
      }
      rowChecks++;
      if (meta.paused && !row.parked) {
        errors.push(
          `${rel}:${row.line} — \`${row.name}\` declares \`paused:\` in its playbook but this table ` +
            'row is not marked parked (see `docs/routines/review.md` for the shipped marker form)'
        );
      }
      if (!meta.paused && row.parked) {
        errors.push(
          `${rel}:${row.line} — this table row marks \`${row.name}\` parked but its playbook has no ` +
            '`paused:` key — unpause in the playbook or drop the marker here'
        );
      }
      const schedule = meta.schedule;
      if (schedule === 'none') {
        errors.push(
          `${rel}:${row.line} — \`${row.name}\` is a ladder row with cron \`${row.cron}\`, but ` +
            'its playbook declares `schedule: none` (manual-only). Either the row is a lie or the ' +
            'rung was scheduled without editing the playbook.'
        );
        continue;
      }
      if (schedule !== row.cron) {
        errors.push(
          `${rel}:${row.line} — \`${row.name}\` is scheduled \`${row.cron}\` in this table but ` +
            `'${schedule}' in its playbook`
        );
      }
      if (row.hkt) {
        const expected = `${String((row.hour + HKT_OFFSET_HOURS) % 24).padStart(2, '0')}:${String(
          row.minute
        ).padStart(2, '0')}`;
        if (row.hkt !== expected) {
          errors.push(
            `${rel}:${row.line} — \`${row.name}\` shows HKT ${row.hkt} for cron \`${row.cron}\` ` +
              `(UTC), which is ${expected} in GMT+${HKT_OFFSET_HOURS}`
          );
        }
      }
    }
  }

  if (authorityPresent) {
    for (const row of authorityRows) {
      if (windowOffset(row.hour, row.minute) > NIGHT_WINDOW.spanMinutes) {
        errors.push(
          `${LADDER_AUTHORITY}:${row.line} — \`${row.name ?? '(unnamed)'}\` opens at ` +
            `\`${row.cron}\` UTC, outside the night ladder window (${WINDOW_LABEL} UTC). ` +
            'The ladder exists so the fleet runs while the owner is asleep; move the slot back, or ' +
            'take the rung off the ladder deliberately and say why in its playbook.'
        );
      }
    }
    for (const [name, meta] of declared) {
      if (meta.schedule === 'none' || OFF_LADDER_ROUTINES.has(name)) continue;
      const listed = authorityRows.some((row) => row.name === name);
      if (!listed) {
        errors.push(
          `${LADDER_AUTHORITY} — \`${name}\` declares schedule '${meta.schedule}' but has no ladder row. ` +
            'A scheduled rung that appears in no table is invisible to every reader who does not grep ' +
            'front-matter, and to `digest` watchdog 1.'
        );
      }
    }
  }

  let jobCountMatches = 0;
  for (const rel of LADDER_JOB_COUNT_FILES) {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) continue;
    const markdown = fs.readFileSync(abs, 'utf8');
    for (const match of markdown.matchAll(LADDER_JOB_COUNT_RE)) {
      jobCountMatches++;
      const stated = parseLadderJobCountToken(match[1]);
      if (stated === null) {
        errors.push(
          `${rel} — ladder job count \`${match[1]}\` is not a digit or a known English number word`
        );
        continue;
      }
      if (stated !== activeRungCount) {
        errors.push(
          `${rel} — says ${stated} jobs run on the night ladder but ${activeRungCount} rungs are ` +
            'unpaused (count playbooks with a `schedule:` minus `paused:` and off-ladder rungs like `deps`)'
        );
      }
    }
  }
  if (jobCountMatches === 0) {
    errors.push(
      `${LADDER_JOB_COUNT_FILES.join(', ')} — no "… jobs run between" ladder count found; ` +
        'the job-count sensor had nothing to check'
    );
  }

  return {
    ok: errors.length === 0,
    errors,
    rungCount: declared.size,
    activeRungCount,
    rowCheckCount: rowChecks
  };
}

/**
 * @param {string} root
 * @param {string[]} [docFiles]
 */
export function verifyAgentInfra(root, docFiles = null) {
  const files = docFiles ?? [
    ...AGENT_DOC_FILES,
    ...PLAYBOOK_DOC_DIRS.map((dirRel) => `${dirRel}/README.md`),
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

  const ladder = verifyNightLadder(root);
  const budgets = verifyPlaybookPaths(root);

  return {
    ok: missingScripts.length === 0 && missingTests.length === 0 && ladder.ok && budgets.ok,
    missingScripts,
    missingTests,
    scriptCount: checkedScripts.size,
    testPathCount: checkedTests.size,
    ladder,
    budgets
  };
}

function main() {
  const result = verifyAgentInfra(ROOT);
  if (result.ok) {
    console.log(
      `verify:agent-infra: OK (${result.scriptCount} npm script(s), ${result.testPathCount} blast-radius test path(s), ` +
        `night ladder: ${result.ladder.rungCount} scheduled rung(s) agreed across ${result.ladder.rowCheckCount} table row(s), ` +
        `${result.budgets.checkedCount} forbidden-path gate(s) still pointing at a real file)`
    );
    return;
  }
  for (const miss of result.missingScripts) {
    console.error(`  missing npm script "${miss.script}" (cited in ${miss.source})`);
  }
  for (const miss of result.missingTests) {
    console.error(`  missing blast-radius test "${miss.path}" (cited in ${miss.source})`);
  }
  for (const problem of result.ladder.errors) {
    console.error(`  night ladder: ${problem}`);
  }
  for (const problem of result.budgets.errors) {
    console.error(`  budget gate: ${problem}`);
  }
  process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
