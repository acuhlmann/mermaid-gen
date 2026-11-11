import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import { ContentTypeSchema } from '@archislop/shared';
import { buildWebCanvasUrl } from '../diagramDiffSummary.js';
import { publishAttributedInsight } from '../mcpInsightPublish.js';
import { jsonResult, originFromMcpEntry, requireRegisteredAgent } from '../mcpHelpers.js';
import {
  MCP_APP_URI_CRITIQUE_MAP,
  MCP_APP_URI_INSIGHTS_FEED,
  MCP_APP_URI_PROPOSAL_INBOX,
  UI_META
} from '../registerMcpApps.js';

export function registerMcpCollaborationInsightTools(server, ctx) {
  const { sessionRegistry, agentTokenStore, currentEntry } = ctx;

  server.registerTool(
    'get_insights',
    {
      title: 'List session insights',
      description:
        'Returns attributed insights (notes, critiques, suggestions) stored for this session. Use before revising proposals or to catch up after joining late.',
      inputSchema: {
        limit: z.number().int().min(1).max(100).optional(),
        variant: z.enum(['note', 'critique', 'suggestion']).optional()
      }
    },
    async ({ limit, variant }) => {
      const entry = currentEntry();
      const blocked = requireRegisteredAgent(entry, agentTokenStore);
      if (blocked) return blocked;
      const services = sessionRegistry.getSessionServices(entry.appSessionId);
      return jsonResult({
        insights: services.insightStore.list({ limit: limit ?? 50, variant }),
        webCanvasUrl: buildWebCanvasUrl(entry.appSessionId)
      });
    }
  );

  registerAppTool(
    server,
    'open_insights_feed',
    {
      title: 'Open insights feed',
      description: 'Shows the insights-feed MCP App: Thinking-pane parity for external agents.',
      inputSchema: {
        limit: z.number().int().min(1).max(100).optional()
      },
      ...UI_META(MCP_APP_URI_INSIGHTS_FEED)
    },
    async ({ limit }) => {
      const entry = currentEntry();
      const blocked = requireRegisteredAgent(entry, agentTokenStore);
      if (blocked) return blocked;
      const services = sessionRegistry.getSessionServices(entry.appSessionId);
      return jsonResult({
        insights: services.insightStore.list({ limit: limit ?? 50 }),
        webCanvasUrl: buildWebCanvasUrl(entry.appSessionId)
      });
    }
  );

  server.registerTool(
    'get_my_proposals',
    {
      title: 'List my diagram proposals',
      description:
        'Returns proposals submitted by this MCP agent (pending and resolved). Pair with open_my_proposals for the inbox MCP App.',
      inputSchema: {
        includeResolved: z.boolean().optional(),
        limit: z.number().int().min(1).max(50).optional()
      }
    },
    async ({ includeResolved, limit }) => {
      const entry = currentEntry();
      const blocked = requireRegisteredAgent(entry, agentTokenStore);
      if (blocked) return blocked;
      const services = sessionRegistry.getSessionServices(entry.appSessionId);
      return jsonResult({
        proposals: services.proposalStore.listByAgent(entry.agentId, {
          includeResolved: includeResolved ?? true,
          limit: limit ?? 20
        }),
        webCanvasUrl: buildWebCanvasUrl(entry.appSessionId)
      });
    }
  );

  registerAppTool(
    server,
    'open_my_proposals',
    {
      title: 'Open my proposal inbox',
      description:
        'Shows the proposal-inbox MCP App: track your pending and resolved diagram edit proposals.',
      inputSchema: {
        includeResolved: z.boolean().optional(),
        limit: z.number().int().min(1).max(50).optional()
      },
      ...UI_META(MCP_APP_URI_PROPOSAL_INBOX)
    },
    async ({ includeResolved, limit }) => {
      const entry = currentEntry();
      const blocked = requireRegisteredAgent(entry, agentTokenStore);
      if (blocked) return blocked;
      const services = sessionRegistry.getSessionServices(entry.appSessionId);
      return jsonResult({
        proposals: services.proposalStore.listByAgent(entry.agentId, {
          includeResolved: includeResolved ?? true,
          limit: limit ?? 20
        }),
        webCanvasUrl: buildWebCanvasUrl(entry.appSessionId)
      });
    }
  );

  server.registerTool(
    'wait_for_resolution',
    {
      title: 'Wait for proposal resolution',
      description:
        'Long-poll for the user to accept, reject, or let a proposal go stale. Times out after `timeoutMs` (default 50s) and returns the current status.',
      inputSchema: {
        proposalId: z.string().min(1),
        timeoutMs: z.number().int().min(1000).max(55000).optional()
      }
    },
    async ({ proposalId, timeoutMs }) => {
      const entry = currentEntry();
      const blocked = requireRegisteredAgent(entry, agentTokenStore);
      if (blocked) return blocked;
      const services = sessionRegistry.getSessionServices(entry.appSessionId);
      const result = await services.proposalStore.waitForResolution(proposalId, {
        timeoutMs: timeoutMs ?? 50000
      });
      services.presenceStore.touch(entry.agentId);
      return jsonResult(result);
    }
  );

  server.registerTool(
    'drop_insight',
    {
      title: 'Post an attributed insight',
      description:
        'Add a comment, critique, or suggestion to the InsightsPane. Shows up with your agent badge so the human user knows it came from you. Use this for second opinions, observations, or follow-up nudges.',
      inputSchema: {
        text: z.string().min(1).max(8000),
        variant: z.enum(['note', 'critique', 'suggestion']).default('note')
      }
    },
    async ({ text, variant }) => {
      const entry = currentEntry();
      const blocked = requireRegisteredAgent(entry, agentTokenStore);
      if (blocked) return blocked;
      const services = sessionRegistry.getSessionServices(entry.appSessionId);
      const insight = {
        insightId: randomUUID(),
        origin: originFromMcpEntry(entry),
        variant,
        text,
        createdAt: new Date().toISOString()
      };
      publishAttributedInsight({
        insightStore: services.insightStore,
        eventBus: services.eventBus,
        sessionId: entry.appSessionId,
        insight
      });
      services.presenceStore.touch(entry.agentId);
      const posted = {
        status: 'posted',
        insightId: insight.insightId,
        variant,
        text,
        origin: insight.origin
      };
      if (variant === 'critique') {
        return jsonResult({
          ...posted,
          hint: 'Call open_critique_review with the same text to show the critique-map MCP App.'
        });
      }
      return jsonResult(posted);
    }
  );

  registerAppTool(
    server,
    'open_critique_review',
    {
      title: 'Review critique with interactive map',
      description:
        'Opens the critique-map MCP App for a critique insight. Pass the critique markdown and metadata from drop_insight.',
      inputSchema: {
        text: z.string().min(1).max(8000),
        variant: z.enum(['note', 'critique', 'suggestion']).default('critique'),
        insightId: z.string().optional(),
        contentType: ContentTypeSchema.optional()
      },
      ...UI_META(MCP_APP_URI_CRITIQUE_MAP)
    },
    async ({ text, variant, insightId, contentType }) => {
      const entry = currentEntry();
      const blocked = requireRegisteredAgent(entry, agentTokenStore);
      if (blocked) return blocked;
      return jsonResult({
        text,
        variant,
        insightId: insightId ?? randomUUID(),
        contentType: contentType ?? 'mermaid',
        origin: originFromMcpEntry(entry)
      });
    }
  );

  server.registerTool(
    'set_focus',
    {
      title: 'Announce what node you are looking at',
      description:
        'Tell the human user which node or region of the diagram has your attention. Renders as a colored focus indicator on the canvas. Pass `nodeId: null` to clear focus. Use open_focus_picker for a visual node list.',
      inputSchema: {
        contentType: ContentTypeSchema,
        nodeId: z.string().max(120).optional(),
        label: z.string().max(240).optional()
      }
    },
    async ({ contentType, nodeId, label }) => {
      const entry = currentEntry();
      const blocked = requireRegisteredAgent(entry, agentTokenStore);
      if (blocked) return blocked;
      const services = sessionRegistry.getSessionServices(entry.appSessionId);
      services.presenceStore.upsert({
        agentId: entry.agentId,
        agentName: entry.agentName,
        color: entry.color,
        emoji: entry.emoji,
        focus: nodeId ? { contentType, nodeId, label } : null
      });
      services.eventBus.publish(entry.appSessionId, {
        type: 'presence_update',
        payload: services.presenceStore.list()
      });
      return jsonResult({ status: 'ok' });
    }
  );

  server.registerTool(
    'react',
    {
      title: 'React with an emoji',
      description:
        'Drop a short-lived emoji reaction on a revision, an insight, or a node. Cheap, fun, low-stakes — celebrate wins or signal disagreement.',
      inputSchema: {
        target: z.discriminatedUnion('kind', [
          z.object({
            kind: z.literal('revision'),
            contentType: ContentTypeSchema,
            revisionId: z.number().int().nonnegative()
          }),
          z.object({
            kind: z.literal('insight'),
            insightId: z.string().min(1)
          }),
          z.object({
            kind: z.literal('node'),
            contentType: ContentTypeSchema,
            nodeId: z.string().min(1)
          })
        ]),
        emoji: z.string().min(1).max(8)
      }
    },
    async ({ target, emoji }) => {
      const entry = currentEntry();
      const blocked = requireRegisteredAgent(entry, agentTokenStore);
      if (blocked) return blocked;
      const services = sessionRegistry.getSessionServices(entry.appSessionId);
      const reaction = {
        reactionId: randomUUID(),
        origin: originFromMcpEntry(entry),
        target,
        emoji,
        createdAt: new Date().toISOString()
      };
      services.eventBus.publish(entry.appSessionId, {
        type: 'reaction',
        payload: reaction
      });
      services.presenceStore.touch(entry.agentId);
      return jsonResult({ status: 'ok', reactionId: reaction.reactionId });
    }
  );
}
