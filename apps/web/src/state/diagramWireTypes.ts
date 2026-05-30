/**
 * Wire: Zod-inferred HTTP bodies for copilot/diagram API calls from the web client.
 * Validation stays in route handlers and `sanitizeAgentStreamPayload` at send time.
 */
import type { z } from 'zod';
import {
  AgentStreamPayloadSchema,
  DiagramAnalyzeSchema,
  DiagramIntentSchema,
  DiagramStyleSchema,
  DiagramTransformIntentSchema,
  StyleIntentSchema
} from '@archislop/shared';

export type DiagramIntentBody = z.infer<typeof DiagramIntentSchema>;
export type DiagramTransformIntentBody = z.infer<typeof DiagramTransformIntentSchema>;
export type DiagramAnalyzeBody = z.infer<typeof DiagramAnalyzeSchema>;
export type DiagramStyleBody = z.infer<typeof DiagramStyleSchema>;
export type StyleIntentBody = z.infer<typeof StyleIntentSchema>;
export type AgentStreamPayloadBody = z.infer<typeof AgentStreamPayloadSchema>;

export {
  AgentStreamPayloadSchema,
  DiagramAnalyzeSchema,
  DiagramIntentSchema,
  DiagramStyleSchema,
  DiagramTransformIntentSchema,
  StyleIntentSchema
};
