/**
 * Register-accuracy sensor for improve item 1: the ~LOC figures in CLAUDE.md's
 * "File-size budgets" bullet must match measured line counts on disk.
 *
 * The ratchet tracks the same monolith paths separately (budget caps); this check
 * catches prose drift like 1182→1022 register updates that forget upstream shrinkage.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { measureFileLoc } from './verify-ratchet.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CLAUDE_MONolith_BULLET_FILE = 'CLAUDE.md';
export const FILE_SIZE_BUDGETS_HEADING = '## File-size budgets (work in progress)';

/** @param {string} filePath */
export function countLines(filePath) {
  const rel = path.relative(ROOT, filePath);
  const measured = measureFileLoc(ROOT, [rel]);
  return measured[rel] ?? 0;
}

/**
 * @param {string} claudeSource
 * @returns {{ path: string, declaredLoc: number, line: number }[]}
 */
export function parseClaudeMonolithLocEntries(claudeSource) {
  const headingIdx = claudeSource.indexOf(FILE_SIZE_BUDGETS_HEADING);
  if (headingIdx === -1) {
    return [];
  }
  const afterHeading = claudeSource.slice(headingIdx);
  const bulletMatch = afterHeading.match(/^\s*-\s+`/m);
  if (!bulletMatch || bulletMatch.index === undefined) {
    return [];
  }
  const bulletStart = headingIdx + bulletMatch.index;
  const line = claudeSource.slice(0, bulletStart).split('\n').length;
  const bulletEnd = claudeSource.indexOf('\n\n', bulletStart);
  const bullet =
    bulletEnd === -1 ? claudeSource.slice(bulletStart) : claudeSource.slice(bulletStart, bulletEnd);

  /** @type {{ path: string, declaredLoc: number, line: number }[]} */
  const entries = [];
  const re = /`((?:apps|packages)\/[^`]+)`\s*\(~(\d+)/g;
  let match;
  while ((match = re.exec(bullet)) !== null) {
    entries.push({
      path: match[1],
      declaredLoc: Number(match[2]),
      line
    });
  }
  return entries;
}

/**
 * @param {string} root
 * @returns {{ ok: boolean, mismatches: { path: string, declaredLoc: number, measuredLoc: number, line: number }[] }}
 */
export function verifyMonolithLocRegister(root) {
  const claudePath = path.join(root, CLAUDE_MONolith_BULLET_FILE);
  const claudeSource = fs.readFileSync(claudePath, 'utf8');
  const entries = parseClaudeMonolithLocEntries(claudeSource);
  /** @type {{ path: string, declaredLoc: number, measuredLoc: number, line: number }[]} */
  const mismatches = [];

  for (const entry of entries) {
    const abs = path.join(root, entry.path);
    if (!fs.existsSync(abs)) {
      mismatches.push({
        path: entry.path,
        declaredLoc: entry.declaredLoc,
        measuredLoc: -1,
        line: entry.line
      });
      continue;
    }
    const measuredLoc = countLines(abs);
    if (measuredLoc !== entry.declaredLoc) {
      mismatches.push({
        path: entry.path,
        declaredLoc: entry.declaredLoc,
        measuredLoc,
        line: entry.line
      });
    }
  }

  return { ok: mismatches.length === 0, mismatches };
}

function main() {
  const result = verifyMonolithLocRegister(ROOT);
  if (!result.ok) {
    console.error('verify-monolith-loc-register: CLAUDE.md ~LOC figures disagree with disk:');
    for (const row of result.mismatches) {
      if (row.measuredLoc === -1) {
        console.error(`  ${CLAUDE_MONolith_BULLET_FILE}:${row.line} — ${row.path} missing on disk`);
      } else {
        console.error(
          `  ${CLAUDE_MONolith_BULLET_FILE}:${row.line} — ${row.path} declares ~${row.declaredLoc}, measured ${row.measuredLoc}`
        );
      }
    }
    console.error(
      '\nRecompute improve item 1 (CLAUDE.md § File-size budgets) or fix the file on disk.'
    );
    process.exit(1);
  }
  const entries = parseClaudeMonolithLocEntries(
    fs.readFileSync(path.join(ROOT, CLAUDE_MONolith_BULLET_FILE), 'utf8')
  );
  console.log(
    `verify-monolith-loc-register: OK (${entries.length} monolith paths match CLAUDE.md ~LOC)`
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
