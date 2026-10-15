#!/usr/bin/env node
/**
 * Whether this tick may start the observe harness (ADR-0019).
 *
 *   node scripts/god/actDecision.mjs --gate-go true --tier observe \
 *     --source live --brief /tmp/god/brief.json
 *
 * Pure: no network, no git. A fixture brief is sufficient by construction and must not spend money.
 * Observe and propose may start the harness. Ship is not wired — it records `blocked`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { GodBriefSchema } from '@archislop/shared/godSchemas.js';

const SLUG = /^[a-z0-9][a-z0-9_.:-]{0,63}$/;
const HYPOTHESIS_MAX = 280;
/** Tiers that may start dsh. Ship stays closed until merge policy is lifted on purpose. */
const ACT_TIERS = new Set(['observe', 'propose']);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function flag(value) {
  return value === true || value === 'true' || value === '1';
}

/**
 * @param {{
 *   gateGo?: boolean | string,
 *   tier?: string | null,
 *   briefSource?: string | null,
 *   sufficient?: boolean | string,
 *   briefOk?: boolean | string,
 *   force?: boolean | string
 * }} input
 * @returns {{ act: boolean, skipVerdict: 'noop' | 'blocked' | null, reason: string }}
 */
export function decideAct(input = {}) {
  const go = flag(input.gateGo);
  const tier = String(input.tier ?? '')
    .trim()
    .toLowerCase();
  const live =
    String(input.briefSource ?? '')
      .trim()
      .toLowerCase() === 'live';
  const enough = flag(input.sufficient);
  const briefOk = input.briefOk === undefined ? true : flag(input.briefOk);
  const forced = flag(input.force);

  if (!go) return { act: false, skipVerdict: 'noop', reason: 'gate' };
  if (!ACT_TIERS.has(tier)) return { act: false, skipVerdict: 'blocked', reason: 'tier_not_wired' };
  if (!live) return { act: false, skipVerdict: 'noop', reason: 'brief_not_live' };
  if (!briefOk) return { act: false, skipVerdict: 'noop', reason: 'brief_invalid' };
  if (!enough && !forced) return { act: false, skipVerdict: 'noop', reason: 'insufficient' };
  return { act: true, skipVerdict: null, reason: 'go' };
}

/**
 * The observe contract: `finding:<slug> <one sentence>` or exact `waiting`.
 * Anything else is dropped — the run record keeps a null hypothesis.
 *
 * @param {unknown} text
 * @returns {{ findingId: string | null, hypothesis: string | null, waiting: boolean }}
 */
export function parseObserveNarration(text) {
  const empty = { findingId: null, hypothesis: null, waiting: false };
  if (typeof text !== 'string') return empty;
  // eslint-disable-next-line no-control-regex -- (reason: narration must match shortText, which rejects control characters)
  const flat = text
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!flat) return empty;
  if (flat === 'waiting') return { findingId: null, hypothesis: null, waiting: true };
  const match = flat.match(/^finding:([a-z0-9][a-z0-9_.:-]{0,63}) (.*)$/);
  if (!match || !SLUG.test(match[1])) return empty;
  let hypothesis = match[2].trim();
  if (!hypothesis) return empty;
  if (hypothesis.length > HYPOTHESIS_MAX) {
    hypothesis = `${hypothesis.slice(0, HYPOTHESIS_MAX - 1)}…`;
  }
  return { findingId: match[1], hypothesis, waiting: false };
}

/**
 * Last assistant `text` line, or the closing `final` when the harness emitted no text.
 * A later `final` does not replace a `text` line — trailers like "Done." would erase the finding.
 *
 * @param {string} ndjson
 * @returns {string | null}
 */
export function lastNarrationText(ndjson) {
  let lastText = null;
  let lastFinal = null;
  for (const line of String(ndjson ?? '').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let event;
    try {
      event = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (!event || typeof event.text !== 'string') continue;
    if (event.type === 'text') lastText = event.text;
    else if (event.type === 'final') lastFinal = event.text;
  }
  return lastText ?? lastFinal;
}

/**
 * @param {ReturnType<typeof decideAct>} decision
 * @param {{ outputPath?: string | null, summaryPath?: string | null }} [paths]
 */
export function writeActDecisionOutputs(decision, paths = {}) {
  const outputPath = paths.outputPath ?? process.env.GITHUB_OUTPUT ?? null;
  const summaryPath = paths.summaryPath ?? process.env.GITHUB_STEP_SUMMARY ?? null;
  const lines = [
    `act=${decision.act ? 'true' : 'false'}`,
    `skip_verdict=${decision.skipVerdict ?? ''}`,
    `skip_reason=${decision.reason}`
  ];
  if (outputPath) fs.appendFileSync(outputPath, `${lines.join('\n')}\n`);
  if (summaryPath) {
    fs.appendFileSync(
      summaryPath,
      [
        '',
        '### Act decision',
        '',
        '| | |',
        '| --- | --- |',
        `| act | \`${decision.act}\` |`,
        `| skip | \`${decision.skipVerdict ?? '—'}\` |`,
        `| act reason | \`${decision.reason}\` |`,
        ''
      ].join('\n')
    );
  }
  return lines;
}

/**
 * @param {string | undefined} file
 * @returns {{ sufficient: boolean, briefOk: boolean }}
 */
export function readBriefFlags(file) {
  if (!file || !fs.existsSync(file)) return { sufficient: false, briefOk: false };
  try {
    const brief = GodBriefSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8')));
    return { sufficient: brief.sufficient === true, briefOk: true };
  } catch {
    return { sufficient: false, briefOk: false };
  }
}

function parseCli(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      'gate-go': { type: 'string', default: 'false' },
      tier: { type: 'string', default: '' },
      source: { type: 'string' },
      'source-file': { type: 'string' },
      brief: { type: 'string' },
      sufficient: { type: 'string' },
      force: { type: 'boolean', default: false }
    }
  });
  return values;
}

export function main(argv = process.argv.slice(2)) {
  const values = parseCli(argv);
  let source = values.source ?? '';
  if (values['source-file'] && fs.existsSync(values['source-file'])) {
    source = fs.readFileSync(values['source-file'], 'utf8');
  }
  const flags = values.brief
    ? readBriefFlags(values.brief)
    : { sufficient: flag(values.sufficient), briefOk: true };
  const decision = decideAct({
    gateGo: values['gate-go'],
    tier: values.tier,
    briefSource: source,
    sufficient: flags.sufficient,
    briefOk: flags.briefOk,
    force: values.force
  });
  writeActDecisionOutputs(decision);
  process.stdout.write(`${JSON.stringify(decision)}\n`);
  return decision;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`god act: ${error?.message ?? error}\n`);
    process.exitCode = 1;
  });
}
