import { useEffect, useState } from 'react';
import { formatActionDurationMs } from '../utils/formatTechnicalActionDetail.js';

const PATCH_TOOL_RE = /patch|mermaid|infographic|chart|anything|metaphor/i;

type StageKind = 'inspect' | 'generate' | 'validate' | 'repair';

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

type StageMeta = {
  kind: StageKind;
  label: string;
  icon: string;
  runningLabel: string;
  doneLabel: string;
};

function stageMeta(name: string | undefined): StageMeta {
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

function useNowTicker(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

function actionDurationMs(action: TechnicalAction, now: number): number | null {
  const durationMs = action.durationMs;
  if (typeof durationMs === 'number' && Number.isFinite(durationMs)) {
    return durationMs;
  }
  const startedAt = action.startedAt;
  if (
    action.status === 'running' &&
    typeof startedAt === 'number' &&
    Number.isFinite(startedAt)
  ) {
    return Math.max(0, now - startedAt);
  }
  return null;
}

function actionStatusLabel(action: TechnicalAction, meta: StageMeta): string {
  if (action.status === 'rejected') return 'Validation failed';
  if (action.status === 'running') return meta.runningLabel;
  if (action.status === 'done') return meta.doneLabel;
  return 'Queued';
}

function recoveryStatus(actions: TechnicalAction[], index: number): string {
  if (actions.slice(index + 1).some((item) => item.status === 'running')) return 'Repairing now';
  if (index < actions.length - 1) return 'Passed to recovery';
  return 'Awaiting retry';
}

function PipelineOverview({
  actions,
  activeAction,
  now
}: {
  actions: TechnicalAction[];
  activeAction: TechnicalAction | null;
  now: number;
}) {
  const completedCount = actions.filter(
    (action) => action.status === 'done' || action.status === 'rejected'
  ).length;
  const rejectedCount = actions.filter((action) => action.status === 'rejected').length;
  const repairCount = actions.filter((action) => stageMeta(action.name).kind === 'repair').length;
  const elapsedStageMs = actions.reduce(
    (total, action) => total + (actionDurationMs(action, now) ?? 0),
    0
  );
  const elapsedStageLabel = formatActionDurationMs(elapsedStageMs);
  const needsAttention = activeAction == null && actions.at(-1)?.status === 'rejected';
  let pipelineState = 'Pipeline complete';
  let pipelineHeadline = rejectedCount > 0 ? 'Validation recovered' : 'Generation checks complete';
  if (needsAttention) {
    pipelineState = 'Needs attention';
    pipelineHeadline = 'Validation needs another pass';
  } else if (activeAction) {
    pipelineState = 'Pipeline active';
    pipelineHeadline = stageMeta(activeAction.name).runningLabel;
  }

  return (
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
        {actions.map((action, index) => (
          <span
            key={`rail-${action.id ?? `${action.name}-${index}`}`}
            className={`is-${action.status ?? 'pending'}`}
          />
        ))}
      </div>
    </header>
  );
}

function TechnicalActionDetail({
  action,
  actions,
  index
}: {
  action: TechnicalAction;
  actions: TechnicalAction[];
  index: number;
}) {
  const validationError =
    typeof action.validationError === 'string' ? action.validationError.trim() : '';
  const contextNote = typeof action.contextNote === 'string' ? action.contextNote.trim() : '';
  const outcomeDetail = typeof action.outcomeDetail === 'string' ? action.outcomeDetail.trim() : '';
  const reason =
    typeof action.patchStats?.reason === 'string' ? action.patchStats.reason.trim() : '';
  return (
    <>
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
            <em>{recoveryStatus(actions, index)}</em>
          </span>
          <code>{truncateValidationError(validationError)}</code>
        </span>
      ) : null}
    </>
  );
}

function TechnicalActionStep({
  action,
  actions,
  index,
  now
}: {
  action: TechnicalAction;
  actions: TechnicalAction[];
  index: number;
  now: number;
}) {
  const meta = stageMeta(action.name);
  const isRunning = action.status === 'running';
  const isRejected = action.status === 'rejected';
  const isDone = action.status === 'done';
  const durationLabel = formatActionDurationMs(actionDurationMs(action, now));

  return (
    <li
      className={[
        'insights-tech-step',
        `is-${meta.kind}`,
        isRunning ? 'is-running' : '',
        isDone ? 'is-done' : '',
        isRejected ? 'is-rejected' : ''
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ animationDelay: `${index * 55}ms` }}
    >
      <span className="insights-tech-step-track" aria-hidden="true">
        <span className="insights-tech-step-index">{String(index + 1).padStart(2, '0')}</span>
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
            {isRunning ? <span className="insights-tech-step-spinner" aria-hidden="true" /> : null}
            {actionStatusLabel(action, meta)}
          </span>
        </span>
        <TechnicalActionDetail action={action} actions={actions} index={index} />
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
  const activeAction = actions.find((action) => action.status === 'running') ?? null;
  const list = (
    <div className="insights-pipeline" data-testid="technical-action-stepper">
      <PipelineOverview actions={actions} activeAction={activeAction} now={now} />
      <ol className="insights-tech-stepper">
        {actions.map((action, index) => (
          <TechnicalActionStep
            key={action.id ?? `${action.name}-${index}`}
            action={action}
            actions={actions}
            index={index}
            now={now}
          />
        ))}
      </ol>
    </div>
  );
  return collapsed ? <div className="insights-tech-details-inner">{list}</div> : list;
}
