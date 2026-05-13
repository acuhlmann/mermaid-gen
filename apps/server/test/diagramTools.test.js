import test from 'node:test';
import assert from 'node:assert/strict';
import { createDiagramTools } from '../src/agents/diagramTools.js';
import { createDiagramStateStore } from '../src/state/diagramStateStore.js';

test('apply_mermaid_patch tool applies valid Mermaid source', async () => {
  const stateStore = createDiagramStateStore();
  const [, applyMermaidPatch] = createDiagramTools({ stateStore });

  const payload = await applyMermaidPatch.invoke({
    diagramSource: 'flowchart TD\n  Start[Start] --> Gateway[API Gateway]',
    reason: 'add gateway'
  });
  const result = JSON.parse(payload);

  assert.equal(result.accepted, true);
  assert.equal(result.state.revisionId, 1);
  assert.match(stateStore.getState().diagramSource, /Gateway/);
});

test('apply_mermaid_patch tool rejects invalid Mermaid source', async () => {
  const stateStore = createDiagramStateStore();
  const before = stateStore.getState();
  const [, applyMermaidPatch] = createDiagramTools({ stateStore });

  const payload = await applyMermaidPatch.invoke({
    diagramSource: 'not-a-diagram',
    reason: 'bad update'
  });
  const result = JSON.parse(payload);

  assert.equal(result.accepted, false);
  assert.equal(stateStore.getState(), before);
});

test('apply_mermaid_patch retries transient MCP failures before local parser fallback', async () => {
  const stateStore = createDiagramStateStore();
  const [, applyMermaidPatch] = createDiagramTools({ stateStore });
  const originalFetch = global.fetch;
  const originalMcpUrl = process.env.MERMAID_MCP_URL;
  const originalRetries = process.env.MERMAID_MCP_MAX_RETRIES;
  const originalDelay = process.env.MERMAID_MCP_RETRY_DELAY_MS;
  let attempts = 0;

  process.env.MERMAID_MCP_URL = 'https://example.com/validate';
  process.env.MERMAID_MCP_MAX_RETRIES = '1';
  process.env.MERMAID_MCP_RETRY_DELAY_MS = '0';
  global.fetch = async () => {
    attempts += 1;
    throw new Error('temporary network issue');
  };

  try {
    const payload = await applyMermaidPatch.invoke({
      diagramSource: 'flowchart TD\n  Start[Start] --> EndNode[End]',
      reason: 'retry mcp'
    });
    const result = JSON.parse(payload);

    assert.equal(result.accepted, true);
    assert.equal(result.metadata.validator, 'local-parser-fallback');
    assert.equal(attempts, 2);
  } finally {
    global.fetch = originalFetch;
    process.env.MERMAID_MCP_URL = originalMcpUrl;
    process.env.MERMAID_MCP_MAX_RETRIES = originalRetries;
    process.env.MERMAID_MCP_RETRY_DELAY_MS = originalDelay;
  }
});
