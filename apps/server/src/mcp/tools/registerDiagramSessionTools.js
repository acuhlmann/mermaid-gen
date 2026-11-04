import { z } from 'zod';
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import { ContentTypeSchema } from '@archislop/shared';
import { validateAndPreparePatch } from '../../tools/mermaidDiffTool.js';
import { validateAndPrepareInfographicPatch } from '../../tools/infographicDslTool.js';
import { validateAndPrepareMetaphorPatch } from '../../tools/metaphorDslTool.js';
import { validateAndPrepareChartPatch } from '../../tools/chartDslTool.js';
import { validateAndPrepareAnythingPatch } from '../../tools/anythingHtmlTool.js';
import { validateAndPrepareFormsPatch } from '../../tools/formsA2uiTool.js';
import { buildDiagramDiffSummary, buildWebCanvasUrl } from '../diagramDiffSummary.js';
import { buildCanvasPreviewPayload } from '../mcpCanvasPayload.js';
import { jsonResult, originFromMcpEntry, requireRegisteredAgent } from '../mcpHelpers.js';
import {
  MCP_APP_URI_CANVAS_PREVIEW,
  MCP_APP_URI_WEB_COMPANION,
  UI_META
} from '../registerMcpApps.js';

async function validateProposedDiagramPatch(contentType, slot, diagramSource, reason) {
  if (contentType === 'mermaid') {
    return validateAndPreparePatch({
      currentState: slot,
      proposedMermaidSource: diagramSource,
      reason
    });
  }
  if (contentType === 'metaphor3d') {
    return validateAndPrepareMetaphorPatch({
      currentState: slot,
      proposedDiagramSource: diagramSource,
      reason
    });
  }
  if (contentType === 'chart') {
    return validateAndPrepareChartPatch({
      currentState: slot,
      proposedDiagramSource: diagramSource,
      reason
    });
  }
  if (contentType === 'anything') {
    return validateAndPrepareAnythingPatch({
      currentState: slot,
      proposedDiagramSource: diagramSource,
      reason
    });
  }
  if (contentType === 'forms') {
    return validateAndPrepareFormsPatch({
      currentState: slot,
      proposedDiagramSource: diagramSource,
      reason
    });
  }
  return validateAndPrepareInfographicPatch({
    currentState: slot,
    proposedDiagramSource: diagramSource,
    reason
  });
}

export function registerDiagramSessionTools(server, ctx) {
  const { sessionRegistry, agentTokenStore, currentEntry } = ctx;

  server.registerTool(
    'get_session_state',
    {
      title: 'Read current diagram state',
      description:
        'Returns the current state of a slot (mermaid, infographic, metaphor3d, or chart). Use this before proposing edits so you can pass the right baseRevisionId.',
      inputSchema: {
        contentType: ContentTypeSchema.optional()
      }
    },
    async ({ contentType }) => {
      const entry = currentEntry();
      const blocked = requireRegisteredAgent(entry, agentTokenStore);
      if (blocked) return blocked;
      const services = sessionRegistry.getSessionServices(entry.appSessionId);
      const sessionId = entry.appSessionId;
      const webCanvasUrl = buildWebCanvasUrl(sessionId);
      if (contentType) {
        return jsonResult({
          ...services.stateStore.getSlot(contentType),
          contentType,
          sessionId,
          webCanvasUrl
        });
      }
      return jsonResult({
        ...services.stateStore.getSessionState(),
        ...buildCanvasPreviewPayload(services, sessionId),
        sessionId,
        webCanvasUrl
      });
    }
  );

  registerAppTool(
    server,
    'open_diagram_canvas',
    {
      title: 'Preview session diagram',
      description:
        'Opens the canvas-preview MCP App: live Mermaid render (or infographic DSL) for the current session, plus a link to open the full editor in ArchiSlop web.',
      inputSchema: {
        contentType: ContentTypeSchema.optional()
      },
      ...UI_META(MCP_APP_URI_CANVAS_PREVIEW)
    },
    async ({ contentType }) => {
      const entry = currentEntry();
      const blocked = requireRegisteredAgent(entry, agentTokenStore);
      if (blocked) return blocked;
      const services = sessionRegistry.getSessionServices(entry.appSessionId);
      return jsonResult(buildCanvasPreviewPayload(services, entry.appSessionId, contentType));
    }
  );

  registerAppTool(
    server,
    'propose_diagram_edit',
    {
      title: 'Propose a diagram edit',
      description:
        'Submit a complete replacement of the diagram source as a proposal. Opens the web-companion MCP App (read-only in Cursor; approve in ArchiSlop web). Also appears in InsightsPane. Returns proposalId; poll with `wait_for_resolution`.',
      inputSchema: {
        contentType: ContentTypeSchema,
        diagramSource: z.string().min(1).max(200000),
        reason: z.string().min(1).max(2000),
        baseRevisionId: z.number().int().nonnegative()
      },
      ...UI_META(MCP_APP_URI_WEB_COMPANION)
    },
    async ({ contentType, diagramSource, reason, baseRevisionId }) => {
      const entry = currentEntry();
      const blocked = requireRegisteredAgent(entry, agentTokenStore);
      if (blocked) return blocked;
      const services = sessionRegistry.getSessionServices(entry.appSessionId);
      const slot = services.stateStore.getSlot(contentType);
      if (baseRevisionId !== slot.revisionId) {
        return jsonResult({
          status: 'stale_revision',
          serverRevisionId: slot.revisionId,
          message: 'baseRevisionId is stale. Call get_session_state and retry.'
        });
      }
      const prepared = await validateProposedDiagramPatch(contentType, slot, diagramSource, reason);
      if (!prepared.accepted) {
        return jsonResult({ status: 'invalid', error: prepared.error });
      }
      const origin = originFromMcpEntry(entry);
      const proposal = services.proposalStore.create({
        sessionId: entry.appSessionId,
        origin,
        contentType,
        baseRevisionId,
        diagramSource: prepared.patch.diagramSource,
        reason,
        metadata: prepared.metadata
      });
      services.eventBus.publish(entry.appSessionId, {
        type: 'proposal_received',
        payload: proposal
      });
      services.presenceStore.touch(entry.agentId);
      const currentDiagramSource = slot.diagramSource ?? '';
      const proposedSource = proposal.diagramSource ?? '';
      const diffSummary = buildDiagramDiffSummary(currentDiagramSource, proposedSource, {
        contentType
      });
      return jsonResult({
        status: 'pending',
        ...proposal,
        origin: proposal.origin,
        sessionId: entry.appSessionId,
        currentDiagramSource,
        diffSummary,
        graphDiff: diffSummary.graphDiff ?? prepared.metadata?.graphDiff,
        webCanvasUrl: buildWebCanvasUrl(entry.appSessionId)
      });
    }
  );
}
