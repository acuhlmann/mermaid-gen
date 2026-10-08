/**
 * `npm run test:floor` and ISOMETRIC_FLOOR_BLAST_TESTS are deliberately not the same set.
 * test:floor is the geometry/behaviour loop agents run by hand; the blast bundle is what
 * test:affected pulls when floor source changes. Drift between them was invisible until
 * office-life's ledger flagged it (improve todo `officefloor-suite-blast-wall`).
 *
 * This sensor fails when either set changes without updating the documented intentional
 * delta — not when the delta exists.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ISOMETRIC_FLOOR_BLAST_TESTS } from './test-affected-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB_PKG = path.join(ROOT, 'apps/web/package.json');
const WEB_TEST_DIR = path.join(ROOT, 'apps/web/test');

/** In test:floor but not the blast bundle — see docs/agents/isometric-floor-tests.md */
export const INTENTIONAL_TEST_FLOOR_ONLY = ['apps/web/test/useOfficeDayPhase.test.jsx'];

/** In the blast bundle but not test:floor — hook/persona suites test:affected still needs */
export const INTENTIONAL_BLAST_ONLY = [
  'apps/web/test/officeErrand.test.jsx',
  'apps/web/test/personaFaces.test.jsx',
  'apps/web/test/useFloorArrivalFocus.test.jsx',
  'apps/web/test/useFloorAway.test.jsx'
];

/**
 * @param {string} testFloorScript e.g. vitest run test/officeFloor …
 * @returns {string[]}
 */
export function parseTestFloorVitestArgs(testFloorScript) {
  const parts = testFloorScript.trim().split(/\s+/);
  const runIdx = parts.indexOf('run');
  if (runIdx === -1 || runIdx === parts.length - 1) {
    throw new Error('verify-isometric-floor-suites: could not parse test:floor vitest args');
  }
  return parts.slice(runIdx + 1);
}

/**
 * Resolve vitest positional args to repo-relative test file paths (apps/web/test/…).
 * Matches how vitest treats a bare prefix like `test/officeFloor`.
 *
 * @param {string[]} vitestArgs
 * @param {string} [testDirAbs]
 */
export function resolveTestFloorFiles(vitestArgs, testDirAbs = WEB_TEST_DIR) {
  const names = fs.readdirSync(testDirAbs);
  /** @type {Set<string>} */
  const matched = new Set();
  for (const arg of vitestArgs) {
    const prefix = arg.replace(/^test\//, '');
    for (const name of names) {
      if (name.startsWith(prefix)) {
        matched.add(`apps/web/test/${name}`);
      }
    }
  }
  return [...matched].sort();
}

/**
 * @param {string[]} testFloorFiles
 * @param {string[]} blastFiles
 * @param {{ testFloorOnly?: string[], blastOnly?: string[] }} [intentional]
 */
export function compareFloorSuiteSets(
  testFloorFiles,
  blastFiles,
  intentional = {
    testFloorOnly: INTENTIONAL_TEST_FLOOR_ONLY,
    blastOnly: INTENTIONAL_BLAST_ONLY
  }
) {
  const testSet = new Set(testFloorFiles);
  const blastSet = new Set(blastFiles);
  const onlyTestFloor = testFloorFiles.filter((f) => !blastSet.has(f)).sort();
  const onlyBlast = blastFiles.filter((f) => !testSet.has(f)).sort();
  const expectedTestOnly = [...intentional.testFloorOnly].sort();
  const expectedBlastOnly = [...intentional.blastOnly].sort();
  const ok =
    onlyTestFloor.length === expectedTestOnly.length &&
    onlyBlast.length === expectedBlastOnly.length &&
    onlyTestFloor.every((f, i) => f === expectedTestOnly[i]) &&
    onlyBlast.every((f, i) => f === expectedBlastOnly[i]);
  return { ok, onlyTestFloor, onlyBlast, expectedTestOnly, expectedBlastOnly };
}

/**
 * @param {string} [root]
 */
export function loadTestFloorFilesFromPackage(root = ROOT) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'apps/web/package.json'), 'utf8'));
  const script = pkg.scripts?.['test:floor'];
  if (!script) {
    throw new Error('verify-isometric-floor-suites: apps/web missing test:floor script');
  }
  const args = parseTestFloorVitestArgs(script);
  return resolveTestFloorFiles(args, path.join(root, 'apps/web/test'));
}

function main() {
  const testFloorFiles = loadTestFloorFilesFromPackage();
  const blastFiles = [...ISOMETRIC_FLOOR_BLAST_TESTS].sort();
  const result = compareFloorSuiteSets(testFloorFiles, blastFiles);
  if (!result.ok) {
    console.error(
      'verify-isometric-floor-suites: test:floor and ISOMETRIC_FLOOR_BLAST_TESTS drifted.'
    );
    console.error(
      '  Update apps/web/package.json test:floor, ISOMETRIC_FLOOR_BLAST_TESTS in scripts/test-affected-lib.mjs,',
      'and the INTENTIONAL_* lists in this file — see docs/agents/isometric-floor-tests.md.'
    );
    if (result.onlyTestFloor.join() !== result.expectedTestOnly.join()) {
      console.error('  only in test:floor:', result.onlyTestFloor);
      console.error('  expected intentional test:floor-only:', result.expectedTestOnly);
    }
    if (result.onlyBlast.join() !== result.expectedBlastOnly.join()) {
      console.error('  only in blast bundle:', result.onlyBlast);
      console.error('  expected intentional blast-only:', result.expectedBlastOnly);
    }
    process.exitCode = 1;
    return;
  }
  console.log(
    `verify-isometric-floor-suites: OK (${testFloorFiles.length} test:floor, ${blastFiles.length} blast, ${INTENTIONAL_TEST_FLOOR_ONLY.length + INTENTIONAL_BLAST_ONLY.length} intentional deltas)`
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
