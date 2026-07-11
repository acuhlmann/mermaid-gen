/**
 * Legacy agent-stream event union (pre-AG-UI wire on the client, semantic emit on the server).
 * Consumed by `createAgentStreamEmitter` / `createAgUiTranslator` / `applyAgentStreamInsightEvent`.
 */

import type { ExplainContentType, ExplainSection } from './explainSections.js';
import type { StyleEdit } from './styleEdits.js';
import type { DiagramState } from './diagramSchema.js';
import { LEGACY_STREAM_TYPE_A2UI, LEGACY_STREAM_TYPE_PLAN_BEAT } from './agUiWireConstants.js';

/** A2UI v0.9 wire message (surface create / component update). */
export type A2uiV09Message = {
  createSurface?: { surfaceId?: string; catalogId?: string };
  updateComponents?: { surfaceId?: string; components?: unknown[] };
  [key: string]: unknown;
};

export type LegacyPhaseEvent = {
  type: 'phase';
  id: string;
  label: string;
  timestamp?: number;
};

/** Closes the phase opened by the matching `phase` event (wire STEP_FINISHED). */
export type LegacyPhaseEndEvent = {
  type: 'phase_end';
  id: string;
  timestamp?: number;
};

/** An LLM turn started inside the run (LangChain on_chat_model_start). */
export type LegacyModelCallStartEvent = {
  type: 'model_call_start';
  callId?: string;
  model?: string;
  timestamp?: number;
};

/** An LLM turn finished; token usage is best-effort (provider-dependent). */
export type LegacyModelCallEndEvent = {
  type: 'model_call_end';
  callId?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  timestamp?: number;
};

export type LegacyStatusEvent = {
  type: 'status';
  text: string;
  timestamp?: number;
};

export type LegacyPlanBeatEvent = {
  type: typeof LEGACY_STREAM_TYPE_PLAN_BEAT;
  text: string;
  source?: 'server' | 'agent';
  timestamp?: number;
};

export type LegacyTokenEvent = {
  type: 'token';
  text: string;
  timestamp?: number;
};

export type LegacyA2uiEvent = {
  type: typeof LEGACY_STREAM_TYPE_A2UI;
  messages: A2uiV09Message[];
  timestamp?: number;
};

export type LegacyPatchSummaryArtifact = {
  type: 'artifact';
  kind: 'patch_summary';
  revisionId: number;
  linesAdded?: number;
  linesRemoved?: number;
  timestamp?: number;
};

export type LegacyExplainSectionsArtifact = {
  type: 'artifact';
  kind: 'explain_sections';
  contentType?: ExplainContentType;
  preamble?: string;
  sections: ExplainSection[];
  timestamp?: number;
};

export type LegacyStyleEditsArtifact = {
  type: 'artifact';
  kind: 'style_edits';
  edits: StyleEdit[];
  timestamp?: number;
};

export type LegacyArtifactEvent =
  | LegacyPatchSummaryArtifact
  | LegacyExplainSectionsArtifact
  | LegacyStyleEditsArtifact
  | { type: 'artifact'; kind: string; timestamp?: number; [key: string]: unknown };

export type LegacyToolStartEvent = {
  type: 'tool_start';
  name: string;
  id?: string;
  timestamp?: number;
};

/** Structured patch outcome surfaced in the insights tool trace (success or rejection). */
export type ToolApplyResultSummary = {
  accepted: boolean;
  error?: string;
  revisionId?: number;
  reason?: string;
  validator?: string;
  sanitizerApplied?: string[];
  linesAdded?: number;
  linesRemoved?: number;
  nodesAdded?: number;
  nodesRemoved?: number;
  edgesAdded?: number;
  edgesRemoved?: number;
};

export type LegacyToolEndEvent = {
  type: 'tool_end';
  name: string;
  id?: string;
  applyResult?: ToolApplyResultSummary;
  timestamp?: number;
};

export type LegacyToolApplyResultEvent = {
  type: 'tool_apply_result';
  name: string;
  id?: string;
  accepted: boolean;
  error?: string;
  revisionId?: number;
  reason?: string;
  validator?: string;
  sanitizerApplied?: string[];
  linesAdded?: number;
  linesRemoved?: number;
  nodesAdded?: number;
  nodesRemoved?: number;
  edgesAdded?: number;
  edgesRemoved?: number;
  timestamp?: number;
};

export type LegacySyntaxFixerStartEvent = {
  type: 'syntax_fixer_start';
  contentType: string;
  triggerError?: string;
  timestamp?: number;
};

export type LegacySyntaxFixerResultEvent = {
  type: 'syntax_fixer_result';
  contentType: string;
  outcome: 'repaired' | 'fixer_failed' | 'store_rejected';
  error?: string;
  detail?: string;
  timestamp?: number;
};

export type LegacyDraftPreviewEvent = {
  type: 'draftPreview';
  contentType: 'mermaid' | 'infographic' | string;
  source?: string;
  delta?: string;
  accumulated?: string;
  timestamp?: number;
};

export type LegacyErrorEvent = {
  type: 'error';
  message: string;
  code?: string;
  timestamp?: number;
};

/** Terminal stream payload from RUN_FINISHED (legacy `final`). */
export type LegacyFinalEvent = {
  type: 'final';
  revisionChanged?: boolean;
  message?: string;
  analyzeText?: string;
  state?: DiagramState;
  timestamp?: number;
};

export type LegacyStreamEvent =
  | LegacyPhaseEvent
  | LegacyPhaseEndEvent
  | LegacyModelCallStartEvent
  | LegacyModelCallEndEvent
  | LegacyStatusEvent
  | LegacyPlanBeatEvent
  | LegacyTokenEvent
  | LegacyA2uiEvent
  | LegacyArtifactEvent
  | LegacyToolStartEvent
  | LegacyToolEndEvent
  | LegacyToolApplyResultEvent
  | LegacySyntaxFixerStartEvent
  | LegacySyntaxFixerResultEvent
  | LegacyDraftPreviewEvent
  | LegacyErrorEvent
  | LegacyFinalEvent
  | { type: string; timestamp?: number; [key: string]: unknown };

export function isLegacyStreamEvent(evt: unknown): evt is LegacyStreamEvent {
  return Boolean(
    evt && typeof evt === 'object' && typeof (evt as { type?: unknown }).type === 'string'
  );
}
