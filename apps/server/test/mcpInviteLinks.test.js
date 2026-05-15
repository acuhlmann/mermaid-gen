import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCursorInstallUrl,
  buildMcpConfigSnippet,
  buildVscodeInstallUrl,
  MCP_SERVER_NAME
} from '../src/mcp/mcpInviteLinks.js';

test('buildCursorInstallUrl encodes transport config', () => {
  const url = buildCursorInstallUrl('archislop', { url: 'https://example.com/mcp' });
  assert.match(url, /^cursor:\/\/anysphere\.cursor-deeplink\/mcp\/install\?/);
  assert.match(url, /name=archislop/);
  const configParam = new URL(url.replace('cursor://', 'http://')).searchParams.get('config');
  const decoded = JSON.parse(Buffer.from(configParam, 'base64').toString('utf8'));
  assert.deepEqual(decoded, { url: 'https://example.com/mcp' });
});

test('buildVscodeInstallUrl includes name and http type', () => {
  const url = buildVscodeInstallUrl({
    name: MCP_SERVER_NAME,
    type: 'http',
    url: 'https://example.com/mcp'
  });
  assert.match(url, /^vscode:mcp\/install\?/);
  const json = JSON.parse(decodeURIComponent(url.slice('vscode:mcp/install?'.length)));
  assert.equal(json.name, MCP_SERVER_NAME);
  assert.equal(json.type, 'http');
});

test('buildMcpConfigSnippet wraps url under archislop', () => {
  assert.deepEqual(buildMcpConfigSnippet('https://x/mcp'), {
    mcpServers: { archislop: { url: 'https://x/mcp' } }
  });
});
