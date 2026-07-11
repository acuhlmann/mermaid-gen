/**
 * Unified live-activity timeline for a Thinking-pane entry (view layer).
 *
 * Merges every signal the server streams — run phases, plan beats, tool calls,
 * model turns, syntax-fixer passes, patch results — into one chronological rail
 * with live per-step timing. Content-domain beats stay visible; technical steps
 * fold into per-phase summaries once a phase completes. The streamed response
 * (children) renders as the final segment so the whole run reads as one story.
 * Derivation logic lives in `runTimelineModel.ts`.
 */

import { useEffect, useState, type ReactNode } from 'react';
import PlanBeatCard from './PlanBeatCard';
import { PatchLinesBar } from '../utils/thinkingProseEnrich';
import { formatActionDurationMs } from '../utils/formatTechnicalActionDetail.js';
import {
  PHASE_ID_LABELS,
  actionDurationMs,
  actionKind,
  actionStatusLabel,
  ceremonyLabelFor,
  deriveActionDetails,
  deriveRunTimelineView,
  foldSummaryLabel,
  formatRunOffset,
  runKicker,
  segmentDurationMs,
  segmentStateFor,
  timelineRootClass,
  truncateDetail,
  type ActionKind,
  type RunStatus,
  type SegmentState,
  type StatChip,
  type TimelineItem,
  type TimelineSegment
} from './runTimelineModel';
import type { InsightEntry, InsightTechnicalAction } from './insightsEntryTypes';

const ACTION_GLYPHS: Record<ActionKind, string> = {
  model: '✻',
  fixer: '↻',
  patch: '✓',
  inspect: '⌕',
  tool: '✦'
};

function useNowTicker(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

/** Detail lines under an action row: intent, trigger, outcome, lines bar, validation error. */
function ActionRowDetails({
  action,
  kind,
  showRawNames
}: {
  action: InsightTechnicalAction;
  kind: ActionKind;
  showRawNames: boolean;
}) {
  const details = deriveActionDetails(action, kind);
  return (
    <>
      {details.reason ? (
        <span className="run-timeline-action-note" title={details.reason}>
          <b>Intent</b>
          {truncateDetail(details.reason, 180)}
        </span>
      ) : null}
      {details.contextNote ? (
        <span className="run-timeline-action-note" title={details.contextNote}>
          <b>Triggered by</b>
          {truncateDetail(details.contextNote, 180)}
        </span>
      ) : null}
      {details.outcomeDetail ? (
        <span className="run-timeline-action-outcome" title={details.outcomeDetail}>
          {truncateDetail(details.outcomeDetail)}
        </span>
      ) : null}
      {details.showLinesBar ? (
        <span className="run-timeline-action-lines">
          <PatchLinesBar
            added={details.linesAdded}
            removed={details.linesRemoved}
            keyPrefix={`tl-${action.id ?? action.name ?? 'patch'}`}
          />
        </span>
      ) : null}
      {details.validationError ? (
        <span className="run-timeline-action-error">
          <b>Validation feedback</b>
          <code>{truncateDetail(details.validationError)}</code>
        </span>
      ) : null}
      {showRawNames && action.name ? (
        <code className="run-timeline-action-name">{action.name}</code>
      ) : null}
    </>
  );
}

function ActionRow({
  action,
  runLive,
  now,
  showRawNames
}: {
  action: InsightTechnicalAction;
  runLive: boolean;
  now: number;
  showRawNames: boolean;
}) {
  const kind = actionKind(action);
  const isRunning = action.status === 'running' && runLive;
  const durationLabel = formatActionDurationMs(actionDurationMs(action, runLive, now));

  return (
    <li
      className={[
        'run-timeline-action',
        `is-${kind}`,
        isRunning ? 'is-running' : '',
        action.status === 'done' ? 'is-done' : '',
        action.status === 'rejected' ? 'is-rejected' : ''
      ]
        .filter(Boolean)
        .join(' ')}
      data-testid="run-timeline-action"
    >
      <span className="run-timeline-action-glyph" aria-hidden="true">
        {ACTION_GLYPHS[kind]}
      </span>
      <span className="run-timeline-action-body">
        <span className="run-timeline-action-head">
          <strong className="run-timeline-action-label">{action.label ?? action.name}</strong>
          {action.modelName ? (
            <code className="run-timeline-action-model" title={action.modelName}>
              {action.modelName}
            </code>
          ) : null}
          <span className={`run-timeline-action-status is-${action.status ?? 'pending'}`}>
            {isRunning ? <span className="run-timeline-action-spinner" aria-hidden="true" /> : null}
            {actionStatusLabel(action, kind, runLive)}
          </span>
          {durationLabel ? (
            <span
              className={`run-timeline-action-duration ${isRunning ? 'is-live' : ''}`}
              title={isRunning ? 'Elapsed so far' : 'Step duration'}
            >
              {durationLabel}
            </span>
          ) : null}
        </span>
        <ActionRowDetails action={action} kind={kind} showRawNames={showRawNames} />
      </span>
    </li>
  );
}

function SegmentItems({
  items,
  variant,
  runLive,
  now,
  showRawNames,
  collapsed
}: {
  items: TimelineItem[];
  variant: string;
  runLive: boolean;
  now: number;
  showRawNames: boolean;
  collapsed: boolean;
}) {
  if (items.length === 0) return null;

  // Preserve chronology while letting beats stay visible when tech steps fold:
  // consecutive same-kind items render as one run.
  const runs: TimelineItem[][] = [];
  for (const item of items) {
    const current = runs[runs.length - 1];
    if (current && current[0] && current[0].kind === item.kind) {
      current.push(item);
    } else {
      runs.push([item]);
    }
  }

  return (
    <>
      {runs.map((run, runIdx) => {
        const first = run[0];
        if (!first) return null;
        if (first.kind === 'beat') {
          return (
            <ul
              key={`beats-${runIdx}`}
              className="insights-plan-list insights-plan-list-cards run-timeline-beats"
            >
              {run.map((item) =>
                item.kind === 'beat' ? (
                  <PlanBeatCard
                    key={`beat-${item.beatIndex}-${item.at}`}
                    beat={item.beat}
                    variant={variant}
                    index={item.beatIndex}
                  />
                ) : null
              )}
            </ul>
          );
        }
        const actionItems = run.filter(
          (item): item is Extract<TimelineItem, { kind: 'action' }> => item.kind === 'action'
        );
        const rows = actionItems.map((item) => (
          <ActionRow
            key={item.action.id ?? `action-${item.actionIndex}`}
            action={item.action}
            runLive={runLive}
            now={now}
            showRawNames={showRawNames}
          />
        ));
        if (!collapsed) {
          return (
            <ul key={`actions-${runIdx}`} className="run-timeline-actions">
              {rows}
            </ul>
          );
        }
        return (
          <details key={`actions-${runIdx}`} className="run-timeline-actions-fold">
            <summary>
              <span className="run-timeline-fold-marker" aria-hidden="true" />
              {foldSummaryLabel(actionItems, runLive, now)}
            </summary>
            <ul className="run-timeline-actions">{rows}</ul>
          </details>
        );
      })}
    </>
  );
}

function segmentGlyph(state: SegmentState): ReactNode {
  if (state === 'complete') {
    return (
      <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
        <path fill="currentColor" d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
      </svg>
    );
  }
  if (state === 'failed-at') {
    return (
      <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
        <path fill="currentColor" d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
      </svg>
    );
  }
  if (state === 'stopped-at') {
    return (
      <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
        <path fill="currentColor" d="M6 6h12v12H6V6z" />
      </svg>
    );
  }
  return <span className="run-timeline-node-pulse" aria-hidden="true" />;
}

const RAIL_CLASS_BY_STATE: Record<SegmentState, string> = {
  active: 'is-active',
  complete: 'is-done',
  'failed-at': 'is-failed',
  'stopped-at': 'is-stopped'
};

function TimelineOverview({
  segments,
  runStatus,
  runLive,
  responseActive,
  hasResponse,
  headline,
  totalLabel,
  statChips
}: {
  segments: TimelineSegment[];
  runStatus: RunStatus;
  runLive: boolean;
  responseActive: boolean;
  hasResponse: boolean;
  headline: string;
  totalLabel: string;
  statChips: StatChip[];
}) {
  return (
    <header className="run-timeline-overview">
      <div className="run-timeline-overview-copy">
        <span className="run-timeline-kicker">
          <span className="run-timeline-live-dot" aria-hidden="true" />
          {runKicker(runStatus)}
        </span>
        <strong className="run-timeline-headline">{headline}</strong>
      </div>
      {totalLabel ? (
        <span
          className={`run-timeline-total ${runLive ? 'is-live' : ''}`}
          title={runLive ? 'Elapsed run time' : 'Total run time'}
        >
          <span aria-hidden="true">◷</span>
          {totalLabel}
        </span>
      ) : null}
      <div className="run-timeline-stats" aria-label="Run summary">
        {statChips.map((chip) => (
          <span key={chip.key} className={chip.className}>
            {chip.text}
          </span>
        ))}
      </div>
      <div className="run-timeline-rail" aria-hidden="true">
        {segments.map((seg, idx) => {
          const state = segmentStateFor(
            idx === segments.length - 1,
            runStatus,
            runLive,
            responseActive
          );
          return <span key={`rail-${seg.key}`} className={RAIL_CLASS_BY_STATE[state]} />;
        })}
        {hasResponse ? (
          <span
            className={`is-response ${
              responseActive ? 'is-active' : runStatus === 'failed' ? 'is-failed' : 'is-done'
            }`}
          />
        ) : null}
      </div>
    </header>
  );
}

function PhaseSegment({
  seg,
  state,
  variant,
  showRawPhaseIds,
  offsetLabel,
  durationLabel,
  statusText,
  runLive,
  now
}: {
  seg: TimelineSegment;
  state: SegmentState;
  variant: string;
  showRawPhaseIds: boolean;
  offsetLabel: string;
  durationLabel: string;
  statusText: string;
  runLive: boolean;
  now: number;
}) {
  const isActive = state === 'active';
  return (
    <li
      className={`run-timeline-segment is-${state}`}
      data-testid="run-timeline-segment"
      data-phase-id={seg.id}
    >
      <span className="run-timeline-node" aria-hidden="true">
        {segmentGlyph(state)}
      </span>
      <div className="run-timeline-segment-body">
        <div className="run-timeline-segment-head">
          <span className="run-timeline-segment-label">
            {ceremonyLabelFor(variant, seg.id, seg.label)}
          </span>
          <span className="run-timeline-segment-chip" aria-hidden="true">
            {PHASE_ID_LABELS[seg.id] ?? seg.id}
          </span>
          {showRawPhaseIds ? (
            <code className="run-timeline-segment-id">{seg.id}</code>
          ) : (
            <span className="insights-visually-hidden">{seg.id}</span>
          )}
          {offsetLabel ? (
            <span className="run-timeline-segment-offset" title="Time from run start">
              {offsetLabel}
            </span>
          ) : null}
          {durationLabel ? (
            <span
              className={`run-timeline-segment-duration ${isActive ? 'is-live' : ''}`}
              title={isActive ? 'Time in this step so far' : 'Time spent in this step'}
            >
              {durationLabel}
            </span>
          ) : null}
        </div>
        {isActive && statusText ? <p className="run-timeline-segment-now">{statusText}</p> : null}
        <SegmentItems
          items={seg.items}
          variant={variant}
          runLive={runLive}
          now={now}
          showRawNames={showRawPhaseIds}
          collapsed={!isActive && state === 'complete'}
        />
      </div>
    </li>
  );
}

function ResponseSegment({
  responseActive,
  responseHead,
  responseTitle,
  children
}: {
  responseActive: boolean;
  responseHead: ReactNode;
  responseTitle: string;
  children: ReactNode;
}) {
  return (
    <li
      className={`run-timeline-segment is-response ${responseActive ? 'is-active' : 'is-complete'}`}
      data-testid="run-timeline-response"
    >
      <span className="run-timeline-node" aria-hidden="true">
        {responseActive ? <span className="run-timeline-node-pulse" /> : segmentGlyph('complete')}
      </span>
      <div className="run-timeline-segment-body">
        <div className="run-timeline-segment-head">
          {responseHead ?? <span className="run-timeline-segment-label">{responseTitle}</span>}
        </div>
        <div className="run-timeline-response-body">{children}</div>
      </div>
    </li>
  );
}

function TerminalRow({ runStatus, totalLabel }: { runStatus: RunStatus; totalLabel: string }) {
  const state: SegmentState =
    runStatus === 'failed' ? 'failed-at' : runStatus === 'cancelled' ? 'stopped-at' : 'complete';
  const label =
    runStatus === 'failed' ? 'Ended with an issue' : runStatus === 'cancelled' ? 'Stopped' : 'Done';
  return (
    <li className={`run-timeline-terminal is-${runStatus}`} data-testid="run-timeline-terminal">
      <span className="run-timeline-node" aria-hidden="true">
        {segmentGlyph(state)}
      </span>
      <span className="run-timeline-terminal-label">
        {label}
        {totalLabel ? <em> · {totalLabel}</em> : null}
      </span>
    </li>
  );
}

export default function RunTimeline({
  entry,
  variant = 'general',
  showRawPhaseIds = false,
  responseTitle = 'Content updates',
  responseHead = null,
  hasResponse = false,
  responseActive = false,
  children = null
}: {
  entry: InsightEntry;
  variant?: string;
  showRawPhaseIds?: boolean;
  responseTitle?: string;
  /** Custom head (e.g. the accent variant title) rendered instead of `responseTitle`. */
  responseHead?: ReactNode;
  hasResponse?: boolean;
  responseActive?: boolean;
  children?: ReactNode;
}) {
  const now = useNowTicker((entry.status ?? 'running') === 'running');
  const view = deriveRunTimelineView(entry, {
    variant,
    responseTitle,
    responseActive,
    hasResponse,
    now
  });
  const { runStatus, runLive, segments, startedAt, totalLabel, headline, statusText, statChips } =
    view;

  if (view.empty) return null;

  return (
    <section
      className={timelineRootClass(runStatus, runLive)}
      aria-label="Run activity timeline"
      data-testid="run-timeline"
    >
      <TimelineOverview
        segments={segments}
        runStatus={runStatus}
        runLive={runLive}
        responseActive={responseActive}
        hasResponse={hasResponse}
        headline={headline}
        totalLabel={totalLabel}
        statChips={statChips}
      />

      <ol className="run-timeline-track">
        {segments.map((seg, idx) => {
          const state = segmentStateFor(
            idx === segments.length - 1,
            runStatus,
            runLive,
            responseActive
          );
          return (
            <PhaseSegment
              key={seg.key}
              seg={seg}
              state={state}
              variant={variant}
              showRawPhaseIds={showRawPhaseIds}
              offsetLabel={formatRunOffset(startedAt, seg.at)}
              durationLabel={formatActionDurationMs(
                segmentDurationMs(seg, segments[idx + 1], entry, state === 'active', now)
              )}
              statusText={statusText}
              runLive={runLive}
              now={now}
            />
          );
        })}

        {hasResponse ? (
          <ResponseSegment
            responseActive={responseActive}
            responseHead={responseHead}
            responseTitle={responseTitle}
          >
            {children}
          </ResponseSegment>
        ) : null}

        {!runLive ? <TerminalRow runStatus={runStatus} totalLabel={totalLabel} /> : null}
      </ol>
    </section>
  );
}
