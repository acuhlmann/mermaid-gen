import { z } from 'zod';
import { ContentTypeSchema } from '@archislop/shared';
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import { humanOnlyMcpToolBlocked } from '../mcpHelpers.js';
import {
  APP_ONLY_UI,
  MCP_APP_URI_CRITIQUE_MAP,
  MCP_APP_URI_HANDSHAKE,
  MCP_APP_URI_PROPOSAL_REVIEW
} from '../registerMcpApps.js';

/**
 * Human-only MCP App stubs. Hosts with Apps UI call the matching REST endpoints;
 * model-driven tool calls are rejected so agents cannot self-approve.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 */
export function registerHumanOnlyAppTools(server) {
  registerAppTool(
    server,
    'resolve_handshake',
    {
      title: 'Approve or deny agent handshake',
      description:
        'Human-only (MCP App): approve or deny a pending register_agent request. Use decision "approve" or "deny".',
      inputSchema: {
        requestId: z.string().min(1),
        decision: z.enum(['approve', 'deny'])
      },
      ...APP_ONLY_UI(MCP_APP_URI_HANDSHAKE)
    },
    async () => humanOnlyMcpToolBlocked()
  );

  registerAppTool(
    server,
    'resolve_proposal',
    {
      title: 'Accept or reject diagram proposal',
      description:
        'Human-only (MCP App): accept or reject a pending propose_diagram_edit. Use decision "accept" or "reject".',
      inputSchema: {
        proposalId: z.string().min(1),
        decision: z.enum(['accept', 'reject'])
      },
      ...APP_ONLY_UI(MCP_APP_URI_PROPOSAL_REVIEW)
    },
    async () => humanOnlyMcpToolBlocked()
  );

  registerAppTool(
    server,
    'request_proposal_changes',
    {
      title: 'Request changes on a proposal',
      description:
        'Human-only (MCP App): ask the proposing agent to revise without accepting or rejecting. The proposal stays pending; the agent learns via session event and can submit a new propose_diagram_edit.',
      inputSchema: {
        proposalId: z.string().min(1),
        comment: z.string().min(1).max(4000)
      },
      ...APP_ONLY_UI(MCP_APP_URI_PROPOSAL_REVIEW)
    },
    async () => humanOnlyMcpToolBlocked()
  );

  registerAppTool(
    server,
    'request_critique_fix',
    {
      title: 'Request fix for critique items',
      description:
        'Human-only (MCP App): queue a fix request for selected actionable critique bullets. Surfaces in session events for the ArchiSlop web client.',
      inputSchema: {
        items: z.array(z.string().min(1)).min(1).max(40),
        contentType: ContentTypeSchema,
        critiqueInsightId: z.string().optional()
      },
      ...APP_ONLY_UI(MCP_APP_URI_CRITIQUE_MAP)
    },
    async () => humanOnlyMcpToolBlocked()
  );
}
