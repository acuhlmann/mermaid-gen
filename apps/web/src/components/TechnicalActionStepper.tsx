const PATCH_TOOL_RE = /patch|mermaid|infographic/i;

function actionIcon(name: string | undefined): string {
  if (PATCH_TOOL_RE.test(name ?? '')) return '✂️';
  if (/syntax|fix|repair/i.test(name ?? '')) return '🔧';
  if (/diagram|state|get_/i.test(name ?? '')) return '📋';
  return '⚙️';
}

type TechnicalAction = {
  id?: string;
  name?: string;
  label?: string;
  status?: string;
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
        const isDone = action.status === 'done';
        const isPatch = PATCH_TOOL_RE.test(action.name ?? '');
        return (
          <li
            key={action.id ?? `${action.name}-${idx}`}
            className={[
              'insights-tech-step',
              isRunning ? 'is-running' : '',
              isDone ? 'is-done' : '',
              isPatch ? 'is-patch-tool' : ''
            ]
              .filter(Boolean)
              .join(' ')}
            style={{ animationDelay: `${idx * 40}ms` }}
          >
            <span className="insights-tech-step-icon" aria-hidden="true">
              {isDone ? '✓' : isRunning ? '◉' : '○'}
            </span>
            <span className="insights-tech-step-glyph" aria-hidden="true">
              {actionIcon(action.name)}
            </span>
            <span className="insights-tech-step-label">{action.label}</span>
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
