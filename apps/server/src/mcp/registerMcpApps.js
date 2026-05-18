import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE
} from '@modelcontextprotocol/ext-apps/server';
import { MCP_APP_HTML_BY_URI } from './apps/index.js';
import { MCP_APP_CSP_CONNECT, MCP_APP_CSP_RESOURCES } from './apps/mcpAppStyles.js';
import {
  MCP_APP_URI_CANVAS_PREVIEW,
  MCP_APP_URI_COMPOSE_INSIGHT,
  MCP_APP_URI_CRITIQUE_MAP,
  MCP_APP_URI_FOCUS_PICKER,
  MCP_APP_URI_WEB_COMPANION,
  MCP_APP_URI_HANDSHAKE,
  MCP_APP_URI_INSIGHTS_FEED,
  MCP_APP_URI_PROPOSAL_INBOX,
  MCP_APP_URI_PROPOSAL_REVIEW,
  MCP_APP_URI_SESSION_DASHBOARD,
  MCP_APP_URI_SESSION_EVENTS,
  MCP_APP_URI_SESSION_PAIRING,
  MCP_APP_URI_WELCOME
} from './mcpAppUris.js';

const UI_META = (resourceUri) => ({
  _meta: { ui: { resourceUri } }
});

const APP_ONLY_UI = (resourceUri) => ({
  _meta: { ui: { resourceUri, visibility: ['app'] } }
});

function resolveConnectDomains(getPublicBaseUrl) {
  const domains = new Set(MCP_APP_CSP_CONNECT);
  const bases = [getPublicBaseUrl?.(), process.env.ARCHISLOP_WEB_URL?.trim()].filter(Boolean);
  for (const base of bases) {
    try {
      domains.add(new URL(base.replace(/\/+$/, '')).origin);
    } catch (err) {
      console.warn(`registerMcpApps: dropping invalid CSP connect URL ${JSON.stringify(base)}:`, err?.message ?? err);
    }
  }
  return [...domains];
}

function readAppHtml(uri, getPublicBaseUrl) {
  const html = MCP_APP_HTML_BY_URI[uri];
  if (!html) throw new Error(`Unknown MCP App URI: ${uri}`);
  return {
    contents: [
      {
        uri,
        mimeType: RESOURCE_MIME_TYPE,
        text: html,
        _meta: {
          ui: {
            csp: {
              connectDomains: resolveConnectDomains(getPublicBaseUrl),
              resourceDomains: MCP_APP_CSP_RESOURCES
            }
          }
        }
      }
    ]
  };
}

/**
 * Registers ui:// resources and MCP App tool metadata on the session MCP server.
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {{ getPublicBaseUrl?: () => string }} [options]
 */
export function registerMcpApps(server, { getPublicBaseUrl } = {}) {
  for (const [uri] of Object.entries(MCP_APP_HTML_BY_URI)) {
    const name = uri.replace('ui://archislop/', '').replace('.html', '');
    registerAppResource(server, `ArchiSlop ${name}`, uri, { description: `MCP App: ${name}` }, () =>
      readAppHtml(uri, getPublicBaseUrl)
    );
  }
}

export {
  MCP_APP_URI_HANDSHAKE,
  MCP_APP_URI_PROPOSAL_REVIEW,
  MCP_APP_URI_SESSION_DASHBOARD,
  MCP_APP_URI_CRITIQUE_MAP,
  MCP_APP_URI_SESSION_PAIRING,
  MCP_APP_URI_CANVAS_PREVIEW,
  MCP_APP_URI_INSIGHTS_FEED,
  MCP_APP_URI_PROPOSAL_INBOX,
  MCP_APP_URI_SESSION_EVENTS,
  MCP_APP_URI_WELCOME,
  MCP_APP_URI_COMPOSE_INSIGHT,
  MCP_APP_URI_FOCUS_PICKER,
  MCP_APP_URI_WEB_COMPANION,
  UI_META,
  APP_ONLY_UI
};
