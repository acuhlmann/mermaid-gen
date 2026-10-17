#!/usr/bin/env node
/**
 * Read and fold the `god-log` data branch (ADR-0019 §8) — cadence, monthly spend, and the history
 * the harness may see.
 *
 *   node scripts/god/godLog.mjs --root god-log --github-output --history-out god-run/history.json
 *   node scripts/god/godLog.mjs --root god-log --merge-tick-dir "$RUNNER_TEMP/god-tick"
 *
 * History written for the harness has `hypothesis` cleared. That sentence is owner-facing only
 * and is never fed back into a prompt (GodRunRecordSchema).
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { GOD_ACT_VERDICTS, GodRunRecordSchema } from '@archislop/shared/godSchemas.js';

/**
 * Verdicts that mean the harness actually started. Single source with the owner's status view, so the
 * two cannot disagree about which tick counts as an act.
 */
export const ACT_VERDICTS = new Set(GOD_ACT_VERDICTS);

const HISTORY_MAX = 50;

/**
 * Accept an array, or the older `{ records: [] }` object brief.mjs used to write.
 * Always returns records with `hypothesis` null, so a caller can rewrite the file the model reads.
 *
 * @param {unknown} raw
 * @returns {import('@archislop/shared/godSchemas.js').GodRunRecord[]}
 */
export function promptSafeHistory(raw) {
  const records = Array.isArray(raw)
    ? raw
    : raw &&
        typeof raw === 'object' &&
        Array.isArray(/** @type {{ records?: unknown }} */ (raw).records)
      ? /** @type {{ records: unknown[] }} */ (raw).records
      : null;
  if (!records) throw new Error('history must be an array of run records');
  if (records.length > HISTORY_MAX) throw new Error('history must be ≤50 runs');
  return records.map((record) => {
    const parsed = GodRunRecordSchema.parse(record);
    return { ...parsed, hypothesis: null };
  });
}

/**
 * Every run record on the branch, uncapped. `runs/<runId>.json` is the durable store: one file per
 * tick, written by `recordTick.mjs` and never rewritten by a later tick.
 *
 * @param {string} runsDir
 * @returns {import('@archislop/shared/godSchemas.js').GodRunRecord[]}
 */
export function loadRunRecords(runsDir) {
  if (!fs.existsSync(runsDir)) return [];
  /** @type {import('@archislop/shared/godSchemas.js').GodRunRecord[]} */
  const records = [];
  for (const name of fs.readdirSync(runsDir)) {
    if (!name.endsWith('.json')) continue;
    try {
      const parsed = GodRunRecordSchema.parse(
        JSON.parse(fs.readFileSync(path.join(runsDir, name), 'utf8'))
      );
      records.push(parsed);
    } catch {
      // One bad file must not stop the gate. The next act still has a cadence.
    }
  }
  records.sort((a, b) => a.endedAt.localeCompare(b.endedAt));
  return records;
}

/**
 * The last `HISTORY_MAX` records, with `hypothesis` cleared — the only history the harness sees.
 *
 * @param {import('@archislop/shared/godSchemas.js').GodRunRecord[]} records
 */
function loadHistory(records) {
  return promptSafeHistory(records.slice(-HISTORY_MAX));
}

/**
 * The authoritative numbers for one month, from the run records.
 *
 * Both the gate (via `deriveCadence`) and the owner's status view read these. The view can only list
 * what the rollup file carries, and the rollup's rows proved truncatable — so the fold step computes
 * the truth from `runs/*.json` while it has the whole branch checked out and stamps it on the file.
 *
 * @param {import('@archislop/shared/godSchemas.js').GodRunRecord[]} records
 * @param {string} month `YYYY-MM`
 */
export function monthTotals(records, month) {
  let ticks = 0;
  let acts = 0;
  let spend = 0;
  let lastMs = null;
  /** @type {string | null} */
  let lastActAt = null;

  for (const record of records) {
    if (record.endedAt.slice(0, 7) !== month) continue;
    ticks += 1;
    const usd = Number(record.usage?.usd);
    if (Number.isFinite(usd) && usd > 0) spend += usd;
    if (!ACT_VERDICTS.has(record.verdict)) continue;
    acts += 1;
    const ms = Date.parse(record.startedAt);
    if (!Number.isFinite(ms)) continue;
    if (lastMs == null || ms > lastMs) {
      lastMs = ms;
      lastActAt = new Date(ms).toISOString();
    }
  }

  return { ticks, acts, monthSpendUsd: round6(spend), lastActAt };
}

function round6(value) {
  return Math.round(value * 1e6) / 1e6;
}

/**
 * Cadence and spend for the gate, derived from run records.
 *
 * Deliberately **not** read from `index/*.json` rows: the index is a rollup a bad merge can rewrite,
 * and a rollup is not something to hang the monthly money cap (`GOD_MAX_USD_PER_MONTH`) or the
 * `GOD_EVERY_HOURS` cadence on. A 2026-10 tick clobbered the month file with its own single row — 54
 * run records, one index row.
 *
 * The two numbers have different scopes, and mixing them up breaks a rail: spend is per-month (it is
 * what the monthly cap measures), but the last act is **all-time**. Scoping the act to the month would
 * reset `GOD_EVERY_HOURS` to "God has never acted" at every month boundary and let it spend again
 * immediately after midnight on the 1st.
 *
 * @param {import('@archislop/shared/godSchemas.js').GodRunRecord[]} records
 * @param {string} month `YYYY-MM`
 * @returns {{ lastActAt: string | null, monthSpendUsd: number }}
 */
export function deriveCadence(records, month) {
  const { monthSpendUsd } = monthTotals(records, month);

  let lastMs = null;
  /** @type {string | null} */
  let lastActAt = null;
  for (const record of records) {
    if (!ACT_VERDICTS.has(record.verdict)) continue;
    const ms = Date.parse(record.startedAt);
    if (!Number.isFinite(ms)) continue;
    if (lastMs == null || ms > lastMs) {
      lastMs = ms;
      lastActAt = new Date(ms).toISOString();
    }
  }

  return { lastActAt, monthSpendUsd };
}

/**
 * @param {string} root god-log checkout (may be missing)
 * @param {{ now?: Date }} [opts]
 * @returns {{ lastActAt: string | null, monthSpendUsd: number, history: import('@archislop/shared/godSchemas.js').GodRunRecord[] }}
 */
export function readGodLogState(root, opts = {}) {
  const now = opts.now ?? new Date();
  const month = now.toISOString().slice(0, 7);
  const records = loadRunRecords(path.join(root, 'runs'));
  const { lastActAt, monthSpendUsd } = deriveCadence(records, month);

  return {
    lastActAt,
    monthSpendUsd,
    history: loadHistory(records)
  };
}

/**
 * Fold one tick's `recordTick.mjs` output into the god-log branch, idempotently.
 *
 * `runs/` is a straight copy (a runId file is written once). `index/` is unioned by runId: the
 * incoming file holds only this tick's row, so overwriting the branch file would drop every earlier
 * row of the month — which is exactly what the pre-2026-10-17 workflow did by `cp`-ing before it
 * merged. Order matters here and is now enforced by this function instead of a shell heredoc.
 *
 * @param {{ destRoot: string, tickDir: string }} input
 * @returns {{ runsCopied: number, index: Record<string, number> }}
 */
export function mergeGodLogTick(input) {
  const destRoot = path.resolve(input.destRoot);
  const tickDir = path.resolve(input.tickDir);
  const destRuns = path.join(destRoot, 'runs');
  const destIndex = path.join(destRoot, 'index');
  fs.mkdirSync(destRuns, { recursive: true });
  fs.mkdirSync(destIndex, { recursive: true });

  const srcRuns = path.join(tickDir, 'runs');
  let runsCopied = 0;
  if (fs.existsSync(srcRuns)) {
    for (const name of fs.readdirSync(srcRuns)) {
      if (!name.endsWith('.json')) continue;
      fs.copyFileSync(path.join(srcRuns, name), path.join(destRuns, name));
      runsCopied += 1;
    }
  }

  /** @type {Record<string, number>} */
  const index = {};
  const srcIndex = path.join(tickDir, 'index');
  if (fs.existsSync(srcIndex)) {
    for (const name of fs.readdirSync(srcIndex)) {
      if (!name.endsWith('.json')) continue;
      let incoming;
      try {
        incoming = JSON.parse(fs.readFileSync(path.join(srcIndex, name), 'utf8'));
      } catch {
        continue;
      }
      const month =
        typeof incoming?.month === 'string' ? incoming.month : name.replace('.json', '');
      const dest = path.join(destIndex, name);
      /** @type {{ v: number, month: string, runs: object[] }} */
      let base = { v: 1, month, runs: [] };
      if (fs.existsSync(dest)) {
        try {
          const existing = JSON.parse(fs.readFileSync(dest, 'utf8'));
          if (existing && Array.isArray(existing.runs)) base = existing;
        } catch {
          // A corrupt rollup is rebuilt from this tick rather than blocking the push.
        }
      }
      const seen = new Set(base.runs.map((row) => row?.runId));
      for (const row of Array.isArray(incoming?.runs) ? incoming.runs : []) {
        if (row && !seen.has(row.runId)) {
          base.runs.push(row);
          seen.add(row.runId);
        }
      }
      base.runs.sort((a, b) =>
        String(a?.startedAt ?? '').localeCompare(String(b?.startedAt ?? ''))
      );
      fs.writeFileSync(dest, `${JSON.stringify(base, null, 2)}\n`);
      index[month] = base.runs.length;
    }
  }

  /**
   * Stamp the authoritative month numbers from `runs/*.json` onto every rollup on the branch.
   *
   * This is the only moment the true totals can be computed: the fold has the whole branch checked
   * out, while the owner's status view can read exactly one file per month and cannot list `runs/`
   * over raw HTTPS. Without the stamp, a rollup whose rows were truncated reports a smaller month —
   * including its spend — and nothing notices.
   *
   * Previous months are re-stamped too, so a month whose files were truncated before this landed
   * reports its real totals again. Writing only on change keeps an hourly tick from churning files
   * whose numbers have not moved.
   */
  const records = loadRunRecords(destRuns);
  /** @type {Record<string, object>} */
  const stamped = {};
  for (const name of fs.readdirSync(destIndex)) {
    if (!name.endsWith('.json')) continue;
    const file = path.join(destIndex, name);
    /** @type {{ month?: string, totals?: object } | null} */
    let doc = null;
    try {
      doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      continue;
    }
    if (!doc) continue;
    const month = typeof doc.month === 'string' ? doc.month : name.replace('.json', '');
    const totals = monthTotals(records, month);
    if (JSON.stringify(doc.totals ?? null) === JSON.stringify(totals)) continue;
    doc.totals = totals;
    fs.writeFileSync(file, `${JSON.stringify(doc, null, 2)}\n`);
    stamped[month] = totals;
  }

  return { runsCopied, index, stamped };
}

/**
 * @param {ReturnType<typeof readGodLogState>} state
 * @param {string | null} [outputPath]
 */
export function writeGodLogOutputs(state, outputPath = process.env.GITHUB_OUTPUT ?? null) {
  const lines = [`last_act_at=${state.lastActAt ?? ''}`, `month_spend=${state.monthSpendUsd}`];
  if (outputPath) fs.appendFileSync(outputPath, `${lines.join('\n')}\n`);
  return lines;
}

function parseCli(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      root: { type: 'string', default: 'god-log' },
      now: { type: 'string' },
      'history-out': { type: 'string' },
      'merge-tick-dir': { type: 'string' },
      'github-output': { type: 'boolean', default: false }
    }
  });
  return values;
}

export function main(argv = process.argv.slice(2)) {
  const values = parseCli(argv);
  const root = path.resolve(values.root);
  if (values['merge-tick-dir']) {
    const merged = mergeGodLogTick({ destRoot: root, tickDir: values['merge-tick-dir'] });
    process.stdout.write(`${JSON.stringify(merged, null, 2)}\n`);
    return merged;
  }
  const now = values.now ? new Date(values.now) : new Date();
  if (Number.isNaN(now.getTime())) throw new Error(`invalid --now ${values.now}`);
  const state = readGodLogState(root, { now });
  if (values['history-out']) {
    const out = path.resolve(values['history-out']);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, `${JSON.stringify(state.history, null, 2)}\n`);
  }
  if (values['github-output']) writeGodLogOutputs(state);
  process.stdout.write(
    `${JSON.stringify({
      lastActAt: state.lastActAt,
      monthSpendUsd: state.monthSpendUsd,
      history: state.history.length
    })}\n`
  );
  return state;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`god log: ${error?.message ?? error}\n`);
    process.exitCode = 1;
  }
}
