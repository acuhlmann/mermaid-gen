/**
 * Keeps scripts/prettier-files.mjs's PRETTIER_SKIP in sync with `.prettierignore`.
 * Diff-scoped Prettier (format:affected / check:affected) uses PRETTIER_SKIP; CI uses
 * Prettier's ignore file — nothing previously asserted the two agreed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRETTIER_SKIP } from './prettier-files.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PRETTIER_IGNORE_PATH = path.join(ROOT, '.prettierignore');

/**
 * @param {string} content
 * @returns {string[]}
 */
export function parsePrettierIgnoreLines(content) {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}

/**
 * Canonical ignore entries expected from PRETTIER_SKIP (mirrors prettier-files.mjs).
 * @param {RegExp[]} skipRes
 * @returns {string[]}
 */
export function canonicalLinesFromPrettierSkip(skipRes) {
  /** @type {string[]} */
  const lines = [];
  for (const re of skipRes) {
    const src = re.source;
    if (src === '^node_modules\\/') lines.push('node_modules');
    else if (src === '^\\.agents\\/') lines.push('.agents');
    else if (src === '^\\.claude\\/worktrees\\/') lines.push('.claude/worktrees');
    else if (src === '^dist\\/') lines.push('dist');
    else if (src === '^build\\/') lines.push('build');
    else if (src === '^coverage\\/') lines.push('coverage');
    else if (src === '^apps\\/web\\/dist') lines.push('apps/web/dist');
    else if (src === '^apps\\/web\\/dist-main') lines.push('apps/web/dist-main');
    else if (src === '^apps\\/web\\/dist-hackathon') lines.push('apps/web/dist-hackathon');
    else if (src === '^apps\\/server\\/bench-results\\/') lines.push('apps/server/bench-results');
    else if (src === '^packages\\/shared\\/src\\/vendor\\/')
      lines.push('packages/shared/src/vendor');
    else if (src === '^package-lock\\.json$') lines.push('package-lock.json');
    else if (src === '^skills-lock\\.json$') lines.push('skills-lock.json');
    else if (src === '\\.min\\.js$') lines.push('*.min.js');
    else if (src === '\\.min\\.css$') lines.push('*.min.css');
    else if (src === '^\\.env') lines.push('.env');
    else if (src === '^\\.env\\.') lines.push('.env.*');
    else {
      throw new Error(
        `verify-prettier-ignore-sync: unrecognized PRETTIER_SKIP pattern /${src}/ — extend canonicalLinesFromPrettierSkip`
      );
    }
  }
  return [...lines].sort();
}

/**
 * @param {string[]} ignoreLines
 * @param {string[]} skipLines
 * @returns {{ ok: boolean, missing: string[], extra: string[] }}
 */
export function comparePrettierIgnoreSets(ignoreLines, skipLines) {
  const ignoreSet = new Set(ignoreLines);
  const skipSet = new Set(skipLines);
  const missing = ignoreLines.filter((line) => !skipSet.has(line));
  const extra = skipLines.filter((line) => !ignoreSet.has(line));
  return { ok: missing.length === 0 && extra.length === 0, missing, extra };
}

/**
 * @param {string} root
 * @returns {{ ok: boolean, missing: string[], extra: string[], ignoreLines: string[], skipLines: string[] }}
 */
export function verifyPrettierIgnoreSync(root) {
  const content = fs.readFileSync(path.join(root, '.prettierignore'), 'utf8');
  const ignoreLines = parsePrettierIgnoreLines(content).sort();
  const skipLines = canonicalLinesFromPrettierSkip(PRETTIER_SKIP);
  const result = comparePrettierIgnoreSets(ignoreLines, skipLines);
  return { ...result, ignoreLines, skipLines };
}

function main() {
  const result = verifyPrettierIgnoreSync(ROOT);
  if (!result.ok) {
    console.error(
      'verify-prettier-ignore-sync: PRETTIER_SKIP (scripts/prettier-files.mjs) is out of sync with .prettierignore.'
    );
    if (result.missing.length > 0) {
      console.error('  in .prettierignore but missing from PRETTIER_SKIP:', result.missing);
    }
    if (result.extra.length > 0) {
      console.error('  in PRETTIER_SKIP but missing from .prettierignore:', result.extra);
    }
    process.exitCode = 1;
    return;
  }
  console.log(
    `verify-prettier-ignore-sync: OK (${result.ignoreLines.length} ignore entries in sync)`
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
