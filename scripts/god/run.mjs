#!/usr/bin/env node
/**
 * The ArchiSlop God run wrapper (ADR-0019): one bounded harness session.
 *
 *   node scripts/god/run.mjs --harness dsh --tier observe --key-file "$KEY_FILE" --out-dir "$OUT"
 *   node scripts/god/run.mjs --harness mock --upstream http://127.0.0.1:9999 --key-file k --out-dir o
 *   node scripts/god/run.mjs --spike …          (the harness self-test; exits 3 on no-go)
 *
 * Starts the meter proxy (money cap + key isolation), starts the harness with a sandbox chosen by
 * tier (observe → read-only, otherwise workspace-write), enforces the wall clock by killing the
 * harness's process group, streams sanitized live events to the owner's window, and writes
 * `report.json`, `meter.json` and `events.ndjson` to the output directory. It never touches git:
 * committing, checking and publishing are later workflow jobs that hold the credentials this
 * process must never see.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { GOD_HARD_LIMITS } from '@archislop/shared/godBudget.js';
import { GodBriefSchema, GodFocusSchema, GodTierSchema } from '@archislop/shared/godSchemas.js';
import { startMeterProxy, DEFAULT_UPSTREAM } from './meterProxy.mjs';
import { promptSafeHistory } from './godLog.mjs';
import { createLiveEventStream } from './liveEvents.mjs';
import { createIngestClient } from './ingestClient.mjs';
import { startDsh, dshVersion, isProcessGroupAlive, readDshVersions } from './harness/dsh.mjs';
import { startMock, MOCK_VERSION } from './harness/mock.mjs';
import { buildSpikeTask, evaluateSpike, SPIKE_MAX_MINUTES, SPIKE_MAX_USD } from './spike.mjs';

/** Minutes held back from the harness for the jobs that follow it. */
export const WRAPPER_RESERVE_MINUTES = 5;
const KILL_GRACE_MS = 10_000;

/**
 * The loader prompt. Like every rung's trigger, it names the files that are authoritative and adds
 * nothing of its own; tier and focus are validated enums, the paths are the runner's own.
 */
export function buildTaskText({ tier, focus, briefPath, historyPath }) {
  GodTierSchema.parse(tier);
  GodFocusSchema.parse(focus);
  return [
    `Run the feature automation \`god\`, tier \`${tier}\`, focus \`${focus}\`.`,
    'Read docs/automations/README.md (the contract), docs/automations/god.md (the playbook) and',
    `docs/automations/ledger/god.md (durable memory), then ${briefPath} and ${historyPath}`,
    "(this run's evidence). Follow them exactly; this message adds nothing."
  ].join('\n');
}

/** Observe is read-only all the way down: the sandbox refuses every write. */
export function permissionModeForTier(tier) {
  return tier === 'observe' ? 'read-only' : 'workspace-write';
}

function readSecretFile(file) {
  if (!file) return null;
  const value = fs.readFileSync(file, 'utf8').trim();
  fs.rmSync(file, { force: true });
  return value || null;
}

function validateInputs({ briefPath, historyPath }) {
  if (briefPath) GodBriefSchema.parse(JSON.parse(fs.readFileSync(briefPath, 'utf8')));
  if (historyPath) {
    // Rewrite in place so the file the harness reads cannot carry a prior hypothesis.
    const safe = promptSafeHistory(JSON.parse(fs.readFileSync(historyPath, 'utf8')));
    fs.writeFileSync(historyPath, `${JSON.stringify(safe, null, 2)}\n`);
  }
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, Number(value)));
}

/**
 * @param {{
 *   runId: string,
 *   tier: 'observe' | 'propose' | 'ship',
 *   focus?: string,
 *   harness?: 'dsh' | 'mock',
 *   cwd?: string,
 *   outDir: string,
 *   briefPath?: string,
 *   historyPath?: string,
 *   keyFile?: string,
 *   apiKey?: string,
 *   upstream?: string,
 *   maxUsd: number,
 *   maxMinutes: number,
 *   harnessTimeoutMs?: number,
 *   model?: string,
 *   ingestUrl?: string,
 *   ingestSecretFile?: string,
 *   installDir?: string,
 *   dshEntry?: string,
 *   spike?: boolean,
 *   spikeOutsidePath?: string,
 *   mockScript?: ReadonlyArray<Record<string, unknown>>,
 *   fetchImpl?: typeof fetch
 * }} options
 */
export async function runGod(options) {
  const tier = GodTierSchema.parse(options.tier);
  const focus = GodFocusSchema.parse(options.focus ?? 'any');
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const outDir = path.resolve(options.outDir);
  const harnessName = options.harness ?? 'dsh';
  const model = options.model ?? readDshVersions().model;
  const spike = options.spike === true;
  const maxUsd = clampNumber(
    options.maxUsd,
    GOD_HARD_LIMITS.minUsdPerRun,
    spike ? SPIKE_MAX_USD : GOD_HARD_LIMITS.maxUsdPerRun
  );
  const maxMinutes = clampNumber(
    options.maxMinutes,
    1,
    spike ? SPIKE_MAX_MINUTES : GOD_HARD_LIMITS.maxMinutes
  );
  const harnessTimeoutMs =
    options.harnessTimeoutMs ?? Math.max(1, maxMinutes - WRAPPER_RESERVE_MINUTES) * 60_000;

  validateInputs(options);
  fs.mkdirSync(outDir, { recursive: true });
  const startedAt = new Date();
  const eventsFile = path.join(outDir, 'events.ndjson');
  fs.writeFileSync(eventsFile, '');

  const ingest = createIngestClient({
    url: options.ingestUrl,
    secret: readSecretFile(options.ingestSecretFile),
    runId: options.runId,
    fetchImpl: options.fetchImpl
  });
  const live = createLiveEventStream({ cwd });
  const emit = (raw) => {
    const event = live.push(raw);
    if (!event) return;
    fs.appendFileSync(eventsFile, `${JSON.stringify(event)}\n`);
    ingest.push(event);
  };

  const writeMeter = (usage) =>
    fs.writeFileSync(
      path.join(outDir, 'meter.json'),
      JSON.stringify({ maxUsd, ...usage }, null, 2)
    );

  emit({ type: 'phase', phase: 'act' });
  // `onEvent` only fires while a request is in flight, which is after this assignment completes.
  const proxy = await startMeterProxy({
    keyFile: options.keyFile,
    apiKey: options.apiKey,
    upstream: options.upstream ?? DEFAULT_UPSTREAM,
    maxUsd,
    fetchImpl: options.fetchImpl,
    onEvent: (event) => {
      emit(event);
      if (event.type === 'model') writeMeter(proxy.usage());
    }
  });
  const keyFileRemoved = options.keyFile ? !fs.existsSync(options.keyFile) : true;

  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'god-home-'));
  // dsh's workspace-write grants the workspace *and* the temp areas (/tmp, os.tmpdir()) by design,
  // so the escape probe is a sibling of the workspace: outside both.
  const outsidePath =
    options.spikeOutsidePath ??
    path.join(path.dirname(cwd), `god-spike-outside-${options.runId}.txt`);
  const task = spike
    ? buildSpikeTask(outsidePath)
    : buildTaskText({
        tier,
        focus,
        briefPath: options.briefPath ?? 'the brief',
        historyPath: options.historyPath ?? 'the run history'
      });
  const harnessOptions = {
    task,
    cwd,
    permissionMode: permissionModeForTier(tier),
    baseUrl: proxy.anthropicBaseUrl,
    apiKey: proxy.clientToken,
    model,
    home,
    installDir: options.installDir,
    entry: options.dshEntry,
    onEvent: emit,
    script: options.mockScript
  };
  const harness = harnessName === 'mock' ? startMock(harnessOptions) : startDsh(harnessOptions);

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    harness.kill('SIGTERM');
    setTimeout(() => harness.kill('SIGKILL'), KILL_GRACE_MS).unref();
  }, harnessTimeoutMs);
  const exit = await harness.exit;
  clearTimeout(timer);

  const orphans = isProcessGroupAlive(harness.pid);
  if (orphans) harness.kill('SIGKILL');
  const usage = proxy.usage();
  const stopReason = timedOut
    ? 'timeout'
    : (proxy.stopReason() ?? (exit.code === 0 && exit.sawFinal ? 'completed' : 'error'));
  emit({ type: 'status', text: `harness stopped: ${stopReason}` });
  await proxy.close();
  await ingest.close();
  writeMeter(usage);
  fs.rmSync(home, { recursive: true, force: true });

  const endedAt = new Date();
  const report = {
    v: 1,
    runId: options.runId,
    tier,
    focus,
    harness: { name: harnessName, version: harnessName === 'mock' ? MOCK_VERSION : dshVersion() },
    model,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    minutes: Math.round(((endedAt.getTime() - startedAt.getTime()) / 60_000) * 100) / 100,
    maxUsd,
    maxMinutes,
    stopReason,
    exit,
    usage,
    events: live.count(),
    ingest: ingest.stats(),
    orphans,
    keyFileRemoved
  };
  if (spike) report.spike = evaluateSpike({ report, cwd, outsidePath, model });
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  return report;
}

function parseCli(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      harness: { type: 'string', default: 'dsh' },
      tier: { type: 'string', default: 'observe' },
      focus: { type: 'string', default: 'any' },
      'run-id': { type: 'string', default: `local-${Date.now()}` },
      cwd: { type: 'string' },
      'out-dir': { type: 'string' },
      brief: { type: 'string' },
      history: { type: 'string' },
      'key-file': { type: 'string' },
      upstream: { type: 'string' },
      'max-usd': { type: 'string', default: '1' },
      'max-minutes': { type: 'string', default: '45' },
      model: { type: 'string' },
      'ingest-url': { type: 'string' },
      'ingest-secret-file': { type: 'string' },
      'install-dir': { type: 'string' },
      spike: { type: 'boolean', default: false }
    }
  });
  if (!values['out-dir']) throw new Error('--out-dir is required');
  if (!values['key-file']) throw new Error('--key-file is required');
  return {
    harness: values.harness,
    tier: values.tier,
    focus: values.focus,
    runId: values['run-id'],
    cwd: values.cwd,
    outDir: values['out-dir'],
    briefPath: values.brief,
    historyPath: values.history,
    keyFile: values['key-file'],
    upstream: values.upstream,
    maxUsd: Number(values['max-usd']),
    maxMinutes: Number(values['max-minutes']),
    model: values.model,
    ingestUrl: values['ingest-url'],
    ingestSecretFile: values['ingest-secret-file'],
    installDir: values['install-dir'],
    spike: values.spike
  };
}

async function main() {
  const options = parseCli(process.argv.slice(2));
  const report = await runGod(options);
  const summary = {
    stopReason: report.stopReason,
    usd: report.usage.usd,
    calls: report.usage.calls,
    minutes: report.minutes,
    ...(report.spike ? { spike: report.spike } : {})
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (report.spike && !report.spike.go) process.exitCode = 3;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`god run: ${error?.message ?? error}\n`);
    process.exitCode = 1;
  });
}
