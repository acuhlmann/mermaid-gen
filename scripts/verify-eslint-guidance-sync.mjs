/**
 * Keeps packages/eslint-config/formatter.cjs's inline GUIDANCE map in sync with
 * packages/eslint-config/guidance.js. The formatter duplicates the map because
 * ESLint loads formatters via require() and ESM<->CJS interop is uneven across
 * versions — nothing previously asserted the two copies agreed.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { GUIDANCE as canonicalGuidance } from '../packages/eslint-config/guidance.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FORMATTER_PATH = path.join(ROOT, 'packages/eslint-config/formatter.cjs');

/**
 * Collapse whitespace so formatter's `\n    ` joins and guidance.js's `\n  `
 * joins compare equal.
 * @param {string} text
 */
export function normalizeGuidanceText(text) {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * @param {string} formatterSource
 * @returns {Record<string, string>}
 */
export function loadFormatterGuidance(formatterSource) {
  const marker = 'const GUIDANCE = ';
  const start = formatterSource.indexOf(marker);
  if (start === -1) {
    throw new Error('verify-eslint-guidance-sync: GUIDANCE block not found in formatter.cjs');
  }
  const objStart = start + marker.length;
  let depth = 0;
  let end = objStart;
  for (; end < formatterSource.length; end++) {
    const ch = formatterSource[end];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        end += 1;
        break;
      }
    }
  }
  const expr = formatterSource.slice(objStart, end);
  // Parentheses required: a bare `{` is parsed as a block, not an object literal.
  return vm.runInNewContext(`(${expr})`, {});
}

/**
 * @param {Record<string, string>} canonical
 * @param {Record<string, string>} formatter
 */
export function compareGuidanceMaps(canonical, formatter) {
  const missing = Object.keys(canonical).filter((key) => !(key in formatter));
  const extra = Object.keys(formatter).filter((key) => !(key in canonical));
  const mismatched = Object.keys(canonical).filter((key) => {
    if (!(key in formatter)) return false;
    return normalizeGuidanceText(canonical[key]) !== normalizeGuidanceText(formatter[key]);
  });
  return {
    ok: missing.length === 0 && extra.length === 0 && mismatched.length === 0,
    missing,
    extra,
    mismatched
  };
}

function main() {
  const formatterSource = fs.readFileSync(FORMATTER_PATH, 'utf8');
  const formatterGuidance = loadFormatterGuidance(formatterSource);
  const result = compareGuidanceMaps(canonicalGuidance, formatterGuidance);
  if (!result.ok) {
    console.error(
      'verify-eslint-guidance-sync: formatter.cjs GUIDANCE is out of sync with guidance.js.'
    );
    if (result.missing.length > 0) {
      console.error('  in guidance.js but missing from formatter.cjs:', result.missing);
    }
    if (result.extra.length > 0) {
      console.error('  in formatter.cjs but missing from guidance.js:', result.extra);
    }
    if (result.mismatched.length > 0) {
      console.error('  same rule id, different text:', result.mismatched);
    }
    process.exitCode = 1;
    return;
  }
  console.log(
    `verify-eslint-guidance-sync: OK (${Object.keys(canonicalGuidance).length} rules in sync)`
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
