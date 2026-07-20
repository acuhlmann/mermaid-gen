import test from 'node:test';
import assert from 'node:assert/strict';

import { handshakeAppHtml } from '../src/mcp/apps/handshakeAppHtml.js';
import { webCompanionAppHtml } from '../src/mcp/apps/webCompanionAppHtml.js';
import { proposalReviewAppHtml } from '../src/mcp/apps/proposalReviewAppHtml.js';
import { sessionPairingAppHtml } from '../src/mcp/apps/sessionPairingAppHtml.js';
import { canvasPreviewAppHtml } from '../src/mcp/apps/canvasPreviewAppHtml.js';
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

test('shared infographic preview script renders AntV from CDN, not just DSL text', () => {
  assert.match(MCP_APP_DIAGRAM_PREVIEW_SCRIPT, /INFOGRAPHIC_CDN/);
  assert.match(MCP_APP_DIAGRAM_PREVIEW_SCRIPT, /@antv\/infographic/);
  assert.match(MCP_APP_DIAGRAM_PREVIEW_SCRIPT, /new Infographic\(/);
  assert.match(MCP_APP_DIAGRAM_PREVIEW_SCRIPT, /parseSyntax/);
  assert.match(MCP_APP_DIAGRAM_PREVIEW_SCRIPT, /infographicDslFallback/);
});

test('shared preview script includes chart, forms, and anything slot helpers', () => {
  assert.match(MCP_APP_DIAGRAM_PREVIEW_SCRIPT, /renderChartPreview/);
  assert.match(MCP_APP_DIAGRAM_PREVIEW_SCRIPT, /renderFormsSlotPreview/);
  assert.match(MCP_APP_DIAGRAM_PREVIEW_SCRIPT, /renderAnythingPreview/);
  assert.match(MCP_APP_DIAGRAM_PREVIEW_SCRIPT, /VEGA_EMBED_CDN/);
});

test('canvas-preview MCP App exposes all six slot tabs and preview helpers', () => {
  assert.match(canvasPreviewAppHtml, /data-slot="mermaid"/);
  assert.match(canvasPreviewAppHtml, /data-slot="infographic"/);
  assert.match(canvasPreviewAppHtml, /data-slot="metaphor3d"/);
  assert.match(canvasPreviewAppHtml, /data-slot="chart"/);
  assert.match(canvasPreviewAppHtml, /data-slot="anything"/);
  assert.match(canvasPreviewAppHtml, /data-slot="forms"/);
  assert.match(canvasPreviewAppHtml, /renderChartPreview/);
  assert.match(canvasPreviewAppHtml, /renderFormsSlotPreview/);
  assert.match(canvasPreviewAppHtml, /renderAnythingPreview/);
});

test('canvas-preview MCP App advertises a live AntV preview for infographic slot', () => {
  assert.match(canvasPreviewAppHtml, /Live AntV infographic preview/i);
  assert.doesNotMatch(canvasPreviewAppHtml, /open ArchiSlop web for full AntV preview/i);
});

test('proposal-review MCP App advertises a live AntV preview for infographic proposals', () => {
  assert.match(proposalReviewAppHtml, /Live AntV infographic preview/i);
  assert.doesNotMatch(proposalReviewAppHtml, /open ArchiSlop web for full AntV preview/i);
});
