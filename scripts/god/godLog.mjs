#!/usr/bin/env node
/**
 * Read the `god-log` data branch for cadence and for the history the harness may see.
 *
 *   node scripts/god/godLog.mjs --root god-log --github-output --history-out god-run/history.json
 *
 * History written for the harness has `hypothesis` cleared. That sentence is owner-facing only
 * and is never fed back into a prompt (GodRunRecordSchema).
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { GodRunRecordSchema } from '@archislop/shared/godSchemas.js';

/** Verdicts that mean the harness actually started. Noop and blocked ticks did not. */
export const ACT_VERDICTS = new Set([
  'observed',
  'pr_opened',
  'revert_opened',
  'red',
  'failed',
  'stopped'
]);

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
 * @param {string} runsDir
 * @returns {import('@archislop/shared/godSchemas.js').GodRunRecord[]}
 */
function loadHistory(runsDir) {
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
  return promptSafeHistory(records.slice(-HISTORY_MAX));
}

/**
 * @param {string} root god-log checkout (may be missing)
 * @param {{ now?: Date }} [opts]
 * @returns {{ lastActAt: string | null, monthSpendUsd: number, history: import('@archislop/shared/godSchemas.js').GodRunRecord[] }}
 */
export function readGodLogState(root, opts = {}) {
  const now = opts.now ?? new Date();
  const month = now.toISOString().slice(0, 7);
  const indexDir = path.join(root, 'index');
  let lastMs = null;
  /** @type {string | null} */
  let lastActAt = null;
  let monthSpendUsd = 0;

  if (fs.existsSync(indexDir)) {
    for (const name of fs.readdirSync(indexDir)) {
      if (!name.endsWith('.json')) continue;
      let idx;
      try {
        idx = JSON.parse(fs.readFileSync(path.join(indexDir, name), 'utf8'));
      } catch {
        continue;
      }
      const rows = Array.isArray(idx?.runs) ? idx.runs : [];
      const fileMonth = typeof idx?.month === 'string' ? idx.month : name.slice(0, 7);
      for (const row of rows) {
        if (!row || typeof row !== 'object') continue;
        if (fileMonth === month) {
          const usd = Number(row.usd);
          if (Number.isFinite(usd) && usd > 0) monthSpendUsd += usd;
        }
        if (!ACT_VERDICTS.has(row.verdict)) continue;
        const iso = typeof row.startedAt === 'string' ? row.startedAt : row.endedAt;
        const ms = Date.parse(String(iso ?? ''));
        if (!Number.isFinite(ms)) continue;
        if (lastMs == null || ms > lastMs) {
          lastMs = ms;
          lastActAt = new Date(ms).toISOString();
        }
      }
    }
  }

  return {
    lastActAt,
    monthSpendUsd: Math.round(monthSpendUsd * 1e6) / 1e6,
    history: loadHistory(path.join(root, 'runs'))
  };
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
      'github-output': { type: 'boolean', default: false }
    }
  });
  return values;
}

export function main(argv = process.argv.slice(2)) {
  const values = parseCli(argv);
  const now = values.now ? new Date(values.now) : new Date();
  if (Number.isNaN(now.getTime())) throw new Error(`invalid --now ${values.now}`);
  const state = readGodLogState(path.resolve(values.root), { now });
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
