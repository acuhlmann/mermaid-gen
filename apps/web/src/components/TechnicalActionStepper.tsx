import { useEffect, useState } from 'react';
import { formatActionDurationMs } from '../utils/formatTechnicalActionDetail.js';

const PATCH_TOOL_RE = /patch|mermaid|infographic|chart|anything|metaphor/i;

type StageKind = 'inspect' | 'generate' | 'validate' | 'repair';

function stageMeta(name: string | undefined): {
  kind: StageKind;
  label: string;
  icon: string;
  runningLabel: string;
  doneLabel: string;
} {
  const toolName = name ?? '';
  if (/syntax|fix|repair/i.test(toolName)) {
    return {
      kind: 'repair',
      label: 'Repair',
      icon: '↻',
      runningLabel: 'Repairing output',
      doneLabel: 'Repair complete'
    };
  }
  if (PATCH_TOOL_RE.test(toolName)) {
    return {
      kind: 'validate',
      label: 'Validate & apply',
      icon: '✓',
      runningLabel: 'Validating update',
      doneLabel: 'Update accepted'
    };
  }
  if (/diagram|state|get_/i.test(toolName)) {
    return {
      kind: 'inspect',
      label: 'Inspect',
      icon: '⌕',
      runningLabel: 'Reading context',
      doneLabel: 'Context loaded'
    };
  }
  return {
    kind: 'generate',
    label: 'Generate',
    icon: '✦',
    runningLabel: 'Generating',
    doneLabel: 'Complete'
  };
}

function truncateValidationError(error: string, maxLen = 220): string {
  const trimmed = error.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen - 1)}…`;
}

type TechnicalAction = {
  id?: string;
  name?: string;
  label?: string;
  status?: string;
  validationError?: string;
  contextNote?: string;
  outcomeDetail?: string;
  durationMs?: number;
  startedAt?: number;
  patchStats?: {
    reason?: string;
    revisionId?: number;
    [key: string]: unknown;
  };
};

function useNowTicker(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

export default function TechnicalActionStepper({
  actions = [],
  collapsed = false
}: {
  actions?: TechnicalAction[];
  collapsed?: boolean;
}) {
  const now = useNowTicker(actions.some((action) => action.status === 'running'));
  if (!actions.length) {
    return <p className="insights-tech-empty">No technical actions yet.</p>;
  }

  const activeIndex = actions.findIndex((action) => action.status === 'running');
  const activeAction = activeIndex >= 0 ? actions[activeIndex] : null;
  const completedCount = actions.filter(
    (action) => action.status === 'done' || action.status === 'rejected'
  ).length;
  const rejectedCount = actions.filter((action) => action.status === 'rejected').length;
  const repairCount = actions.filter((action) => stageMeta(action.name).kind === 'repair').length;
  const elapsedStageMs = actions.reduce((total, action) => {
    if (Number.isFinite(action.durationMs)) return total + (action.durationMs as number);
    if (action.status === 'running' && Number.isFinite(action.startedAt)) {
      return total + Math.max(0, now - (action.startedAt as number));
    }
    return total;
  }, 0);
  const elapsedStageLabel = formatActionDurationMs(elapsedStageMs);
  const pipelineNeedsAttention = activeAction == null && actions.at(-1)?.status === 'rejected';
  const pipelineState =
    activeAction != null
      ? 'Pipeline active'
      : pipelineNeedsAttention
        ? 'Needs attention'
        : 'Pipeline complete';
  const pipelineHeadline =
    activeAction != null
      ? stageMeta(activeAction.name).runningLabel
      : pipelineNeedsAttention
        ? 'Validation needs another pass'
        : rejectedCount > 0
          ? 'Validation recovered'
          : 'Generation checks complete';

  const list = (
    <div className="insights-pipeline" data-testid="technical-action-stepper">
      <header className={`insights-pipeline-overview ${activeAction ? 'is-live' : ''}`}>
        <div className="insights-pipeline-overview-copy">
          <span className="insights-pipeline-kicker">
            <span className="insights-pipeline-live-dot" aria-hidden="true" />
            {pipelineState}
          </span>
          <strong className="insights-pipeline-headline">{pipelineHeadline}</strong>
        </div>
        {elapsedStageLabel ? (
          <span className="insights-pipeline-total-time" title="Cumulative time in observed stages">
            <span aria-hidden="true">◷</span>
            {elapsedStageLabel}
            <small> stage time</small>
          </span>
        ) : null}
        <div className="insights-pipeline-stats" aria-label="Generation pipeline summary">
          <span>{completedCount} finished</span>
          {rejectedCount > 0 ? (
            <span className="is-warning">
              {rejectedCount} {rejectedCount === 1 ? 'issue' : 'issues'}
            </span>
          ) : null}
          {repairCount > 0 ? (
            <span className="is-repair">
              {repairCount} {repairCount === 1 ? 'repair' : 'repairs'}
            </span>
          ) : null}
        </div>
        <div className="insights-pipeline-rail" aria-hidden="true">
          {actions.map((action, idx) => (
            <span
              key={`rail-${action.id ?? `${action.name}-${idx}`}`}
              className={`is-${action.status ?? 'pending'}`}
            />
          ))}
        </div>
      </header>

      <ol className="insights-tech-stepper">
        {actions.map((action, idx) => {
          const isRunning = action.status === 'running';
          const isRejected = action.status === 'rejected';
          const isDone = action.status === 'done' && !isRejected;
          const meta = stageMeta(action.name);
          const validationError =
            typeof action.validationError === 'string' ? action.validationError.trim() : '';
          const contextNote =
            typeof action.contextNote === 'string' ? action.contextNote.trim() : '';
          const outcomeDetail =
            typeof action.outcomeDetail === 'string' ? action.outcomeDetail.trim() : '';
          const reason =
            typeof action.patchStats?.reason === 'string' ? action.patchStats.reason.trim() : '';
          const durationLabel =
            action.status === 'running' && Number.isFinite(action.startedAt)
              ? formatActionDurationMs(now - (action.startedAt as number))
              : formatActionDurationMs(action.durationMs);
          const hasLaterStage = idx < actions.length - 1;
          const recoveryLabel = actions.slice(idx + 1).some((item) => item.status === 'running')
            ? 'Repairing now'
            : hasLaterStage
              ? 'Passed to recovery'
              : 'Awaiting retry';
          const statusLabel = isRejected
            ? 'Validation failed'
            : isRunning
              ? meta.runningLabel
              : isDone
                ? meta.doneLabel
                : 'Queued';
          return (
            <li
              key={action.id ?? `${action.name}-${idx}`}
              className={[
                'insights-tech-step',
                `is-${meta.kind}`,
                isRunning ? 'is-running' : '',
                isDone ? 'is-done' : '',
                isRejected ? 'is-rejected' : ''
              ]
                .filter(Boolean)
                .join(' ')}
              style={{ animationDelay: `${idx * 55}ms` }}
            >
              <span className="insights-tech-step-track" aria-hidden="true">
                <span className="insights-tech-step-index">{String(idx + 1).padStart(2, '0')}</span>
                <span className="insights-tech-step-track-line" />
              </span>
              <span className="insights-tech-step-glyph" aria-hidden="true">
                {meta.icon}
              </span>
              <span className="insights-tech-step-body">
                <span className="insights-tech-step-stage">{meta.label}</span>
                <span className="insights-tech-step-label-row">
                  <strong className="insights-tech-step-label">{action.label}</strong>
                  <span className={`insights-tech-step-status is-${action.status ?? 'pending'}`}>
                    {isRunning ? (
                      <span className="insights-tech-step-spinner" aria-hidden="true" />
                    ) : null}
                    {statusLabel}
                  </span>
                </span>
                {reason ? (
                  <span className="insights-tech-step-context" title={reason}>
                    <b>Intent</b>
                    {truncateValidationError(reason, 180)}
                  </span>
                ) : null}
                {contextNote ? (
                  <span className="insights-tech-step-context" title={contextNote}>
                    <b>Triggered by</b>
                    {truncateValidationError(contextNote, 180)}
                  </span>
                ) : null}
                {outcomeDetail ? (
                  <span className="insights-tech-step-detail" title={outcomeDetail}>
                    {truncateValidationError(outcomeDetail)}
                  </span>
                ) : null}
                {validationError ? (
                  <span className="insights-tech-step-error" title={validationError}>
                    <span className="insights-tech-step-error-heading">
                      <b>Validation feedback</b>
                      <em>{recoveryLabel}</em>
                    </span>
                    <code>{truncateValidationError(validationError)}</code>
                  </span>
                ) : null}
                <code className="insights-tech-step-name">{action.name}</code>
              </span>
              {durationLabel ? (
                <span
                  className={`insights-tech-step-duration ${isRunning ? 'is-live' : ''}`}
                  title={isRunning ? 'Elapsed stage time' : 'Stage duration'}
                >
                  {durationLabel}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );

  if (collapsed) {
    return <div className="insights-tech-details-inner">{list}</div>;
  }

  return list;
}
