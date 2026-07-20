import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

import { RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { buildFormsSeedDoc } from '@archislop/shared';

import { createSessionServicesRegistry } from '../src/state/sessionServices.js';
import { createPairingCodeStore } from '../src/state/pairingCodeStore.js';
import { createAgentTokenStore } from '../src/state/agentTokenStore.js';
import { createMcpRateLimiter } from '../src/mcp/mcpRateLimit.js';
import { createMcpHandler } from '../src/mcp/mcpServer.js';
import { createCopilotRouter } from '../src/routes/copilot.js';
import { MCP_APP_URIS } from '../src/mcp/mcpAppUris.js';

function setupServer() {
  const app = express();
  app.use(express.json());
  const sessionRegistry = createSessionServicesRegistry();
  const pairingCodeStore = createPairingCodeStore();
  const agentTokenStore = createAgentTokenStore();
  const mcpRateLimiter = createMcpRateLimiter();
  app.use(
    '/api/copilotkit',
    createCopilotRouter({
      resolveServices: (req) => sessionRegistry.getSessionServicesForRequest(req),
      sessionExists: (sessionId) => sessionRegistry.hasSession(sessionId),
      pairingCodeStore,
      agentTokenStore,
      sessionRegistry
    })
  );
  app.all(
    '/mcp',
    createMcpHandler({
      sessionRegistry,
      pairingCodeStore,
      agentTokenStore,
      mcpRateLimiter
    })
  );
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      const closeServer = () =>
        new Promise((done) => {
          server.closeAllConnections?.();
          server.close(() => done());
        });
      resolve({ server, sessionRegistry, pairingCodeStore, port, closeServer });
    });
  });
}

async function connectClient(port, query = '') {
  const suffix = query ? (query.startsWith('?') ? query : `?${query}`) : '';
  const transport = new StreamableHTTPClientTransport(
    new URL(`http://127.0.0.1:${port}/mcp${suffix}`)
  );
  const client = new Client({ name: 'archislop-test-client', version: '0.0.1' });
  await client.connect(transport);
  return { client, transport };
}

function callTool(client, name, args) {
  return client.callTool({ name, arguments: args });
}

function parseToolText(result) {
  if (!result?.content?.length) return null;
  const t = result.content.find((c) => c.type === 'text');
  if (!t?.text) return null;
  try {
    return JSON.parse(t.text);
  } catch {
    return t.text;
  }
}

test('MCP: end-to-end handshake → presence → propose → accept → state advances', async (t) => {
  const { sessionRegistry, pairingCodeStore, port, closeServer } = await setupServer();
  t.after(closeServer);

  const sessionId = 'mcp-smoke-1';
  const code = pairingCodeStore.getOrCreateCode(sessionId);
  const services = sessionRegistry.getSessionServices(sessionId);
  const eventEnvelopes = [];
  const offBus = services.eventBus.subscribe(sessionId, (e) => eventEnvelopes.push(e));
  t.after(offBus);

  const { client, transport } = await connectClient(port, `pairing=${encodeURIComponent(code)}`);
  t.after(() => client.close());
  t.after(() => transport.close());

  // 1. Tool list reflects our registered tools
  const tools = await client.listTools();
  const names = new Set(tools.tools.map((t) => t.name));
  for (const required of [
    'get_mcp_binding',
    'get_session_bootstrap',
    'open_session_pairing',
    'register_agent',
    'get_session_state',
    'propose_diagram_edit',
    'wait_for_resolution',
    'drop_insight',
    'set_focus',
    'react',
    'resolve_handshake',
    'resolve_proposal',
    'get_session_snapshot',
    'open_session_dashboard',
    'open_critique_review',
    'request_critique_fix',
    'request_proposal_changes',
    'open_diagram_canvas',
    'get_insights',
    'open_insights_feed',
    'get_my_proposals',
    'open_my_proposals',
    'open_proposal_review',
    'open_session_events',
    'open_welcome',
    'open_compose_insight',
    'open_focus_picker',
    'open_web_companion',
    'open_handshake_review'
  ]) {
    assert.ok(names.has(required), `expected MCP tool ${required} to be registered`);
  }

  const registerTool = tools.tools.find((t) => t.name === 'register_agent');
  const proposeTool = tools.tools.find((t) => t.name === 'propose_diagram_edit');
  assert.equal(
    registerTool?._meta?.ui?.resourceUri ?? registerTool?._meta?.['ui/resourceUri'],
    'ui://archislop/web-companion.html'
  );
  assert.equal(
    proposeTool?._meta?.ui?.resourceUri ?? proposeTool?._meta?.['ui/resourceUri'],
    'ui://archislop/web-companion.html'
  );

  const resources = await client.listResources();
  const resourceUris = new Set(resources.resources.map((r) => r.uri));
  for (const uri of MCP_APP_URIS) {
    assert.ok(resourceUris.has(uri), `expected MCP App resource ${uri}`);
  }

  const handshakeRead = await client.readResource({ uri: 'ui://archislop/handshake.html' });
  const html = handshakeRead.contents?.[0]?.text ?? '';
  assert.ok(html.includes('<!DOCTYPE html>'), 'handshake MCP App should return HTML');
  assert.equal(handshakeRead.contents?.[0]?.mimeType, RESOURCE_MIME_TYPE);

  const eventsRead = await client.readResource({ uri: 'ui://archislop/session-events.html' });
  const eventsHtml = eventsRead.contents?.[0]?.text ?? '';
  assert.ok(eventsHtml.includes('EventSource'), 'session-events MCP App should use SSE');
  assert.ok(
    eventsHtml.includes('createSessionEventBridge'),
    'session-events MCP App should use session bridge'
  );

  const welcomeRead = await client.readResource({ uri: 'ui://archislop/welcome.html' });
  assert.ok((welcomeRead.contents?.[0]?.text ?? '').includes('get_session_bootstrap'));

  // 2. register_agent: fire the handshake, approve it from the "UI" while the client awaits
  const registerPromise = callTool(client, 'register_agent', {
    name: 'Smoke Bot',
    emoji: '🧪',
    wait: true
  });
  // Poll briefly for the handshake request to appear.
  let requestId = null;
  for (let i = 0; i < 20 && !requestId; i += 1) {
    const pending = services.handshakeStore.listPendingRequests();
    if (pending.length > 0) requestId = pending[0].requestId;
    if (!requestId) await new Promise((r) => setTimeout(r, 25));
  }
  assert.ok(requestId, 'handshake request appeared in the store');
  const approvedAgent = services.handshakeStore.approveRequest(requestId);
  services.eventBus.publish(sessionId, {
    type: 'handshake_resolved',
    payload: { requestId, status: 'approved', agent: approvedAgent }
  });
  const registerResult = parseToolText(await registerPromise);
  assert.equal(registerResult.status, 'approved');
  assert.equal(registerResult.agentName, 'Smoke Bot');

  // 3. set_focus updates presence
  const focusResult = parseToolText(
    await callTool(client, 'set_focus', { contentType: 'mermaid', nodeId: 'A', label: 'Start' })
  );
  assert.equal(focusResult.status, 'ok');
  const presence = services.presenceStore.list();
  assert.equal(presence.length, 1);
  assert.equal(presence[0].focus?.nodeId, 'A');

  // 4. propose_diagram_edit lands a pending proposal
  const proposeResult = parseToolText(
    await callTool(client, 'propose_diagram_edit', {
      contentType: 'mermaid',
      diagramSource: 'graph TD\n  A-->B\n',
      reason: 'tiny test diagram',
      baseRevisionId: 0
    })
  );
  assert.equal(proposeResult.status, 'pending');
  const proposalId = proposeResult.proposalId;
  assert.ok(proposalId);

  // 5. Accept via the proposalStore + state mutation (mirrors the REST accept handler)
  const pending = services.proposalStore.get(proposalId);
  assert.equal(pending.status, 'pending');
  const applied = await services.stateStore.applyDiagramSource({
    contentType: pending.contentType,
    diagramSource: pending.diagramSource,
    reason: pending.reason,
    origin: pending.origin
  });
  assert.equal(applied.accepted, true);
  assert.equal(applied.state.revisionId, 1);
  assert.equal(applied.patch.origin.kind, 'external-agent');
  services.proposalStore.markAccepted(proposalId);

  // 6. drop_insight publishes an attributed insight event
  const insightResult = parseToolText(
    await callTool(client, 'drop_insight', { text: 'nice diagram', variant: 'note' })
  );
  assert.equal(insightResult.status, 'posted');
  const insightEvents = eventEnvelopes.filter((e) => e.type === 'attributed_insight');
  assert.equal(insightEvents.length, 1);
  assert.equal(insightEvents[0].payload.origin.agentName, 'Smoke Bot');
  assert.equal(services.insightStore.list().length, 1);

  const statePayload = parseToolText(await callTool(client, 'get_session_state', {}));
  assert.ok(statePayload.webCanvasUrl?.includes('/sessions/'));
  assert.ok(statePayload.slots?.mermaid);

  // 7. react fires a reaction event
  const reactionResult = parseToolText(
    await callTool(client, 'react', {
      target: { kind: 'revision', contentType: 'mermaid', revisionId: 1 },
      emoji: '🎉'
    })
  );
  assert.equal(reactionResult.status, 'ok');
  const reactionEvents = eventEnvelopes.filter((e) => e.type === 'reaction');
  assert.equal(reactionEvents.length, 1);
  assert.equal(reactionEvents[0].payload.emoji, '🎉');
});

test('MCP: session resource denied without room binding', async (t) => {
  const { port, closeServer } = await setupServer();
  t.after(closeServer);

  const { client } = await connectClient(port);
  t.after(() => client.close());

  await assert.rejects(
    () => client.readResource({ uri: 'archislop://session/other-room-1' }),
    /Resource access denied/
  );
});

test('MCP: tools other than register_agent fail before handshake', async (t) => {
  const { pairingCodeStore, port, closeServer } = await setupServer();
  t.after(closeServer);

  const sessionId = 'mcp-smoke-2';
  const code = pairingCodeStore.getOrCreateCode(sessionId);
  const { client, transport } = await connectClient(port, `pairing=${encodeURIComponent(code)}`);
  t.after(() => client.close());
  t.after(() => transport.close());

  const result = await callTool(client, 'get_session_state', {});
  assert.equal(result.isError, true);
  const text = result.content?.[0]?.text ?? '';
  assert.match(text, /register_agent/);
});

test('MCP: human-only tools blocked; REST accepts proposals', async (t) => {
  const { sessionRegistry, pairingCodeStore, port, closeServer } = await setupServer();
  t.after(closeServer);

  const sessionId = 'mcp-apps-resolve';
  const code = pairingCodeStore.getOrCreateCode(sessionId);
  const services = sessionRegistry.getSessionServices(sessionId);

  const { client, transport } = await connectClient(port, `pairing=${encodeURIComponent(code)}`);
  t.after(() => client.close());
  t.after(() => transport.close());

  const blockedHandshake = await callTool(client, 'resolve_handshake', {
    requestId: 'req-blocked',
    decision: 'approve'
  });
  assert.equal(blockedHandshake.isError, true);
  assert.match(blockedHandshake.content?.[0]?.text ?? '', /web UI/i);

  const registerPromise = callTool(client, 'register_agent', {
    name: 'App Tester',
    emoji: '🧪',
    color: '#3b82f6',
    wait: true
  });
  let requestId = null;
  for (let i = 0; i < 20 && !requestId; i += 1) {
    const pending = services.handshakeStore.listPendingRequests();
    if (pending.length > 0) requestId = pending[0].requestId;
    if (!requestId) await new Promise((r) => setTimeout(r, 25));
  }
  assert.ok(requestId);
  const approvedAgent = services.handshakeStore.approveRequest(requestId);
  services.eventBus.publish(sessionId, {
    type: 'handshake_resolved',
    payload: { requestId, status: 'approved', agent: approvedAgent }
  });
  const registerResult = parseToolText(await registerPromise);
  assert.equal(registerResult.status, 'approved');

  const proposeResult = parseToolText(
    await callTool(client, 'propose_diagram_edit', {
      contentType: 'mermaid',
      diagramSource: 'graph TD\n  X-->Y\n',
      reason: 'mcp app test',
      baseRevisionId: 0
    })
  );
  assert.equal(proposeResult.status, 'pending');

  const blockedProposal = await callTool(client, 'resolve_proposal', {
    proposalId: proposeResult.proposalId,
    decision: 'accept'
  });
  assert.equal(blockedProposal.isError, true);

  const acceptRes = await fetch(
    `http://127.0.0.1:${port}/api/copilotkit/proposals/${proposeResult.proposalId}/accept`,
    { method: 'POST', headers: { 'x-session-id': sessionId } }
  );
  assert.equal(acceptRes.status, 200);
  assert.equal(services.stateStore.getSlot('mermaid').revisionId, 1);
});

test('MCP: invite endpoint returns stable URL, pairing code, and deeplinks', async (t) => {
  const prevPublic = process.env.PUBLIC_BASE_URL;
  delete process.env.PUBLIC_BASE_URL;
  t.after(() => {
    if (prevPublic === undefined) delete process.env.PUBLIC_BASE_URL;
    else process.env.PUBLIC_BASE_URL = prevPublic;
  });

  const { port, closeServer } = await setupServer();
  t.after(closeServer);

  const sessionId = 'mcp-invite-1';
  const res = await fetch(
    `http://127.0.0.1:${port}/api/copilotkit/invite?sessionId=${encodeURIComponent(sessionId)}`,
    { headers: { 'x-session-id': sessionId, host: `127.0.0.1:${port}` } }
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.sessionId, sessionId);
  assert.equal(body.stableMcpUrl, `http://127.0.0.1:${port}/mcp`);
  assert.match(body.mcpUrl, /\/mcp\?token=/);
  assert.match(body.mcpUrlWithPairing, /\/mcp\?pairing=[A-Z0-9]{6}$/);
  assert.equal(body.pairingCode.length, 6);
  assert.match(body.cursorInstallUrl, /^cursor:\/\/anysphere\.cursor-deeplink\/mcp\/install\?/);
  assert.match(body.vscodeInstallUrl, /^vscode:mcp\/install\?/);
  assert.ok(body.qrDataUrl?.startsWith('data:image/png;base64,'));
});

test('MCP: join_session without args returns needs_pairing_code and exposes pairing App', async (t) => {
  const { port, closeServer } = await setupServer();
  t.after(closeServer);

  const { client } = await connectClient(port);
  t.after(() => client.close());

  const tools = await client.listTools();
  const joinTool = tools.tools.find((tool) => tool.name === 'join_session');
  assert.ok(joinTool?._meta?.ui?.resourceUri?.includes('session-pairing'));

  const needs = parseToolText(await callTool(client, 'join_session', {}));
  assert.equal(needs.status, 'needs_pairing_code');
  assert.equal(needs.bound, false);

  const binding = parseToolText(await callTool(client, 'get_mcp_binding', {}));
  assert.equal(binding.bound, false);

  const open = parseToolText(await callTool(client, 'open_session_pairing', {}));
  assert.equal(open.bound, false);
  assert.ok(open.inviteHint);
});

test('MCP: session-pairing MCP App resource returns HTML', async (t) => {
  const { port, closeServer } = await setupServer();
  t.after(closeServer);

  const { client } = await connectClient(port, 'mcp-pairing-html');
  t.after(() => client.close());

  const read = await client.readResource({ uri: 'ui://archislop/session-pairing.html' });
  const html = read.contents?.[0]?.text ?? '';
  assert.ok(html.includes('Join ArchiSlop room'));
  assert.ok(html.includes('get_mcp_binding'));
  assert.equal(read.contents?.[0]?.mimeType, RESOURCE_MIME_TYPE);
});

test('MCP: join_session binds stable transport to room', async (t) => {
  const { port, pairingCodeStore, closeServer } = await setupServer();
  t.after(closeServer);

  const sessionId = 'mcp-join-1';
  const code = pairingCodeStore.getOrCreateCode(sessionId);
  const { client } = await connectClient(port);
  t.after(() => client.close());

  const joined = parseToolText(await callTool(client, 'join_session', { pairingCode: code }));
  assert.equal(joined.status, 'joined');
  assert.equal(joined.sessionId, sessionId);

  const reg = parseToolText(
    await callTool(client, 'register_agent', { name: 'JoinBot', emoji: '🤖', color: '#336699' })
  );
  assert.ok(
    ['pending', 'awaiting_user_approval', 'approved', 'already_registered'].includes(reg.status)
  );
});

test('MCP: initialize with ?pairing= binds without join_session', async (t) => {
  const { port, pairingCodeStore, closeServer } = await setupServer();
  t.after(closeServer);

  const sessionId = 'mcp-pairing-init';
  const code = pairingCodeStore.getOrCreateCode(sessionId);
  const { client } = await connectClient(port, `pairing=${encodeURIComponent(code)}`);
  t.after(() => client.close());

  const reg = parseToolText(
    await callTool(client, 'register_agent', { name: 'PairBot', emoji: '🔗', color: '#663399' })
  );
  assert.ok(['pending', 'awaiting_user_approval', 'approved'].includes(reg.status));
});

test('MCP: non-blocking register_agent and get_handshake_status', async (t) => {
  const { sessionRegistry, pairingCodeStore, port, closeServer } = await setupServer();
  t.after(closeServer);

  const sessionId = 'mcp-handshake-poll';
  const services = sessionRegistry.getSessionServices(sessionId);
  const code = pairingCodeStore.getOrCreateCode(sessionId);
  const { client, transport } = await connectClient(port, `pairing=${encodeURIComponent(code)}`);
  t.after(() => client.close());
  t.after(() => transport.close());

  const reg = parseToolText(
    await callTool(client, 'register_agent', { name: 'Poll Bot', emoji: '⏳', color: '#22c55e' })
  );
  assert.equal(reg.status, 'pending');
  assert.ok(reg.requestId);

  const approvedAgent = services.handshakeStore.approveRequest(reg.requestId);
  services.eventBus.publish(sessionId, {
    type: 'handshake_resolved',
    payload: { requestId: reg.requestId, status: 'approved', agent: approvedAgent }
  });

  const status = parseToolText(
    await callTool(client, 'get_handshake_status', { requestId: reg.requestId })
  );
  assert.equal(status.status, 'approved');
  assert.ok(status.agentToken);

  const bootstrap = parseToolText(await callTool(client, 'get_session_bootstrap', {}));
  assert.equal(bootstrap.bound, true);
  assert.equal(bootstrap.handshakeStatus, 'approved');

  const sub = parseToolText(await callTool(client, 'subscribe_session_events', {}));
  assert.ok(sub.sessionEventsUrl?.includes('session-events'));
  assert.ok(sub.agentToken);
});

test('MCP: propose_diagram_edit accepts forms slot documents', async (t) => {
  const { sessionRegistry, pairingCodeStore, port, closeServer } = await setupServer();
  t.after(closeServer);

  const sessionId = 'mcp-forms-propose';
  const code = pairingCodeStore.getOrCreateCode(sessionId);
  const services = sessionRegistry.getSessionServices(sessionId);
  const { client, transport } = await connectClient(port, `pairing=${encodeURIComponent(code)}`);
  t.after(() => client.close());
  t.after(() => transport.close());

  const registerPromise = callTool(client, 'register_agent', {
    name: 'Forms Bot',
    emoji: '📋',
    wait: true
  });
  let requestId = null;
  for (let i = 0; i < 20 && !requestId; i += 1) {
    const pending = services.handshakeStore.listPendingRequests();
    if (pending.length > 0) requestId = pending[0].requestId;
    if (!requestId) await new Promise((r) => setTimeout(r, 25));
  }
  assert.ok(requestId);
  const approvedAgent = services.handshakeStore.approveRequest(requestId);
  services.eventBus.publish(sessionId, {
    type: 'handshake_resolved',
    payload: { requestId, status: 'approved', agent: approvedAgent }
  });
  const registerResult = parseToolText(await registerPromise);
  assert.equal(registerResult.status, 'approved');

  const formsDoc = buildFormsSeedDoc();
  const proposeResult = parseToolText(
    await callTool(client, 'propose_diagram_edit', {
      contentType: 'forms',
      diagramSource: formsDoc,
      reason: 'forms proposal',
      baseRevisionId: 0
    })
  );
  assert.equal(proposeResult.status, 'pending');
  assert.ok(proposeResult.proposalId);

  const statePayload = parseToolText(await callTool(client, 'get_session_state', {}));
  assert.ok(statePayload.slots?.forms);
  assert.equal(statePayload.revisions?.forms, 0);
});
