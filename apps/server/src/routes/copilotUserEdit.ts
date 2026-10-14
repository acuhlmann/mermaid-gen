/**
 * Canvas graph edit: `POST /api/copilotkit/user-edit` — a point-and-click Add/Delete/Rename/Link
 * on the canvas rewrites the slot's DSL client-side and lands here as an `origin: user` patch.
 * See docs/canvas-graph-edit.md. Split out of copilot.ts (ADR-0005 / balanced-coupling-priorities §5
 * "copilot.ts → route modules by concern") as the smallest slice that clears the file's ratchet
 * violation (#381) without reorganising the rest of the router.
 */
import type { ContentType, UxServerSignal } from '@archislop/shared';
import { ContentTypeSchema } from '@archislop/shared';
import type { Request } from 'express';
import {
  UserDiagramEditSchema,
  type ApplyStoreResult,
  type JsonRouteResult
} from './copilotRouteTypes.js';
import type { DiagramStateStore } from '../state/diagramStateStore.js';
import { recordUxSignal } from '../metrics/uxSignalMetrics.js';

type UserEditHandlerDeps = {
  body: unknown;
  stateStore: DiagramStateStore;
  /** Test seam: where the content-free `graph_edit` signal goes (ADR-0019). */
  recordSignal?: (signal: UxServerSignal) => unknown;
};

/**
 * Client syncs never append history, so the slot's latest patch is an agent's unless it was the
 * user's own canvas edit — i.e. "the user is reworking what an agent just produced".
 */
function latestPatchCameFromAgent(history: ReadonlyArray<{ origin?: { kind?: string } }>): boolean {
  const latest = history.at(-1);
  return latest !== undefined && latest.origin?.kind !== 'user';
}

export async function handleUserDiagramEdit({
  body,
  stateStore,
  recordSignal = recordUxSignal
}: UserEditHandlerDeps): Promise<JsonRouteResult> {
  const parsed = UserDiagramEditSchema.safeParse(body);
  if (!parsed.success) {
    return {
      status: 400,
      body: {
        error: 'Invalid user edit payload',
        details: parsed.error.flatten()
      }
    };
  }

  const allowed =
    parsed.data.contentType === 'mermaid' ||
    parsed.data.contentType === 'infographic' ||
    parsed.data.contentType === 'metaphor3d' ||
    parsed.data.contentType === 'chart';
  if (!allowed) {
    return {
      status: 400,
      body: {
        error:
          'Canvas graph edits support mermaid, infographic, metaphor3d (base kinds and composite), and chart values'
      }
    };
  }

  const contentType = parsed.data.contentType;
  const slot = stateStore.getSlot(contentType);
  if (slot.revisionId !== parsed.data.previousRevisionId) {
    return {
      status: 409,
      body: {
        error: 'Diagram changed',
        code: 'stale_revision'
      }
    };
  }

  const afterAgent = latestPatchCameFromAgent(slot.history);

  const applied = await stateStore.applyDiagramSource({
    contentType,
    diagramSource: parsed.data.diagramSource,
    reason: parsed.data.reason,
    origin: { kind: 'user' }
  });

  if (!applied.accepted) {
    const rejected = applied as Extract<ApplyStoreResult, { accepted: false }>;
    return {
      status: 422,
      body: {
        error: rejected.error ?? 'User edit rejected'
      }
    };
  }

  const accepted = applied as Extract<ApplyStoreResult, { accepted: true }>;
  recordSignal({ kind: 'graph_edit', contentType, afterAgent });
  return {
    status: 200,
    body: {
      state: accepted.state as unknown as Record<string, unknown>,
      patch: accepted.patch as Record<string, unknown>
    }
  };
}

export function resolveStateContentType(req: Request): ContentType | null {
  const candidate = req?.query?.contentType;
  const parsed = ContentTypeSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}
