import { useEffect, useState } from 'react';
import { formatActionDurationMs } from '../utils/formatTechnicalActionDetail.js';

const PATCH_TOOL_RE = /patch|mermaid|infographic|chart|anything|metaphor/i;

function actionIcon(name: string | undefined): string {
  if (PATCH_TOOL_RE.test(name ?? '')) return '✂️';
  if (/syntax|fix|repair/i.test(name ?? '')) return '🔧';
  if (/diagram|state|get_/i.test(name ?? '')) return '📋';
  return '⚙️';
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

  const list = (
    <ol className="insights-tech-stepper" data-testid="technical-action-stepper">
      {actions.map((action, idx) => {
        const isRunning = action.status === 'running';
        const isRejected = action.status === 'rejected';
        const isDone = action.status === 'done' && !isRejected;
        const isPatch = PATCH_TOOL_RE.test(action.name ?? '');
        const isSyntaxFixer = action.name === 'syntax_fixer';
        const validationError =
          typeof action.validationError === 'string' ? action.validationError.trim() : '';
        const contextNote = typeof action.contextNote === 'string' ? action.contextNote.trim() : '';
        const outcomeDetail =
          typeof action.outcomeDetail === 'string' ? action.outcomeDetail.trim() : '';
        const reason =
          typeof action.patchStats?.reason === 'string' ? action.patchStats.reason.trim() : '';
        const durationLabel =
          action.status === 'running' && Number.isFinite(action.startedAt)
            ? formatActionDurationMs(now - (action.startedAt as number))
            : formatActionDurationMs(action.durationMs);
        return (
          <li
            key={action.id ?? `${action.name}-${idx}`}
            className={[
              'insights-tech-step',
              isRunning ? 'is-running' : '',
              isDone ? 'is-done' : '',
              isRejected ? 'is-rejected' : '',
              isPatch ? 'is-patch-tool' : '',
              isSyntaxFixer ? 'is-syntax-fixer' : ''
            ]
              .filter(Boolean)
              .join(' ')}
            style={{ animationDelay: `${idx * 40}ms` }}
          >
            <span className="insights-tech-step-icon" aria-hidden="true">
              {isRejected ? '✗' : isDone ? '✓' : isRunning ? '◉' : '○'}
            </span>
            <span className="insights-tech-step-glyph" aria-hidden="true">
              {actionIcon(action.name)}
            </span>
            <span className="insights-tech-step-body">
              <span className="insights-tech-step-label-row">
                <span className="insights-tech-step-label">{action.label}</span>
                {durationLabel ? (
                  <span className="insights-tech-step-duration" title="Tool duration">
                    {durationLabel}
                  </span>
                ) : null}
              </span>
              {reason ? (
                <span className="insights-tech-step-context" title={reason}>
                  {truncateValidationError(reason, 180)}
                </span>
              ) : null}
              {contextNote ? (
                <span className="insights-tech-step-context" title={contextNote}>
                  After: {truncateValidationError(contextNote, 180)}
                </span>
              ) : null}
              {outcomeDetail ? (
                <span className="insights-tech-step-detail" title={outcomeDetail}>
                  {truncateValidationError(outcomeDetail)}
                </span>
              ) : null}
              {validationError ? (
                <span className="insights-tech-step-error" title={validationError}>
                  {truncateValidationError(validationError)}
                </span>
              ) : null}
            </span>
            <code className="insights-tech-step-name">{action.name}</code>
          </li>
        );
      })}
    </ol>
  );

  if (collapsed) {
    return <div className="insights-tech-details-inner">{list}</div>;
  }

  return list;
}
