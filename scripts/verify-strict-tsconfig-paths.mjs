/**
 * Every path listed in an ADR-0006 strict-island tsconfig must exist on disk.
 * convert-js-leaf-to-ts and manual edits can append a `.ts` path before the file
 * is moved, or leave a stale entry after a rename — typecheck:strict then fails with
 * a path error that does not name the tsconfig line.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readTsconfigInclude } from './verify-strict-islands.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** @type {{ tsconfigRel: string, appRootRel: string }[]} */
export const STRICT_TSCONFIGS = [
  { tsconfigRel: 'apps/web/tsconfig.strict.json', appRootRel: 'apps/web' },
  { tsconfigRel: 'apps/server/tsconfig.strict.json', appRootRel: 'apps/server' }
];

/**
 * @param {string} appRootAbs
 * @param {string} includeEntry e.g. src/utils/foo.ts
 * @returns {boolean}
 */
export function strictIncludePathExists(appRootAbs, includeEntry) {
  const direct = path.join(appRootAbs, includeEntry);
  if (fs.existsSync(direct)) return true;
  if (includeEntry.endsWith('.js')) {
    const asTs = includeEntry.replace(/\.js$/, '.ts');
    if (fs.existsSync(path.join(appRootAbs, asTs))) return true;
    const asTsx = includeEntry.replace(/\.js$/, '.tsx');
    if (fs.existsSync(path.join(appRootAbs, asTsx))) return true;
  }
  return false;
}

/**
 * @param {string} root
 * @param {{ tsconfigRel: string, appRootRel: string }} spec
 * @returns {{ ok: boolean, missing: string[] }}
 */
export function verifyStrictTsconfigPaths(root, spec) {
  const appRootAbs = path.join(root, spec.appRootRel);
  const include = readTsconfigInclude(path.join(root, spec.tsconfigRel));
  const missing = include.filter((entry) => !strictIncludePathExists(appRootAbs, entry));
  return { ok: missing.length === 0, missing };
}

/**
 * @param {string} root
 * @returns {{ ok: boolean, byConfig: Record<string, string[]> }}
 */
export function verifyAllStrictTsconfigPaths(root) {
  /** @type {Record<string, string[]>} */
  const byConfig = {};
  let ok = true;
  for (const spec of STRICT_TSCONFIGS) {
    const result = verifyStrictTsconfigPaths(root, spec);
    if (!result.ok) {
      ok = false;
      byConfig[spec.tsconfigRel] = result.missing;
    }
  }
  return { ok, byConfig };
}

function main() {
  const result = verifyAllStrictTsconfigPaths(ROOT);
  if (!result.ok) {
    console.error(
      'verify-strict-tsconfig-paths: a strict-island tsconfig lists a path that does not exist:'
    );
    for (const [config, missing] of Object.entries(result.byConfig)) {
      console.error(`  ${config}:`);
      for (const entry of missing) {
        console.error(`    - ${entry}`);
      }
    }
    process.exitCode = 1;
    return;
  }
  const total = STRICT_TSCONFIGS.reduce(
    (n, spec) => n + readTsconfigInclude(path.join(ROOT, spec.tsconfigRel)).length,
    0
  );
  console.log(`verify-strict-tsconfig-paths: OK (${total} include paths exist)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
