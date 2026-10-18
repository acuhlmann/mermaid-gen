#!/usr/bin/env node
/**
 * ArchiSlop God's synthetic probes (ADR-0019): God's own traffic, for when production is too thin.
 *
 *   node scripts/god/probe.mjs --key-file "$KEY_FILE" --run-id 123 --tick-max-usd 1 \
 *     --out "$OUT/probe.json"
 *
 * Boots the real server from source, points its DeepSeek client at the meter proxy (so the key never
 * reaches the server process and spend stops at `PROBE_MAX_USD`), sends every prompt in
 * `probeCorpus.mjs` through `POST /api/copilotkit/intent` from an empty canvas, and reads back the
 * `agent_turn` lines the agents already emit with `MERMAID_METRICS=1`. The output is counts per slot
 * plus what the run cost — `GodProbeSummarySchema`, nothing a prompt or a model wrote.
 *
 * Two kinds of failure are deliberately **not** product evidence, because they measure God's own
 * plumbing: a turn whose model call failed in transport (`errorClass: invoke-error`), and every turn
 * of a run the money cap cut short. Counting either would hand God a finding about its budget.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { GOD_HARD_LIMITS } from '@archislop/shared/godBudget.js';
import { GodProbeSummarySchema } from '@archislop/shared/godSchemas.js';
import { startMeterProxy, DEFAULT_UPSTREAM } from './meterProxy.mjs';
import { PROBE_CORPUS } from './probeCorpus.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** One probe run's ceiling. Taken out of the tick's per-run cap, never added to it. */
export const PROBE_MAX_USD = 0.25;
/** Longer than a full repair ladder, and longer than the server's own retries on a dead upstream. */
export const PROBE_TURN_TIMEOUT_MS = 240_000;
export const PROBE_CONCURRENCY = 4;
const SERVER_READY_TIMEOUT_MS = 180_000;
/** Transport failure: the model call never came back. Says nothing about the slot. */
const TRANSPORT_ERROR_CLASS = 'invoke-error';

/**
 * What a probe may spend out of the tick's per-run cap (the gate's `max_usd`, already shrunk to the
 * month's remainder). Whatever it leaves must still be a usable act budget, so the act's floor
 * (`minUsdPerRun`) is held back first: probes never starve the harness of the minimum it needs, and
 * probe plus act together never exceed the tick's cap.
 *
 * @param {unknown} tickMaxUsd
 */
export function probeBudget(tickMaxUsd) {
  const tick = Number(tickMaxUsd);
  if (!Number.isFinite(tick)) return 0;
  const room = tick - GOD_HARD_LIMITS.minUsdPerRun;
  return Math.max(0, Math.round(Math.min(PROBE_MAX_USD, room) * 100) / 100);
}

/**
 * `agent_turn` lines out of the server's stdout. Anything else the server prints is ignored.
 *
 * @param {string} text
 * @returns {Array<{ contentType: string, accepted: boolean, repairAttempts: number, errorClass: string | null }>}
 */
export function parseAgentTurnLines(text) {
  const turns = [];
  for (const line of String(text ?? '').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) continue;
    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (!parsed || parsed.tag !== 'agent_turn' || typeof parsed.contentType !== 'string') continue;
    turns.push({
      contentType: parsed.contentType,
      accepted: parsed.accepted === true,
      repairAttempts: Math.max(0, Math.round(Number(parsed.repairAttempts) || 0)),
      errorClass: typeof parsed.errorClass === 'string' ? parsed.errorClass : null
    });
  }
  return turns;
}

/**
 * Fold one run into the summary the run record keeps.
 *
 * `turns` per slot is the cases that produced a product verdict: a case sent but answered by no
 * `agent_turn` line (it timed out, or the server died) counts as a turn that was not accepted —
 * a probe that hangs is a slot that hangs. Transport failures are removed from both sides.
 *
 * @param {{
 *   cases: ReadonlyArray<{ contentType: string }>,
 *   turns: ReturnType<typeof parseAgentTurnLines>,
 *   usd: number,
 *   capped?: boolean
 * }} input
 * @returns {import('@archislop/shared/godSchemas.js').GodProbeSummary}
 */
export function summarizeProbe({ cases, turns, usd, capped = false }) {
  const spent = Math.round(Math.max(0, Number(usd) || 0) * 1e6) / 1e6;
  if (capped) return GodProbeSummarySchema.parse({ turns: 0, usd: spent, slots: [] });

  /** @type {Map<string, { contentType: string, turns: number, accepted: number, repairAttempts: number }>} */
  const bySlot = new Map();
  for (const c of cases) {
    const slot = bySlot.get(c.contentType) ?? {
      contentType: c.contentType,
      turns: 0,
      accepted: 0,
      repairAttempts: 0
    };
    slot.turns += 1;
    bySlot.set(c.contentType, slot);
  }
  for (const turn of turns) {
    const slot = bySlot.get(turn.contentType);
    if (!slot) continue;
    if (turn.errorClass === TRANSPORT_ERROR_CLASS) {
      slot.turns = Math.max(0, slot.turns - 1);
      continue;
    }
    if (turn.accepted && slot.accepted < slot.turns) slot.accepted += 1;
    slot.repairAttempts += turn.repairAttempts;
  }
  const slots = [...bySlot.values()].filter((s) => s.turns > 0);
  return GodProbeSummarySchema.parse({
    turns: slots.reduce((sum, s) => sum + s.turns, 0),
    usd: spent,
    slots
  });
}

/**
 * The server's environment: only what it needs to run, plus the proxy in place of DeepSeek. The
 * runner's own environment (secrets of other jobs, cloud credentials) is not inherited.
 *
 * @param {{ port: number, proxyBaseUrl: string, clientToken: string, base?: NodeJS.ProcessEnv }} opts
 */
export function probeServerEnv({ port, proxyBaseUrl, clientToken, base = process.env }) {
  /** @type {Record<string, string>} */
  const env = {};
  for (const key of ['PATH', 'HOME', 'TMPDIR', 'LANG']) {
    if (base[key]) env[key] = String(base[key]);
  }
  return {
    ...env,
    PORT: String(port),
    MERMAID_METRICS: '1',
    LLM_PROVIDER: 'deepseek',
    DEEPSEEK_API_KEY: clientToken,
    DEEPSEEK_API_BASE: proxyBaseUrl,
    // Probes are one client sending a burst; the per-IP limiter is for visitors.
    API_LLM_RATE_LIMIT_MAX: '1000',
    UX_SIGNALS: '0'
  };
}

/**
 * @param {string} baseUrl
 * @param {{ contentType: string, prompt: string }} entry
 * @param {string} sessionId
 * @param {{ fetchImpl?: typeof fetch, timeoutMs?: number }} [opts]
 */
export async function sendProbe(baseUrl, entry, sessionId, opts = {}) {
  const fetchImpl = opts.fetchImpl ?? fetch;
  try {
    const res = await fetchImpl(`${baseUrl}/api/copilotkit/intent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-session-id': sessionId },
      body: JSON.stringify({
        prompt: entry.prompt,
        revisionId: 0,
        diagramSource: '',
        contentType: entry.contentType,
        modelProfile: 'fast'
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? PROBE_TURN_TIMEOUT_MS)
    });
    await res.text();
    return { status: res.status };
  } catch (error) {
    return { status: 0, error: String(error?.name ?? 'error') };
  }
}

/**
 * Run `fn` over `items` with at most `limit` in flight, in order of start.
 *
 * @template T
 * @param {ReadonlyArray<T>} items
 * @param {number} limit
 * @param {(item: T, index: number) => Promise<void>} fn
 */
async function eachLimited(items, limit, fn) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      await fn(items[index], index);
    }
  });
  await Promise.all(workers);
}

async function waitForReady(baseUrl, child, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode != null) throw new Error(`server exited early (${child.exitCode})`);
    try {
      const res = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(2_000) });
      const body = await res.json();
      if (body?.runtimeReady === true) return;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error('server never became ready');
}

/**
 * @param {{
 *   runId: string,
 *   keyFile?: string,
 *   apiKey?: string,
 *   upstream?: string,
 *   tickMaxUsd: number,
 *   port?: number,
 *   corpus?: ReadonlyArray<{ id: string, contentType: string, prompt: string }>,
 *   concurrency?: number,
 *   log?: (line: string) => void
 * }} options
 */
export async function runProbe(options) {
  const corpus = options.corpus ?? PROBE_CORPUS;
  const maxUsd = probeBudget(options.tickMaxUsd);
  const log = options.log ?? ((line) => process.stderr.write(`${line}\n`));
  if (!(maxUsd > 0)) return summarizeProbe({ cases: [], turns: [], usd: 0 });

  const proxy = await startMeterProxy({
    keyFile: options.keyFile,
    apiKey: options.apiKey,
    upstream: options.upstream ?? DEFAULT_UPSTREAM,
    maxUsd
  });
  const port = options.port ?? 4100 + Math.floor(Math.random() * 800);
  const baseUrl = `http://127.0.0.1:${port}`;
  let stdout = '';
  const child = spawn(
    process.execPath,
    [
      '--import',
      './scripts/register-antv-layout-esm.mjs',
      '--import',
      'tsx',
      'apps/server/src/index.js'
    ],
    {
      cwd: REPO_ROOT,
      env: probeServerEnv({ port, proxyBaseUrl: proxy.baseUrl, clientToken: proxy.clientToken }),
      stdio: ['ignore', 'pipe', 'pipe']
    }
  );
  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString('utf8');
  });
  child.stderr.on('data', () => {});

  /** @type {Array<{ id: string, contentType: string }>} */
  const sent = [];
  try {
    await waitForReady(baseUrl, child, SERVER_READY_TIMEOUT_MS);
    await eachLimited(corpus, options.concurrency ?? PROBE_CONCURRENCY, async (entry, index) => {
      // Stop dispatching once the cap is spent: a case started after it would measure the 402.
      if (proxy.stopReason() === 'budget') return;
      sent.push({ id: entry.id, contentType: entry.contentType });
      const result = await sendProbe(baseUrl, entry, `god-probe-${options.runId}-${index}`);
      log(`probe ${entry.id}: HTTP ${result.status}`);
    });
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => {
      if (child.exitCode != null) resolve();
      else child.once('exit', resolve);
    });
    await proxy.close();
  }

  return summarizeProbe({
    cases: sent,
    turns: parseAgentTurnLines(stdout),
    usd: proxy.usage().usd,
    capped: proxy.stopReason() === 'budget'
  });
}

function parseCli(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      'run-id': { type: 'string' },
      'key-file': { type: 'string' },
      upstream: { type: 'string' },
      'tick-max-usd': { type: 'string' },
      out: { type: 'string' }
    }
  });
  if (!values.out) throw new Error('--out is required');
  if (!values['run-id']) throw new Error('--run-id is required');
  if (!values['tick-max-usd']) throw new Error('--tick-max-usd is required');
  return values;
}

export async function main(argv = process.argv.slice(2)) {
  const values = parseCli(argv);
  const summary = await runProbe({
    runId: values['run-id'],
    keyFile: values['key-file'],
    upstream: values.upstream,
    tickMaxUsd: Number(values['tick-max-usd'])
  });
  fs.mkdirSync(path.dirname(path.resolve(values.out)), { recursive: true });
  fs.writeFileSync(values.out, `${JSON.stringify(summary, null, 2)}\n`);
  return summary;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
    .then((summary) => process.stdout.write(`${JSON.stringify(summary)}\n`))
    .catch((error) => {
      process.stderr.write(`god probe: ${error?.message ?? error}\n`);
      process.exitCode = 1;
    });
}
