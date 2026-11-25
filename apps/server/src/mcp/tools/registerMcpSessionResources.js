import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { isConcreteContentType } from '@archislop/shared';
import { buildSessionBootstrap } from '../mcpSessionBootstrap.js';

/**
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {{
 *   sessionRegistry: import('../mcpSessionRegistry.js').McpSessionRegistry['sessionRegistry'],
 *   pairingCodeStore: object,
 *   publicBaseUrl: () => string,
 *   currentEntry: () => object | null,
 *   assertResourceSessionAccess: (sessionId: string) => void,
 * }} ctx
 */
export function registerMcpSessionResources(server, ctx) {
  const {
    sessionRegistry,
    pairingCodeStore,
    publicBaseUrl,
    currentEntry,
    assertResourceSessionAccess
  } = ctx;

  server.registerResource(
    'session',
    new ResourceTemplate('archislop://session/{sessionId}', { list: undefined }),
    { description: 'Full ArchiSlop session state (both mermaid and infographic slots).' },
    async (uri, { sessionId }) => {
      assertResourceSessionAccess(sessionId);
      const services = sessionRegistry.getSessionServices(sessionId);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(services.stateStore.getSessionState(), null, 2)
          }
        ]
      };
    }
  );

  server.registerResource(
    'slot',
    new ResourceTemplate('archislop://session/{sessionId}/{contentType}', { list: undefined }),
    {
      description:
        'Diagram state for a specific slot (mermaid, infographic, metaphor3d, chart, anything, or forms).'
    },
    async (uri, { sessionId, contentType }) => {
      assertResourceSessionAccess(sessionId);
      if (!isConcreteContentType(contentType)) {
        throw new Error(`Unknown contentType: ${contentType}`);
      }
      const services = sessionRegistry.getSessionServices(sessionId);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(services.stateStore.getSlot(contentType), null, 2)
          }
        ]
      };
    }
  );

  server.registerResource(
    'presence',
    new ResourceTemplate('archislop://session/{sessionId}/presence', { list: undefined }),
    { description: 'External agents currently connected to the session.' },
    async (uri, { sessionId }) => {
      assertResourceSessionAccess(sessionId);
      const services = sessionRegistry.getSessionServices(sessionId);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(services.presenceStore.list(), null, 2)
          }
        ]
      };
    }
  );

  server.registerResource(
    'bootstrap',
    new ResourceTemplate('archislop://session/{sessionId}/bootstrap', { list: undefined }),
    {
      description:
        'One-shot session bootstrap for external agents: binding, revisions, handshake status, checklist.'
    },
    async (uri, { sessionId }) => {
      assertResourceSessionAccess(sessionId);
      const services = sessionRegistry.getSessionServices(sessionId);
      const entry = currentEntry();
      const payload = buildSessionBootstrap({
        entry,
        services,
        pairingCodeStore,
        publicBaseUrl: publicBaseUrl()
      });
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(payload, null, 2)
          }
        ]
      };
    }
  );
}
