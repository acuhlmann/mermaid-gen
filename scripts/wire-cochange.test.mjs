import assert from 'node:assert/strict';
import test from 'node:test';
import { detectWireCoChangeRisks, formatWireCoChangeRisks } from './wire-cochange.mjs';

test('detectWireCoChangeRisks flags diagramSchema without web consumer', () => {
  const risks = detectWireCoChangeRisks([
    'packages/shared/src/diagramSchema.ts',
    'packages/shared/test/diagramSchema.test.ts',
    'apps/server/src/routes/copilot.ts'
  ]);
  assert.ok(risks.some((r) => r.id === 'diagram-schema-producer-only'));
});

test('detectWireCoChangeRisks passes diagramSchema with server+web+test', () => {
  const risks = detectWireCoChangeRisks([
    'packages/shared/src/diagramSchema.ts',
    'packages/shared/test/diagramSchema.test.ts',
    'apps/server/src/state/diagramStateStore.ts',
    'apps/web/src/state/diagramStore.js'
  ]);
  assert.equal(risks.length, 0);
});

test('detectWireCoChangeRisks flags AG-UI emitter without translator', () => {
  const risks = detectWireCoChangeRisks([
    'packages/shared/src/agentStreamEmitter.ts',
    'packages/shared/test/wireRoundTrip.test.ts'
  ]);
  assert.ok(risks.some((r) => r.id === 'ag-ui-stream-producer-only'));
});

test('detectWireCoChangeRisks flags MCP tool change without test', () => {
  const risks = detectWireCoChangeRisks(['apps/server/src/mcp/tools/registerGetMcpBinding.js']);
  assert.ok(risks.some((r) => r.id === 'mcp-tool-without-test'));
});

test('detectWireCoChangeRisks ignores MCP tools README-only edits', () => {
  const risks = detectWireCoChangeRisks(['apps/server/src/mcp/tools/README.md']);
  assert.equal(risks.length, 0);
});

test('detectWireCoChangeRisks flags sessionEventBus without client test', () => {
  const risks = detectWireCoChangeRisks([
    'apps/server/src/state/sessionEventBus.ts',
    'apps/server/test/sessionEventBus.test.js',
    'apps/web/src/state/sessionEventsClient.js'
  ]);
  assert.ok(risks.some((r) => r.id === 'session-events-producer-only'));
});

test('detectWireCoChangeRisks passes sessionEventBus with client and both tests', () => {
  const risks = detectWireCoChangeRisks([
    'apps/server/src/state/sessionEventBus.ts',
    'apps/server/test/sessionEventBus.test.js',
    'apps/web/src/state/sessionEventsClient.js',
    'apps/web/test/sessionEventsClient.test.js'
  ]);
  assert.equal(risks.length, 0);
});

test('detectWireCoChangeRisks flags chartDslTool without test', () => {
  const risks = detectWireCoChangeRisks(['apps/server/src/tools/chartDslTool.js']);
  assert.ok(risks.some((r) => r.id === 'chart-tool-without-test'));
});

test('detectWireCoChangeRisks flags formsA2uiTool without test', () => {
  const risks = detectWireCoChangeRisks(['apps/server/src/tools/formsA2uiTool.js']);
  assert.ok(risks.some((r) => r.id === 'forms-tool-without-test'));
});

test('detectWireCoChangeRisks flags sessionEventBus without client', () => {
  const risks = detectWireCoChangeRisks([
    'apps/server/src/state/sessionEventBus.ts',
    'apps/server/test/sessionEventBus.test.js'
  ]);
  assert.ok(risks.some((r) => r.id === 'session-events-producer-only'));
});

test('formatWireCoChangeRisks includes agent guidance', () => {
  const text = formatWireCoChangeRisks(
    detectWireCoChangeRisks(['packages/shared/src/diagramSchema.ts'])
  );
  assert.match(text, /Agent guidance/);
  assert.match(text, /diagram-schema-producer-only/);
});
