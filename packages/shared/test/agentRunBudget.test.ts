import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAgentRunBudgetExceededMessage,
  resolveAgentRepairMaxAttempts,
  resolveAgentRunBudgetMs
} from '../src/agentRunBudget.js';

test('resolveAgentRunBudgetMs keeps separate fast and quality defaults', () => {
  assert.equal(resolveAgentRunBudgetMs('fast'), 75_000);
  assert.equal(resolveAgentRunBudgetMs('quality'), 105_000);
  assert.equal(resolveAgentRunBudgetMs('unknown'), 75_000);
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
    180_000
  );
});

test('resolveAgentRepairMaxAttempts defaults quality lower than fast', () => {
  assert.equal(resolveAgentRepairMaxAttempts('fast'), 2);
  assert.equal(resolveAgentRepairMaxAttempts('quality'), 1);
});

test('resolveAgentRepairMaxAttempts supports Mermaid and Infographic envs', () => {
  assert.equal(
    resolveAgentRepairMaxAttempts('quality', { MERMAID_REPAIR_MAX_ATTEMPTS_QUALITY: '3' }),
    3
  );
  assert.equal(
    resolveAgentRepairMaxAttempts('fast', { INFOGRAPHIC_REPAIR_MAX_ATTEMPTS_FAST: '4' }, 'infographic'),
    4
  );
  assert.equal(
    resolveAgentRepairMaxAttempts('fast', { INFOGRAPHIC_REPAIR_MAX_ATTEMPTS: '99' }, 'infographic'),
    6
  );
});

test('buildAgentRunBudgetExceededMessage includes tier and seconds', () => {
  assert.match(buildAgentRunBudgetExceededMessage('quality', 105_000), /Quality time limit \(105s\)/);
});
