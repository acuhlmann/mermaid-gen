import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  findVerifyTestsMissingFromBlast,
  listVerifySensorTests,
  verifyAgentToolingBlastCoverage
} from './verify-agent-tooling-blast.mjs';
import { AGENT_TOOLING_BLAST_TESTS } from './test-affected-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPTS_DIR = path.join(ROOT, 'scripts');

test('listVerifySensorTests finds every verify-*.test.mjs under scripts/', () => {
  const listed = listVerifySensorTests(SCRIPTS_DIR);
  assert.ok(listed.length >= 10, 'expected the full verify sensor suite set');
  assert.ok(listed.every((entry) => entry.startsWith('scripts/verify-')));
});

test('findVerifyTestsMissingFromBlast reports paths absent from the bundle', () => {
  const missing = findVerifyTestsMissingFromBlast(
    ['scripts/verify-foo.test.mjs', 'scripts/verify-bar.test.mjs'],
    ['scripts/verify-foo.test.mjs']
  );
  assert.deepEqual(missing, ['scripts/verify-bar.test.mjs']);
});

test('every verify sensor suite is listed in AGENT_TOOLING_BLAST_TESTS', () => {
  const result = verifyAgentToolingBlastCoverage(ROOT);
  assert.equal(
    result.ok,
    true,
    `missing from AGENT_TOOLING_BLAST_TESTS: ${result.missing.join(', ')}`
  );
});

test('negative case: a verify suite left out of the bundle fails the sensor', () => {
  const verifyTests = listVerifySensorTests(SCRIPTS_DIR);
  const trimmed = AGENT_TOOLING_BLAST_TESTS.filter((entry) => entry !== verifyTests[0]);
  const missing = findVerifyTestsMissingFromBlast(verifyTests, trimmed);
  assert.ok(missing.includes(verifyTests[0]));
});
