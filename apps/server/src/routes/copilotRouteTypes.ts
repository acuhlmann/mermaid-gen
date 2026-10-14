/**
 * Wire: Zod-inferred HTTP bodies for copilot route handlers.
 * Import types here when adding handlers; keep validation in route modules via shared schemas.
 */
import type { z } from 'zod';
import type {
  AgentResult,
  AgentStreamEmit,
  AgentStreamOperation,
  ApplyAnalyzeIntentInput,
  ApplyIntentInput,
  ApplyStyleIntentInput,
  ApplyTransformIntentInput,
  ContentType,
  DiagramAgentStreamPayload,
  DiagramState
} from '@archislop/shared';
import {
  AgentStreamPayloadSchema,
  DiagramAnalyzeSchema,
  DiagramIntentSchema,
  DiagramStyleSchema,
  DiagramTransformIntentSchema,
  StyleIntentSchema,
  UserDiagramEditSchema
} from '@archislop/shared';

export type DiagramIntentBody = z.infer<typeof DiagramIntentSchema>;
export type DiagramTransformIntentBody = z.infer<typeof DiagramTransformIntentSchema>;
export type DiagramAnalyzeBody = z.infer<typeof DiagramAnalyzeSchema>;
export type DiagramStyleBody = z.infer<typeof DiagramStyleSchema>;
export type StyleIntentBody = z.infer<typeof StyleIntentSchema>;
export type AgentStreamPayloadBody = z.infer<typeof AgentStreamPayloadSchema>;
export type UserDiagramEditBody = z.infer<typeof UserDiagramEditSchema>;

export {
  AgentStreamPayloadSchema,
  DiagramAnalyzeSchema,
  DiagramIntentSchema,
  DiagramStyleSchema,
  DiagramTransformIntentSchema,
  StyleIntentSchema,
  UserDiagramEditSchema
};

/** Shared result shape for route handlers that apply a diagram-source patch to a slot. */
export type ApplyStoreResult =
  { accepted: true; state: DiagramState; patch: unknown } | { accepted: false; error?: string };

export type JsonRouteResult = {
  status: number;
  body: Record<string, unknown>;
};

/** Dispatcher routes by contentType before delegating to per-slot agent services. */
export type CopilotAgentService = {
  applyIntent(input: ApplyIntentInput & { contentType: ContentType }): Promise<AgentResult>;
  applyTransformIntent(
    input: ApplyTransformIntentInput & { contentType: ContentType }
  ): Promise<AgentResult>;
  applyAnalyzeIntent(
    input: ApplyAnalyzeIntentInput & { contentType: ContentType }
  ): Promise<AgentResult>;
  applyStyleIntent(input: ApplyStyleIntentInput): Promise<AgentResult>;
  runAgentStream(
    operation: AgentStreamOperation,
    payload: DiagramAgentStreamPayload,
    emit: AgentStreamEmit
  ): Promise<AgentResult>;
};
