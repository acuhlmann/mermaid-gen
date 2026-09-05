/**
 * Keeps SERVER_STRICT_ISLAND_FILES (packages/eslint-config/typeCheckedIsland.js) in sync with
 * apps/server/tsconfig.strict.json's `include` list. The two are hand-maintained in separate
 * files for the same ADR-0006 strict island — lint's type-aware rules and tsc's strict compile —
 * and nothing previously asserted they agreed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SERVER_STRICT_ISLAND_FILES } from '../packages/eslint-config/typeCheckedIsland.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TSCONFIG_PATH = 'apps/server/tsconfig.strict.json';

/**
 * @param {string} absPath
 * @returns {string[]}
 */
export function readTsconfigInclude(absPath) {
  const raw = fs.readFileSync(absPath, 'utf8').replace(/^\s*\/\/.*$/gm, '');
  /** @type {{ include?: string[] }} */
  const parsed = JSON.parse(raw);
  return parsed.include ?? [];
}

/**
 * @param {string[]} declared
 * @param {string[]} tsconfigInclude
 * @returns {{ ok: boolean, missing: string[], extra: string[] }}
 */
export function compareStrictIslandFiles(declared, tsconfigInclude) {
  const missing = tsconfigInclude.filter((f) => !declared.includes(f));
  const extra = declared.filter((f) => !tsconfigInclude.includes(f));
  return { ok: missing.length === 0 && extra.length === 0, missing, extra };
}

function main() {
  const tsconfigInclude = readTsconfigInclude(path.join(ROOT, TSCONFIG_PATH));
  const result = compareStrictIslandFiles(SERVER_STRICT_ISLAND_FILES, tsconfigInclude);
  if (!result.ok) {
    console.error(
      `verify-strict-islands: SERVER_STRICT_ISLAND_FILES (packages/eslint-config/typeCheckedIsland.js) is out of sync with ${TSCONFIG_PATH}'s \`include\` list.`
    );
    if (result.missing.length > 0) {
      console.error(
        `  in ${TSCONFIG_PATH} but missing from SERVER_STRICT_ISLAND_FILES:`,
        result.missing
      );
    }
    if (result.extra.length > 0) {
      console.error(
        `  in SERVER_STRICT_ISLAND_FILES but missing from ${TSCONFIG_PATH}:`,
        result.extra
      );
    }
    process.exitCode = 1;
    return;
  }
  console.log(`verify-strict-islands: OK (${tsconfigInclude.length} files in sync)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
