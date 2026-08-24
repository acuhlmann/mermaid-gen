/**
 * Canvas graph edit: `POST /api/copilotkit/user-edit` — a point-and-click Add/Delete/Rename/Link
 * on the canvas rewrites the slot's DSL client-side and lands here as an `origin: user` patch.
 * See docs/canvas-graph-edit.md. Split out of copilot.ts (ADR-0005 / balanced-coupling-priorities §5
 * "copilot.ts → route modules by concern") as the smallest slice that clears the file's ratchet
 * violation (#381) without reorganising the rest of the router.
 */
import type { ContentType } from '@archislop/shared';
import { ContentTypeSchema } from '@archislop/shared';
import type { Request } from 'express';
import {
  UserDiagramEditSchema,
  type ApplyStoreResult,
  type JsonRouteResult
} from './copilotRouteTypes.js';
import type { DiagramStateStore } from '../state/diagramStateStore.js';

type UserEditHandlerDeps = {
  body: unknown;
  stateStore: DiagramStateStore;
};

export async function handleUserDiagramEdit({
  body,
  stateStore
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
          'Canvas graph edits support mermaid, infographic, metaphor3d (tree/city/garden), and chart values'
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
