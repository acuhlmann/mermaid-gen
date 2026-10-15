#!/usr/bin/env node
/**
 * Write one no-LLM god-log tick record (ADR-0019 stage 2b).
 *
 *   node scripts/god/recordTick.mjs --out-dir . --run-id 123 --reason disabled --tier observe
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { GodRunRecordSchema } from '@archislop/shared/godSchemas.js';

function parseCli(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      'out-dir': { type: 'string', default: '.' },
      'run-id': { type: 'string' },
      reason: { type: 'string', default: 'disabled' },
      tier: { type: 'string', default: 'observe' },
      focus: { type: 'string', default: 'any' },
      go: { type: 'string', default: 'false' },
      trigger: { type: 'string', default: 'schedule' },
      now: { type: 'string' }
    }
  });
  if (!values['run-id']) throw new Error('--run-id is required');
  return values;
}

/**
 * @param {ReturnType<typeof parseCli>} values
 */
export function buildTickRecord(values) {
  const now = values.now ? new Date(values.now) : new Date();
  if (Number.isNaN(now.getTime())) throw new Error(`invalid --now ${values.now}`);
  const iso = now.toISOString();
  const go = values.go === 'true' || values.go === '1';
  const verdict = go ? 'observed' : 'noop';
  return GodRunRecordSchema.parse({
    v: 1,
    runId: String(values['run-id']),
    startedAt: iso,
    endedAt: iso,
    trigger: values.trigger === 'manual' ? 'manual' : 'schedule',
    tier: values.tier,
    focus: values.focus,
    verdict,
    stopReason: 'completed',
    findingId: null,
    hypothesis: null,
    pr: null,
    branch: null,
    filesChanged: [],
    usage: { calls: 0, inputTokens: 0, outputTokens: 0, cacheHitTokens: 0, usd: 0 },
    minutes: 0,
    balanceAfter: null,
    harness: { name: 'mock', version: '0.0.0' }
  });
}

export function main(argv = process.argv.slice(2)) {
  const values = parseCli(argv);
  const record = buildTickRecord(values);
  const outDir = path.resolve(values['out-dir']);
  const runsDir = path.join(outDir, 'runs');
  const indexDir = path.join(outDir, 'index');
  fs.mkdirSync(runsDir, { recursive: true });
  fs.mkdirSync(indexDir, { recursive: true });
  const runPath = path.join(runsDir, `${record.runId}.json`);
  fs.writeFileSync(runPath, `${JSON.stringify(record, null, 2)}\n`);

  const month = record.endedAt.slice(0, 7);
  const idxPath = path.join(indexDir, `${month}.json`);
  /** @type {{ v: number, month: string, runs: object[] }} */
  let idx = { v: 1, month, runs: [] };
  if (fs.existsSync(idxPath)) {
    try {
      idx = JSON.parse(fs.readFileSync(idxPath, 'utf8'));
    } catch {
      idx = { v: 1, month, runs: [] };
    }
  }
  if (!Array.isArray(idx.runs)) idx.runs = [];
  idx.runs.push({
    runId: record.runId,
    endedAt: record.endedAt,
    verdict: record.verdict,
    tier: record.tier,
    usd: 0,
    gateReason: values.reason
  });
  fs.writeFileSync(idxPath, `${JSON.stringify(idx, null, 2)}\n`);
  return { record, runPath, idxPath };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = main();
    process.stdout.write(
      `${JSON.stringify({ runId: result.record.runId, verdict: result.record.verdict }, null, 2)}\n`
    );
  } catch (error) {
    process.stderr.write(`god recordTick: ${error?.message ?? error}\n`);
    process.exitCode = 1;
  }
}
