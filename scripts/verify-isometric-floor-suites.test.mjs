import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  compareFloorSuiteSets,
  INTENTIONAL_BLAST_ONLY,
  INTENTIONAL_TEST_FLOOR_ONLY,
  loadTestFloorFilesFromPackage,
  parseTestFloorVitestArgs,
  resolveTestFloorFiles
} from './verify-isometric-floor-suites.mjs';
import { ISOMETRIC_FLOOR_BLAST_TESTS } from './test-affected-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB_TEST_DIR = path.join(ROOT, 'apps/web/test');

test('parseTestFloorVitestArgs extracts vitest positional suite args', () => {
  const args = parseTestFloorVitestArgs(
    'vitest run test/officeFloor test/useOfficeDayPhase test/useWalkAnimation'
  );
  assert.deepEqual(args, ['test/officeFloor', 'test/useOfficeDayPhase', 'test/useWalkAnimation']);
});

test('resolveTestFloorFiles maps officeFloor prefix to every matching suite', () => {
  const files = resolveTestFloorFiles(['test/officeFloor'], WEB_TEST_DIR);
  assert.ok(files.length >= 5, 'expected multiple officeFloor* files');
  assert.ok(files.every((f) => f.includes('officeFloor')));
});

test('test:floor and ISOMETRIC_FLOOR_BLAST_TESTS match the documented intentional delta', () => {
  const testFloorFiles = loadTestFloorFilesFromPackage();
  assert.ok(testFloorFiles.length > 0, 'test:floor resolved to nothing — would pass vacuously');
  const blastFiles = [...ISOMETRIC_FLOOR_BLAST_TESTS].sort();
  assert.ok(blastFiles.length > 0, 'ISOMETRIC_FLOOR_BLAST_TESTS is empty');
  const result = compareFloorSuiteSets(testFloorFiles, blastFiles);
  assert.equal(
    result.ok,
    true,
    `onlyTestFloor=${result.onlyTestFloor.join(', ')} onlyBlast=${result.onlyBlast.join(', ')}`
  );
  assert.deepEqual(result.onlyTestFloor, [...INTENTIONAL_TEST_FLOOR_ONLY].sort());
  assert.deepEqual(result.onlyBlast, [...INTENTIONAL_BLAST_ONLY].sort());
});

test('negative case: an unlisted asymmetry fails the sensor', () => {
  const testFloor = ['apps/web/test/a.test.js', 'apps/web/test/useOfficeDayPhase.test.jsx'];
  const blast = ['apps/web/test/b.test.js'];
  const result = compareFloorSuiteSets(testFloor, blast);
  assert.equal(result.ok, false);
});
