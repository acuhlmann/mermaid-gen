/**
 * Insight pane entry shapes (extracted from InsightsPane for typed consumers).
 */

import type { A2uiV09Message, ExplainSection, StyleEdit } from '@archislop/shared';

export type InsightPlanBeat = {
  text: string;
  source: 'server' | 'agent';
  at: number;
};

/**
 * One run phase in an insight entry. `at`/`endAt` are client arrival times;
 * `serverAt`/`serverEndAt` mirror the server's emit timestamps when the wire
 * carried them (preferred for durations — no transport jitter).
 */
export type InsightPhase = {
  id: string;
  label: string;
  at?: number;
  endAt?: number;
  serverAt?: number;
  serverEndAt?: number;
};

/** One technical action (tool call, model turn, syntax fixer pass) in an entry. */
export type InsightTechnicalAction = {
  id?: string;
  name?: string;
  label?: string;
  status?: string;
  toolCallId?: string;
  modelName?: string;
  validationError?: string;
  contextNote?: string;
  outcomeDetail?: string;
  durationMs?: number;
  startedAt?: number;
  patchStats?: {
    reason?: string;
    revisionId?: number;
    linesAdded?: number;
    linesRemoved?: number;
    [key: string]: unknown;
  };
};

export type InsightArtifactPatchSummary = {
  kind: 'patch_summary';
  revisionId: number;
  linesAdded?: number;
  linesRemoved?: number;
};

export type InsightEntry = {
  id?: string;
  content?: string;
  status?: string;
  statusText?: string;
  phases?: InsightPhase[];
  planBeats?: InsightPlanBeat[];
  technicalActions?: InsightTechnicalAction[];
  artifacts?: InsightArtifactPatchSummary[];
  explainSections?: {
    contentType?: 'mermaid' | 'infographic';
    preamble?: string;
    sections?: ExplainSection[];
  };
  styleEdits?: StyleEdit[];
  a2uiMessages?: A2uiV09Message[];
  styleEditsA2uiMessages?: A2uiV09Message[];
  /** Rolling sum of per-model-call USD estimates when deployed cost tracking is on. */
  estimatedCostUsd?: number;
  [key: string]: unknown;
};
