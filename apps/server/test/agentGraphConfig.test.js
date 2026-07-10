import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_MERMAID_AGENT_MAX_TOOL_CALLS_PER_RUN,
  DEFAULT_MERMAID_AGENT_RECURSION_LIMIT,
  createDiagramAgentMiddleware,
  getAgentRunnableConfig,
  resolveAgentRecursionLimit,
  resolveAgentToolCallRunLimit
} from '../src/agents/agentGraphConfig.js';

test('resolveAgentRecursionLimit defaults and clamps', () => {
  assert.equal(resolveAgentRecursionLimit({}), DEFAULT_MERMAID_AGENT_RECURSION_LIMIT);
  assert.equal(
    resolveAgentRecursionLimit({ MERMAID_AGENT_RECURSION_LIMIT: '' }),
    DEFAULT_MERMAID_AGENT_RECURSION_LIMIT
  );
  assert.equal(
    resolveAgentRecursionLimit({ MERMAID_AGENT_RECURSION_LIMIT: 'not-a-number' }),
    DEFAULT_MERMAID_AGENT_RECURSION_LIMIT
  );
  assert.equal(resolveAgentRecursionLimit({ MERMAID_AGENT_RECURSION_LIMIT: '80' }), 80);
  assert.equal(resolveAgentRecursionLimit({ MERMAID_AGENT_RECURSION_LIMIT: '10' }), 25);
  assert.equal(resolveAgentRecursionLimit({ MERMAID_AGENT_RECURSION_LIMIT: '999' }), 200);
});

test('getAgentRunnableConfig exposes recursionLimit', () => {
  assert.deepEqual(getAgentRunnableConfig({ MERMAID_AGENT_RECURSION_LIMIT: '42' }), {
    recursionLimit: 42
  });
});

test('resolveAgentToolCallRunLimit defaults disables at zero and clamps', () => {
  assert.equal(resolveAgentToolCallRunLimit({}), DEFAULT_MERMAID_AGENT_MAX_TOOL_CALLS_PER_RUN);
  assert.equal(
    resolveAgentToolCallRunLimit({ MERMAID_AGENT_MAX_TOOL_CALLS_PER_RUN: '' }),
    DEFAULT_MERMAID_AGENT_MAX_TOOL_CALLS_PER_RUN
  );
  assert.equal(
    resolveAgentToolCallRunLimit({ MERMAID_AGENT_MAX_TOOL_CALLS_PER_RUN: 'not-a-number' }),
    DEFAULT_MERMAID_AGENT_MAX_TOOL_CALLS_PER_RUN
  );
  assert.equal(resolveAgentToolCallRunLimit({ MERMAID_AGENT_MAX_TOOL_CALLS_PER_RUN: '0' }), null);
  assert.equal(resolveAgentToolCallRunLimit({ MERMAID_AGENT_MAX_TOOL_CALLS_PER_RUN: '-1' }), null);
  assert.equal(resolveAgentToolCallRunLimit({ MERMAID_AGENT_MAX_TOOL_CALLS_PER_RUN: '20' }), 20);
  assert.equal(resolveAgentToolCallRunLimit({ MERMAID_AGENT_MAX_TOOL_CALLS_PER_RUN: '2' }), 4);
  assert.equal(resolveAgentToolCallRunLimit({ MERMAID_AGENT_MAX_TOOL_CALLS_PER_RUN: '99' }), 40);
});

test('createDiagramAgentMiddleware is empty when tool run limit disabled', () => {
  assert.equal(
    createDiagramAgentMiddleware({ MERMAID_AGENT_MAX_TOOL_CALLS_PER_RUN: '0' }).length,
    0
  );
});

test('createDiagramAgentMiddleware returns one limiter when enabled', () => {
  assert.equal(
    createDiagramAgentMiddleware({ MERMAID_AGENT_MAX_TOOL_CALLS_PER_RUN: '8' }).length,
    1
  );
});
