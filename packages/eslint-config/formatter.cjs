// Agent-guidance ESLint formatter. Renders a compact result block plus a
// trailing "agent guidance" section that quotes the canonical fix for every
// rule id that fired. Fowler's "Sensors for Coding Agents" pattern: don't
// just emit a message id, hand the agent the fix.
//
// Loaded via: eslint --format ./node_modules/@archislop/eslint-config/formatter.cjs

'use strict';

const path = require('node:path');

// Mirror packages/eslint-config/guidance.js (ESM). Kept inline because
// formatters are loaded via require() and ESM<->CJS interop is uneven across
// ESLint versions; the duplication is small and well-contained.
const GUIDANCE = {
  'max-lines': [
    'Files this size are hard for agents to edit in one pass.',
    'Prefer extracting a slice into a sibling module (ADR-0005).',
    'If a split is genuinely not yet possible, raise the threshold for THIS file with a written reason:',
    '  /* eslint max-lines: ["warn", { max: <new>, skipBlankLines: true, skipComments: true }] -- (reason: pending <split-name>) */',
  ].join('\n    '),
  'max-lines-per-function': [
    'Long functions resist comprehension and surgical edits.',
    'Extract guard clauses and named helpers; a function over the limit usually contains 2-3 cohesive sub-tasks.',
    'Suppress with a reason if the function is essentially a state machine that would be worse when split:',
    '  // eslint-disable-next-line max-lines-per-function -- (reason: ...)',
  ].join('\n    '),
  'max-params': [
    'Long parameter lists signal a missing options object or extracted dependency.',
    'Group related params into an `opts` object, or pass a context/factory.',
    'Suppress only when the order is fixed by an external contract.',
  ].join('\n    '),
  complexity: [
    'High cyclomatic complexity correlates with subtle bugs and slow agent edits.',
    'Replace nested if/else with guard clauses, lookup tables, or polymorphism.',
    'Suppress with a written reason if the branches are a small, stable state machine.',
  ].join('\n    '),
  '@factory/filename-match-export': [
    'Default export should match the filename (React component convention).',
    'Either rename the file to match the export, or rename the export to match the file.',
  ].join('\n    '),
  '@factory/no-log-exception-with-throw': [
    'Logging an exception in the same block as a throw double-reports the error.',
    'Either log OR throw; the surrounding handler will log if needed.',
  ].join('\n    '),
  '@factory/no-exported-string-union-types': [
    'Exported string-literal unions are harder for agents to navigate than enums or Zod schemas.',
    'Prefer a Zod enum in packages/shared or a const object + keyof typeof for wire constants.',
  ].join('\n    '),
  '@factory/no-exported-function-expressions': [
    'Named function declarations are easier for agents to find and refactor than exported arrow functions.',
    'Replace `export const foo = () => {}` with `export function foo() {}`.',
  ].join('\n    '),
  '@typescript-eslint/no-unused-vars': [
    'Dead code drifts. Either delete or prefix with `_` if intentional.',
    'For caught errors, `catch (_err)` signals "intentionally unused".',
  ].join('\n    '),
  'no-unused-vars': [
    'Dead code drifts. Either delete or prefix with `_` if intentional.',
    'For caught errors, `catch (_err)` signals "intentionally unused".',
  ].join('\n    '),
  '@typescript-eslint/no-explicit-any': [
    '`any` disables the type-checking that makes TS files readable for agents.',
    'Prefer a precise type, `unknown` + a narrowing guard, or a Zod-inferred type from packages/shared.',
    'Suppress only at a genuine external boundary: // eslint-disable-next-line @typescript-eslint/no-explicit-any -- (reason: ...)',
  ].join('\n    '),
  '@typescript-eslint/ban-ts-comment': [
    '`@ts-ignore`/`@ts-expect-error` hide real type errors from the next agent.',
    'Fix the underlying type, or use `@ts-expect-error -- (reason: ...)` so it self-removes when the error goes away.',
  ].join('\n    '),
  '@typescript-eslint/no-empty-object-type': [
    'An empty `{}` type means "any non-nullish value", which is rarely intended.',
    'Use `object`, `Record<string, unknown>`, `unknown`, or a named interface with real fields.',
  ].join('\n    '),
  '@typescript-eslint/no-floating-promises': [
    'This promise is never awaited or handled — its errors vanish and ordering races.',
    '`await` it, prefix with `void` to deliberately ignore, or add `.catch(...)`.',
  ].join('\n    '),
  '@typescript-eslint/no-base-to-string': [
    '`String(x)` / template on this value yields "[object Object]" — its toString is the default.',
    'Stringify a specific field, `JSON.stringify(x)`, or narrow to a primitive first.',
  ].join('\n    '),
};

const ESC = '[';
const RESET = `${ESC}0m`;
const BOLD = `${ESC}1m`;
const DIM = `${ESC}2m`;
const RED = `${ESC}31m`;
const YELLOW = `${ESC}33m`;
const CYAN = `${ESC}36m`;
const GRAY = `${ESC}90m`;

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, s) => (useColor ? `${code}${s}${RESET}` : s);

function severityLabel(sev) {
  return sev === 2 ? c(RED, 'error') : c(YELLOW, 'warning');
}

function relPath(p) {
  return path.relative(process.cwd(), p) || p;
}

function renderResults(results) {
  const lines = [];
  let errorCount = 0;
  let warningCount = 0;

  for (const result of results) {
    if (!result.messages || result.messages.length === 0) continue;
    lines.push('');
    lines.push(c(BOLD, relPath(result.filePath)));
    for (const m of result.messages) {
      if (m.severity === 2) errorCount += 1;
      else warningCount += 1;
      const loc = c(DIM, `  ${m.line}:${m.column}`);
      const sev = `  ${severityLabel(m.severity)}`;
      const rule = m.ruleId ? c(GRAY, `  ${m.ruleId}`) : '';
      const msg = `  ${m.message}`;
      lines.push(`${loc}${sev}${msg}${rule}`);
    }
  }

  const summary = `${errorCount} error(s), ${warningCount} warning(s)`;
  if (errorCount + warningCount > 0) {
    lines.push('');
    lines.push(c(errorCount > 0 ? RED : YELLOW, summary));
  }
  return { body: lines.join('\n'), errorCount, warningCount };
}

function renderGuidance(results) {
  const seen = new Set();
  const blocks = [];
  for (const r of results) {
    for (const m of r.messages ?? []) {
      if (!m.ruleId || seen.has(m.ruleId)) continue;
      const guidance = GUIDANCE[m.ruleId];
      if (!guidance) continue;
      seen.add(m.ruleId);
      blocks.push(
        `${c(CYAN, `[agent guidance: ${m.ruleId}]`)}\n    ${guidance}`,
      );
    }
  }
  if (blocks.length === 0) return '';
  return `\n\n${c(BOLD, 'Agent guidance')} ${c(DIM, '(read before suppressing)')}\n\n${blocks.join('\n\n')}\n`;
}

module.exports = function aiFormatter(results) {
  const { body, errorCount, warningCount } = renderResults(results);
  if (errorCount + warningCount === 0) return '';
  return `${body}${renderGuidance(results)}`;
};
