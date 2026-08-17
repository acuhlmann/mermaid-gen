/**
 * Wire: Zod-inferred HTTP bodies for copilot route handlers.
 * Import types here when adding handlers; keep validation in route modules via shared schemas.
 */
import type { z } from 'zod';
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
