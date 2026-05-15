import test from 'node:test';
import assert from 'node:assert/strict';

import { handshakeAppHtml } from '../src/mcp/apps/handshakeAppHtml.js';
import { webCompanionAppHtml } from '../src/mcp/apps/webCompanionAppHtml.js';
import { proposalReviewAppHtml } from '../src/mcp/apps/proposalReviewAppHtml.js';
import { sessionPairingAppHtml } from '../src/mcp/apps/sessionPairingAppHtml.js';
import { MCP_APP_DIAGRAM_PREVIEW_SCRIPT } from '../src/mcp/apps/mcpAppDiagramPreview.js';

test('handshake MCP App title distinguishes agent approval from room pairing', () => {
  assert.match(handshakeAppHtml, /<h1>Approve external agent<\/h1>/);
  assert.doesNotMatch(handshakeAppHtml, /<h1>Join ArchiSlop session<\/h1>/);
});

test('session-pairing MCP App title refers to pairing not handshake', () => {
  assert.match(sessionPairingAppHtml, /Pair MCP to room|Join ArchiSlop room/);
});

test('proposal-review MCP App includes web-first hint element', () => {
  assert.match(proposalReviewAppHtml, /id="web-hint"/);
  assert.match(proposalReviewAppHtml, /proposal card in Insights/);
});

test('web companion MCP App is read-only hybrid control surface', () => {
  assert.match(webCompanionAppHtml, /<h1>Web companion<\/h1>/);
  assert.match(webCompanionAppHtml, /You control this session in the browser/);
  assert.match(webCompanionAppHtml, /Resolve in web/);
  assert.match(webCompanionAppHtml, /open_proposal_review/);
  assert.doesNotMatch(webCompanionAppHtml, /resolve_proposal/);
});

test('shared Mermaid preview script uses load/render timeouts', () => {
  assert.match(MCP_APP_DIAGRAM_PREVIEW_SCRIPT, /withTimeout/);
  assert.match(MCP_APP_DIAGRAM_PREVIEW_SCRIPT, /MERMAID_LOAD_MS/);
  assert.match(MCP_APP_DIAGRAM_PREVIEW_SCRIPT, /mermaidPreviewFallback/);
});
