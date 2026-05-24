// Per-rule guidance strings appended to ESLint output by formatter.cjs.
// Adding a new rule to a config? Add a matching entry here so agents see the
// canonical fix. See docs/recipes/add-eslint-rule.md.

export const GUIDANCE = {
  'max-lines': [
    'Files this size are hard for agents to edit in one pass.',
    'Prefer extracting a slice into a sibling module (ADR-0005).',
    'If a split is genuinely not yet possible, raise the threshold for THIS file with a written reason:',
    '  /* eslint max-lines: ["warn", { max: <new>, skipBlankLines: true, skipComments: true }] -- (reason: pending <split-name>) */',
  ].join('\n  '),
  'max-lines-per-function': [
    'Long functions resist comprehension and surgical edits.',
    'Extract guard clauses and named helpers; a function over the limit usually contains 2-3 cohesive sub-tasks.',
    'Suppress with a reason if the function is essentially a state machine that would be worse when split:',
    '  // eslint-disable-next-line max-lines-per-function -- (reason: ...)',
  ].join('\n  '),
  'max-params': [
    'Long parameter lists are a smell for a missing options object or extracted dependency.',
    'Group related params into an `opts` object, or pass a context/factory.',
    'Suppress only when the order is fixed by an external contract:',
    '  // eslint-disable-next-line max-params -- (reason: matches <api/spec>)',
  ].join('\n  '),
  complexity: [
    'High cyclomatic complexity correlates with subtle bugs and slow agent edits.',
    'Replace nested if/else with guard clauses, lookup tables, or polymorphism.',
    'Suppress with a written reason if the branches are a small, stable state machine.',
  ].join('\n  '),
  '@factory/filename-match-export': [
    'Default export should match the filename (React component convention).',
    'Either rename the file to match the export, or rename the export to match the file.',
    'See packages/eslint-config/frontend.js for the configured paths.',
  ].join('\n  '),
  '@factory/no-log-exception-with-throw': [
    'Logging an exception in the same block as a throw double-reports the error.',
    'Either log OR throw; the surrounding handler will log if needed.',
  ].join('\n  '),
  '@factory/no-exported-string-union-types': [
    'Exported string-literal unions are harder for agents to navigate than enums or Zod schemas.',
    'Prefer a Zod enum in packages/shared or a const object + keyof typeof for wire constants.',
    'Suppress only when mirroring an external API shape:',
    '  // eslint-disable-next-line @factory/no-exported-string-union-types -- (reason: ...)',
  ].join('\n  '),
  '@factory/no-exported-function-expressions': [
    'Named function declarations are easier for agents to find and refactor than exported arrow functions.',
    'Replace `export const foo = () => {}` with `export function foo() {}`.',
    'Suppress when the export must stay an expression (e.g. generic callback factory):',
    '  // eslint-disable-next-line @factory/no-exported-function-expressions -- (reason: ...)',
  ].join('\n  '),
  '@typescript-eslint/no-unused-vars': [
    'Dead code drifts. Either delete or prefix with `_` if intentional.',
    'For caught errors, `catch (_err)` signals "intentionally unused".',
  ].join('\n  '),
  'no-unused-vars': [
    'Dead code drifts. Either delete or prefix with `_` if intentional.',
    'For caught errors, `catch (_err)` signals "intentionally unused".',
  ].join('\n  '),
};
