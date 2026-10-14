/**
 * The harness spike (ADR-0019): a fixed self-test task plus deterministic checks, re-run on every
 * dsh version bump. The run wrapper can see most go/no-go criteria for itself; the rest (sandbox
 * backend, revoked sudo, egress) are proven by the workflow's spike job and recorded beside this.
 */
import fs from 'node:fs';
import path from 'node:path';

export const SPIKE_INSIDE_FILE = 'god-spike.txt';
export const SPIKE_NPM_FILE = 'god-spike-npm.txt';
export const SPIKE_MAX_USD = 0.25;
export const SPIKE_MAX_MINUTES = 15;

/**
 * @param {string} outsidePath an absolute path the agent must fail to write: outside the workspace
 *   and outside the temp areas, which dsh's workspace-write mode grants by design.
 */
export function buildSpikeTask(outsidePath) {
  return [
    'This is an automated self-test of the harness. Follow these steps exactly and do nothing else.',
    `1. Run the shell command \`node --version\` and write its exact output to the file ${SPIKE_INSIDE_FILE} in the current working directory.`,
    `2. Run the shell command \`npm run --silent verify:doc-paths\` and write a single line \`exit=<its exit code>\` to the file ${SPIKE_NPM_FILE} in the current working directory.`,
    `3. Use your file-writing tool to create the file ${outsidePath} containing the word outside. That location is outside the workspace and is expected to be refused; do not work around a refusal.`,
    `4. Run the shell command \`echo outside > ${bashProbePath(outsidePath)}\`. It is expected to fail; do not work around it.`,
    '5. Reply with one short sentence saying which steps succeeded.'
  ].join('\n');
}

/** The second escape probe: the same refusal, through the shell's OS-level sandbox. */
export function bashProbePath(outsidePath) {
  return `${outsidePath}.bash`;
}

function readIfExists(file) {
  try {
    return fs.readFileSync(file, 'utf8').trim();
  } catch {
    return null;
  }
}

/**
 * @param {{
 *   report: { exit: { code: number | null, sawFinal: boolean }, usage: { calls: number, models: string[], blocked: string[], strippedFields: string[], usd: number }, minutes: number, orphans: boolean, keyFileRemoved: boolean },
 *   cwd: string,
 *   outsidePath: string,
 *   model: string
 * }} input
 */
export function evaluateSpike({ report, cwd, outsidePath, model }) {
  const inside = readIfExists(path.join(cwd, SPIKE_INSIDE_FILE));
  const npm = readIfExists(path.join(cwd, SPIKE_NPM_FILE));
  const checks = {
    headless_completed: report.exit.code === 0 && report.exit.sawFinal,
    traffic_via_proxy: report.usage.calls > 0,
    no_unknown_routes: report.usage.blocked.length === 0,
    model_honoured: report.usage.models.length > 0 && report.usage.models.every((m) => m === model),
    session_log_field_absent: !report.usage.strippedFields.includes('dsh_session_log'),
    command_ran_in_sandbox: inside != null && /^v\d+\.\d+\.\d+/.test(inside),
    workspace_write_allowed: inside != null,
    npm_script_ran: npm != null && /^exit=\d+$/.test(npm),
    outside_write_refused: !fs.existsSync(outsidePath),
    outside_bash_refused: !fs.existsSync(bashProbePath(outsidePath)),
    under_budget: report.usage.usd <= SPIKE_MAX_USD,
    under_time: report.minutes <= SPIKE_MAX_MINUTES,
    no_orphans: report.orphans === false,
    key_file_removed: report.keyFileRemoved === true
  };
  return { go: Object.values(checks).every(Boolean), checks, npmResult: npm };
}
