/**
 * Every `scripts/verify-*.test.mjs` sensor suite must appear in
 * `AGENT_TOOLING_BLAST_TESTS`. Those sensors are wired in `test-affected-lib.mjs`
 * (per-sensor blast rules plus the bundle itself). Editing the lib without re-running
 * every verify sensor test let blast-radius wiring drift while `check:affected` stayed green.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AGENT_TOOLING_BLAST_TESTS } from './test-affected-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPTS_DIR = path.join(ROOT, 'scripts');

export const VERIFY_SENSOR_TEST_RE = /^verify-.*\.test\.mjs$/;

/**
 * @param {string} scriptsDirAbs
 * @returns {string[]} repo-relative paths like `scripts/verify-foo.test.mjs`
 */
export function listVerifySensorTests(scriptsDirAbs) {
  return fs
    .readdirSync(scriptsDirAbs)
    .filter((name) => VERIFY_SENSOR_TEST_RE.test(name))
    .sort()
    .map((name) => `scripts/${name}`);
}

/**
 * @param {string[]} verifyTests
 * @param {readonly string[]} blastBundle
 * @returns {string[]}
 */
export function findVerifyTestsMissingFromBlast(verifyTests, blastBundle) {
  const inBundle = new Set(blastBundle);
  return verifyTests.filter((entry) => !inBundle.has(entry));
}

/**
 * @param {string} root
 * @returns {{ ok: boolean, missing: string[], verifyTests: string[] }}
 */
export function verifyAgentToolingBlastCoverage(root) {
  const verifyTests = listVerifySensorTests(path.join(root, 'scripts'));
  const missing = findVerifyTestsMissingFromBlast(verifyTests, AGENT_TOOLING_BLAST_TESTS);
  return { ok: missing.length === 0, missing, verifyTests };
}

function main() {
  const result = verifyAgentToolingBlastCoverage(ROOT);
  if (!result.ok) {
    console.error(
      'verify-agent-tooling-blast: AGENT_TOOLING_BLAST_TESTS is missing verify sensor suites:'
    );
    for (const entry of result.missing) {
      console.error(`  - ${entry}`);
    }
    console.error(
      'Add each path to AGENT_TOOLING_BLAST_TESTS in scripts/test-affected-lib.mjs so edits to that file re-run the sensors it wires.'
    );
    process.exitCode = 1;
    return;
  }
  console.log(
    `verify-agent-tooling-blast: OK (${result.verifyTests.length} verify sensor suites in AGENT_TOOLING_BLAST_TESTS)`
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
