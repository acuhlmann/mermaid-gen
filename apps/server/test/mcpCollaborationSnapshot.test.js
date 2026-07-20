import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionServicesRegistry } from '../src/state/sessionServices.js';
import { getSessionCollaborationSnapshot } from '../src/mcp/mcpCollaborationActions.js';
import { buildCanvasPreviewPayload } from '../src/mcp/mcpCanvasPayload.js';
import { collectSlotRevisions } from '../src/mcp/mcpSlotRevisions.js';

const ORIGIN = {
  kind: 'external-agent',
  agentId: 'agent-1',
  agentName: 'Cursor',
  color: '#f97316',
  emoji: '🦊'
};

const CHART_V1 =
  '{"archislopVersion":1,"theme":"whiteboard","spec":{"mark":"bar","data":{"values":[{"x":1}]}}}';
const CHART_V2 =
  '{"archislopVersion":1,"theme":"whiteboard","spec":{"mark":"bar","data":{"values":[{"x":2}]}}}';

test('collectSlotRevisions includes all six diagram slots', () => {
  const registry = createSessionServicesRegistry();
  const services = registry.getSessionServices('slot-revisions');
  const revisions = collectSlotRevisions(services.stateStore);
  assert.deepEqual(Object.keys(revisions).sort(), [
    'anything',
    'chart',
    'forms',
    'infographic',
    'mermaid',
    'metaphor3d'
  ]);
});

test('getSessionCollaborationSnapshot omits stale chart proposals', async () => {
  const registry = createSessionServicesRegistry();
  const sessionId = 'snap-chart-stale';
  const services = registry.getSessionServices(sessionId);
  const proposal = services.proposalStore.create({
    sessionId,
    origin: ORIGIN,
    contentType: 'chart',
    baseRevisionId: 0,
    diagramSource: CHART_V1,
    reason: 'proposal'
  });

  const before = getSessionCollaborationSnapshot(services, sessionId);
  assert.equal(before.proposals.length, 1);

  const applied = await services.stateStore.applyDiagramSource({
    contentType: 'chart',
    diagramSource: CHART_V2,
    reason: 'advance',
    origin: { kind: 'user' }
  });
  assert.equal(applied.accepted, true);

  const after = getSessionCollaborationSnapshot(services, sessionId);
  assert.equal(after.proposals.length, 0);
  assert.equal(services.proposalStore.get(proposal.proposalId).status, 'stale');
});

test('buildCanvasPreviewPayload includes the forms slot', () => {
  const registry = createSessionServicesRegistry();
  const services = registry.getSessionServices('canvas-forms-slot');
  const payload = buildCanvasPreviewPayload(services, 'canvas-forms-slot', 'forms');
  assert.ok(payload.slots.forms);
  assert.equal(payload.revisions.forms, 0);
  assert.equal(payload.activeContentType, 'forms');
});
