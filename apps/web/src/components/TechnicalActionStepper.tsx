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
};

export default function TechnicalActionStepper({
  actions = [],
  collapsed = false
}: {
  actions?: TechnicalAction[];
  collapsed?: boolean;
}) {
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
        const validationError =
          typeof action.validationError === 'string' ? action.validationError.trim() : '';
        return (
          <li
            key={action.id ?? `${action.name}-${idx}`}
            className={[
              'insights-tech-step',
              isRunning ? 'is-running' : '',
              isDone ? 'is-done' : '',
              isRejected ? 'is-rejected' : '',
              isPatch ? 'is-patch-tool' : ''
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
              <span className="insights-tech-step-label">{action.label}</span>
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
