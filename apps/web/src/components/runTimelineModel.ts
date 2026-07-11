/**
 * Pure derivation model for the unified run timeline: buckets plan beats and
 * technical actions into timed phase segments, computes per-step durations,
 * and prepares display copy. No React — `RunTimeline.tsx` is the view.
 */

import { formatActionDurationMs } from '../utils/formatTechnicalActionDetail.js';
import { summarizeInsightNowStatus } from '../utils/insightNowStatus.js';
import { phaseCeremonyLabel } from '../utils/slopitectCopy.js';
import type {
  InsightEntry,
  InsightPhase,
  InsightPlanBeat,
  InsightTechnicalAction
} from './insightsEntryTypes';

export const PHASE_ID_LABELS: Record<string, string> = {
  run_started: 'Start',
  planning: 'Plan',
  analyze: 'Analyze',
  analyze_stream: 'Stream',
  intent: 'Apply',
  agent_run: 'Tools',
  transform: 'Transform',
  syntax_fixer: 'Syntax',
  chart_syntax_fixer: 'Syntax',
  metaphor_syntax_fixer: 'Syntax',
  anything_syntax_fixer: 'Syntax',
  syntax_repair: 'Repair',
  patch_retry: 'Retry',
  invoke: 'Generate',
  invoke_fallback: 'Finalize',
  repair_1: 'Repair',
  repair_2: 'Repair',
  chart_transform: 'Transform',
  chart_style: 'Style',
  chart_analyze: 'Analyze',
  metaphor_transform: 'Transform',
  metaphor_analyze: 'Analyze',
  anything_transform: 'Transform',
  anything_analyze: 'Analyze',
  activity: 'Activity'
};

export const ACTION_KINDS = {
  model: 'model',
  fixer: 'fixer',
  patch: 'patch',
  inspect: 'inspect',
  tool: 'tool'
} as const;
export type ActionKind = keyof typeof ACTION_KINDS;

export type TimelineItem =
  | { kind: 'beat'; at: number; beat: InsightPlanBeat; beatIndex: number }
  | { kind: 'action'; at: number | null; action: InsightTechnicalAction; actionIndex: number };

export type TimelineSegment = {
  key: string;
  id: string;
  label: string;
  at: number | null;
  endAt: number | null;
  serverAt: number | null;
  serverEndAt: number | null;
  items: TimelineItem[];
  synthetic: boolean;
};

export const RUN_STATUSES = {
  running: 'running',
  done: 'done',
  failed: 'failed',
  cancelled: 'cancelled'
} as const;
export type RunStatus = keyof typeof RUN_STATUSES;

export const SEGMENT_STATES = {
  active: 'active',
  complete: 'complete',
  'failed-at': 'failed-at',
  'stopped-at': 'stopped-at'
} as const;
export type SegmentState = keyof typeof SEGMENT_STATES;

export type RunStats = {
  modelTurns: number;
  toolRuns: number;
  beats: number;
  repairs: number;
  issues: number;
};

export function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Ceremony label from the untyped slopitect copy module, coerced to a string. */
export function ceremonyLabelFor(variant: string, id: string, fallbackLabel: string): string {
  const custom: unknown = phaseCeremonyLabel(variant, id, fallbackLabel);
  return typeof custom === 'string' && custom ? custom : fallbackLabel;
}

export function actionKind(action: InsightTechnicalAction): ActionKind {
  const name = action.name ?? '';
  if (name === 'model_call') return 'model';
  if (/syntax|fix|repair/i.test(name)) return 'fixer';
  if (/patch/i.test(name)) return 'patch';
  if (/diagram|state|get_/i.test(name)) return 'inspect';
  return 'tool';
}

const ACTION_RUNNING_LABELS: Record<ActionKind, string> = {
  model: 'Reasoning…',
  fixer: 'Repairing',
  patch: 'Validating',
  inspect: 'Reading context',
  tool: 'Working'
};

const ACTION_DONE_LABELS: Record<ActionKind, string> = {
  model: 'Turn complete',
  fixer: 'Repair complete',
  patch: 'Update accepted',
  inspect: 'Context loaded',
  tool: 'Complete'
};

export function actionStatusLabel(
  action: InsightTechnicalAction,
  kind: ActionKind,
  runLive: boolean
): string {
  if (action.status === 'rejected') return 'Validation failed';
  if (action.status === 'running') return runLive ? ACTION_RUNNING_LABELS[kind] : 'Interrupted';
  if (action.status === 'done') return ACTION_DONE_LABELS[kind];
  return 'Queued';
}

export function truncateDetail(text: string, maxLen = 220): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen - 1)}…`;
}

/** Compact clock offset from run start (e.g. `+0:07`). */
export function formatRunOffset(startedAt: number | null, at: number | null): string {
  if (startedAt == null || at == null) return '';
  const seconds = Math.max(0, Math.floor((at - startedAt) / 1000));
  const mm = Math.floor(seconds / 60);
  const ss = String(seconds % 60).padStart(2, '0');
  return `+${mm}:${ss}`;
}

function toSegment(phase: InsightPhase | undefined, idx: number): TimelineSegment {
  const id = String(phase?.id ?? 'phase');
  return {
    key: `${id}-${idx}`,
    id,
    label: String(phase?.label ?? id),
    at: finiteOrNull(phase?.at),
    endAt: finiteOrNull(phase?.endAt),
    serverAt: finiteOrNull(phase?.serverAt),
    serverEndAt: finiteOrNull(phase?.serverEndAt),
    items: [],
    synthetic: false
  };
}

function sortSegmentItems(seg: TimelineSegment): void {
  seg.items.sort((a, b) => (a.at ?? Number.MAX_SAFE_INTEGER) - (b.at ?? Number.MAX_SAFE_INTEGER));
}

/**
 * Bucket every beat and technical action into its phase segment by arrival
 * time. Entries persisted before phases carried timestamps fall back to a
 * single synthetic "Run activity" segment appended after the phases.
 */
export function buildSegments(entry: InsightEntry): TimelineSegment[] {
  const phases = Array.isArray(entry.phases) ? entry.phases : [];
  const beats = Array.isArray(entry.planBeats) ? entry.planBeats : [];
  const actions = Array.isArray(entry.technicalActions) ? entry.technicalActions : [];

  const segments = phases.map(toSegment);
  const timedSegments = segments.filter((seg) => seg.at != null);
  let syntheticSegment: TimelineSegment | null = null;
  const ensureSyntheticSegment = (): TimelineSegment => {
    syntheticSegment ??= {
      key: 'activity',
      id: 'activity',
      label: 'Run activity',
      at: null,
      endAt: null,
      serverAt: null,
      serverEndAt: null,
      items: [],
      synthetic: true
    };
    return syntheticSegment;
  };

  const bucketFor = (at: number | null): TimelineSegment => {
    const lastTimed = timedSegments[timedSegments.length - 1];
    if (!lastTimed) return ensureSyntheticSegment();
    if (at == null) return lastTimed;
    let target: TimelineSegment | null = null;
    for (const seg of timedSegments) {
      if (seg.at != null && seg.at <= at) target = seg;
    }
    return target ?? timedSegments[0] ?? lastTimed;
  };

  beats.forEach((beat, beatIndex) => {
    if (!beat || !String(beat.text ?? '').trim()) return;
    const at = finiteOrNull(beat.at);
    bucketFor(at).items.push({ kind: 'beat', at: at ?? 0, beat, beatIndex });
  });
  actions.forEach((action, actionIndex) => {
    if (!action) return;
    const at = finiteOrNull(action.startedAt);
    bucketFor(at).items.push({ kind: 'action', at, action, actionIndex });
  });

  for (const seg of segments) sortSegmentItems(seg);
  if (syntheticSegment) {
    sortSegmentItems(syntheticSegment);
    return [...segments, syntheticSegment];
  }
  return segments;
}

/**
 * Time spent in one phase. Prefers the server's own emit timestamps (no
 * transport jitter), then client arrival bounds, then a live now-based tick
 * for the active segment.
 */
export function segmentDurationMs(
  seg: TimelineSegment,
  next: TimelineSegment | undefined,
  entry: InsightEntry,
  isLiveSegment: boolean,
  now: number
): number | null {
  if (seg.serverAt != null && seg.serverEndAt != null) {
    return Math.max(0, seg.serverEndAt - seg.serverAt);
  }
  if (seg.at == null) return null;
  if (seg.endAt != null) return Math.max(0, seg.endAt - seg.at);
  if (isLiveSegment) return Math.max(0, now - seg.at);
  if (next?.at != null) return Math.max(0, next.at - seg.at);
  const completedAt = finiteOrNull(entry.completedAt);
  if (completedAt != null) return Math.max(0, completedAt - seg.at);
  return null;
}

export function actionDurationMs(
  action: InsightTechnicalAction,
  runLive: boolean,
  now: number
): number | null {
  if (typeof action.durationMs === 'number' && Number.isFinite(action.durationMs)) {
    return action.durationMs;
  }
  if (
    action.status === 'running' &&
    runLive &&
    typeof action.startedAt === 'number' &&
    Number.isFinite(action.startedAt)
  ) {
    return Math.max(0, now - action.startedAt);
  }
  return null;
}

export function segmentStateFor(
  isLast: boolean,
  runStatus: RunStatus,
  runLive: boolean,
  responseActive: boolean
): SegmentState {
  if (runStatus === 'failed' && isLast) return 'failed-at';
  if (runStatus === 'cancelled' && isLast) return 'stopped-at';
  if (runLive && isLast && !responseActive) return 'active';
  return 'complete';
}

export function buildRunStats(entry: InsightEntry): RunStats {
  const actions = Array.isArray(entry.technicalActions) ? entry.technicalActions : [];
  const modelTurns = actions.filter((action) => actionKind(action) === 'model').length;
  const repairs = actions.filter((action) => actionKind(action) === 'fixer').length;
  return {
    modelTurns,
    repairs,
    issues: actions.filter((action) => action.status === 'rejected').length,
    toolRuns: actions.length - modelTurns - repairs,
    beats: Array.isArray(entry.planBeats) ? entry.planBeats.length : 0
  };
}

export type StatChip = { key: string; className?: string; text: string };

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

export function buildStatChips(segmentCount: number, stats: RunStats): StatChip[] {
  const chips: StatChip[] = [];
  if (segmentCount > 0) {
    chips.push({
      key: 'phases',
      text: `${segmentCount} ${pluralize(segmentCount, 'phase', 'phases')}`
    });
  }
  if (stats.modelTurns > 0) {
    chips.push({
      key: 'model',
      className: 'is-model',
      text: `${stats.modelTurns} model ${pluralize(stats.modelTurns, 'turn', 'turns')}`
    });
  }
  if (stats.toolRuns > 0) {
    chips.push({
      key: 'tools',
      text: `${stats.toolRuns} tool ${pluralize(stats.toolRuns, 'run', 'runs')}`
    });
  }
  if (stats.beats > 0) {
    chips.push({
      key: 'beats',
      className: 'is-beats',
      text: `${stats.beats} plan ${pluralize(stats.beats, 'beat', 'beats')}`
    });
  }
  if (stats.repairs > 0) {
    chips.push({
      key: 'repairs',
      className: 'is-repair',
      text: `${stats.repairs} ${pluralize(stats.repairs, 'repair', 'repairs')}`
    });
  }
  if (stats.issues > 0) {
    chips.push({
      key: 'issues',
      className: 'is-warning',
      text: `${stats.issues} ${pluralize(stats.issues, 'issue', 'issues')}`
    });
  }
  return chips;
}

export function runKicker(runStatus: RunStatus): string {
  if (runStatus === 'running') return 'Live activity';
  if (runStatus === 'failed') return 'Run issue';
  if (runStatus === 'cancelled') return 'Run stopped';
  return 'Run activity';
}

export function runHeadline({
  runStatus,
  responseActive,
  responseTitle,
  activeSegment,
  variant,
  issueCount
}: {
  runStatus: RunStatus;
  responseActive: boolean;
  responseTitle: string;
  activeSegment: TimelineSegment | null;
  variant: string;
  issueCount: number;
}): string {
  if (runStatus === 'running') {
    if (responseActive) return `${responseTitle}…`;
    if (activeSegment) return ceremonyLabelFor(variant, activeSegment.id, activeSegment.label);
    return 'Working…';
  }
  if (runStatus === 'failed') return 'Stopped on an issue';
  if (runStatus === 'cancelled') return 'Stopped by you';
  return issueCount > 0 ? 'Recovered and completed' : 'All steps complete';
}

export type ActionRowDetailData = {
  reason: string;
  contextNote: string;
  outcomeDetail: string;
  validationError: string;
  linesAdded: number;
  linesRemoved: number;
  showLinesBar: boolean;
};

export function deriveActionDetails(
  action: InsightTechnicalAction,
  kind: ActionKind
): ActionRowDetailData {
  const linesAdded = Number(action.patchStats?.linesAdded) || 0;
  const linesRemoved = Number(action.patchStats?.linesRemoved) || 0;
  return {
    reason: typeof action.patchStats?.reason === 'string' ? action.patchStats.reason.trim() : '',
    contextNote: typeof action.contextNote === 'string' ? action.contextNote.trim() : '',
    outcomeDetail: typeof action.outcomeDetail === 'string' ? action.outcomeDetail.trim() : '',
    validationError:
      typeof action.validationError === 'string' ? action.validationError.trim() : '',
    linesAdded,
    linesRemoved,
    showLinesBar: kind === 'patch' && (linesAdded > 0 || linesRemoved > 0)
  };
}

/** Root section class for the timeline (live/failure accents). */
export function timelineRootClass(runStatus: RunStatus, runLive: boolean): string {
  return [
    'run-timeline',
    runLive ? 'is-live' : '',
    runStatus === 'failed' ? 'is-failed' : '',
    runStatus === 'cancelled' ? 'is-cancelled' : ''
  ]
    .filter(Boolean)
    .join(' ');
}

export type RunTimelineView = {
  runStatus: RunStatus;
  runLive: boolean;
  segments: TimelineSegment[];
  startedAt: number | null;
  totalLabel: string;
  headline: string;
  statusText: string;
  statChips: StatChip[];
  /** Nothing to show: no segments, no response, run already over. */
  empty: boolean;
};

/** One-stop derivation of everything the RunTimeline view renders. */
export function deriveRunTimelineView(
  entry: InsightEntry,
  {
    variant,
    responseTitle,
    responseActive,
    hasResponse,
    now
  }: {
    variant: string;
    responseTitle: string;
    responseActive: boolean;
    hasResponse: boolean;
    now: number;
  }
): RunTimelineView {
  const runStatus = (entry.status ?? 'running') as RunStatus;
  const runLive = runStatus === 'running';
  const segments = buildSegments(entry);
  const startedAt = finiteOrNull(entry.startedAt);
  const completedAt = finiteOrNull(entry.completedAt);
  const totalMs = startedAt != null ? Math.max(0, (completedAt ?? now) - startedAt) : null;
  const stats = buildRunStats(entry);
  const activeSegment = runLive && !responseActive ? (segments[segments.length - 1] ?? null) : null;
  const statusText: string = summarizeInsightNowStatus(
    typeof entry.statusText === 'string' ? entry.statusText : '',
    entry
  );
  return {
    runStatus,
    runLive,
    segments,
    startedAt,
    totalLabel: totalMs != null ? formatActionDurationMs(totalMs) : '',
    headline: runHeadline({
      runStatus,
      responseActive,
      responseTitle,
      activeSegment,
      variant,
      issueCount: stats.issues
    }),
    statusText,
    statChips: buildStatChips(segments.length, stats),
    empty: segments.length === 0 && !hasResponse && !runLive
  };
}

/** Summary line for a folded run of technical steps (completed segments). */
export function foldSummaryLabel(
  run: { action: InsightTechnicalAction }[],
  runLive: boolean,
  now: number
): string {
  const rejected = run.filter((item) => item.action.status === 'rejected').length;
  const totalMs = run.reduce(
    (total, item) => total + (actionDurationMs(item.action, runLive, now) ?? 0),
    0
  );
  const durationLabel = formatActionDurationMs(totalMs);
  const bits = [
    `${run.length} technical ${pluralize(run.length, 'step', 'steps')}`,
    ...(rejected > 0 ? [`${rejected} ${pluralize(rejected, 'issue', 'issues')}`] : []),
    ...(durationLabel ? [durationLabel] : [])
  ];
  return bits.join(' · ');
}
