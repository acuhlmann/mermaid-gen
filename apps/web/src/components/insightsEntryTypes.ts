/**
 * Insight pane entry shapes (extracted from InsightsPane for typed consumers).
 */

import type { A2uiV09Message, ExplainSection, StyleEdit } from '@archislop/shared';

export type InsightPlanBeat = {
  text: string;
  source: 'server' | 'agent';
  at: number;
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
  phases?: { id: string; label: string }[];
  planBeats?: InsightPlanBeat[];
  artifacts?: InsightArtifactPatchSummary[];
  explainSections?: {
    contentType?: 'mermaid' | 'infographic';
    preamble?: string;
    sections?: ExplainSection[];
  };
  styleEdits?: StyleEdit[];
  a2uiMessages?: A2uiV09Message[];
  styleEditsA2uiMessages?: A2uiV09Message[];
  [key: string]: unknown;
};
