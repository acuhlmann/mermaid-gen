#!/usr/bin/env node
/**
 * ArchiSlop God's gate (ADR-0019): decide whether this tick may spend money.
 *
 *   node scripts/god/gate.mjs --vars-file vars.json --now 2026-10-15T07:00:00Z
 *   node scripts/god/gate.mjs --dry-run   # reads process.env + live open-PR count
 *
 * Writes `$GITHUB_OUTPUT` (when set) and a step summary. Never starts the harness.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import {
  decideGodRun,
  GOD_CONFIG_VARIABLES,
  GOD_HARD_LIMITS,
  readGodConfigFromVars
} from '@archislop/shared/godBudget.js';
import { GodFocusSchema, GodTierSchema } from '@archislop/shared/godSchemas.js';
import { fetchOpenPrs, loadPlaybook, matchOpenRoutinePrs } from '../routine-guard.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * @param {string | undefined} secret
 * @param {{ fetchImpl?: typeof fetch }} [opts]
 * @returns {Promise<number | null>} USD balance, or null when unknown
 */
export async function fetchDeepSeekBalanceUsd(secret, opts = {}) {
  if (!secret) return null;
  const fetchImpl = opts.fetchImpl ?? fetch;
  try {
    const res = await fetchImpl('https://api.deepseek.com/user/balance', {
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(10_000)
    });
    if (!res.ok) return null;
    const body = await res.json();
    const infos = Array.isArray(body?.balance_infos) ? body.balance_infos : [];
    const usd = infos.find((i) => String(i?.currency ?? '').toUpperCase() === 'USD');
    const total = Number(usd?.total_balance ?? usd?.balance);
    if (Number.isFinite(total)) return total;
    // CNY-only accounts: treat as unknown rather than inventing an FX rate.
    return null;
  } catch {
    return null;
  }
}

/**
 * @param {{
 *   vars?: Record<string, string | undefined>,
 *   now?: Date | number,
 *   lastActAt?: number | null,
 *   openGodPrs?: number,
 *   balanceUsd?: number | null,
 *   monthSpendUsd?: number,
 *   newSignals?: number | null,
 *   force?: boolean,
 *   requestedTier?: string | null,
 *   focus?: string | null,
 *   root?: string,
 *   fetchPrs?: typeof fetchOpenPrs
 * }} input
 */
export function runGate(input = {}) {
  const root = input.root ?? ROOT;
  const vars =
    input.vars ??
    Object.fromEntries(Object.values(GOD_CONFIG_VARIABLES).map((k) => [k, process.env[k]]));
  const config = readGodConfigFromVars(vars);

  let openGodPrs = input.openGodPrs;
  if (openGodPrs == null) {
    const { playbook, errors } = loadPlaybook(root, 'god');
    if (errors.length) {
      throw new Error(`god playbook invalid: ${errors.join('; ')}`);
    }
    const fetchPrs = input.fetchPrs ?? fetchOpenPrs;
    const openPrs = fetchPrs();
    if (openPrs == null) {
      // Unknown open-PR state: refuse rather than double-booking.
      openGodPrs = 1;
    } else {
      openGodPrs = matchOpenRoutinePrs({ name: 'god', playbook, openPrs }).length;
    }
  }

  const requestedTier = input.requestedTier
    ? GodTierSchema.safeParse(String(input.requestedTier).toLowerCase())
    : null;
  const focus = input.focus ? GodFocusSchema.safeParse(String(input.focus).toLowerCase()) : null;

  const decision = decideGodRun({
    config,
    now: input.now ?? Date.now(),
    lastActAt: input.lastActAt ?? null,
    openGodPrs,
    balanceUsd: input.balanceUsd === undefined ? null : input.balanceUsd,
    monthSpendUsd: input.monthSpendUsd ?? 0,
    newSignals: input.newSignals === undefined ? null : input.newSignals,
    force: input.force === true,
    requestedTier: requestedTier?.success ? requestedTier.data : null
  });

  return {
    ...decision,
    focus: focus?.success ? focus.data : 'any',
    config,
    openGodPrs,
    minNewSignals: GOD_HARD_LIMITS.minNewSignals
  };
}

/**
 * @param {ReturnType<typeof runGate>} decision
 * @param {{ outputPath?: string | null, summaryPath?: string | null }} [paths]
 */
export function writeGateOutputs(decision, paths = {}) {
  const outputPath = paths.outputPath ?? process.env.GITHUB_OUTPUT ?? null;
  const summaryPath = paths.summaryPath ?? process.env.GITHUB_STEP_SUMMARY ?? null;
  const lines = [
    `go=${decision.go}`,
    `reason=${decision.reason}`,
    `tier=${decision.tier}`,
    `focus=${decision.focus}`,
    `max_minutes=${decision.maxMinutes}`,
    `max_usd=${decision.maxUsd}`,
    `next_due_at=${decision.nextDueAt ?? ''}`,
    `open_god_prs=${decision.openGodPrs}`
  ];
  if (outputPath) {
    fs.appendFileSync(outputPath, `${lines.join('\n')}\n`);
  }
  if (summaryPath) {
    const md = [
      '## ArchiSlop God — gate',
      '',
      `| | |`,
      `| --- | --- |`,
      `| go | \`${decision.go}\` |`,
      `| reason | \`${decision.reason}\` |`,
      `| tier | \`${decision.tier}\` |`,
      `| focus | \`${decision.focus}\` |`,
      `| max minutes | ${decision.maxMinutes} |`,
      `| max usd | ${decision.maxUsd} |`,
      `| open god PRs | ${decision.openGodPrs} |`,
      `| next due | ${decision.nextDueAt ?? '—'} |`,
      `| enabled | ${decision.config.enabled} |`,
      `| window | ${decision.config.windowUtc} UTC |`,
      ''
    ].join('\n');
    fs.appendFileSync(summaryPath, md);
  }
  return lines;
}

function parseCli(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      'vars-file': { type: 'string' },
      now: { type: 'string' },
      'last-act-at': { type: 'string' },
      'month-spend': { type: 'string' },
      'new-signals': { type: 'string' },
      'open-prs': { type: 'string' },
      'balance-usd': { type: 'string' },
      force: { type: 'boolean', default: false },
      tier: { type: 'string' },
      focus: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      'skip-balance': { type: 'boolean', default: false }
    }
  });
  return values;
}

export async function main(argv = process.argv.slice(2)) {
  const values = parseCli(argv);
  /** @type {Record<string, string | undefined>} */
  let vars = Object.fromEntries(
    Object.values(GOD_CONFIG_VARIABLES).map((k) => [k, process.env[k]])
  );
  if (values['vars-file']) {
    vars = {
      ...vars,
      ...JSON.parse(fs.readFileSync(values['vars-file'], 'utf8'))
    };
  }

  const now = values.now ? Date.parse(values.now) : Date.now();
  if (!Number.isFinite(now)) throw new Error(`invalid --now ${values.now}`);

  let balanceUsd = values['balance-usd'] != null ? Number(values['balance-usd']) : undefined;
  if (balanceUsd === undefined && !values['skip-balance'] && !values['dry-run']) {
    balanceUsd = await fetchDeepSeekBalanceUsd(process.env.GOD_DEEPSEEK_API_KEY);
  } else if (values['dry-run'] && balanceUsd === undefined) {
    balanceUsd = null;
  }

  const decision = runGate({
    vars,
    now,
    lastActAt: values['last-act-at'] ? Date.parse(values['last-act-at']) : null,
    monthSpendUsd: values['month-spend'] != null ? Number(values['month-spend']) : 0,
    newSignals: values['new-signals'] != null ? Number(values['new-signals']) : null,
    openGodPrs: values['open-prs'] != null ? Number(values['open-prs']) : undefined,
    balanceUsd: balanceUsd === undefined ? null : balanceUsd,
    force: values.force === true,
    requestedTier: values.tier ?? null,
    focus: values.focus ?? null
  });

  writeGateOutputs(decision);
  process.stdout.write(`${JSON.stringify(decision, null, 2)}\n`);
  return decision;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`god gate: ${error?.message ?? error}\n`);
    process.exitCode = 1;
  });
}
