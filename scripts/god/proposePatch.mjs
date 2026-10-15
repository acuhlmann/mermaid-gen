#!/usr/bin/env node
/**
 * Propose-tier patch and pull-request text (ADR-0019).
 *
 * The act job may write the workspace. It does not commit or push. This module decides whether a
 * completed propose run has a diff worth verifying, and the title/body the publish job opens.
 * Ship is not a path here.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { lastNarrationText, parseObserveNarration } from './actDecision.mjs';

const REPO_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._@/-]{1,200}$/;
const FILES_MAX = 50;

/**
 * A patch is only packed when propose finished cleanly. A budget stop or an observe run leaves no diff.
 *
 * @param {{ tier?: string, stopReason?: string }} input
 */
export function shouldPackPatch(input = {}) {
  return input.tier === 'propose' && input.stopReason === 'completed';
}

/**
 * @param {string} runId
 * @returns {string} `god/<id>` matching GodRunRecordSchema
 */
export function branchForRun(runId) {
  const id = String(runId ?? '')
    .replace(/[^A-Za-z0-9._-]/g, '')
    .slice(0, 80);
  if (!id) throw new Error('run id cannot form a branch');
  return `god/${id}`;
}

/**
 * Drop staged paths the harness must not publish (its own brief, the data branch, dependencies)
 * and anything that is not a repo-relative path the run record can store.
 *
 * @param {Iterable<string>} names
 * @returns {string[]}
 */
export function filterPatchFiles(names) {
  /** @type {string[]} */
  const kept = [];
  for (const raw of names) {
    const name = String(raw ?? '').trim();
    if (!name) continue;
    if (
      name === 'god-run' ||
      name.startsWith('god-run/') ||
      name === 'god-log' ||
      name.startsWith('god-log/') ||
      name === 'node_modules' ||
      name.startsWith('node_modules/')
    ) {
      continue;
    }
    if (!REPO_PATH.test(name)) continue;
    kept.push(name);
    if (kept.length >= FILES_MAX) break;
  }
  return kept;
}

/**
 * @param {{ runId: string, narration?: string | null }} input
 * @returns {{ title: string, body: string, findingId: string | null, hypothesis: string | null }}
 */
export function proposePrText(input) {
  const parsed = parseObserveNarration(input.narration);
  const slug = parsed.findingId ?? `run-${String(input.runId).replace(/[^A-Za-z0-9._-]/g, '')}`;
  const title = `god: ${slug}`.slice(0, 120);
  const sentence =
    parsed.hypothesis ?? 'The harness did not leave a one-sentence finding. Read the diff.';
  const body = [
    sentence,
    '',
    `Run \`${input.runId}\`. Opened ready. A human merges. This workflow does not auto-merge.`
  ].join('\n');
  return { title, body, findingId: parsed.findingId, hypothesis: parsed.hypothesis };
}

function parseCli(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      report: { type: 'string' },
      tier: { type: 'string' },
      events: { type: 'string' },
      'run-id': { type: 'string' },
      'title-out': { type: 'string' },
      'body-out': { type: 'string' }
    }
  });
  return values;
}

export function main(argv = process.argv.slice(2)) {
  const values = parseCli(argv);
  if (values.report) {
    const report = JSON.parse(fs.readFileSync(values.report, 'utf8'));
    const pack = shouldPackPatch({
      tier: values.tier ?? report.tier,
      stopReason: report.stopReason
    });
    process.stdout.write(pack ? 'pack=true\n' : 'pack=false\n');
    return { pack };
  }
  if (!values['run-id'] || !values['title-out'] || !values['body-out']) {
    throw new Error('--report, or --run-id with --title-out and --body-out, is required');
  }
  const events =
    values.events && fs.existsSync(values.events) ? fs.readFileSync(values.events, 'utf8') : '';
  const text = proposePrText({
    runId: values['run-id'],
    narration: lastNarrationText(events)
  });
  fs.writeFileSync(values['title-out'], text.title);
  fs.writeFileSync(values['body-out'], `${text.body}\n`);
  process.stdout.write(`${JSON.stringify({ title: text.title })}\n`);
  return text;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`god propose: ${error?.message ?? error}\n`);
    process.exitCode = 1;
  }
}
