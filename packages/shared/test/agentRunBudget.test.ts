import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appendLastValidationError,
  buildAgentRunBudgetExceededMessage,
  extractLastValidationError,
  resolveAgentRepairAttemptProfile,
  resolveAgentRepairMaxAttempts,
  resolveAgentRunBudgetMs
} from '../src/agentRunBudget.js';

test('resolveAgentRunBudgetMs keeps separate fast and quality defaults', () => {
  assert.equal(resolveAgentRunBudgetMs('fast'), 120_000);
  assert.equal(resolveAgentRunBudgetMs('quality'), 210_000);
  assert.equal(resolveAgentRunBudgetMs('unknown'), 120_000);
});

test('resolveAgentRunBudgetMs gives Go Mad extra headroom for the patch_retry turn', () => {
  assert.equal(resolveAgentRunBudgetMs('fast', {}, 'goMad'), 150_000);
  assert.equal(resolveAgentRunBudgetMs('quality', {}, 'goMad'), 240_000);
  // Other modes are unaffected by the mode argument.
  assert.equal(resolveAgentRunBudgetMs('quality', {}, 'refine'), 210_000);
  assert.equal(resolveAgentRunBudgetMs('quality', {}, 'erlich'), 210_000);
});

test('resolveAgentRunBudgetMs supports profile env overrides with clamps', () => {
  assert.equal(
    resolveAgentRunBudgetMs('quality', { MERMAID_AGENT_RUN_BUDGET_MS_QUALITY: '120000' }),
    120_000
  );
  assert.equal(
    resolveAgentRunBudgetMs('fast', { MERMAID_AGENT_RUN_BUDGET_MS_FAST: '1000' }),
    30_000
  );
  assert.equal(
    resolveAgentRunBudgetMs('quality', { MERMAID_AGENT_RUN_BUDGET_MS: '999999' }),
    300_000
  );
});

test('resolveAgentRepairMaxAttempts defaults match across profiles', () => {
  assert.equal(resolveAgentRepairMaxAttempts('fast'), 2);
  assert.equal(resolveAgentRepairMaxAttempts('quality'), 2);
});

test('resolveAgentRepairMaxAttempts supports Mermaid and Infographic envs', () => {
  assert.equal(
    resolveAgentRepairMaxAttempts('quality', { MERMAID_REPAIR_MAX_ATTEMPTS_QUALITY: '3' }),
    3
  );
  assert.equal(
    resolveAgentRepairMaxAttempts(
      'fast',
      { INFOGRAPHIC_REPAIR_MAX_ATTEMPTS_FAST: '4' },
      'infographic'
    ),
    4
  );
  assert.equal(
    resolveAgentRepairMaxAttempts('fast', { INFOGRAPHIC_REPAIR_MAX_ATTEMPTS: '99' }, 'infographic'),
    6
  );
});

test('resolveAgentRepairAttemptProfile climbs to quality on attempt 2+', () => {
  assert.equal(resolveAgentRepairAttemptProfile('fast', 1), 'fast');
  assert.equal(resolveAgentRepairAttemptProfile('quality', 1), 'quality');
  assert.equal(resolveAgentRepairAttemptProfile('fast', 2), 'quality');
  assert.equal(resolveAgentRepairAttemptProfile('quality', 2), 'quality');
  assert.equal(resolveAgentRepairAttemptProfile('fast', 3), 'quality');
});

test('buildAgentRunBudgetExceededMessage includes tier and seconds', () => {
  assert.match(
    buildAgentRunBudgetExceededMessage('quality', 210_000),
    /Quality time limit \(210s\)/
  );
});

test('appendLastValidationError carries the validator diagnostic into failure messages', () => {
  const message = appendLastValidationError(
    'Agent run exceeded the Fast time limit (120s).',
    "Mermaid parser rejected source: Parse error on line 2:\nExpecting 'SQE', got 'PS'"
  );
  assert.match(message, /Last validation error: Mermaid parser rejected source/);
  assert.equal(
    extractLastValidationError(message),
    "Mermaid parser rejected source: Parse error on line 2:\nExpecting 'SQE', got 'PS'"
  );
});

test('appendLastValidationError no-ops without a diagnostic and truncates long ones', () => {
  assert.equal(appendLastValidationError('Budget exceeded.', null), 'Budget exceeded.');
  assert.equal(appendLastValidationError('Budget exceeded.', '  '), 'Budget exceeded.');
  assert.equal(appendLastValidationError('Same text.', 'Same text.'), 'Same text.');
  const long = 'x'.repeat(2000);
  const message = appendLastValidationError('Budget exceeded.', long);
  assert.ok(message.length < 700);
  assert.match(message, /…$/);
});

test('extractLastValidationError returns null without the marker', () => {
  assert.equal(extractLastValidationError('Agent run exceeded the Fast time limit (120s).'), null);
  assert.equal(extractLastValidationError(null), null);
});
