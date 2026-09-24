/**
 * Ensures no scripts/*.test.mjs turns verify:ratchet into a hard CI gate by asserting
 * zero live violations after measureAll(ROOT, …). The ratchet is improve's work queue only;
 * see docs/routines/ledger/improve.md (2026-08-21 incident).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Assertions that make a live-repo ratchet measurement fail CI for every PR. */
export const HARD_GATE_ASSERTIONS = [
  {
    id: 'result-ok-true',
    re: /assert\.equal\s*\(\s*result\.ok\s*,\s*true\s*\)/
  },
  {
    id: 'result-ok-truthy',
    re: /assert\.ok\s*\(\s*result\.ok\s*(?:,|\))/
  },
  {
    id: 'violations-empty',
    re: /assert\.deepEqual\s*\(\s*result\.violations\s*,\s*\[\s*\]\s*\)/
  },
  {
    id: 'violations-length-zero',
    re: /assert\.equal\s*\(\s*result\.violations\.length\s*,\s*0\s*\)/
  }
];

/**
 * Split a test file into top-level `test(...)` callback bodies (approximate brace match).
 * @param {string} source
 * @returns {{ startLine: number, text: string }[]}
 */
export function splitTopLevelTests(source) {
  /** @type {{ startLine: number, text: string }[]} */
  const blocks = [];
  const re = /^\s*test\s*\(/gm;
  let match;
  while ((match = re.exec(source)) !== null) {
    const start = match.index;
    const startLine = source.slice(0, start).split('\n').length;
    const braceStart = source.indexOf('{', match.index);
    if (braceStart === -1) {
      continue;
    }
    let depth = 0;
    let inSingle = false;
    let inDouble = false;
    let inTemplate = false;
    let escape = false;
    let end = braceStart;
    for (let i = braceStart; i < source.length; i++) {
      const ch = source[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\' && (inSingle || inDouble || inTemplate)) {
        escape = true;
        continue;
      }
      if (!inDouble && !inTemplate && ch === "'") {
        inSingle = !inSingle;
        continue;
      }
      if (!inSingle && !inTemplate && ch === '"') {
        inDouble = !inDouble;
        continue;
      }
      if (!inSingle && !inDouble && ch === '`') {
        inTemplate = !inTemplate;
        continue;
      }
      if (inSingle || inDouble || inTemplate) {
        continue;
      }
      if (ch === '{') {
        depth += 1;
      } else if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }
    blocks.push({ startLine, text: source.slice(start, end) });
    re.lastIndex = end;
  }
  return blocks;
}

/**
 * Remove string/template literal bodies so fixture text in unit tests is not scanned as code.
 * @param {string} text
 */
export function stripStringLiterals(text) {
  return text
    .replace(/`[^`\\]*(?:\\.[^`\\]*)*`/gs, '``')
    .replace(/'[^'\\]*(?:\\.[^'\\]*)*'/g, "''")
    .replace(/"[^"\\]*(?:\\.[^"\\]*)*"/g, '""');
}

/**
 * @param {string} blockText
 * @returns {string[]}
 */
export function hardGatePatternsInLiveRatchetTest(blockText) {
  const code = stripStringLiterals(blockText);
  if (!/measureAll\s*\(\s*ROOT/.test(code)) {
    return [];
  }
  if (!/compareRatchet\s*\(/.test(code)) {
    return [];
  }
  return HARD_GATE_ASSERTIONS.filter(({ re }) => re.test(code)).map(({ id }) => id);
}

/**
 * @param {string} source
 * @param {string} relativePath
 * @returns {{ file: string, startLine: number, patterns: string[] }[]}
 */
export function scanTestFileForRatchetHardGate(source, relativePath) {
  const hits = [];
  for (const block of splitTopLevelTests(source)) {
    const patterns = hardGatePatternsInLiveRatchetTest(block.text);
    if (patterns.length > 0) {
      hits.push({ file: relativePath, startLine: block.startLine, patterns });
    }
  }
  return hits;
}

/**
 * @param {string} scriptsDir absolute path to scripts/
 * @returns {{ ok: boolean, hits: { file: string, startLine: number, patterns: string[] }[] }}
 */
export function scanAllScriptTests(scriptsDir) {
  const names = fs
    .readdirSync(scriptsDir)
    .filter((name) => name.endsWith('.test.mjs'))
    .sort();
  /** @type {{ file: string, startLine: number, patterns: string[] }[]} */
  const hits = [];
  for (const name of names) {
    const full = path.join(scriptsDir, name);
    const source = fs.readFileSync(full, 'utf8');
    hits.push(...scanTestFileForRatchetHardGate(source, path.join('scripts', name)));
  }
  return { ok: hits.length === 0, hits };
}

function main() {
  const result = scanAllScriptTests(path.join(ROOT, 'scripts'));
  if (!result.ok) {
    console.error(
      'verify-ratchet-no-gate: a scripts/*.test.mjs file would turn verify:ratchet into a CI gate:'
    );
    for (const hit of result.hits) {
      console.error(`  ${hit.file}:${hit.startLine} — ${hit.patterns.join(', ')}`);
    }
    console.error(
      '\nThe ratchet gates no build. Assert compareRatchet return shape, not zero violations.'
    );
    process.exit(1);
  }
  console.log('verify-ratchet-no-gate: OK (no live-repo ratchet hard gates in script tests)');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
